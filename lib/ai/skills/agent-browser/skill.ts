/**
 * Agent-browser skill - Core workflow for browser automation.
 *
 * This is the main skill loaded into context. Keep it concise (<200 lines).
 * Detailed references are in ./references/ and loaded on demand.
 */
export const agentBrowserSkill = `
# Browser Automation

## MANDATORY RULES — Read Before Anything Else

1. **ALWAYS use snapshot refs (@e1, @e2, etc.) to interact with form fields.** Take a snapshot, read the refs, use them. This is the PRIMARY method. Do NOT skip snapshots and jump to \`getbylabel\` or CSS selectors.
2. **NEVER use \`getbylabel\` on forms with repeated sections** (e.g. home address + mailing address + facility address). Labels like "First Name", "Street Address", "Zip Code", "Birthdate" will match multiple fields and cause strict-mode violations. Use refs instead.
3. **NEVER include asterisks or colons in \`getbylabel\` labels.** Use \`"First Name"\` — NOT \`"First Name: *"\` or \`"First Name:"\`.
4. **Use \`type\` (NOT \`fill\`) for masked/formatted fields** — SSN, birthdate, phone, state, zip. \`fill\` bypasses JS input masks and the value silently fails. Click first, then \`type\` with \`clear: true\`, then verify with \`inputvalue\`.
5. **Use \`fill\` ONLY for plain text fields** — name, address, city, email. Nothing with formatting.
6. **NEVER mention technical terms in your text messages.** No refs, selectors, snapshot, DOM, field IDs, evaluate, CSS, getbylabel, strict mode, interactive elements, or any code-related terms. Your audience is a caseworker. Describe actions in human terms only: "Filling in the personal information" — NOT "I have all the refs" or "Using CSS selectors".

## Snapshot Strategy (CRITICAL)

Snapshots are your eyes. Without fresh snapshots, you are flying blind.

1. **Full snapshot first**: After navigating, ALWAYS run \`{ action: "snapshot" }\` (not interactive-only) to understand the full page
2. **Scope on complex pages**: If the page has heavy navigation/sidebar/footer (Drupal, WordPress), immediately follow with \`{ action: "snapshot", selector: "form" }\` or \`{ action: "snapshot", selector: "main" }\` to focus on the content area
3. **Re-snapshot after every DOM change**: After click, select, fill-that-triggers-dynamic-fields, or navigation — ALWAYS snapshot again before the next interaction. Refs go stale after DOM changes.
4. **Use \`{ action: "snapshot", interactive: true }\` sparingly**: Only when you specifically want just interactive refs. Prefer full or scoped snapshots to maintain context.

## Core Workflow

1. **Navigate**: \`{ action: "navigate", url: "<url>" }\`, then \`{ action: "waitforloadstate", state: "networkidle" }\`
2. **Snapshot**: \`{ action: "snapshot" }\` → then \`{ action: "snapshot", selector: "form" }\` on complex pages
3. **Read the refs**: The snapshot gives you refs like @e3, @e4, @e7. USE THEM for all interactions.
4. **Interact using refs**: \`{ action: "fill", selector: "@e3", value: "John" }\`
5. **Re-snapshot**: After EVERY DOM-changing action — refs go stale

## Selector Strategy (in order of preference)

### 1. Refs from Snapshot (USE THIS — mandatory for form filling)
After every snapshot you get refs. These are unambiguous and never cause strict-mode violations. **This is your default method for all form interactions.**
\`\`\`
browser({ action: "snapshot", selector: "form" })
// Snapshot shows: textbox "First Name" [ref=@e3], textbox "Last Name" [ref=@e4]
//                 textbox "SSN" [ref=@e8], textbox "Birthdate" [ref=@e9]
//                 checkbox "Yes" [ref=@e7]

// Plain text fields: use fill with refs
browser({ action: "fill", selector: "@e3", value: "John" })
browser({ action: "fill", selector: "@e4", value: "Doe" })

// Masked fields: click + type with refs, then verify
browser({ action: "click", selector: "@e8" })
browser({ action: "type", selector: "@e8", text: "123456789", clear: true })
browser({ action: "inputvalue", selector: "@e8" })  // Verify it stuck

browser({ action: "click", selector: "@e9" })
browser({ action: "type", selector: "@e9", text: "01022000", clear: true })
browser({ action: "inputvalue", selector: "@e9" })  // Verify it stuck

// Checkboxes/radios: click with refs
browser({ action: "click", selector: "@e7" })
\`\`\`

### 2. Label Locators (ONLY when you have no snapshot refs AND the label is unique)
\`getbylabel\` is a fallback, not the default. Only use it when:
- You do NOT have snapshot refs available
- The label text is **globally unique** on the entire page (not just the visible section)
- The form does NOT have repeated sections (address/mailing/facility, applicant/household)

**NEVER use \`getbylabel\` for**: "Yes", "No", "Male", "Female", "First Name", "Last Name", "Street Address", "City", "State", "Zip Code", "Birthdate", "Phone" — these commonly appear multiple times on benefit application forms.

**NEVER include** asterisks (\`*\`), colons (\`:\`), or required-field indicators in the label text.
\`\`\`
// GOOD — unique label, no punctuation
browser({ action: "getbylabel", label: "Social Security Number", subaction: "fill", value: "123456789" })
// BAD — will match multiple fields
browser({ action: "getbylabel", label: "First Name:", subaction: "fill", value: "John" })
// BAD — includes asterisk
browser({ action: "getbylabel", label: "First Name: *", subaction: "fill", value: "John" })
\`\`\`

### 3. Tab Navigation (when labels/refs fail)
\`\`\`
browser({ action: "click", selector: "@e3" })  // Focus first field
browser({ action: "press", key: "Tab" })
browser({ action: "type", selector: ":focus", text: "Doe" })
\`\`\`

### 4. CSS Selectors / DOM Inspection (last resort)
\`\`\`
browser({ action: "fill", selector: "#firstNameTxt", value: "John" })
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
- \`{ action: "back" }\` / \`{ action: "forward" }\` - Browser navigation (AVOID during form filling — may wipe state)

### Interaction
- \`{ action: "fill", selector: "<sel>", value: "text" }\` - Clear and fill field (plain text only: name, address, city, email)
- \`{ action: "type", selector: "<sel>", text: "text", clear: true }\` - Simulate keystrokes (REQUIRED for masked/formatted fields: SSN, date, phone, state, zip)
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

## Masked/Formatted Fields (CRITICAL)

Many form fields (SSN, birthdate, phone, state, zip) have JavaScript input masks or \`maxlength\` constraints.

**\`fill\` vs \`type\`**: The \`fill\` action sets values programmatically, **bypassing** JS event handlers — masked fields will silently reject or wipe the value. Use \`type\` with \`clear: true\` for these fields, which simulates real keystrokes and triggers the JS formatters.

**Rule of thumb**: \`fill\` for plain text (name, address, city, email). \`type\` for anything with formatting (SSN, date, phone, state, zip).

**Respect \`maxlength\`**: Strip dashes, slashes, spaces so digits fit. Examples:
- SSN \`maxlength="9"\` → \`"123456789"\`
- Date \`maxlength="8"\` → \`"01022000"\`
- Phone \`maxlength="10"\` → \`"7775551234"\`
- State \`maxlength="2"\` → \`"CA"\`

**Always verify**: After typing into masked fields, use \`inputvalue\` to confirm the value stuck. If empty/wrong, click the field, wait, and re-type.

## Form Workflow Example (with proper snapshot discipline)

\`\`\`
browser({ action: "navigate", url: "https://example.com/application" })
browser({ action: "waitforloadstate", state: "networkidle" })
browser({ action: "snapshot" })              // 1. Full snapshot first

// Complex page? Scope to the form area
browser({ action: "snapshot", selector: "form" })   // 2. Reduces 200+ elements to just form fields
// Snapshot shows refs: textbox "First Name" [ref=@e3], textbox "Last Name" [ref=@e4],
//   textbox "Email" [ref=@e5], radio "Yes" [ref=@e7], textbox "SSN" [ref=@e10],
//   textbox "Birthdate" [ref=@e11], textbox "Phone" [ref=@e12]

// Plain text fields — use fill with refs
browser({ action: "fill", selector: "@e3", value: "John" })
browser({ action: "fill", selector: "@e4", value: "Doe" })
browser({ action: "fill", selector: "@e5", value: "john@example.com" })

// Masked fields — click + type with refs, then verify
browser({ action: "click", selector: "@e10" })
browser({ action: "type", selector: "@e10", text: "123456789", clear: true })
browser({ action: "inputvalue", selector: "@e10" })  // Verify SSN stuck

browser({ action: "click", selector: "@e11" })
browser({ action: "type", selector: "@e11", text: "01022000", clear: true })
browser({ action: "inputvalue", selector: "@e11" })  // Verify birthdate stuck

browser({ action: "click", selector: "@e12" })
browser({ action: "type", selector: "@e12", text: "7775551234", clear: true })
browser({ action: "inputvalue", selector: "@e12" })  // Verify phone stuck

// Radio button — click ref, then re-snapshot (DOM may change with conditional fields)
browser({ action: "click", selector: "@e7" })
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

## Modals, Dialogs & Popups

When a modal or popup appears (cookie consent, terms, confirmation, error, login prompt, etc.), it blocks interaction with the page behind it. Elements behind the modal will time out if you try to interact with them.

**How to detect**: After any action that navigates or changes the page, take a snapshot. A modal is likely present if:
- The snapshot returns very little content (under ~100 characters) — the modal overlay is hiding the accessibility tree of the page behind it
- You see a \`dialog\`, \`[role="dialog"]\`, or overlay with only a few elements (buttons like "OK", "Accept", "Close", "Continue", "USE THIS ADDRESS")
- You see a small set of elements instead of the expected form content
- Multiple modals can appear sequentially on the same page (e.g. address validation → county selection)

**What to do**:
1. **Stop** what you were doing — do NOT try to fill or click elements behind the modal
2. **Resolve the modal first** — if the snapshot is nearly empty, try \`{ action: "snapshot", selector: "[role=dialog]" }\` or \`{ action: "snapshot", selector: ".modal" }\` to find the modal content. Use the refs from that snapshot to interact with it.
3. **Re-snapshot after dismissing** — check if ANOTHER modal appeared. Repeat until you get a full page snapshot back.
4. **Then resume** your previous task using snapshot + refs as normal

**CRITICAL**: If snapshots return empty/minimal content, this does NOT mean snapshots are broken. It means a modal is blocking. Do NOT fall back to \`evaluate\` — instead, find and dismiss the modal. Once the modal is resolved, snapshots will work normally again.

This applies to all types of overlays: cookie banners, session timeout warnings, confirmation dialogs, address validation modals, county selection popups, error popups, terms modals, etc.

## CAPTCHA & Turnstile Handling

The browser runs in Kernel stealth mode with an **auto-solver** that handles Cloudflare Turnstile, reCAPTCHA, and similar challenges automatically in the background.

**Important**: The auto-solver works asynchronously. It may solve the challenge BEFORE the page UI updates, so:
- A submit button may appear disabled even though the CAPTCHA is already solved
- A CAPTCHA checkbox may appear unchecked even though it has been completed
- The Turnstile token is injected into a hidden field — the visible widget may lag behind

**What to do**:
1. Do NOT click on CAPTCHA checkboxes or interact with challenge widgets — let the auto-solver handle it
2. If a submit button is disabled and you've filled all required fields, wait for the CAPTCHA to resolve: \`{ action: "wait", timeout: 5000 }\` then re-check
3. If still disabled after waiting, take a snapshot to check for missing required fields — the issue is likely unfilled fields, not the CAPTCHA
4. Do NOT use \`evaluate\` to debug why the submit button is disabled — the most common causes are: (a) CAPTCHA still solving (wait), (b) required fields not filled (snapshot and check), (c) the form doesn't allow submission and the agent should stop anyway per instructions

## Forbidden Actions

- NEVER use \`evaluate\` to find, search for, click, fill, select, or check elements. Always use the proper actions (\`snapshot\`, \`click\`, \`fill\`, \`type\`, \`select\`, \`check\`). If you need to find something, use a snapshot — it gives you refs you can interact with directly.
- NEVER use \`evaluate\` as a fallback when snapshots return empty/minimal content. Empty snapshots mean a modal is blocking — find and dismiss the modal, then snapshots will work again. Do NOT switch to using \`evaluate\` for the rest of the session.
- NEVER use \`evaluate\` to enable disabled buttons or bypass validation
- NEVER use \`evaluate\` to modify form state or hidden fields
- \`evaluate\` is ONLY acceptable for reading simple values (e.g. checking a field's maxLength)
- If a button is disabled, fill the required fields — don't force-enable it
- NEVER use \`reload\` while filling a form — reloading wipes all form state and you lose everything you filled. If a page appears blank or a snapshot returns very little content, wait a moment and re-snapshot. If still blank, it's likely a modal overlay or a page transition — do NOT reload.
- NEVER use \`back\` during multi-page form filling unless recovering from an error — going back may also wipe form state on the current page

## Parameter Types

Always use correct JSON types — the browser will error on wrong types:
- \`timeout\` must be a number: \`{ action: "wait", timeout: 1000 }\` NOT \`"1000"\`
- \`interactive\` must be a boolean: \`{ action: "snapshot", interactive: true }\` NOT \`"true"\`
`;
