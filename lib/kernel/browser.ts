import Kernel from '@onkernel/sdk';
import { Redis } from '@upstash/redis';
import { logger } from './logger';

const kernel = new Kernel();

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// =============================================================================
// KEY DESIGN: All Redis keys are scoped by userId first.
//
// This makes cross-user session access structurally impossible because:
//   1. The userId comes from server-side auth (cannot be spoofed by clients)
//   2. Every Redis operation requires userId to construct the key
//   3. Even if a sessionId leaks, the attacker cannot construct the key without
//      the correct userId prefix
//
// Previous implementation used `kernel-browser:{sessionId}` where sessionId
// contained the userId as a suffix. Isolation depended on runtime ownership
// checks inside non-atomic read-modify-write patterns, which was racy.
// =============================================================================

const SESSION_KEY_PREFIX = 'kb:session:';
const LOCK_KEY_PREFIX = 'kb:lock:';
const EVENT_KEY_PREFIX = 'kb:events:';
const CMD_STREAM_PREFIX = 'mq:cmd:';
const RES_STREAM_PREFIX = 'mq:res:';
const STATUS_STREAM_PREFIX = 'mq:status:';

const SESSION_TTL_SECONDS = 10 * 60; // 10 minutes
const LOCK_TTL_SECONDS = 30; // 30 seconds for creation lock
const EVENT_TTL_SECONDS = 5 * 60; // 5 minutes for event log
export const STREAM_TTL_SECONDS = 10 * 60; // 10 minutes — same as session
const AGENT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes without agent tool usage

// =============================================================================
// Types
// =============================================================================

export interface BrowserSession {
  kernelSessionId: string;
  liveViewUrl: string;
  cdpWsUrl: string;
  userId: string;
  createdAt: number;
  lastAgentActivityAt: number;
}

interface BrowserEvent {
  type: 'created' | 'deleted' | 'expired' | 'activity' | 'heartbeat';
  timestamp: number;
  details?: string;
}

// =============================================================================
// Key construction — always user-scoped
// =============================================================================

function sessionKey(userId: string, sessionId: string): string {
  return `${SESSION_KEY_PREFIX}${userId}:${sessionId}`;
}

function lockKey(userId: string, sessionId: string): string {
  return `${LOCK_KEY_PREFIX}${userId}:${sessionId}`;
}

function eventKey(userId: string, sessionId: string): string {
  return `${EVENT_KEY_PREFIX}${userId}:${sessionId}`;
}

export function cmdStreamKey(userId: string, sessionId: string): string {
  return `${CMD_STREAM_PREFIX}${userId}:${sessionId}`;
}

export function resStreamKey(userId: string, sessionId: string): string {
  return `${RES_STREAM_PREFIX}${userId}:${sessionId}`;
}

export function statusStreamKey(userId: string, sessionId: string): string {
  return `${STATUS_STREAM_PREFIX}${userId}:${sessionId}`;
}

// =============================================================================
// Event logging (lightweight message queue / audit trail)
//
// Each session has a per-user event log stored as a Redis list. This provides:
//   - Auditability: see exactly what happened to a session
//   - Isolation: events are per-user, per-session
//   - Debugging: easy to diagnose cross-session issues in production
// =============================================================================

async function logEvent(
  userId: string,
  sessionId: string,
  event: BrowserEvent,
): Promise<void> {
  const key = eventKey(userId, sessionId);
  try {
    await redis.lpush(key, JSON.stringify(event));
    await redis.ltrim(key, 0, 49); // Keep last 50 events
    await redis.expire(key, EVENT_TTL_SECONDS);
  } catch (err) {
    // Non-critical — don't fail operations due to event logging
    console.warn('[Kernel] Failed to log event:', err);
  }
}

// =============================================================================
// Core operations
// =============================================================================

/**
 * Get or create a browser session for a user's chat.
 *
 * Uses SET NX on a lock key to prevent duplicate creations across Cloud Run
 * instances. The lock is short-lived (30 s) and auto-expires.
 *
 * Returns a {@link BrowserSession} with the Kernel live view URL and CDP URL.
 */
