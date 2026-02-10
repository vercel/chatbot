import { tool, type ToolExecutionOptions } from 'ai';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { executeCommand } from 'agent-browser/dist/actions.js';
import type { Command, Response } from 'agent-browser/dist/types.js';
import { getOrCreateBrowser } from '@/lib/kernel/browser';

const COMMAND_TIMEOUT_MS = 120_000; // 2 minutes

/**
 * Creates a browser automation tool for a specific session.
 * Uses agent-browser's BrowserManager API with Kernel for remote browser control.
 *
 * Executes commands in-process via executeCommand() — no CLI subprocess.
 * BrowserManager persists across tool calls, so ref maps survive between snapshots.
 *
 * @param sessionId - The chat/session ID for browser isolation
 * @param userId - The user ID for ownership validation and security
 *
 * @see https://www.kernel.sh/docs/integrations/agent-browser
 */
export const createBrowserTool = (sessionId: string, userId: string) =>
  tool({
    description: `Execute browser automation commands on a remote Kernel browser.

Send structured JSON commands with an "action" field and action-specific parameters.

SNAPSHOT DISCIPLINE (critical for reliable automation):
- ALWAYS run { action: "snapshot" } as the FIRST command after navigating
- On complex pages (Drupal, long forms), scope with { action: "snapshot", selector: "form" } or { action: "snapshot", selector: "main" }
- Use { action: "snapshot", interactive: true } only when you specifically need just interactive element refs
- ALWAYS re-snapshot after ANY action that changes the DOM (click, select, fill that triggers dynamic fields, navigation)
- NEVER reuse refs from a previous snapshot after a DOM-changing action — they may be stale

Core workflow:
1. { action: "navigate", url: "<url>" } — navigate to the page
2. { action: "snapshot" } — full page snapshot to understand structure
3. { action: "snapshot", selector: "form" } — scope to form on complex pages
4. Interact using refs (@e1, @e2) or label locators
5. Re-snapshot after every DOM-changing interaction

Common commands:
- { action: "navigate", url: "<url>" } - Navigate to URL
- { action: "snapshot" } - Full accessibility tree (ALWAYS do this first)
- { action: "snapshot", selector: "form" } - Scoped snapshot (reduces noise)
- { action: "snapshot", interactive: true } - Interactive elements only with refs
- { action: "click", selector: "@e1" } - Click element by ref
- { action: "fill", selector: "@e1", value: "text" } - Clear field and fill
- { action: "type", selector: "@e1", text: "text" } - Type into element (appends)
- { action: "select", selector: "@e1", values: ["option"] } - Select native dropdown option
- { action: "getbylabel", label: "Field Name", subaction: "fill", value: "val" } - Fill by accessible label
- { action: "press", key: "Enter" } - Press key (Tab, Escape, ArrowDown, etc.)
- { action: "hover", selector: "@e1" } - Hover over element
- { action: "check", selector: "@e1" } - Toggle checkbox on
- { action: "uncheck", selector: "@e1" } - Toggle checkbox off
- { action: "scrollintoview", selector: "@e1" } - Scroll element into view
- { action: "wait", selector: "@e1" } - Wait for element
- { action: "wait", timeout: 2000 } - Wait milliseconds
- { action: "waitforloadstate", state: "networkidle" } - Wait for network to settle
- { action: "gettext", selector: "@e1" } - Get element text content
- { action: "inputvalue", selector: "@e1" } - Get input field value
- { action: "url" } - Get current URL
- { action: "title" } - Get page title
- { action: "scroll", direction: "down", amount: 500 } - Scroll down 500px
- { action: "screenshot" } - Take screenshot
- { action: "back" } / { action: "forward" } / { action: "reload" } - Browser navigation
- { action: "evaluate", script: "document.title" } - Run JavaScript (read-only!)

Custom dropdowns (Select2, Chosen, Drupal):
If "select" fails, the dropdown is likely a custom widget. Use this pattern:
1. { action: "click", selector: "@e1" } — click the dropdown trigger
2. { action: "wait", timeout: 300 } — let options render
3. { action: "snapshot", interactive: true } — find the options
4. { action: "click", selector: "@e5" } — click the desired option

NEVER use "evaluate" to enable disabled buttons, bypass validation, or modify page state.
evaluate is only acceptable for reading values (e.g. checking if an element exists).`,
    inputSchema: z
      .object({
        action: z.string().describe('The command action (e.g. "navigate", "click", "snapshot", "fill")'),
      })
      .passthrough()
      .describe('Structured command object with action and action-specific parameters'),
    execute: async (
      params: Record<string, unknown>,
      { abortSignal }: ToolExecutionOptions,
    ) => {
      try {
        // Ensure we have a Kernel browser instance (creates one if needed)
        const session = await getOrCreateBrowser(sessionId, userId);

        const command = {
          id: nanoid(),
          ...params,
        } as Command;

        console.log('[browser-tool] Session:', sessionId);
        console.log('[browser-tool] Executing:', command.action, JSON.stringify(params));

        const response = await Promise.race([
          executeCommand(command, session.browserManager),
          new Promise<never>((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error('Command timed out after 2 minutes')),
              COMMAND_TIMEOUT_MS,
            );
            abortSignal?.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Browser command stopped by user'));
            });
          }),
        ]);

        if (response.success) {
          const output =
            typeof response.data === 'string'
              ? response.data
              : JSON.stringify(response.data);
          console.log('[browser-tool] Success. Output length:', output?.length);
          return { success: true, output, error: null };
        }

        console.error('[browser-tool] Command error:', response.error);
        return { success: false, output: null, error: response.error };
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);

        if (abortSignal?.aborted || message.includes('stopped by user')) {
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
