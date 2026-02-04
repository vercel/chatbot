import Kernel from '@onkernel/sdk';
import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';
import { logger } from './logger';

const kernel = new Kernel();

// Initialize Redis for distributed session storage
// This is critical for Cloud Run where multiple instances may handle requests
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const REDIS_KEY_PREFIX = 'kernel-browser:';
const BROWSER_TTL_SECONDS = 10 * 60; // 10 minutes
const LOCK_KEY_PREFIX = 'kernel-browser-lock:';
const LOCK_TTL_SECONDS = 120; // Long enough for Kernel API call to complete
const LOCK_RETRY_DELAY_MS = 200;
const LOCK_MAX_WAIT_MS = 10_000; // Fail fast so callers can surface an error
const PENDING_POLL_INTERVAL_MS = 250;
const PENDING_MAX_WAIT_MS = 10_000;
const AGENT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes without tool usage
const LIVE_VIEW_HEARTBEAT_TIMEOUT_MS = 60 * 1000; // 60 seconds without heartbeat

interface KernelBrowser {
  session_id: string;
  cdp_ws_url: string;
  browser_live_view_url: string;
}

interface KernelBrowserEntry {
  browser: KernelBrowser;
  userId: string; // Owner of this browser session - CRITICAL for isolation
  lastAccessedAt: number;
  lastAgentActivityAt: number;
  liveViewConnections: number;
  lastLiveViewHeartbeatAt: number | null;
}

type KernelBrowserRedisValue =
  | KernelBrowserEntry
  | {
      status: 'pending';
      lastAccessedAt: number;
    };

// In-memory pending creations map (per-instance only, for race condition prevention)
// This is fine to be in-memory since it's only for preventing duplicate creations
// within the same instance during the brief creation window
const globalForKernel = globalThis as typeof globalThis & {
  kernelPendingCreations?: Map<string, Promise<KernelBrowser>>;
};

if (!globalForKernel.kernelPendingCreations) {
  globalForKernel.kernelPendingCreations = new Map<string, Promise<KernelBrowser>>();
}

const pendingCreations = globalForKernel.kernelPendingCreations;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getRedisKey(sessionId: string): string {
  return `${REDIS_KEY_PREFIX}${sessionId}`;
}

function getLockKey(sessionId: string): string {
  return `${LOCK_KEY_PREFIX}${sessionId}`;
}

function isBrowserEntry(
  value: KernelBrowserRedisValue | null
): value is KernelBrowserEntry {
  return !!value && 'browser' in value;
}

function isPendingEntry(value: KernelBrowserRedisValue | null): boolean {
  return !!value && 'status' in value && value.status === 'pending';
}

function hasRecentAgentActivity(entry: KernelBrowserEntry): boolean {
  return Date.now() - entry.lastAgentActivityAt <= AGENT_IDLE_TIMEOUT_MS;
}

function hasActiveLiveView(entry: KernelBrowserEntry): boolean {
  if (entry.liveViewConnections <= 0 || entry.lastLiveViewHeartbeatAt == null) {
    return false;
  }
  return Date.now() - entry.lastLiveViewHeartbeatAt <= LIVE_VIEW_HEARTBEAT_TIMEOUT_MS;
}

/**
 * Determines if a browser entry should be deleted from our Redis state.
 *
 * IMPORTANT: We only expire based on agent activity, NOT live view connection.
 * Kernel handles browser deletion via timeout when no CDP/live view connections exist.
 *
 * Our job: Delete the Redis entry when agent is idle for 5 minutes.
 * This allows the client to disconnect the live view iframe, which triggers
 * Kernel's own timeout mechanism to delete the actual browser instance.
 */
function isEntryExpired(entry: KernelBrowserEntry): boolean {
  return !hasRecentAgentActivity(entry);
}

async function persistEntry(
  sessionId: string,
  entry: KernelBrowserEntry,
  userId?: string
): Promise<KernelBrowserEntry> {
  const redisKey = getRedisKey(sessionId);
  const updated: KernelBrowserEntry = {
    ...entry,
    userId: userId || entry.userId, // Preserve or update userId
    lastAccessedAt: Date.now(),
  };
  await redis.set(redisKey, updated, { ex: BROWSER_TTL_SECONDS });
  console.log(`[Kernel] Persisted browser entry for session ${sessionId}, user ${updated.userId}`);
  return updated;
}

async function loadBrowserEntry(sessionId: string): Promise<KernelBrowserEntry | null> {
  const entry = await redis.get<KernelBrowserRedisValue>(getRedisKey(sessionId));
  return isBrowserEntry(entry) ? entry : null;
}

