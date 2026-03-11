/**
 * Agent-browser skill - Core workflow for browser automation.
 *
 * This is the main skill loaded into context. Keep it concise.
 * Detailed references are in ./references/ and loaded on demand.
 */
export const agentBrowserSkill = `
# Browser Automation

## MANDATORY RULES — Read Before Anything Else

1. **ALWAYS use snapshot refs (@e1, @e2) OR CSS IDs (#fieldId) to interact with form fields.** Take a snapshot — it shows both refs and IDs. Use whichever you have. NEVER skip the snapshot and jump straight to \`getbylabel\`.
2. **NEVER use \`getbylabel\` when the element has an ID** (which is almost always). If the snapshot shows \`[id="firstNameTxt"]\`, use \`#firstNameTxt\` — not \`getbylabel\`. Only use \`getbylabel\` when a label is globally unique AND the element has no ID at all.
3. **NEVER include asterisks or colons in \`getbylabel\` labels.** Use \`"First Name"\` — NOT \`"First Name: *"\` or \`"First Name:"\`.
4. **Use \`type\` (NOT \`fill\`) for masked/formatted fields** — SSN, birthdate, phone, state, zip. \`fill\` bypasses JS input masks and the value silently fails. Click first, then \`type\` with \`clear: true\`, then verify with \`inputvalue\`.
5. **Use \`fill\` ONLY for plain text fields** — name, address, city, email. Nothing with formatting.
6. **NEVER mention technical terms in your text messages.** No refs, selectors, snapshot, DOM, field IDs, evaluate, CSS, getbylabel, strict mode, interactive elements, or any code-related terms. Your audience is a caseworker. Describe actions in human terms only: "Filling in the personal information" — NOT "I have all the refs" or "Using CSS selectors".
7. **Call multiple tools in parallel when they are independent.** After a snapshot gives you refs, you can fill/type multiple fields simultaneously in one response. You can also fetch database records while navigating the browser. Do NOT parallelize actions that depend on each other (e.g., snapshot then use refs from that snapshot).
8. **\`evaluate\` is for workarounds, not form filling.** Use it to remove overlays (Google Translate bar), enable a stuck submit button after CAPTCHA solves, or read field attributes. NEVER use it to find, click, fill, or check elements — use the proper actions instead. For disabled submit buttons, follow the CAPTCHA section step by step before using evaluate.

## Snapshot Strategy (CRITICAL)

Snapshots are your eyes. Without fresh snapshots, you are flying blind.

1. **Full snapshot first**: After navigating, ALWAYS run \`{ action: "snapshot" }\` (not interactive-only) to understand the full page
2. **Scope on complex pages**: If the page has heavy navigation/sidebar/footer (Drupal, WordPress), immediately follow with \`{ action: "snapshot", selector: "form" }\` or \`{ action: "snapshot", selector: "main" }\` to focus on the content area
3. **Re-snapshot after every DOM change**: After click, select, fill-that-triggers-dynamic-fields, or navigation — ALWAYS snapshot again before the next interaction. Refs go stale after DOM changes.
4. **Use \`{ action: "snapshot", interactive: true }\` sparingly**: Only when you specifically want just interactive refs. Prefer full or scoped snapshots to maintain context.

## Core Workflow

1. **Navigate**: \`{ action: "navigate", url: "<url>" }\` (already waits for page load internally — do NOT add a separate waitforloadstate)
2. **Snapshot**: \`{ action: "snapshot" }\` → then \`{ action: "snapshot", selector: "form" }\` on complex pages
3. **Read the refs**: The snapshot gives you refs like @e3, @e4, @e7. USE THEM for all interactions.
4. **Interact using refs**: \`{ action: "fill", selector: "@e3", value: "John" }\`
5. **Re-snapshot**: After EVERY DOM-changing action — refs go stale

**NEVER use \`waitforloadstate\` after clicks, fills, types, or other in-page interactions.** It wastes a tool call. Only use it after navigating to a completely new URL via a link or form submission, and only if the page has heavy async content that loads after the initial page load.

## Selector Strategy

### 1. Refs (@e3) OR CSS IDs (#id) — both are first-class, use whichever is available
After a snapshot you get refs. If the snapshot also shows \`[id="..."]\` on an element, you can use \`#id\` directly — CSS IDs are stable across DOM changes and don't go stale. **Use either — they are equally valid.**

\`\`\`
browser({ action: "snapshot", selector: "form" })
// Snapshot shows: textbox "First Name" [ref=@e3] [id="firstNameTxt"]
//                 textbox "SSN"        [ref=@e8] [id="ssnTxt"]
//                 checkbox "Yes"       [ref=@e7] [id="chkBxApplyYourselfYes"]

// Using refs:
browser({ action: "fill", selector: "@e3", value: "John" })
// OR using CSS IDs (equally valid, more stable):
browser({ action: "fill", selector: "#firstNameTxt", value: "John" })

// Masked fields — click + type + verify:
browser({ action: "click", selector: "#ssnTxt" })
browser({ action: "type", selector: "#ssnTxt", text: "123456789", clear: true })
browser({ action: "inputvalue", selector: "#ssnTxt" })  // Verify it stuck

// Checkboxes — use the specific ID to avoid ambiguity:
browser({ action: "check", selector: "#chkBxApplyYourselfYes" })
\`\`\`

### 2. Label Locators (almost never — only for truly unique labels with no ID)
\`getbylabel\` causes strict-mode violations whenever a label appears more than once. On benefit forms, "First Name", "State", "Yes", "No" etc. appear for applicant, representative, mailing address, and household — always causing failures.

**NEVER use \`getbylabel\` for**: "Yes", "No", "Male", "Female", "First Name", "Last Name", "Street Address", "City", "State", "Zip Code", "Birthdate", "Phone". **NEVER include** asterisks (\`*\`) or colons (\`:\`) in the label text.
\`\`\`
// Only acceptable when label is globally unique AND no ID available:
browser({ action: "getbylabel", label: "Social Security Number", subaction: "fill", value: "123456789" })
\`\`\`

### 3. Tab Navigation (when all else fails)
\`\`\`
browser({ action: "click", selector: "@e3" })  // Focus first field
browser({ action: "press", key: "Tab" })
browser({ action: "type", selector: ":focus", text: "Doe" })
\`\`\`

## Custom Dropdowns (Select2, Chosen, Drupal)

If \`select\` fails, the dropdown is a custom widget. Click the trigger → wait → snapshot → click the option → re-snapshot. See \`references/form-automation.md\` for detailed patterns including Select2 search boxes.

## Essential Commands

### Navigation & Snapshot
- \`{ action: "navigate", url: "<url>" }\` - Go to URL (already waits for load)
- \`{ action: "snapshot" }\` - Full accessibility tree (ALWAYS first)
- \`{ action: "snapshot", selector: "form" }\` - Scoped snapshot (complex pages)
- \`{ action: "snapshot", interactive: true }\` - Interactive elements with refs only
- \`{ action: "url" }\` - Get current URL (use to verify you're still on the right domain)
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
- \`{ action: "gettext", selector: "<sel>" }\` / \`{ action: "inputvalue", selector: "<sel>" }\`
- \`{ action: "wait", selector: "<sel>" }\` / \`{ action: "wait", timeout: 2000 }\` — use sparingly, only when waiting for async content
- \`{ action: "waitforloadstate", state: "networkidle" }\` — RARELY needed. Navigate already waits for load. Only use after full-page navigations via link clicks, never after fills/types/clicks on form elements
- \`{ action: "scroll", direction: "down", amount: 500 }\` / \`{ action: "scroll", direction: "up", amount: 300 }\`

### Tabs & Dialogs
- \`{ action: "tab_list" }\` - List open tabs
- \`{ action: "tab_new", url: "<url>" }\` - Open new tab (optionally with URL)
- \`{ action: "tab_switch", index: 2 }\` - Switch to tab by index
- \`{ action: "tab_close" }\` - Close current tab
- \`{ action: "dialog", response: "accept" }\` / \`{ action: "dialog", response: "dismiss" }\` - Handle browser dialogs
- \`{ action: "frame", selector: "#iframe" }\` - Switch to iframe
- \`{ action: "mainframe" }\` - Return to main frame

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

## Modals, Dialogs & Popups

Modals block interaction with the page behind them. Empty/minimal snapshots mean a modal is blocking — NOT that snapshots are broken. Modals often set \`aria-hidden="true"\` on the page root, which is why snapshots return empty. Do NOT use \`evaluate\` to remove \`aria-hidden\` or read \`innerText\` — find the modal instead.

Multiple modals can appear in sequence (e.g. address validation → county selection). Always loop until the page is clear.

**Workflow:**
1. Snapshot the page
2. If minimal content → modal is present. Snapshot with: \`selector: "[role=dialog]"\`, or \`.ReactModal__Overlay\`, or \`.modal\`, or \`[aria-modal=true]\`
3. Use refs from that snapshot to interact — if there's a native \`<select>\`/combobox, use \`select\`; if it's a custom dropdown (button that opens a listbox), click to open → snapshot again → click the option
4. After dismissing, go back to step 1 — another modal may have appeared
5. When the full page is visible again, resume normal workflow

**County/location selection modals** (common on benefits sites): These often appear after address entry. The modal contains a dropdown (native or custom) and a Continue button. Scope your snapshot to \`[role=dialog]\`, select the county, click Continue. Do NOT use \`evaluate\` to dismiss these — use the refs.

### Google Translate Bar

Government and health sites often have a Google Translate bar injected at the top of the page. This renders as a floating element that can block clicks on form fields below it. **Always keep the form in English** — dismiss or hide the translate bar if it's interfering.

If elements report "blocked by another element" and you suspect the translate bar:
1. Dismiss it via evaluate: \`{ action: "evaluate", script: "document.querySelector('.VIpgJd-yAWNEb-hvhgNd') && document.querySelector('.VIpgJd-yAWNEb-hvhgNd').remove()" }\`
2. Re-snapshot and continue — the form fields should now be accessible

## CAPTCHA & Turnstile Handling

The browser runs in Kernel stealth mode with an **auto-solver** that handles Cloudflare Turnstile, reCAPTCHA, and similar challenges automatically in the background.

**Important**: The auto-solver works asynchronously. It may solve the challenge BEFORE the page UI updates, so:
- A submit button may appear disabled even though the CAPTCHA is already solved
- A CAPTCHA checkbox may appear unchecked even though it has been completed
- The Turnstile token is injected into a hidden field — the visible widget may lag behind

**What to do**:
1. Do NOT click on CAPTCHA checkboxes or interact with challenge widgets — let the auto-solver handle it
2. If elements report "blocked by another element" on a page with a CAPTCHA, the auto-solver is likely mid-solve and has scrolled the viewport or placed an overlay temporarily. **Wait briefly and retry** — do NOT treat this as a hard blocker:
   - \`{ action: "wait", timeout: 3000 }\` then retry the blocked action
   - You can continue doing other independent work (gap analysis, database lookups) while waiting — the auto-solver runs in the background
3. If a submit button is disabled and you've filled all required fields, wait for the CAPTCHA to resolve: \`{ action: "wait", timeout: 5000 }\` then re-check
4. If still disabled after waiting, take a snapshot to check for missing required fields — the issue is likely unfilled fields, not the CAPTCHA
5. **Verification checklist** — if submit is still disabled after the 5-second wait, take a snapshot and confirm ALL of the following: (a) all required fields are filled, (b) the CAPTCHA/Turnstile widget visually shows solved/success (green checkmark, "Success", etc.), (c) no error messages are displayed on the page
6. **Captcha-stuck-button fix** — if ALL three conditions above are confirmed (fields filled + captcha solved + no errors) and the submit button is STILL disabled, the captcha solver succeeded but the form's JS failed to re-enable the button. Use **exactly this script and nothing else**:
   \`{ action: "evaluate", script: "const btn = document.querySelector('#btnSubmit, [type=\\"submit\\"]:disabled, button[type=\\"submit\\"]:disabled'); if (btn) btn.removeAttribute('disabled');" }\`
   Do NOT invent your own JavaScript. Do NOT set JS variables like \`isCaptchaChecked\`, \`isExpanded\`, or any other page state. Do NOT click submit after this — proceed with \`formSummary\` as normal so the caseworker can review and submit manually.

## Form Completion Summary

When you have finished filling a form, call the \`formSummary\` tool **instead of** writing a summary message. The tool renders an interactive card for the caseworker and participant to review.

Categorize each field into ONE of three buckets:
- **fromDatabase**: values you pulled directly from the participant database (Apricot records)
- **fromCaseworker**: values the caseworker provided during this session (e.g., answers to a gap analysis, responses to your questions)
- **inferred**: values you reasoned from available data (e.g., "Lives alone — no household members listed", "Nearest clinic determined from home address")

After calling \`formSummary\`, write ONE short sentence like: "The form is filled out. Please review it and submit when you're ready."

Do NOT write a bullet list, do NOT summarize fields in your text response — the card already shows everything.

## Forbidden Actions

### Navigation Boundaries
Once you navigate to the target application, **stay on that domain.** NEVER click social media links (Facebook, Twitter/X, Instagram, YouTube, LinkedIn, TikTok), "Share"/"Follow" buttons, footer links to external sites, banner ads, or any link to a different domain. Focus ONLY on the form content area (\`main\`, \`form\`, \`#content\`). If you accidentally navigate away, immediately use \`{ action: "back" }\` to return, then re-snapshot.

### Evaluate

- NEVER use \`evaluate\` to find, search for, click, fill, select, or check elements. Always use the proper actions (\`snapshot\`, \`click\`, \`fill\`, \`type\`, \`select\`, \`check\`). If you need to find something, use a snapshot — it gives you refs you can interact with directly.
- NEVER use \`evaluate\` as a fallback when snapshots return empty/minimal content. Empty snapshots mean a modal is blocking — find and dismiss the modal, then snapshots will work again. Do NOT switch to using \`evaluate\` for the rest of the session.
- NEVER use \`evaluate\` to enable disabled buttons or bypass validation — **except** for the captcha-stuck-button fix described in the CAPTCHA section above (all three conditions must be confirmed first)
- NEVER use \`evaluate\` to modify form state or hidden fields
- \`evaluate\` is acceptable for: reading simple values (e.g. checking a field's maxLength), removing known third-party overlays that block clicks (e.g. Google Translate bar — see above), and removing the disabled attribute from submit buttons when the captcha solver succeeded but the form's JS failed to re-enable them (see CAPTCHA section)
- If a button is disabled, fill the required fields — don't force-enable it
- NEVER use \`reload\` while filling a form — reloading wipes all form state and you lose everything you filled. If a page appears blank or a snapshot returns very little content, wait a moment and re-snapshot. If still blank, it's likely a modal overlay or a page transition — do NOT reload.
- NEVER use \`back\` during multi-page form filling — going back wipes form state on the current page. The ONE exception: if you accidentally navigated off the target domain, use \`back\` to return immediately.

## Parameter Types

Always use correct JSON types — the browser will error on wrong types:
- \`timeout\` must be a number: \`{ action: "wait", timeout: 1000 }\` NOT \`"1000"\`
- \`interactive\` must be a boolean: \`{ action: "snapshot", interactive: true }\` NOT \`"true"\`
`;
