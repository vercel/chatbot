import Kernel from '@onkernel/sdk';
import { BrowserManager } from 'agent-browser/dist/browser.js';
import { executeCommand } from 'agent-browser/dist/actions.js';
import type { Command } from 'agent-browser/dist/types.js';

const kernel = new Kernel();

// =============================================================================
// Types
// =============================================================================

export interface BrowserSession {
  kernelSessionId: string;
  liveViewUrl: string;
  cdpWsUrl: string;
  userId: string;
  browserManager: BrowserManager;
}

// =============================================================================
// In-memory session cache
//
// Single source of truth for session→browser mapping within this process.
// Kernel.sh is the ultimate source of truth for browser lifecycle/timeout.
// No Redis needed — this is a single Cloud Run instance talking to Kernel.
// =============================================================================

const sessions = new Map<string, BrowserSession>();
const pendingCreations = new Map<string, Promise<BrowserSession>>();

function cacheKey(userId: string, sessionId: string): string {
  return `${userId}:${sessionId}`;
}

// =============================================================================
// Core operations
// =============================================================================

/**
 * Get or create a browser session for a user's chat.
 *
 * Uses in-memory cache to dedup. If a create is already in-flight for this
 * session, awaits it instead of creating a duplicate. Kernel handles all
 * timeout/lifecycle logic.
 */
export async function getOrCreateBrowser(
  sessionId: string,
  userId: string,
  options?: { isMobile?: boolean },
): Promise<BrowserSession> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session isolation');
  }

  const key = cacheKey(userId, sessionId);

  // 1. Check in-memory cache
  const cached = sessions.get(key);
  if (cached) {
    console.log(
      `[Kernel] Reusing browser ${cached.kernelSessionId} for session ${sessionId}`,
    );
    return cached;
  }

  // 2. If a create is already in-flight, await it
  const pending = pendingCreations.get(key);
  if (pending) {
    console.log(`[Kernel] Awaiting in-flight create for session ${sessionId}`);
    return pending;
  }

  // 3. Create new browser via Kernel SDK
  const createPromise = (async () => {
    try {
      const viewport = options?.isMobile
        ? { width: 1024, height: 768 }
        : { width: 1280, height: 800 };

      const browser = (await kernel.browsers.create({
        viewport,
        timeout_seconds: 600,
        kiosk_mode: true,
        stealth: true,
      })) as {
        session_id: string;
        cdp_ws_url: string;
        browser_live_view_url: string;
      };

      const manager = new BrowserManager();
      await manager.launch({
        id: 'launch',
        action: 'launch',
        cdpUrl: browser.cdp_ws_url,
      });

      const session: BrowserSession = {
        kernelSessionId: browser.session_id,
        liveViewUrl: browser.browser_live_view_url,
        cdpWsUrl: browser.cdp_ws_url,
        userId,
        browserManager: manager,
      };

      sessions.set(key, session);
      console.log(
        `[Kernel] Created browser ${browser.session_id} for session ${sessionId}`,
      );

      return session;
    } finally {
      pendingCreations.delete(key);
    }
  })();

  pendingCreations.set(key, createPromise);
  return createPromise;
}

/**
 * Get an existing browser session from cache.
 * Also awaits any in-flight creation so callers can poll for a browser
 * that another code path (e.g. the tool) is currently creating.
 * Returns null if no session exists and none is being created.
 */
export async function getBrowser(
  sessionId: string,
  userId: string,
): Promise<BrowserSession | null> {
  if (!userId) {
    throw new Error('[Kernel] userId is required for browser session access');
  }

  const key = cacheKey(userId, sessionId);

  const cached = sessions.get(key);
  if (cached) return cached;

  // Await in-flight creation from another code path (e.g. tool execution)
  const pending = pendingCreations.get(key);
  if (pending) {
    console.log(
      `[Kernel] getBrowser awaiting in-flight create for session ${sessionId}`,
    );
    return pending;
  }

  return null;
}

/**
 * Stop in-progress browser operations for a session.
 *
 * Sends a window.stop() evaluate command to halt any in-progress page
 * navigation or resource loading.
 */
export async function stopBrowserOperations(
  sessionId: string,
  userId: string,
): Promise<void> {
  if (!userId) return;

  const key = cacheKey(userId, sessionId);
  const session = sessions.get(key);
  if (!session) return;

  try {
    const stopCommand = {
      id: `stop-${Date.now()}`,
      action: 'evaluate',
      script: 'window.stop()',
    } as Command;

    // Race with a short timeout — if Playwright is stuck on a long command,
    // don't block the stop response indefinitely.
    await Promise.race([
      executeCommand(stopCommand, session.browserManager),
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ]);

    console.log(
      `[Kernel] Sent window.stop() for session ${sessionId}`,
    );
  } catch (err) {
    console.error('[Kernel] Failed to stop browser operations:', err);
  }
}

/**
 * Delete a browser session.
 * Removes from cache, then tells Kernel to destroy the browser instance.
 */
export async function deleteBrowser(
  sessionId: string,
  userId: string,
): Promise<void> {
  const key = cacheKey(userId, sessionId);
  const session = sessions.get(key);

  if (!session) return;

  // Remove from cache first
  sessions.delete(key);

  // Close BrowserManager (disconnects Playwright from CDP)
  try {
    await session.browserManager.close();
  } catch (err) {
    console.error('[Kernel] Failed to close BrowserManager:', err);
  }

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
}

