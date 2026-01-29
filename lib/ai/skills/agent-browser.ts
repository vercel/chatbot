/**
 * Agent-browser skill documentation for the web automation system prompt.
 * This provides comprehensive guidance on using agent-browser commands.
 *
 * @see https://agent-browser.dev/commands
 * @see https://www.kernel.sh/docs/integrations/agent-browser
 */
export const agentBrowserSkill = `
# Browser Automation with agent-browser

## Core Workflow
1. Navigate: Use browser tool with "open <url>"
2. Snapshot: Use browser tool with "snapshot -i" to get interactive elements with refs
3. Interact: Use refs from snapshot (@e1, @e2) to click, fill, etc.
4. Re-snapshot: After navigation or DOM changes to get updated refs

## Snapshot Modes
- "snapshot -i" - Interactive elements only (RECOMMENDED for forms - cleaner, faster)
- "snapshot" - Full accessibility tree (use when you need page structure/text context)
- "snapshot -c" - Compact output (less verbose)
- "snapshot -s \\"#main\\"" - Scope to a CSS selector (useful for large pages)

## Navigation & Basic Interaction
- "open <url>" - Navigate to URL (aliases: goto, navigate)
- "click @e1" - Click element by ref
- "dblclick @e1" - Double-click element
- "fill @e1 \\"text\\"" - Clear field and fill with text
- "type @e1 \\"text\\"" - Type into element (appends to existing)
- "press Enter" - Press key (Tab, Escape, ArrowDown, Control+a, etc.)
- "hover @e1" - Hover over element
- "select @e1 \\"value\\"" - Select dropdown option by value or text
- "check @e1" / "uncheck @e1" - Toggle checkbox state

## Information Retrieval
- "snapshot" - Full accessibility tree with element refs (@e1, @e2, etc.)
- "get text @e1" - Get text content of element
- "get value @e1" - Get input field value
- "get html @e1" - Get innerHTML of element
- "get attr @e1 href" - Get specific attribute value
- "get url" - Get current page URL
- "get title" - Get page title
- "get count @e1" - Count matching elements
- "get box @e1" - Get bounding box coordinates

## State Checks
- "is visible @e1" - Check if element is visible
- "is enabled @e1" - Check if element is enabled
- "is checked @e1" - Check checkbox/radio state

## Element Selection Strategy (in order of preference)
1. **Refs from snapshot** (@e1, @e2) - Most reliable, always try first
2. **CSS selectors via eval** - When refs are ambiguous or the page uses clear IDs
3. **Semantic finders** - When labels/roles are unique on the page

## Semantic Locators (alternative to refs)
- "find role button click --name \\"Submit\\"" - Find by ARIA role and name
- "find text \\"Sign In\\" click" - Find by visible text content
- "find label \\"Email\\" fill \\"test@test.com\\"" - Find by associated label
- "find placeholder \\"Enter email\\" fill \\"user@example.com\\"" - Find by placeholder
- "find testid \\"login-btn\\" click" - Find by data-testid attribute
- "find first @e1 click" - Click first matching element
- "find nth 2 @e1 click" - Click nth matching element (1-indexed)

**Strict mode:** If a semantic finder matches multiple elements, it will fail.
Use --exact for exact text matching, or use "find first"/"find nth" to disambiguate.

## Waiting
- "wait @e1" - Wait for element to appear in DOM
- "wait 2000" - Wait specified milliseconds
- "wait --text \\"Welcome\\"" - Wait for text to appear on page
- "wait --url \\"**/dashboard\\"" - Wait for URL to match pattern
- "wait --load networkidle" - Wait for network activity to settle
- "wait --fn \\"document.readyState === 'complete'\\"" - Wait for JS condition
- "wait --download" - Wait for download to complete

## Scrolling
- "scroll down 500" - Scroll down 500 pixels
- "scroll up 300" - Scroll up 300 pixels
- "scroll left 200" - Scroll left
- "scroll right 200" - Scroll right
- "scrollintoview @e1" - Bring element into viewport (implicit in most interactions)

## Browser Navigation
- "back" - Go back in history
- "forward" - Go forward in history
- "reload" - Refresh current page

## Screenshots
- "screenshot page.png" - Capture current viewport
- "screenshot --full page.png" - Capture full page (scrolls)

## Tab Management
- "tab" - List open tabs
- "tab new https://example.com" - Open new tab with URL
- "tab 2" - Switch to tab number 2
- "tab close" - Close current tab

## Frame Handling
- "frame @e1" - Switch to iframe element
- "frame main" - Return to main frame

## Storage & Cookies
- "cookies" - List all cookies
- "cookies set name value" - Set a cookie
- "cookies clear" - Clear all cookies
- "storage local" - List localStorage
- "storage local key" - Get specific localStorage value
- "storage local set key value" - Set localStorage value

## Form Workflow Example (using refs)
1. browser({ command: "open https://example.com/apply" })
2. browser({ command: "snapshot -i" })
   → Output: textbox "First Name" [ref=@e1], textbox "Last Name" [ref=@e2],
             textbox "Email" [ref=@e3], combobox "State" [ref=@e4], button "Submit" [ref=@e5]
3. browser({ command: "fill @e1 \\"John\\"" })
4. browser({ command: "fill @e2 \\"Doe\\"" })
5. browser({ command: "fill @e3 \\"john.doe@email.com\\"" })
6. browser({ command: "select @e4 \\"California\\"" })
7. browser({ command: "snapshot -i" }) // Verify before submit

## Form Workflow Example (using CSS IDs when refs are unclear)
Some forms have clear HTML IDs visible in the snapshot. Use eval to inspect, then fill directly:
1. browser({ command: "open https://example.com/intake" })
2. browser({ command: "snapshot -i" })
   → If snapshot shows IDs like #firstNameTxt, #lastNameTxt, use them:
3. browser({ command: "fill \\"#firstNameTxt\\" \\"John\\"" })
4. browser({ command: "fill \\"#lastNameTxt\\" \\"Doe\\"" })
   → If an ID doesn't work (e.g. #addressTxt errors), re-snapshot to find the correct ID

## Important Notes
- ALWAYS run "snapshot -i" after opening a page or after significant navigation/DOM changes
- Element refs (@e1, @e2) are stable within a snapshot but change after DOM updates
- Use "wait" commands to ensure page is ready before interacting
- For dropdowns: use "select @e1 \\"value\\"" directly (no need to click first)
- Quote strings with spaces: fill @e1 \\"John Doe\\"
- For complex forms, snapshot frequently to track state changes
- If a fill/click fails, re-snapshot to get fresh refs - don't guess
- Fill values with ONLY the data value (e.g. "John") - never include field names, labels, or command syntax in the value
`;
