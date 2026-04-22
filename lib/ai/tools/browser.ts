import { tool, type ToolExecutionOptions } from 'ai';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { executeCommand } from 'agent-browser/dist/actions.js';
import type { Command } from 'agent-browser/dist/types.js';
import { getOrCreateBrowser } from '@/lib/kernel/browser';

const COMMAND_TIMEOUT_MS = 120_000; // 2 minutes

/**
 * Per-session mutex to serialize browser commands.
 * Playwright's page object is not safe for concurrent access — parallel tool
 * calls from the AI SDK will race and time out. We queue them per session so
 * parallel model responses still complete correctly, just sequentially.
 */
const sessionQueues = new Map<string, Promise<unknown>>();

function withSessionQueue<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const prev = sessionQueues.get(sessionId) ?? Promise.resolve();
  const next = prev.then(fn, fn); // always advance the queue even on error
  sessionQueues.set(sessionId, next.then(() => {}, () => {})); // swallow to prevent unhandled rejection on queue chain
  return next;
}

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

Send structured JSON commands with an "action" field and action-specific parameters. See the Browser Automation skill for snapshot discipline, selector strategy, and workflow rules.

Commands:
- { action: "navigate", url: "<url>" } - Navigate to URL
- { action: "snapshot" } - Full accessibility tree (ALWAYS do this first)
- { action: "snapshot", selector: "form" } - Scoped snapshot (reduces noise)
- { action: "snapshot", interactive: true } - Interactive elements only with refs
- { action: "click", selector: "@e1" } - Click element by ref
- { action: "fill", selector: "@e1", value: "text" } - Clear field and fill (programmatic — use for plain text fields)
- { action: "type", selector: "@e1", text: "text", clear: true } - Simulate real keystrokes (use for masked fields: SSN, date, phone, state, zip)
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
- { action: "back" } / { action: "forward" } - Browser navigation (AVOID during form filling — may wipe state)
- { action: "evaluate", script: "document.title" } - Run JavaScript (ONLY for reading simple values — NEVER to find/click elements)
- { action: "tab_list" } / { action: "tab_switch", index: N } / { action: "tab_new" } / { action: "tab_close" } - Tab management
- { action: "dialog", response: "accept" } / { action: "dialog", response: "dismiss" } - Handle browser dialogs
- { action: "frame", selector: "#iframe" } / { action: "mainframe" } - Switch between frames

NEVER navigate away from the target application domain. Do NOT click social media links, share buttons, or external links.`,
    inputSchema: z
      .object({
        action: z.string().describe('The command action (e.g. "navigate", "click", "snapshot", "fill")'),
        selector: z.string().optional().describe('Element selector: ref (@e1), CSS (#id), or label'),
        value: z.string().optional().describe('Value for fill action'),
        text: z.string().optional().describe('Text for type action'),
        url: z.string().optional().describe('URL for navigate action'),
        key: z.string().optional().describe('Key for press action (e.g. "Enter", "Tab")'),
        label: z.string().optional().describe('Label text for getbylabel action'),
        subaction: z.string().optional().describe('Sub-action for getbylabel ("click", "fill", "check")'),
        script: z.string().optional().describe('JavaScript for evaluate action'),
        values: z.array(z.string()).optional().describe('Option values for select action — must be an array'),
        timeout: z.number().optional().describe('Timeout in ms for wait action — must be a number'),
        amount: z.number().optional().describe('Scroll amount in px — must be a number'),
        delay: z.number().optional().describe('Delay between keystrokes in ms — must be a number'),
        interactive: z.boolean().optional().describe('Show only interactive elements in snapshot — must be boolean'),
        clear: z.boolean().optional().describe('Clear field before typing — must be boolean'),
        direction: z.string().optional().describe('Scroll direction: "up" or "down"'),
        state: z.string().optional().describe('Load state for waitforloadstate (e.g. "networkidle")'),
        index: z.number().optional().describe('Tab index for tab_switch/tab_close'),
        response: z.string().optional().describe('Dialog response: "accept" or "dismiss"'),
        promptText: z.string().optional().describe('Text to enter in prompt dialog'),
      })
      .describe('Structured command object with action and action-specific parameters'),
    execute: async (
      params: Record<string, unknown>,
      { abortSignal }: ToolExecutionOptions,
    ) => {
      return withSessionQueue(sessionId, async () => {
        try {
          // Ensure we have a Kernel browser instance (creates one if needed)
          const session = await getOrCreateBrowser(sessionId, userId);

          const command = {
            id: nanoid(),
            ...params,
          } as Command;

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
            return { success: true, output, error: null };
          }

          console.error('[browser-tool] Command error:', response.error);
          return { success: false, output: null, error: response.error };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);

          if (abortSignal?.aborted || message.includes('stopped by user')) {
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
      });
    },
  });
