import Kernel from '@onkernel/sdk';
import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

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

function isEntryExpired(entry: KernelBrowserEntry): boolean {
  return !hasRecentAgentActivity(entry) && !hasActiveLiveView(entry);
}

async function persistEntry(
  sessionId: string,
  entry: KernelBrowserEntry
): Promise<KernelBrowserEntry> {
  const redisKey = getRedisKey(sessionId);
  const updated: KernelBrowserEntry = {
    ...entry,
    lastAccessedAt: Date.now(),
  };
  await redis.set(redisKey, updated, { ex: BROWSER_TTL_SECONDS });
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

async function acquireDistributedLock(sessionId: string): Promise<string> {
  const lockKey = getLockKey(sessionId);
  const token = randomUUID();
  const deadline = Date.now() + LOCK_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const result = await redis.set(lockKey, token, {
      nx: true,
      ex: LOCK_TTL_SECONDS,
    });

    if (result === 'OK') {
      return token;
    }

    // Before sleeping, check if another instance finished creating the browser
    const existing = await redis.get<KernelBrowserRedisValue>(getRedisKey(sessionId));
    if (isBrowserEntry(existing)) {
      throw new Error('browser-exists-after-lock'); // Signal caller to re-fetch
    }

    await sleep(LOCK_RETRY_DELAY_MS);
  }

  throw new Error('Failed to acquire browser creation lock');
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
  options?: { isMobile?: boolean }
): Promise<KernelBrowser> {
  const redisKey = getRedisKey(sessionId);

  // Check if browser already exists in Redis
  let existingEntry = await loadBrowserEntry(sessionId);
  if (existingEntry) {
    const expired = await maybeExpireSession(sessionId, existingEntry);
    if (!expired) {
      const refreshedEntry = await persistEntry(sessionId, existingEntry);
      console.log(
        `[Kernel] Reusing existing browser for session ${sessionId}: ${refreshedEntry.browser.session_id}`
      );
      return refreshedEntry.browser;
    }
    existingEntry = null;
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

  console.log(`[Kernel] Creating new browser for session ${sessionId}...`);

  // Create a promise and store it to prevent duplicate creations within this instance
  const creationPromise = (async () => {
    let lockToken: string | null = null;
    try {
      try {
        lockToken = await acquireDistributedLock(sessionId);
      } catch (lockError) {
        if (lockError instanceof Error && lockError.message === 'browser-exists-after-lock') {
          const browserEntry = await redis.get<KernelBrowserRedisValue>(redisKey);
          if (isBrowserEntry(browserEntry)) {
            await redis.expire(redisKey, BROWSER_TTL_SECONDS);
            console.log(`[Kernel] Reusing existing browser for session ${sessionId}: ${browserEntry.browser.session_id}`);
            return browserEntry.browser;
          }
        }
        throw lockError;
      }

      // Double-check Redis in case another instance created it while we were waiting
      let recheckEntry = await loadBrowserEntry(sessionId);
      if (recheckEntry) {
        const expired = await maybeExpireSession(sessionId, recheckEntry);
        if (!expired) {
          const refreshedEntry = await persistEntry(sessionId, recheckEntry);
          console.log(
            `[Kernel] Browser was created by another instance for session ${sessionId}: ${refreshedEntry.browser.session_id}`
          );
          return refreshedEntry.browser;
        }
        recheckEntry = null;
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

      console.log(`[Kernel] Browser created: ${browser.session_id}`);
      console.log(`[Kernel] CDP URL: ${browser.cdp_ws_url}`);
      console.log(`[Kernel] Live View: ${browser.browser_live_view_url}`);

      // Store in Redis with TTL
      const entry: KernelBrowserEntry = {
        browser,
        lastAccessedAt: Date.now(),
        lastAgentActivityAt: Date.now(),
        liveViewConnections: 0,
        lastLiveViewHeartbeatAt: null,
      };
      await redis.set(redisKey, entry, { ex: BROWSER_TTL_SECONDS });

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
  sessionId: string
): Promise<KernelBrowser | null> {
  const entry = await loadBrowserEntry(sessionId);
  if (entry) {
    const expired = await maybeExpireSession(sessionId, entry);
    if (!expired) {
      await persistEntry(sessionId, entry);
      return entry.browser;
    }
    return null;
  }

  const marker = await redis.get<KernelBrowserRedisValue>(getRedisKey(sessionId));
  if (isPendingEntry(marker)) {
    return waitForPendingBrowser(sessionId);
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

export async function getLiveViewUrl(sessionId: string): Promise<string | null> {
  const entry = await loadBrowserEntry(sessionId);
  if (!entry) {
    return null;
  }

  const expired = await maybeExpireSession(sessionId, entry);
  if (expired) {
    return null;
  }

  const refreshed = await persistEntry(sessionId, entry);
  return refreshed.browser.browser_live_view_url;
}

export async function getCdpUrl(sessionId: string): Promise<string | null> {
  const entry = await loadBrowserEntry(sessionId);
  if (!entry) {
    return null;
  }

  const expired = await maybeExpireSession(sessionId, entry);
  if (expired) {
    return null;
  }

  const refreshed = await persistEntry(sessionId, entry);
  return refreshed.browser.cdp_ws_url;
}

export async function hasActiveBrowser(sessionId: string): Promise<boolean> {
  const entry = await loadBrowserEntry(sessionId);
  if (!entry) {
    return false;
  }

  if (await maybeExpireSession(sessionId, entry)) {
    return false;
  }

  return true;
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

export async function recordAgentActivity(sessionId: string): Promise<void> {
  await updateBrowserEntry(sessionId, entry => {
    entry.lastAgentActivityAt = Date.now();
    return entry;
  });
}

export async function recordLiveViewConnection(sessionId: string): Promise<void> {
  console.log(`[Kernel] Live view connected for session ${sessionId}`);
  await updateBrowserEntry(sessionId, entry => {
    entry.liveViewConnections = 1;
    entry.lastLiveViewHeartbeatAt = Date.now();
    return entry;
  });
}

export async function recordLiveViewDisconnection(sessionId: string): Promise<void> {
  console.log(`[Kernel] Live view disconnected for session ${sessionId}`);
  const entry = await updateBrowserEntry(sessionId, entry => {
    entry.liveViewConnections = 0;
    entry.lastLiveViewHeartbeatAt = null;
    return entry;
  });

  if (entry) {
    await maybeExpireSession(sessionId, entry);
  }
}

export async function recordLiveViewHeartbeat(sessionId: string): Promise<void> {
  await updateBrowserEntry(sessionId, entry => {
    if (entry.liveViewConnections <= 0) {
      return entry;
    }
    entry.lastLiveViewHeartbeatAt = Date.now();
    return entry;
  });
}