async function updateBrowserEntry(
  sessionId: string,
  updater: (entry: KernelBrowserEntry) => KernelBrowserEntry | null
): Promise<KernelBrowserEntry | null> {
  const current = await loadBrowserEntry(sessionId);
  if (!current) {
    return null;
  }

  const updated = updater({ ...current });
  if (!updated) {
    return null;
  }

  return persistEntry(sessionId, updated);
}

async function maybeExpireSession(
  sessionId: string,
  entry: KernelBrowserEntry
): Promise<boolean> {
  if (!isEntryExpired(entry)) {
    return false;
  }

  await deleteKernelBrowser(sessionId, entry);
  return true;
}

async function acquireDistributedLock(sessionId: string, userId: string): Promise<string> {
  const lockKey = getLockKey(sessionId);
  const token = randomUUID();
  const startTime = Date.now();
  const deadline = startTime + LOCK_MAX_WAIT_MS;
  let retryCount = 0;

  while (Date.now() < deadline) {
    const result = await redis.set(lockKey, token, {
      nx: true,
      ex: LOCK_TTL_SECONDS,
    });

    if (result === 'OK') {
      const waitMs = Date.now() - startTime;
      logger.lockAcquired({
        sessionId,
        userId,
        operation: 'acquireLock',
        lockWaitMs: waitMs,
        retryCount,
      });
      return token;
    }

    retryCount++;

    // Before sleeping, check if another instance finished creating the browser
    const existing = await redis.get<KernelBrowserRedisValue>(getRedisKey(sessionId));
    if (isBrowserEntry(existing)) {
      logger.info('Another instance created browser while waiting for lock', {
        sessionId,
        userId,
        operation: 'acquireLock',
        lockWaitMs: Date.now() - startTime,
        retryCount,
      });
      throw new Error('browser-exists-after-lock'); // Signal caller to re-fetch
    }

    await sleep(LOCK_RETRY_DELAY_MS);
  }

  const totalWaitMs = Date.now() - startTime;
  logger.lockTimeout({
    sessionId,
    userId,
    operation: 'acquireLock',
    lockWaitMs: totalWaitMs,
    retryCount,
  });
  throw new Error(`Failed to acquire browser creation lock after ${totalWaitMs}ms and ${retryCount} retries`);
}

async function releaseDistributedLock(sessionId: string, token: string) {
  const lockKey = getLockKey(sessionId);
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  try {
    await redis.eval(script, [lockKey], [token]);
  } catch (error) {
    console.error('[Kernel] Failed to release distributed lock:', error);
  }
}

/**
 * Atomically check if a browser exists and verify userId ownership.
 * Uses standard Redis GET with validation - Upstash REST API compatible.
 * Returns the existing browser if it belongs to the user, null otherwise.
 */
async function atomicCheckAndClaimBrowser(
  sessionId: string,
  userId: string
): Promise<KernelBrowserEntry | null> {
  const entry = await loadBrowserEntry(sessionId);

  if (!entry) {
    return null;
  }

  // CRITICAL: Verify ownership
  if (entry.userId !== userId) {
    logger.securityViolation({
      sessionId,
      userId,
      expectedUserId: entry.userId,
      actualUserId: userId,
      operation: 'atomicCheckAndClaim',
      securityEvent: 'cross_user_session_access_attempt',
    });
    throw new Error(
      `Session ${sessionId} belongs to a different user. This browser session cannot be shared.`
    );
  }

  // Check if expired
  const expired = await maybeExpireSession(sessionId, entry);
  if (expired) {
    logger.browserExpired({
      sessionId,
      userId,
      operation: 'atomicCheckAndClaim',
      browserSessionId: entry.browser.session_id,
    });
    return null;
  }

  // Refresh and return
  const refreshed = await persistEntry(sessionId, entry, userId);
  logger.browserReused({
    sessionId,
    userId,
    operation: 'atomicCheckAndClaim',
    browserSessionId: refreshed.browser.session_id,
  });
  return refreshed;
}

