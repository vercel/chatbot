import { tool } from 'ai';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  createKernelBrowser,
  recordAgentActivity,
} from '@/lib/kernel/browser';

const execFileAsync = promisify(execFile);

/**
 * Parse a command string into an array of arguments, respecting quoted strings.
 * e.g. `fill @e1 "hello world"` → `['fill', '@e1', 'hello world']`
 */
function parseCommand(command: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (inQuote) {
      if (ch === '\\' && i + 1 < command.length) {
        // Escaped character inside quotes — include the next char literally
        current += command[++i];
      } else if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

/**
 * Creates a browser automation tool for a specific session.
 * Uses agent-browser CLI with native Kernel provider for remote browser control.
 *
 * The tool connects to a Kernel.sh managed browser instance and executes
 * commands using the agent-browser CLI.
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
    execute: async ({ command }: { command: string }) => {
      try {
        // Ensure we have a Kernel browser instance for this session
        // This creates a new browser or returns existing one with userId validation
        const browser = await createKernelBrowser(sessionId, userId);
        await recordAgentActivity(sessionId, userId);
        const cdpUrl = browser.cdp_ws_url;

        console.log('[browser-tool] Session:', sessionId);
        console.log('[browser-tool] CDP URL:', cdpUrl);

        // Use --cdp flag to connect agent-browser to Kernel's browser via CDP WebSocket
        // Use execFile (no shell) so URLs with #, &, ? etc. aren't mangled by the shell
        const args = ['agent-browser', '--cdp', cdpUrl, ...parseCommand(command)];
        console.log('[browser-tool] Executing: npx', args.join(' '));

        const { stdout, stderr } = await execFileAsync('npx', args, {
          timeout: 120000, // 2 minute timeout per command
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large snapshots
        });

        console.log('[browser-tool] Success. stdout length:', stdout?.length);
        if (stderr) console.log('[browser-tool] stderr:', stderr);

        return {
          success: true,
          output: stdout || 'Command completed successfully',
          // Don't include stderr as error for successful commands
          // (npx outputs notices to stderr that aren't actual errors)
          error: null,
        };
      } catch (error: unknown) {
        const execError = error as {
          killed?: boolean;
          stdout?: string;
          stderr?: string;
          message?: string;
        };

        console.error('[browser-tool] Error:', {
          killed: execError.killed,
          message: execError.message,
          stderr: execError.stderr,
          stdout: execError.stdout,
        });

        // Handle timeout specifically
        if (execError.killed) {
          return {
            success: false,
            output: null,
            error: 'Command timed out after 2 minutes',
          };
        }

        return {
          success: false,
          output: execError.stdout || null, // May have partial output
          error:
            execError.stderr || execError.message || 'Command failed',
        };
      }
    },
  });
