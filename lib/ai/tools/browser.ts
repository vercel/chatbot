import { tool, type ToolExecutionOptions } from 'ai';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { enqueueCommand, awaitResult } from '@/lib/kernel/message-queue';
import { ensureWorker } from '@/lib/kernel/command-worker';
import {
  getOrCreateBrowser,
  recordAgentActivity,
} from '@/lib/kernel/browser';

/**
 * Creates a browser automation tool for a specific session.
 * Uses agent-browser CLI with native Kernel provider for remote browser control.
 *
 * Commands are submitted to a Redis Streams message queue and executed by a
 * background worker. This decouples command submission from execution, enabling
 * sequential processing, retries, and real-time status events for the client.
 *
 * @param sessionId - The chat/session ID for browser isolation
 * @param userId - The user ID for ownership validation and security
 *
 * @see https://www.kernel.sh/docs/integrations/agent-browser
 * @see https://agent-browser.dev/commands
 */
export const createBrowserTool = (sessionId: string, userId: string) =>
  tool({
    description: `Execute browser automation commands using agent-browser CLI connected to a remote Kernel browser.

SNAPSHOT DISCIPLINE (critical for reliable automation):
- ALWAYS run "snapshot" (full) as the FIRST command after opening a page or navigating
- On complex pages (Drupal, long forms), scope with "snapshot -s \\"form\\"" or "snapshot -s \\"main\\"" to reduce noise
- Use "snapshot -i" only when you specifically need just interactive element refs
- ALWAYS re-snapshot after ANY action that changes the DOM (click, select, fill that triggers dynamic fields, navigation)
- NEVER reuse refs from a previous snapshot after a DOM-changing action — they may be stale

Core workflow:
1. "open <url>" — navigate to the page
2. "snapshot" — full page snapshot to understand structure
3. "snapshot -s \\"form\\"" — scope to form on complex pages with navigation/sidebars
4. Interact using refs (@e1, @e2) or "find label" locators
5. Re-snapshot after every DOM-changing interaction

Common commands:
- "open <url>" - Navigate to URL
- "snapshot" - Full accessibility tree (ALWAYS do this first on a new page)
- "snapshot -s \\"form\\"" - Scoped snapshot (reduces noise on complex pages)
- "snapshot -i" - Interactive elements only with refs
- "click @e1" - Click element by ref
- "fill @e1 \\"text\\"" - Clear field and fill with text
- "type @e1 \\"text\\"" - Type into element (appends)
- "select @e1 \\"option\\"" - Select native dropdown option
- "find label \\"Field Name\\" fill \\"value\\"" - Fill by accessible label (best for forms)
- "press Enter" - Press key (Tab, Escape, ArrowDown, etc.)
- "hover @e1" - Hover over element
- "check @e1" / "uncheck @e1" - Toggle checkbox
- "scrollintoview @e1" - Scroll element into view (useful for long forms)
- "wait --text \\"Success\\"" - Wait for text to appear
- "wait --load networkidle" - Wait for network to settle
- "get text @e1" - Get element text content
- "get value @e1" - Get input field value
- "get url" - Get current URL
- "get title" - Get page title
- "scroll down 500" - Scroll down 500px
- "screenshot page.png" - Take screenshot

Custom dropdowns (Select2, Chosen, Drupal):
If "select" fails, the dropdown is likely a custom widget (Select2/Chosen). Use this pattern:
1. "click @e1" — click the dropdown trigger (the styled container, not a hidden select)
2. "wait 300" — let the dropdown options render
3. "snapshot -s \\".select2-results\\"" or "snapshot -i" — find the options
4. "click @e5" — click the desired option
Alternative: "fill @e1 \\"search text\\"" then "snapshot -i" to filter and select from search results.

NEVER use "eval" to enable disabled buttons, bypass validation, or modify page state.
eval is only acceptable for reading values (e.g. checking if an element exists).`,
    inputSchema: z.object({
      command: z.string().describe('The agent-browser command to execute'),
    }),
    execute: async (
      { command }: { command: string },
      { abortSignal }: ToolExecutionOptions,
    ) => {
      try {
        // Ensure we have a Kernel browser instance (creates one if needed)
        await getOrCreateBrowser(sessionId, userId);
        await recordAgentActivity(sessionId, userId);

        // Ensure the background worker is running for this session
        const worker = ensureWorker(userId, sessionId);

        // If the user aborts, stop the worker
        if (abortSignal) {
          abortSignal.addEventListener('abort', () => worker.stop(), {
            once: true,
          });
        }

        const correlationId = randomUUID();

        console.log('[browser-tool] Enqueueing command:', command);
        console.log('[browser-tool] Correlation ID:', correlationId);

        // Submit command to the queue
        await enqueueCommand({
          correlationId,
          command,
          sessionId,
          userId,
          timestamp: Date.now(),
        });

        // Wait for the worker to execute and publish the result
        const result = await awaitResult(
          userId,
          sessionId,
          correlationId,
          abortSignal,
        );

        console.log(
          '[browser-tool] Result received:',
          result.success ? 'success' : 'failure',
        );

        return {
          success: result.success,
          output: result.output || (result.success ? 'Command completed successfully' : null),
          error: result.error,
        };
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Command failed';

        // Handle abort (user clicked Stop or Take Over)
        if (abortSignal?.aborted) {
          console.log('[browser-tool] Command aborted by user');
          return {
            success: false,
            output: null,
            error: 'Browser command stopped by user',
          };
        }

        console.error('[browser-tool] Error:', message);
        return {
          success: false,
          output: null,
          error: message,
        };
      }
    },
  });