async function waitForPendingBrowser(sessionId: string): Promise<KernelBrowser | null> {
  const deadline = Date.now() + PENDING_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const entry = await loadBrowserEntry(sessionId);
    if (entry) {
      const expired = await maybeExpireSession(sessionId, entry);
      if (expired) {
        return null;
      }
      const refreshed = await persistEntry(sessionId, entry);
      console.log(
        `[Kernel] Observed browser creation completion for session ${sessionId}: ${refreshed.browser.session_id}`
      );
      return refreshed.browser;
    }

    const marker = await redis.get<KernelBrowserRedisValue>(getRedisKey(sessionId));
    if (!isPendingEntry(marker)) {
      return null;
    }

    await sleep(PENDING_POLL_INTERVAL_MS);
  }

  return null;
}

export async function createKernelBrowser(
  sessionId: string,
  userId: string,
  options?: { isMobile?: boolean }
): Promise<KernelBrowser> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session isolation');
  }

  console.log(`[Kernel] createKernelBrowser called for session ${sessionId}, user ${userId}`);

  const redisKey = getRedisKey(sessionId);

  // Check if browser already exists in Redis with ATOMIC ownership verification
  const existingEntry = await atomicCheckAndClaimBrowser(sessionId, userId);
  if (existingEntry) {
    return existingEntry.browser;
  }

  const pendingMarker = await redis.get<KernelBrowserRedisValue>(redisKey);
  if (isPendingEntry(pendingMarker)) {
    const pendingBrowser = await waitForPendingBrowser(sessionId);
    if (pendingBrowser) {
      return pendingBrowser;
    }
  }

  // Check if there's already a pending creation for this session (per-instance race prevention)
  const pending = pendingCreations.get(sessionId);
  if (pending) {
    console.log(`[Kernel] Waiting for pending browser creation for session ${sessionId}...`);
    return pending;
  }

  logger.info('Initiating new browser creation', {
    sessionId,
    userId,
    operation: 'createBrowser',
  });

  // Create a promise and store it to prevent duplicate creations within this instance
  const creationPromise = (async () => {
    let lockToken: string | null = null;
    const creationStartTime = Date.now();
    try {
      try {
        lockToken = await acquireDistributedLock(sessionId, userId);
      } catch (lockError) {
        if (lockError instanceof Error && lockError.message === 'browser-exists-after-lock') {
          // Another instance created a browser while we were waiting
          // CRITICAL: Verify ownership before returning it
          const recheckEntry = await atomicCheckAndClaimBrowser(sessionId, userId);
          if (recheckEntry) {
            console.log(
              `[Kernel] Another instance created browser for session ${sessionId}, user ${userId}: ${recheckEntry.browser.session_id}`
            );
            return recheckEntry.browser;
          }
          // If atomicCheckAndClaimBrowser returns null, the browser doesn't exist or expired
          // Fall through to create a new one
          console.log(
            `[Kernel] Browser was created but expired/invalid for session ${sessionId}, user ${userId}. Creating new one.`
          );
        } else {
          throw lockError;
        }
      }

      // Double-check Redis in case another instance created it while we were acquiring lock
      // CRITICAL: Use atomic check with userId verification
      const recheckEntry = await atomicCheckAndClaimBrowser(sessionId, userId);
      if (recheckEntry) {
        console.log(
          `[Kernel] Browser was created by another instance for session ${sessionId}, user ${userId}: ${recheckEntry.browser.session_id}`
        );
        return recheckEntry.browser;
      }

      // Advertise pending creation so other instances can wait instead of racing
      await redis.set(redisKey, { status: 'pending', lastAccessedAt: Date.now() }, {
        ex: BROWSER_TTL_SECONDS,
      });

      const viewport = options?.isMobile
        ? { width: 1024, height: 768 }
        : { width: 1920, height: 1080 };

      const browser = (await kernel.browsers.create({
        viewport,
        timeout_seconds: 300, // 5 minutes
        kiosk_mode: true, // Hide URL bar, tabs, and browser chrome in live view
        stealth: true, // Residential proxy + auto CAPTCHA solver
      })) as KernelBrowser;

      const creationDuration = Date.now() - creationStartTime;
      logger.performanceMetric({
        sessionId,
        userId,
        operation: 'createBrowser',
        durationMs: creationDuration,
      });
      logger.browserCreated({
        sessionId,
        userId,
        operation: 'createBrowser',
        browserSessionId: browser.session_id,
        cdpUrl: browser.cdp_ws_url,
        liveViewUrl: browser.browser_live_view_url,
      });

      // Store in Redis with TTL and userId for ownership tracking
      // Use atomic Lua script to prevent race where another instance might have just created it
      const entry: KernelBrowserEntry = {
        browser,
        userId, // CRITICAL: Store userId for ownership verification
        lastAccessedAt: Date.now(),
        lastAgentActivityAt: Date.now(),
        liveViewConnections: 0,
        lastLiveViewHeartbeatAt: null,
      };

      // Store in Redis - verify no race condition occurred
      const existingCheck = await loadBrowserEntry(sessionId);
      if (existingCheck && existingCheck.userId !== userId) {
        logger.raceConditionDetected({
          sessionId,
          userId,
          operation: 'createBrowser',
          details: `Another user (${existingCheck.userId}) created browser during our creation window despite lock`,
        });
        // Clean up the Kernel browser we just created since we can't use it
        try {
          await kernel.browsers.deleteByID(browser.session_id);
          logger.info('Cleaned up orphaned browser due to race condition', {
            sessionId,
            userId,
            operation: 'createBrowser',
            browserSessionId: browser.session_id,
          });
        } catch (cleanupError) {
          logger.error('Failed to clean up orphaned browser', {
            sessionId,
            userId,
            operation: 'createBrowser',
            browserSessionId: browser.session_id,
          });
        }
        throw new Error('Race condition detected: browser created by different user');
      }

      await redis.set(redisKey, entry, { ex: BROWSER_TTL_SECONDS });
      logger.info('Browser entry stored in Redis', {
        sessionId,
        userId,
        operation: 'createBrowser',
      });

      return browser;
    } catch (error) {
      console.error('[Kernel] Failed to create browser:', error);
      // Clean up pending marker on failure so another attempt can proceed
      await redis.del(redisKey);
      throw error;
    } finally {
      // Always clean up the pending promise
      pendingCreations.delete(sessionId);
      if (lockToken) {
        await releaseDistributedLock(sessionId, lockToken);
      }
    }
  })();

  pendingCreations.set(sessionId, creationPromise);
  return creationPromise;
}

