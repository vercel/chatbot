/**
 * Agent-browser skill - Core workflow for browser automation.
 *
 * This is the main skill loaded into context. Keep it concise (<200 lines).
 * Detailed references are in ./references/ and loaded on demand.
 */
export const agentBrowserSkill = `
# Browser Automation

## Core Workflow (ALWAYS follow this pattern)

1. **Navigate**: \`open <url>\`
2. **Snapshot**: \`snapshot -i\` to get interactive elements with refs (@e1, @e2, etc.)
3. **Interact**: Use refs from snapshot: \`click @e1\`, \`fill @e2 "text"\`
4. **Re-snapshot**: After ANY navigation or DOM change, snapshot again

## Essential Commands

### Navigation
- \`open <url>\` - Go to URL
- \`back\` / \`forward\` / \`reload\` - Browser navigation

### Snapshot (CRITICAL - always do this first)
- \`snapshot -i\` - Get interactive elements with refs (RECOMMENDED)
- \`snapshot\` - Full accessibility tree (when you need page text)

### Interaction (use refs from snapshot)
- \`click @e1\` - Click element
- \`fill @e1 "text"\` - Clear and fill field
- \`type @e1 "text"\` - Append text to field
- \`select @e1 "option"\` - Select dropdown option
- \`check @e1\` / \`uncheck @e1\` - Toggle checkbox
- \`press Enter\` - Press key (Tab, Escape, ArrowDown, etc.)

### Information
- \`get text @e1\` - Get element text
- \`get value @e1\` - Get input value
- \`get url\` - Current URL

### Waiting
- \`wait @e1\` - Wait for element
- \`wait 2000\` - Wait milliseconds
- \`wait --load networkidle\` - Wait for network to settle

### Scrolling
- \`scroll down 500\` - Scroll pixels
- \`scroll up 300\`

## Critical Rules

1. **ALWAYS snapshot before interacting** - Refs are only valid from the most recent snapshot
2. **Re-snapshot after DOM changes** - Navigation, form submissions, dropdowns opening, modals appearing
3. **Use refs (@e1, @e2), not semantic finders** - Refs from snapshot are most reliable
4. **If a ref doesn't work, re-snapshot** - Don't guess, get fresh refs

## Form Workflow Example

\`\`\`
browser({ command: "open https://example.com/form" })
browser({ command: "wait --load networkidle" })
browser({ command: "snapshot -i" })
// Output: textbox "Name" [ref=@e1], textbox "Email" [ref=@e2], button "Submit" [ref=@e3]
browser({ command: "fill @e1 \\"John Doe\\"" })
browser({ command: "fill @e2 \\"john@example.com\\"" })
browser({ command: "snapshot -i" })  // Verify before submit
\`\`\`

## When CSS Selectors are Better

If snapshot shows HTML IDs (like \`#firstNameTxt\`, \`#emailInput\`), you can use them directly:
\`\`\`
browser({ command: "fill \\"#firstNameTxt\\" \\"John\\"" })
browser({ command: "fill \\"#emailInput\\" \\"john@example.com\\"" })
\`\`\`

Use CSS selectors when:
- The snapshot shows clear, unique IDs
- Refs are ambiguous or the page has many similar elements

## CAPTCHA Handling

The browser has auto-CAPTCHA solving (Kernel stealth mode):
- If you see Cloudflare/reCAPTCHA, just \`wait 5000\` or \`wait 10000\`
- Do NOT click on CAPTCHA checkboxes - let the auto-solver handle it
- After it clears, continue normally

## Forbidden Actions

- NEVER use \`eval\` to enable disabled buttons or bypass validation
- NEVER use \`eval\` to modify form state or hidden fields
- If a button is disabled, fill the required fields - don't force-enable it
`;