export async function getOrCreateBrowser(
  sessionId: string,
  userId: string,
  options?: { isMobile?: boolean },
): Promise<BrowserSession> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session isolation');
  }

  const key = sessionKey(userId, sessionId);

  // 1. Check for existing session
  const existing = await redis.get<BrowserSession>(key);
  if (existing) {
    // Defense-in-depth: verify ownership even though key is user-scoped
    if (existing.userId !== userId) {
      logger.securityViolation({
        sessionId,
        userId,
        operation: 'getOrCreateBrowser',
        securityEvent: 'userId_mismatch_in_user_scoped_key',
        expectedUserId: existing.userId,
        actualUserId: userId,
      });
      throw new Error('Session ownership mismatch');
    }

    // Check if agent has been idle too long
    if (Date.now() - existing.lastAgentActivityAt > AGENT_IDLE_TIMEOUT_MS) {
      logger.browserExpired({
        sessionId,
        userId,
        operation: 'getOrCreateBrowser',
        browserSessionId: existing.kernelSessionId,
      });
      await deleteBrowser(sessionId, userId);
      // Fall through to create new
    } else {
      // Refresh TTL and return
      await redis.expire(key, SESSION_TTL_SECONDS);
      logger.browserReused({
        sessionId,
        userId,
        operation: 'getOrCreateBrowser',
        browserSessionId: existing.kernelSessionId,
      });
      return existing;
    }
  }

  // 2. Acquire creation lock (SET NX — atomic, no in-memory state)
  const lk = lockKey(userId, sessionId);
  const acquired = await redis.set(lk, 'creating', {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });

  if (acquired !== 'OK') {
    // Another request is creating — poll until it appears or timeout
    console.log(
      `[Kernel] Browser creation in progress for ${sessionId}, waiting…`,
    );
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const created = await redis.get<BrowserSession>(key);
      if (created && created.userId === userId) {
        return created;
      }
    }
    throw new Error('Browser creation timed out — please retry');
  }

  // 3. Create browser via Kernel SDK
  try {
    // Double-check after lock (another instance may have written between check
    // and lock acquisition)
    const doubleCheck = await redis.get<BrowserSession>(key);
    if (doubleCheck && doubleCheck.userId === userId) {
      return doubleCheck;
    }

    const viewport = options?.isMobile
      ? { width: 1024, height: 768 }
      : { width: 1920, height: 1080 };

    const startTime = Date.now();

    const browser = (await kernel.browsers.create({
      viewport,
      timeout_seconds: 300,
      kiosk_mode: true,
      stealth: true,
    })) as {
      session_id: string;
      cdp_ws_url: string;
      browser_live_view_url: string;
    };

    const session: BrowserSession = {
      kernelSessionId: browser.session_id,
      liveViewUrl: browser.browser_live_view_url,
      cdpWsUrl: browser.cdp_ws_url,
      userId,
      createdAt: Date.now(),
      lastAgentActivityAt: Date.now(),
    };

    await redis.set(key, session, { ex: SESSION_TTL_SECONDS });

    const duration = Date.now() - startTime;
    logger.browserCreated({
      sessionId,
      userId,
      operation: 'getOrCreateBrowser',
      browserSessionId: browser.session_id,
      liveViewUrl: browser.browser_live_view_url,
    });
    logger.performanceMetric({
      sessionId,
      userId,
      operation: 'getOrCreateBrowser',
      durationMs: duration,
    });

    await logEvent(userId, sessionId, {
      type: 'created',
      timestamp: Date.now(),
      details: `kernel_session=${browser.session_id}`,
    });

    return session;
  } catch (err) {
    console.error('[Kernel] Failed to create browser:', err);
    throw err;
  } finally {
    // Always release lock
    await redis.del(lk);
  }
}

/**
 * Get an existing browser session.
 * Returns null if no session exists or it belongs to a different user.
 */
export async function getBrowser(
  sessionId: string,
  userId: string,
): Promise<BrowserSession | null> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session access');
  }

  const key = sessionKey(userId, sessionId);
  const session = await redis.get<BrowserSession>(key);

  if (!session) return null;

  if (session.userId !== userId) {
    logger.securityViolation({
      sessionId,
      userId,
      operation: 'getBrowser',
      securityEvent: 'userId_mismatch',
      expectedUserId: session.userId,
      actualUserId: userId,
    });
    return null;
  }

  return session;
}

/**
 * Delete a browser session.
 * Removes from Redis first (prevents reuse during deletion), then tells Kernel
 * to destroy the browser instance.
 */
