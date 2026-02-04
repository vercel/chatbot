import Kernel from '@onkernel/sdk';
import { Redis } from '@upstash/redis';

const kernel = new Kernel();

// Initialize Redis for distributed session storage
// This is critical for Cloud Run where multiple instances may handle requests
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const REDIS_KEY_PREFIX = 'kernel-browser:';
const BROWSER_TTL_SECONDS = 10 * 60; // 10 minutes

interface KernelBrowser {
  session_id: string;
  cdp_ws_url: string;
  browser_live_view_url: string;
}

interface KernelBrowserEntry {
  browser: KernelBrowser;
  lastAccessedAt: number;
}

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

function getRedisKey(sessionId: string): string {
  return `${REDIS_KEY_PREFIX}${sessionId}`;
}

export async function createKernelBrowser(
  sessionId: string,
  options?: { isMobile?: boolean }
): Promise<KernelBrowser> {
  // Check if browser already exists in Redis
  const existingEntry = await redis.get<KernelBrowserEntry>(getRedisKey(sessionId));
  if (existingEntry) {
    // Refresh TTL on reuse
    await redis.expire(getRedisKey(sessionId), BROWSER_TTL_SECONDS);
    console.log(`[Kernel] Reusing existing browser for session ${sessionId}: ${existingEntry.browser.session_id}`);
    return existingEntry.browser;
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
    try {
      // Double-check Redis in case another instance created it while we were waiting
      const recheckEntry = await redis.get<KernelBrowserEntry>(getRedisKey(sessionId));
      if (recheckEntry) {
        console.log(`[Kernel] Browser was created by another instance for session ${sessionId}: ${recheckEntry.browser.session_id}`);
        return recheckEntry.browser;
      }

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
      };
      await redis.set(getRedisKey(sessionId), entry, { ex: BROWSER_TTL_SECONDS });

      return browser;
    } finally {
      // Always clean up the pending promise
      pendingCreations.delete(sessionId);
    }
  })();

  pendingCreations.set(sessionId, creationPromise);
  return creationPromise;
}

export async function getKernelBrowser(
  sessionId: string
): Promise<KernelBrowser | null> {
  const entry = await redis.get<KernelBrowserEntry>(getRedisKey(sessionId));
  return entry?.browser || null;
}

export async function deleteKernelBrowser(sessionId: string): Promise<void> {
  const entry = await redis.get<KernelBrowserEntry>(getRedisKey(sessionId));
  if (entry) {
    const browser = entry.browser;
    console.log(`[Kernel] Deleting browser ${browser.session_id} for session ${sessionId}`);

    // Remove from Redis FIRST to prevent reuse during deletion
    await redis.del(getRedisKey(sessionId));

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
  } else {
    console.log(`[Kernel] No browser found for session ${sessionId} to delete`);
  }
}

export async function getLiveViewUrl(sessionId: string): Promise<string | null> {
  const entry = await redis.get<KernelBrowserEntry>(getRedisKey(sessionId));
  if (entry) {
    // Refresh TTL on access
    await redis.expire(getRedisKey(sessionId), BROWSER_TTL_SECONDS);
    return entry.browser.browser_live_view_url;
  }
  return null;
}

export async function getCdpUrl(sessionId: string): Promise<string | null> {
  const entry = await redis.get<KernelBrowserEntry>(getRedisKey(sessionId));
  if (entry) {
    // Refresh TTL on access
    await redis.expire(getRedisKey(sessionId), BROWSER_TTL_SECONDS);
    return entry.browser.cdp_ws_url;
  }
  return null;
}

export async function hasActiveBrowser(sessionId: string): Promise<boolean> {
  const exists = await redis.exists(getRedisKey(sessionId));
  return exists === 1;
}

// Debug function to see all active browsers (scans Redis keys)
export async function listActiveBrowsers(): Promise<string[]> {
  const keys = await redis.keys(`${REDIS_KEY_PREFIX}*`);
  return keys.map(key => key.replace(REDIS_KEY_PREFIX, ''));
}
