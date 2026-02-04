/**
 * Agent-browser skill - Core workflow for browser automation.
 *
 * This is the main skill loaded into context. Keep it concise (<200 lines).
 * Detailed references are in ./references/ and loaded on demand.
 */
export const agentBrowserSkill = `
# Browser Automation

## Snapshot Strategy (CRITICAL)

Snapshots are your eyes. Without fresh snapshots, you are flying blind.

1. **Full snapshot first**: After \`open\` or any navigation, ALWAYS run \`snapshot\` (not \`snapshot -i\`) to understand the full page
2. **Scope on complex pages**: If the page has heavy navigation/sidebar/footer (Drupal, WordPress), immediately follow with \`snapshot -s "form"\` or \`snapshot -s "main"\` to focus on the content area
3. **Re-snapshot after every DOM change**: After click, select, fill-that-triggers-dynamic-fields, or navigation — ALWAYS snapshot again before the next interaction. Refs go stale after DOM changes.
4. **Use \`snapshot -i\` sparingly**: Only when you specifically want just interactive refs. Prefer full or scoped snapshots to maintain context.

## Core Workflow

1. **Navigate**: \`open <url>\`, then \`wait --load networkidle\`
2. **Snapshot**: \`snapshot\` → then \`snapshot -s "form"\` on complex pages
3. **Interact**: Use label locators or refs (see Selector Strategy)
4. **Re-snapshot**: After EVERY DOM-changing action

## Selector Strategy (in order of preference)

### 1. Label Locators (BEST for forms)
\`\`\`
browser({ command: "find label \\"First Name\\" fill \\"John\\"" })
browser({ command: "find label \\"Email\\" fill \\"john@example.com\\"" })
browser({ command: "find label \\"Yes\\" click" })  // Checkboxes/radios
\`\`\`

### 2. Refs from Snapshot
\`\`\`
browser({ command: "snapshot -i" })
browser({ command: "fill @e1 \\"John\\"" })
browser({ command: "click @e2" })
\`\`\`

### 3. Tab Navigation (when labels/refs fail)
\`\`\`
browser({ command: "find label \\"First Name\\" fill \\"John\\"" })
browser({ command: "press Tab" })
browser({ command: "type \\":focus\\" \\"Doe\\"" })
\`\`\`

### 4. CSS Selectors / DOM Inspection (last resort)
\`\`\`
browser({ command: "fill \\"#firstNameTxt\\" \\"John\\"" })
browser({ command: "eval \\"Array.from(document.querySelectorAll('input')).map(e => e.id).filter(Boolean).join(', ')\\"" })
\`\`\`

## Custom Dropdowns (Select2, Chosen, Drupal)

The \`select\` command ONLY works on native \`<select>\` elements. Many CMS forms (Drupal, WordPress) use Select2 or Chosen widgets that render custom HTML. Signs you're dealing with a custom dropdown:
- \`select\` command fails or does nothing
- Snapshot shows a \`<span>\` or \`<div>\` with class like "select2" instead of a \`<select>\`
- The dropdown trigger looks like a styled container, not a native select

**Pattern for custom dropdowns:**
\`\`\`
// 1. Click the dropdown trigger (the visible styled element, NOT a hidden <select>)
browser({ command: "click @e5" })
// 2. Wait for options to render
browser({ command: "wait 300" })
// 3. Snapshot to find the options (scope to dropdown panel if possible)
browser({ command: "snapshot -i" })
// 4. Click the desired option
browser({ command: "click @e12" })
// 5. Re-snapshot to confirm selection and get fresh refs
browser({ command: "snapshot -s \\"form\\"" })
\`\`\`

**If the dropdown has a search box** (common in Select2):
\`\`\`
browser({ command: "click @e5" })          // Open dropdown
browser({ command: "wait 300" })
browser({ command: "type \\":focus\\" \\"California\\"" })  // Type into search
browser({ command: "wait 300" })
browser({ command: "snapshot -i" })         // Find filtered options
browser({ command: "click @e12" })          // Click matching option
\`\`\`

## Essential Commands

### Navigation & Snapshot
- \`open <url>\` - Go to URL
- \`snapshot\` - Full accessibility tree (ALWAYS first)
- \`snapshot -s "form"\` - Scoped snapshot (complex pages)
- \`snapshot -i\` - Interactive elements with refs only
- \`back\` / \`forward\` / \`reload\` - Browser navigation

### Interaction
- \`fill <sel> "text"\` - Clear and fill field
- \`type <sel> "text"\` - Append text (use for search boxes)
- \`click <sel>\` - Click element
- \`select <sel> "option"\` - Native dropdown only
- \`check <sel>\` / \`uncheck <sel>\` - Toggle checkbox
- \`press Enter\` - Press key (Tab, Escape, ArrowDown)
- \`find label "Name" fill "value"\` - Fill by accessible label
- \`scrollintoview @e1\` - Scroll element into view

### Information & Waiting
- \`get text <sel>\` / \`get value <sel>\` / \`get url\`
- \`wait <sel>\` / \`wait 2000\` / \`wait --load networkidle\`
- \`scroll down 500\` / \`scroll up 300\`

## Form Workflow Example (with proper snapshot discipline)

\`\`\`
browser({ command: "open https://example.com/application" })
browser({ command: "wait --load networkidle" })
browser({ command: "snapshot" })              // 1. Full snapshot first

// Complex page? Scope to the form area
browser({ command: "snapshot -s \\"form\\"" })   // 2. Reduces 200+ elements to just form fields

// Fill text fields using labels
browser({ command: "find label \\"First Name\\" fill \\"John\\"" })
browser({ command: "find label \\"Last Name\\" fill \\"Doe\\"" })
browser({ command: "find label \\"Email\\" fill \\"john@example.com\\"" })

// Radio button — click then re-snapshot (DOM may change with conditional fields)
browser({ command: "find label \\"Yes\\" click" })
browser({ command: "snapshot -s \\"form\\"" })   // 3. Re-snapshot: radio may reveal new fields

// Custom dropdown (Select2) — NOT a native select
browser({ command: "click @e8" })              // Click dropdown trigger
browser({ command: "wait 300" })
browser({ command: "snapshot -i" })            // Find dropdown options
browser({ command: "click @e15" })             // Click desired option
browser({ command: "snapshot -s \\"form\\"" })   // 4. Re-snapshot after selection

// Scroll to see more fields if form is long
browser({ command: "scrollintoview @e20" })
browser({ command: "snapshot -s \\"form\\"" })   // 5. Fresh refs after scroll

browser({ command: "snapshot" })               // Final verification before submit
\`\`\`

## CAPTCHA Handling

The browser has auto-CAPTCHA solving (Kernel stealth mode):
- If you see Cloudflare/reCAPTCHA, just \`wait 5000\` or \`wait 10000\`
- Do NOT click on CAPTCHA checkboxes - let the auto-solver handle it

## Forbidden Actions

- NEVER use \`eval\` to enable disabled buttons or bypass validation
- NEVER use \`eval\` to modify form state or hidden fields
- If a button is disabled, fill the required fields - don't force-enable it
`;
