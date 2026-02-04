/**
 * Agent-browser skill - Core workflow for browser automation.
 *
 * This is the main skill loaded into context. Keep it concise (<200 lines).
 * Detailed references are in ./references/ and loaded on demand.
 */
export const agentBrowserSkill = `
# Browser Automation

## Core Workflow

1. **Navigate**: \`open <url>\`
2. **Snapshot**: \`snapshot\` to see the page structure
3. **Interact**: Use the best selector strategy (see below)
4. **Re-snapshot**: After ANY navigation or DOM change

## Selector Strategy (in order of preference)

### 1. Label Locators (BEST for forms)
Use \`find label\` for any field with a visible label - most forms have these:
\`\`\`
browser({ command: "find label \\"First Name\\" fill \\"John\\"" })
browser({ command: "find label \\"Email\\" fill \\"john@example.com\\"" })
browser({ command: "find label \\"State\\" fill \\"CA\\"" })
browser({ command: "find label \\"Yes\\" click" })  // For labeled checkboxes
\`\`\`

This is the most robust approach because:
- Works without needing refs or IDs
- Uses the accessibility tree (token efficient)
- Self-documenting - you can see what field you're targeting

### 2. Refs from Snapshot
If snapshot shows refs (@e1, @e2), use them:
\`\`\`
browser({ command: "snapshot -i" })
// Output: textbox "Name" [ref=@e1], button "Submit" [ref=@e2]
browser({ command: "fill @e1 \\"John\\"" })
browser({ command: "click @e2" })
\`\`\`

### 3. CSS Selectors (fallback)
If labels aren't available and refs don't work, use CSS selectors:
\`\`\`
browser({ command: "fill \\"#firstNameTxt\\" \\"John\\"" })
browser({ command: "click \\"#submitBtn\\"" })
\`\`\`

## Essential Commands

### Navigation
- \`open <url>\` - Go to URL
- \`back\` / \`forward\` / \`reload\` - Browser navigation

### Snapshot
- \`snapshot\` - Full accessibility tree with labels
- \`snapshot -i\` - Interactive elements only (with refs)

### Interaction
- \`fill <sel> "text"\` - Clear and fill field
- \`type <sel> "text"\` - Append text to field
- \`click <sel>\` - Click element
- \`select <sel> "option"\` - Select dropdown option
- \`check <sel>\` / \`uncheck <sel>\` - Toggle checkbox
- \`press Enter\` - Press key (Tab, Escape, ArrowDown, etc.)

### Label-based Actions (RECOMMENDED for forms)
- \`find label "First Name" fill "John"\` - Fill by label
- \`find label "Yes" click\` - Click labeled checkbox
- \`find label "State" fill "CA"\` - Works for any labeled field

### Information
- \`get text <sel>\` - Get element text
- \`get value <sel>\` - Get input value
- \`get url\` - Current URL

### Waiting
- \`wait <sel>\` - Wait for element
- \`wait 2000\` - Wait milliseconds
- \`wait --load networkidle\` - Wait for network to settle

### Scrolling
- \`scroll down 500\` - Scroll pixels
- \`scroll up 300\`

## Form Workflow Example

\`\`\`
browser({ command: "open https://example.com/application" })
browser({ command: "wait --load networkidle" })
browser({ command: "snapshot" })  // See form structure

// Fill using labels (preferred)
browser({ command: "find label \\"First Name\\" fill \\"John\\"" })
browser({ command: "find label \\"Last Name\\" fill \\"Doe\\"" })
browser({ command: "find label \\"Email\\" fill \\"john@example.com\\"" })
browser({ command: "find label \\"Phone\\" fill \\"5551234567\\"" })

// For yes/no checkbox pairs, click the label text
browser({ command: "find label \\"Yes\\" click" })

// For dropdowns
browser({ command: "find label \\"State\\" click" })
browser({ command: "select \\"California\\"" })

browser({ command: "snapshot" })  // Verify before submit
\`\`\`

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
