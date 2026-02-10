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

1. **Full snapshot first**: After navigating, ALWAYS run \`{ action: "snapshot" }\` (not interactive-only) to understand the full page
2. **Scope on complex pages**: If the page has heavy navigation/sidebar/footer (Drupal, WordPress), immediately follow with \`{ action: "snapshot", selector: "form" }\` or \`{ action: "snapshot", selector: "main" }\` to focus on the content area
3. **Re-snapshot after every DOM change**: After click, select, fill-that-triggers-dynamic-fields, or navigation — ALWAYS snapshot again before the next interaction. Refs go stale after DOM changes.
4. **Use \`{ action: "snapshot", interactive: true }\` sparingly**: Only when you specifically want just interactive refs. Prefer full or scoped snapshots to maintain context.

## Core Workflow

1. **Navigate**: \`{ action: "navigate", url: "<url>" }\`, then \`{ action: "waitforloadstate", state: "networkidle" }\`
2. **Snapshot**: \`{ action: "snapshot" }\` → then \`{ action: "snapshot", selector: "form" }\` on complex pages
3. **Interact**: Use label locators or refs (see Selector Strategy)
4. **Re-snapshot**: After EVERY DOM-changing action

## Selector Strategy (in order of preference)

### 1. Label Locators (BEST for forms)
\`\`\`
browser({ action: "getbylabel", label: "First Name", subaction: "fill", value: "John" })
browser({ action: "getbylabel", label: "Email", subaction: "fill", value: "john@example.com" })
browser({ action: "getbylabel", label: "Yes", subaction: "click" })  // Checkboxes/radios
\`\`\`

### 2. Refs from Snapshot
\`\`\`
browser({ action: "snapshot", interactive: true })
browser({ action: "fill", selector: "@e1", value: "John" })
browser({ action: "click", selector: "@e2" })
\`\`\`

### 3. Tab Navigation (when labels/refs fail)
\`\`\`
browser({ action: "getbylabel", label: "First Name", subaction: "fill", value: "John" })
browser({ action: "press", key: "Tab" })
browser({ action: "type", selector: ":focus", text: "Doe" })
\`\`\`

### 4. CSS Selectors / DOM Inspection (last resort)
\`\`\`
browser({ action: "fill", selector: "#firstNameTxt", value: "John" })
browser({ action: "evaluate", script: "Array.from(document.querySelectorAll('input')).map(e => e.id).filter(Boolean).join(', ')" })
\`\`\`

## Custom Dropdowns (Select2, Chosen, Drupal)

The \`select\` action ONLY works on native \`<select>\` elements. Many CMS forms (Drupal, WordPress) use Select2 or Chosen widgets that render custom HTML. Signs you're dealing with a custom dropdown:
- \`select\` command fails or does nothing
- Snapshot shows a \`<span>\` or \`<div>\` with class like "select2" instead of a \`<select>\`
- The dropdown trigger looks like a styled container, not a native select

**Pattern for custom dropdowns:**
\`\`\`
// 1. Click the dropdown trigger (the visible styled element, NOT a hidden <select>)
browser({ action: "click", selector: "@e5" })
// 2. Wait for options to render
browser({ action: "wait", timeout: 300 })
// 3. Snapshot to find the options (scope to dropdown panel if possible)
browser({ action: "snapshot", interactive: true })
// 4. Click the desired option
browser({ action: "click", selector: "@e12" })
// 5. Re-snapshot to confirm selection and get fresh refs
browser({ action: "snapshot", selector: "form" })
\`\`\`

**If the dropdown has a search box** (common in Select2):
\`\`\`
browser({ action: "click", selector: "@e5" })          // Open dropdown
browser({ action: "wait", timeout: 300 })
browser({ action: "type", selector: ":focus", text: "California" })  // Type into search
browser({ action: "wait", timeout: 300 })
browser({ action: "snapshot", interactive: true })         // Find filtered options
browser({ action: "click", selector: "@e12" })          // Click matching option
\`\`\`

## Essential Commands

### Navigation & Snapshot
- \`{ action: "navigate", url: "<url>" }\` - Go to URL
- \`{ action: "snapshot" }\` - Full accessibility tree (ALWAYS first)
- \`{ action: "snapshot", selector: "form" }\` - Scoped snapshot (complex pages)
- \`{ action: "snapshot", interactive: true }\` - Interactive elements with refs only
- \`{ action: "back" }\` / \`{ action: "forward" }\` / \`{ action: "reload" }\` - Browser navigation

### Interaction
- \`{ action: "fill", selector: "<sel>", value: "text" }\` - Clear and fill field
- \`{ action: "type", selector: "<sel>", text: "text" }\` - Append text (use for search boxes)
- \`{ action: "click", selector: "<sel>" }\` - Click element
- \`{ action: "select", selector: "<sel>", values: ["option"] }\` - Native dropdown only
- \`{ action: "check", selector: "<sel>" }\` / \`{ action: "uncheck", selector: "<sel>" }\` - Toggle checkbox
- \`{ action: "press", key: "Enter" }\` - Press key (Tab, Escape, ArrowDown)
- \`{ action: "getbylabel", label: "Name", subaction: "fill", value: "val" }\` - Fill by accessible label
- \`{ action: "scrollintoview", selector: "@e1" }\` - Scroll element into view

### Information & Waiting
- \`{ action: "gettext", selector: "<sel>" }\` / \`{ action: "inputvalue", selector: "<sel>" }\` / \`{ action: "url" }\`
- \`{ action: "wait", selector: "<sel>" }\` / \`{ action: "wait", timeout: 2000 }\` / \`{ action: "waitforloadstate", state: "networkidle" }\`
- \`{ action: "scroll", direction: "down", amount: 500 }\` / \`{ action: "scroll", direction: "up", amount: 300 }\`

## Form Workflow Example (with proper snapshot discipline)

\`\`\`
browser({ action: "navigate", url: "https://example.com/application" })
browser({ action: "waitforloadstate", state: "networkidle" })
browser({ action: "snapshot" })              // 1. Full snapshot first

// Complex page? Scope to the form area
browser({ action: "snapshot", selector: "form" })   // 2. Reduces 200+ elements to just form fields

// Fill text fields using labels
browser({ action: "getbylabel", label: "First Name", subaction: "fill", value: "John" })
browser({ action: "getbylabel", label: "Last Name", subaction: "fill", value: "Doe" })
browser({ action: "getbylabel", label: "Email", subaction: "fill", value: "john@example.com" })

// Radio button — click then re-snapshot (DOM may change with conditional fields)
browser({ action: "getbylabel", label: "Yes", subaction: "click" })
browser({ action: "snapshot", selector: "form" })   // 3. Re-snapshot: radio may reveal new fields

// Custom dropdown (Select2) — NOT a native select
browser({ action: "click", selector: "@e8" })              // Click dropdown trigger
browser({ action: "wait", timeout: 300 })
browser({ action: "snapshot", interactive: true })          // Find dropdown options
browser({ action: "click", selector: "@e15" })             // Click desired option
browser({ action: "snapshot", selector: "form" })          // 4. Re-snapshot after selection

// Scroll to see more fields if form is long
browser({ action: "scrollintoview", selector: "@e20" })
browser({ action: "snapshot", selector: "form" })   // 5. Fresh refs after scroll

browser({ action: "snapshot" })               // Final verification before submit
\`\`\`

## CAPTCHA Handling

The browser has auto-CAPTCHA solving (Kernel stealth mode):
- If you see Cloudflare/reCAPTCHA, just \`{ action: "wait", timeout: 5000 }\` or \`{ action: "wait", timeout: 10000 }\`
- Do NOT click on CAPTCHA checkboxes - let the auto-solver handle it

## Forbidden Actions

- NEVER use \`evaluate\` to enable disabled buttons or bypass validation
- NEVER use \`evaluate\` to modify form state or hidden fields
- If a button is disabled, fill the required fields - don't force-enable it
`;
