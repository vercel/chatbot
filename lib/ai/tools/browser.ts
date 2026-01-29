import { tool } from 'ai';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createKernelBrowser, getCdpUrl } from '@/lib/kernel/browser';

const execAsync = promisify(exec);

/**
 * Creates a browser automation tool for a specific session.
 * Uses agent-browser CLI with native Kernel provider for remote browser control.
 *
 * The tool connects to a Kernel.sh managed browser instance and executes
 * commands using the agent-browser CLI.
 *
 * @see https://www.kernel.sh/docs/integrations/agent-browser
 * @see https://agent-browser.dev/commands
 */
export const createBrowserTool = (sessionId: string) =>
  tool({
    description: `Execute browser automation commands using agent-browser CLI connected to a remote Kernel browser.

Core workflow:
1. Use "snapshot" to see the accessibility tree with element refs (@e1, @e2)
2. Interact using refs: "click @e1", "fill @e2 \\"text\\""
3. Re-snapshot after navigation or DOM changes

Common commands:
- "open <url>" - Navigate to URL
- "snapshot" - Get accessibility tree with refs (ALWAYS do this first after navigation)
- "click @e1" - Click element by ref
- "fill @e1 \\"text\\"" - Clear field and fill with text
- "type @e1 \\"text\\"" - Type into element (appends)
- "select @e1 \\"option\\"" - Select dropdown option
- "press Enter" - Press key (Tab, Escape, ArrowDown, etc.)
- "hover @e1" - Hover over element
- "check @e1" / "uncheck @e1" - Toggle checkbox
- "wait --text \\"Success\\"" - Wait for text to appear
- "wait --load networkidle" - Wait for network to settle
- "get text @e1" - Get element text content
- "get value @e1" - Get input field value
- "get url" - Get current URL
- "get title" - Get page title
- "scroll down 500" - Scroll down 500px
- "screenshot page.png" - Take screenshot`,
    inputSchema: z.object({
      command: z.string().describe('The agent-browser command to execute'),
    }),
    execute: async ({ command }: { command: string }) => {
      try {
        // Ensure we have a Kernel browser instance for this session
        // This creates a new browser or returns existing one
        const browser = await createKernelBrowser(sessionId);
        const cdpUrl = browser.cdp_ws_url;

        console.log('[browser-tool] Session:', sessionId);
        console.log('[browser-tool] CDP URL:', cdpUrl);

        // Use --cdp flag to connect agent-browser to Kernel's browser via CDP WebSocket
        const fullCommand = `npx agent-browser --cdp "${cdpUrl}" ${command}`;
        console.log('[browser-tool] Executing:', fullCommand);

        const { stdout, stderr } = await execAsync(fullCommand, {
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