export async function getKernelBrowser(
  sessionId: string,
  userId: string
): Promise<KernelBrowser | null> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session access');
  }

  console.log(`[Kernel] getKernelBrowser called for session ${sessionId}, user ${userId}`);

  // Use atomic check with userId verification
  const entry = await atomicCheckAndClaimBrowser(sessionId, userId);
  if (entry) {
    return entry.browser;
  }

  const marker = await redis.get<KernelBrowserRedisValue>(getRedisKey(sessionId));
  if (isPendingEntry(marker)) {
    const pendingBrowser = await waitForPendingBrowser(sessionId);
    if (pendingBrowser) {
      // Verify ownership of the pending browser that was just created
      const verifyEntry = await atomicCheckAndClaimBrowser(sessionId, userId);
      if (!verifyEntry) {
        console.error(
          `[Kernel] Pending browser for session ${sessionId} does not belong to user ${userId}`
        );
        return null;
      }
      return verifyEntry.browser;
    }
  }

  return null;
}

export async function deleteKernelBrowser(
  sessionId: string,
  existingEntry?: KernelBrowserEntry | null
): Promise<void> {
  const redisKey = getRedisKey(sessionId);
  let entry = existingEntry ?? (await loadBrowserEntry(sessionId));

  if (!entry) {
    const marker = await redis.get<KernelBrowserRedisValue>(redisKey);
    if (isPendingEntry(marker)) {
      console.log(`[Kernel] Browser creation still pending for session ${sessionId}, skipping delete`);
    } else {
      console.log(`[Kernel] No browser found for session ${sessionId} to delete`);
    }
    return;
  }

  const browser = entry.browser;
  console.log(`[Kernel] Deleting browser ${browser.session_id} for session ${sessionId}`);

  // Remove from Redis FIRST to prevent reuse during deletion
  await redis.del(redisKey);

  try {
    await kernel.browsers.deleteByID(browser.session_id);
    console.log(`[Kernel] Browser ${browser.session_id} deleted successfully`);
  } catch (error: unknown) {
    // Don't throw on 404 - browser may have already timed out
    const err = error as { status?: number; message?: string };
    if (err.status === 404) {
      console.log(`[Kernel] Browser ${browser.session_id} already deleted (404)`);
    } else {
      console.error(
        `[Kernel] Failed to delete browser ${browser.session_id}:`,
        error
      );
    }
  }
}

export async function getLiveViewUrl(
  sessionId: string,
  userId: string
): Promise<string | null> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session access');
  }

  const entry = await atomicCheckAndClaimBrowser(sessionId, userId);
  if (!entry) {
    return null;
  }

  return entry.browser.browser_live_view_url;
}

