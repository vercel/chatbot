import Kernel from '@onkernel/sdk';

const kernel = new Kernel();

interface KernelBrowser {
  session_id: string;
  cdp_ws_url: string;
  browser_live_view_url: string;
}

// Use globalThis to persist state across HMR in development
const globalForKernel = globalThis as typeof globalThis & {
  kernelActiveBrowsers?: Map<string, KernelBrowser>;
  kernelPendingCreations?: Map<string, Promise<KernelBrowser>>;
};

if (!globalForKernel.kernelActiveBrowsers) {
  globalForKernel.kernelActiveBrowsers = new Map<string, KernelBrowser>();
}
if (!globalForKernel.kernelPendingCreations) {
  globalForKernel.kernelPendingCreations = new Map<string, Promise<KernelBrowser>>();
}

const activeBrowsers = globalForKernel.kernelActiveBrowsers;
const pendingCreations = globalForKernel.kernelPendingCreations;

export async function createKernelBrowser(
  sessionId: string,
  options?: { isMobile?: boolean }
): Promise<KernelBrowser> {
  // Check if browser already exists for this session
  const existing = activeBrowsers.get(sessionId);
  if (existing) {
    console.log(`[Kernel] Reusing existing browser for session ${sessionId}: ${existing.session_id}`);
    return existing;
  }

  // Check if there's already a pending creation for this session (prevents race condition)
  const pending = pendingCreations.get(sessionId);
  if (pending) {
    console.log(`[Kernel] Waiting for pending browser creation for session ${sessionId}...`);
    return pending;
  }

  console.log(`[Kernel] Creating new browser for session ${sessionId}...`);

  // Create a promise and store it to prevent duplicate creations
  const creationPromise = (async () => {
    try {
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

      activeBrowsers.set(sessionId, browser);
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
  return activeBrowsers.get(sessionId) || null;
}

export async function deleteKernelBrowser(sessionId: string): Promise<void> {
  const browser = activeBrowsers.get(sessionId);
  if (browser) {
    console.log(`[Kernel] Deleting browser ${browser.session_id} for session ${sessionId}`);
    // Remove from map FIRST to prevent reuse during deletion
    activeBrowsers.delete(sessionId);

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

export function getLiveViewUrl(sessionId: string): string | null {
  const browser = activeBrowsers.get(sessionId);
  return browser?.browser_live_view_url || null;
}

export function getCdpUrl(sessionId: string): string | null {
  const browser = activeBrowsers.get(sessionId);
  return browser?.cdp_ws_url || null;
}

export function hasActiveBrowser(sessionId: string): boolean {
  return activeBrowsers.has(sessionId);
}

// Debug function to see all active browsers
export function listActiveBrowsers(): string[] {
  return Array.from(activeBrowsers.keys());
}