export async function deleteBrowser(
  sessionId: string,
  userId: string,
): Promise<void> {
  const key = sessionKey(userId, sessionId);
  const session = await redis.get<BrowserSession>(key);

  if (!session) return;

  // Remove session + associated streams from Redis first
  await redis.del(
    key,
    cmdStreamKey(userId, sessionId),
    resStreamKey(userId, sessionId),
    statusStreamKey(userId, sessionId),
  );

  // Delete from Kernel
  try {
    await kernel.browsers.deleteByID(session.kernelSessionId);
    console.log(`[Kernel] Deleted browser ${session.kernelSessionId}`);
  } catch (err: unknown) {
    const error = err as { status?: number };
    if (error.status === 404) {
      console.log(
        `[Kernel] Browser ${session.kernelSessionId} already deleted (404)`,
      );
    } else {
      console.error('[Kernel] Failed to delete browser:', err);
    }
  }

  await logEvent(userId, sessionId, {
    type: 'deleted',
    timestamp: Date.now(),
  });
}

/**
 * Refresh session TTL and return current session state.
 *
 * Used by the client heartbeat to:
 *   1. Keep the session alive in Redis
 *   2. Detect if the browser was recreated (live view URL changed)
 *   3. Detect if the session expired due to agent inactivity
 *
 * Returns null if the session has expired.
 */
export async function refreshSession(
  sessionId: string,
  userId: string,
): Promise<BrowserSession | null> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session access');
  }

  const key = sessionKey(userId, sessionId);
  const session = await redis.get<BrowserSession>(key);

  if (!session) return null;

  if (session.userId !== userId) return null;

  // Check agent idle timeout
  if (Date.now() - session.lastAgentActivityAt > AGENT_IDLE_TIMEOUT_MS) {
    console.log(
      `[Kernel] Session ${sessionId} expired (agent idle > 5 min)`,
    );
    await deleteBrowser(sessionId, userId);
    await logEvent(userId, sessionId, {
      type: 'expired',
      timestamp: Date.now(),
      details: 'agent_idle_timeout',
    });
    return null;
  }

  // Refresh TTL
  await redis.expire(key, SESSION_TTL_SECONDS);

  await logEvent(userId, sessionId, {
    type: 'heartbeat',
    timestamp: Date.now(),
  });

  return session;
}

/**
 * Record agent activity (tool usage).
 *
 * Refreshes the `lastAgentActivityAt` timestamp so the session doesn't expire
 * while the agent is actively using the browser.
 */
export async function recordAgentActivity(
  sessionId: string,
  userId: string,
): Promise<void> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session access');
  }

  const key = sessionKey(userId, sessionId);
  const session = await redis.get<BrowserSession>(key);

  if (!session) return;

  if (session.userId !== userId) {
    logger.securityViolation({
      sessionId,
      userId,
      operation: 'recordAgentActivity',
      securityEvent: 'cross_user_activity_attempt',
      expectedUserId: session.userId,
      actualUserId: userId,
    });
    throw new Error(
      'Cannot record activity for session belonging to different user',
    );
  }

  // Simple atomic write — update timestamp and refresh TTL
  session.lastAgentActivityAt = Date.now();
  await redis.set(key, session, { ex: SESSION_TTL_SECONDS });

  await logEvent(userId, sessionId, {
    type: 'activity',
    timestamp: Date.now(),
  });
}

/**
 * Get CDP WebSocket URL for agent-browser CLI.
 */
export async function getCdpUrl(
  sessionId: string,
  userId: string,
): Promise<string | null> {
  const session = await getBrowser(sessionId, userId);
  return session?.cdpWsUrl ?? null;
}

/**
 * Get live view URL for iframe embedding.
 */
export async function getLiveViewUrl(
  sessionId: string,
  userId: string,
): Promise<string | null> {
  const session = await getBrowser(sessionId, userId);
  return session?.liveViewUrl ?? null;
}

/**
 * Check if a browser session is active.
 */
export async function hasActiveBrowser(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const session = await getBrowser(sessionId, userId);
  if (!session) return false;
  return Date.now() - session.lastAgentActivityAt <= AGENT_IDLE_TIMEOUT_MS;
}

/**
 * Get recent events for a session (read from the per-session message queue).
 */
export async function getSessionEvents(
  sessionId: string,
  userId: string,
  limit: number = 10,
): Promise<BrowserEvent[]> {
  const key = eventKey(userId, sessionId);
  const raw = await redis.lrange(key, 0, limit - 1);
  return raw.map((e) =>
    typeof e === 'string' ? (JSON.parse(e) as BrowserEvent) : (e as BrowserEvent),
  );
}