export async function getCdpUrl(
  sessionId: string,
  userId: string
): Promise<string | null> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session access');
  }

  const entry = await atomicCheckAndClaimBrowser(sessionId, userId);
  if (!entry) {
    return null;
  }

  return entry.browser.cdp_ws_url;
}

export async function hasActiveBrowser(
  sessionId: string,
  userId: string
): Promise<boolean> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session access');
  }

  const entry = await atomicCheckAndClaimBrowser(sessionId, userId);
  return entry !== null;
}

// Debug function to see all active browsers (scans Redis keys)
export async function listActiveBrowsers(): Promise<string[]> {
  const keys = await redis.keys(`${REDIS_KEY_PREFIX}*`);
  const sessions: string[] = [];

  for (const key of keys) {
    const value = await redis.get<KernelBrowserRedisValue>(key);
    if (isBrowserEntry(value)) {
      const sessionId = key.replace(REDIS_KEY_PREFIX, '');
      if (await maybeExpireSession(sessionId, value)) {
        continue;
      }
      await persistEntry(sessionId, value);
      sessions.push(sessionId);
    }
  }

  return sessions;
}

export async function recordAgentActivity(
  sessionId: string,
  userId: string
): Promise<void> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session access');
  }

  const entry = await loadBrowserEntry(sessionId);
  if (entry && entry.userId !== userId) {
    console.error(
      `[Kernel] recordAgentActivity: User ${userId} attempted to access session ${sessionId} ` +
      `owned by ${entry.userId}`
    );
    throw new Error('Cannot record activity for session belonging to different user');
  }

  await updateBrowserEntry(sessionId, entry => {
    entry.lastAgentActivityAt = Date.now();
    return entry;
  });
}

export async function recordLiveViewConnection(
  sessionId: string,
  userId: string
): Promise<void> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session access');
  }

  console.log(`[Kernel] Live view connected for session ${sessionId}, user ${userId}`);

  const entry = await loadBrowserEntry(sessionId);
  if (entry && entry.userId !== userId) {
    console.error(
      `[Kernel] CRITICAL: Live view connection attempt by user ${userId} for session ${sessionId} ` +
      `owned by ${entry.userId}. This indicates a session sharing bug!`
    );
    throw new Error('Cannot connect to live view for session belonging to different user');
  }

  const updated = await updateBrowserEntry(sessionId, entry => {
    entry.liveViewConnections = 1;
    entry.lastLiveViewHeartbeatAt = Date.now();
    return entry;
  });

  // MONITORING: Alert if multiple live view connections detected
  if (updated && updated.liveViewConnections > 1) {
    logger.liveViewAnomaly({
      sessionId,
      userId,
      operation: 'recordLiveViewConnection',
      connectionCount: updated.liveViewConnections,
      browserSessionId: updated.browser.session_id,
    });
  }
}

export async function recordLiveViewDisconnection(
  sessionId: string,
  userId: string
): Promise<void> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session access');
  }

  console.log(`[Kernel] Live view disconnected for session ${sessionId}, user ${userId}`);

  const entry = await loadBrowserEntry(sessionId);
  if (entry && entry.userId !== userId) {
    console.warn(
      `[Kernel] Live view disconnection by user ${userId} for session ${sessionId} ` +
      `owned by ${entry.userId}. Ignoring.`
    );
    return; // Don't throw on disconnect, just log and ignore
  }

  const updated = await updateBrowserEntry(sessionId, entry => {
    entry.liveViewConnections = 0;
    entry.lastLiveViewHeartbeatAt = null;
    return entry;
  });

  if (updated) {
    await maybeExpireSession(sessionId, updated);
  }
}

export async function recordLiveViewHeartbeat(
  sessionId: string,
  userId: string
): Promise<void> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session access');
  }

  const entry = await loadBrowserEntry(sessionId);

  // Session doesn't exist - agent has been idle and session expired
  if (!entry) {
    console.log(
      `[Kernel] Heartbeat for expired session ${sessionId}. Agent has been idle >5min.`
    );
    throw new Error('Session expired due to agent inactivity');
  }

  // Wrong user
  if (entry.userId !== userId) {
    console.warn(
      `[Kernel] Heartbeat from user ${userId} for session ${sessionId} owned by ${entry.userId}. Ignoring.`
    );
    throw new Error('Session belongs to different user');
  }

  // Update heartbeat timestamp
  await updateBrowserEntry(sessionId, entry => {
    if (entry.liveViewConnections <= 0) {
      return entry;
    }
    entry.lastLiveViewHeartbeatAt = Date.now();
    return entry;
  });
}
