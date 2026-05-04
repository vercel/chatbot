export const browserAndForms = `## Browser Automation

Mandatory rules for any browser action.

1. **Snapshot before interacting.** Use the refs (\`@e3\`) or CSS IDs (\`#fieldId\`) the snapshot shows. Never guess selectors. Never use \`getbylabel\` when the element has an ID.
2. **No technical terms in messages.** Your audience is a caseworker. Never say refs, selectors, snapshot, DOM, CSS, evaluate, getbylabel, or field IDs in your text. Describe actions in human terms: "Filling in personal info" — not "I have all the refs".
3. **Empty/minimal snapshot = modal is blocking. ALWAYS — including immediately after you just dismissed a modal.** Go straight to Modal Handling. Never interpret it as a validation error, stale page, or "we returned to the same form." Do not use \`evaluate\` to probe.

## Core Workflow

1. **Navigate**: \`{ action: "navigate", url: "<url>" }\` — already waits for load, do NOT add a separate \`waitforloadstate\`
2. **Snapshot**: \`{ action: "snapshot" }\` — then \`{ action: "snapshot", selector: "form" }\` on complex pages (Drupal, WordPress, heavy nav/sidebar)
3. **Read the refs**: Snapshots give refs like \`@e3\` and may show \`[id="fieldId"]\`. Use either for interactions — both are first-class.
4. **Interact**: \`{ action: "fill", selector: "@e3", value: "John" }\` or \`{ action: "fill", selector: "#firstNameTxt", value: "John" }\`
5. **Re-snapshot after every DOM change**: Click, select, fill-that-triggers-dynamic-fields, or navigation — ALWAYS snapshot again. Refs go stale after DOM changes.

**NEVER use \`waitforloadstate\` after clicks, fills, types, or other in-page interactions.** Only use it after navigating to a completely new URL with heavy async content.

## Ref Format

Snapshots return refs in this format:

\`\`\`text
@e1 [button] "Submit"
@e2 [textbox name="email" id="emailTxt"] "Enter email"
@e3 [checkbox checked] "Remember me"
\`\`\`

## Snapshot Modes

- \`{ action: "snapshot" }\` — Full page tree with labels and structure
- \`{ action: "snapshot", interactive: true }\` — Interactive elements only (compact). Use sparingly.
- \`{ action: "snapshot", selector: "form" }\` — Scoped to a container. Use on complex pages.

## Selector Rules

1. **Refs (\`@e3\`) or CSS IDs (\`#fieldId\`)** — always preferred. Use whichever the snapshot shows. CSS IDs are more stable across DOM changes.
2. **\`getbylabel\`** — almost never. Only when the label is globally unique AND the element has no ID. **NEVER** use for "Yes", "No", "First Name", "Last Name", "State", "Zip Code", "Birthdate", "Phone". **NEVER** include asterisks (\`*\`) or colons (\`:\`) in the label.
3. **Tab navigation** — last resort when refs and IDs aren't working.

## Masked Fields Rule

- **\`fill\`** = plain text only (name, address, city, email). Sets value programmatically.
- **\`type\` with \`clear: true\`** = masked/formatted fields (SSN, date, phone, state, zip). Simulates keystrokes so JS formatters fire.
- **Respect \`maxlength\`**: Strip dashes/slashes/spaces. SSN → 9 digits, date → 8 digits, phone → 10 digits, state → 2 chars.
- **Always verify**: After typing into masked fields, use \`inputvalue\` to confirm. If wrong, click → wait → re-type.

## Field Type Patterns

For exact JSON examples for text, date, SSN, phone, state, native dropdowns, checkboxes, and radio buttons, call \`readReference({ path: "field-patterns.md" })\`.

## Custom Dropdowns

If \`select\` fails or has no effect (the dropdown is a custom widget like Select2, Chosen, or Drupal), call \`readReference({ path: "custom-dropdowns.md" })\` for the full patterns.

## Multi-Page Forms

After clicking Next/Continue/Submit on a page, ALWAYS take a fresh snapshot. Refs from the previous page are gone — \`@e1\` now refers to a different element.

\`\`\`json
// Page 1 — fill and advance
{ "action": "snapshot", "selector": "form" }
{ "action": "fill", "selector": "@e1", "value": "..." }
{ "action": "click", "selector": "@e10" }

// Page 2 — fresh snapshot required
{ "action": "snapshot", "selector": "form" }
{ "action": "fill", "selector": "@e1", "value": "..." }
\`\`\`

## Dynamic / Conditional Fields

When selecting an option reveals new fields, re-snapshot to discover them:

\`\`\`json
{ "action": "click", "selector": "@e1" }
{ "action": "snapshot", "selector": "form" }
{ "action": "fill", "selector": "@e5", "value": "..." }
\`\`\`

### AJAX Validation

Some fields trigger validation on blur. If you need to check for errors after filling:

\`\`\`json
{ "action": "fill", "selector": "@e1", "value": "user@email.com" }
{ "action": "press", "key": "Tab" }
{ "action": "snapshot", "selector": "form" }
\`\`\`

## Modal Handling

Empty or minimal snapshots mean a modal is blocking the page — NOT that snapshots are broken. Modals often set \`aria-hidden="true"\` on the page root, hiding everything from the accessibility tree. Multiple modals can appear in sequence. Always loop until the page is clear.

**Probe budget**: If you've taken 3+ snapshots in a row that all came back minimal, you're stuck on a modal that isn't matching the standard scoped selectors. Skip ahead to *When Scoped Snapshots Also Return Empty* — do not retry the same four selectors a fourth time, do not scroll, do not click, do not reload.

### Standard Modal Workflow

1. Snapshot the page.
2. If minimal/empty content, a modal is present. Try scoped snapshots in this order:
   - \`{ action: "snapshot", selector: "[role=dialog]" }\`
   - \`{ action: "snapshot", selector: ".ReactModal__Overlay" }\`
   - \`{ action: "snapshot", selector: "[aria-modal=true]" }\`
   - \`{ action: "snapshot", selector: ".modal" }\`
3. Use refs from that snapshot to interact — native \`<select>\` → \`select\`; custom dropdown → click to open, snapshot again, click the option.
4. After dismissing, go back to step 1 — another modal may have appeared.
5. When the full page is visible again, resume normal workflow.

### Stacked Modals (BenefitsCal pattern)

After you successfully submit/dismiss a modal, your **very next action MUST be a fresh snapshot**. If that snapshot is minimal, another modal is on top — restart the Standard Modal Workflow. Do NOT:

- click anywhere on the page
- re-attempt the previous modal action
- run \`evaluate\` to "check what happened"
- assume validation failed or the click didn't register
- scroll, reload, or navigate

BenefitsCal commonly stacks county → address-confirmation → eligibility modals. Treat each "minimal snapshot after success" as a new modal until proven otherwise. If the second snapshot is also minimal after trying all four scoped selectors, jump to *When Scoped Snapshots Also Return Empty* — don't loop on the same selectors.

### When Scoped Snapshots Also Return Empty

Some modals (especially on React apps like BenefitsCal) set \`aria-hidden="true"\` on the root div AND lack standard ARIA attributes. Use ONE evaluate to discover the modal structure:

\`\`\`js
{ action: "evaluate", script: "document.querySelector('[aria-modal=true], .modal, [role=dialog]')?.outerHTML?.substring(0, 2000) || 'No modal found'" }
\`\`\`

If that returns nothing, try:

\`\`\`js
{ action: "evaluate", script: "document.querySelector('body > div:not([aria-hidden])').outerHTML.substring(0, 2000)" }
\`\`\`

Once you see the modal HTML, interact using CSS selectors (not evaluate):

\`\`\`json
{ "action": "select", "selector": "#county", "value": "33" }
{ "action": "click", "selector": "#continueBtn" }
\`\`\`

### React Modals — When Select/Click Doesn't Register

React apps track form values internally. Setting \`select.value\` programmatically may not trigger React's state update, so the button stays disabled.

For selects — clear React's value tracker and fire change events:

\`\`\`js
{ action: "evaluate", script: "var s = document.querySelector('#county'); var tracker = s._valueTracker; if (tracker) tracker.setValue(''); s.value = '33'; s.dispatchEvent(new Event('change', { bubbles: true }));" }
\`\`\`

For buttons — dispatch the full mouse event sequence (not just \`.click()\`):

\`\`\`js
{ action: "evaluate", script: "var btn = document.querySelector('button'); btn.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, view:window})); btn.dispatchEvent(new MouseEvent('mouseup', {bubbles:true, cancelable:true, view:window})); btn.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, view:window}));" }
\`\`\`

### Google Translate Bar

Government and health sites often inject a Google Translate bar that blocks clicks. Always keep the form in English — dismiss the bar if it interferes:

\`\`\`js
{ action: "evaluate", script: "document.querySelector('.VIpgJd-yAWNEb-hvhgNd') && document.querySelector('.VIpgJd-yAWNEb-hvhgNd').remove()" }
\`\`\`

## Error Recovery

### Field Not Found or Interaction Fails

Re-snapshot to get fresh refs. If the snapshot shows \`[id="..."]\` on the target field, use the CSS ID directly:

\`\`\`json
{ "action": "snapshot", "selector": "form" }
{ "action": "fill", "selector": "#specificFieldId", "value": "..." }
\`\`\`

### Page Navigation Mid-Form

**WARNING**: \`back\`, \`forward\`, and \`reload\` wipe form state — all values you filled will be lost. If a page appears blank or a snapshot returns minimal content, wait and re-snapshot first. Only use \`back\` as a last resort, and expect to re-fill the form.

## Form Submission Protocol

When the submit button is disabled, follow these steps IN ORDER. Do NOT use \`evaluate\` before completing steps 1–3.

1. **Check for missing fields**: Snapshot and verify all required fields are filled.
2. **Check for expand/acknowledge sections**: Look for collapsible sections ("+ Expand", "Please expand and read"). Click them using refs. If no ref available, use ONE evaluate: \`{ action: "evaluate", script: "document.querySelector('.header').click();" }\` then wait 700ms.
3. **Wait for the auto-solver**: \`{ action: "wait", timeout: 5000 }\` then re-snapshot. The browser has a Turnstile/reCAPTCHA auto-solver — do NOT click challenge widgets.
4. **Verification checklist**: Fresh snapshot. Confirm: (a) all required fields filled, (b) expand sections open, (c) no error messages. Just observe — no corrective actions.
5. **Still disabled?** Call \`readReference({ path: "form-submission.md" })\` for advanced JS debugging.

After unlocking submit, do NOT click it. Proceed with \`formSummary\` so the caseworker can review.

## Forbidden Actions

- **Stay on the target domain.** Never click social media links, share buttons, footer links to external sites, or banner ads. Focus on \`main\`, \`form\`, \`#content\`. If you navigate away, use \`navigate\` to return.
- **\`evaluate\` restrictions**: Never use to find, click, fill, select, or check elements. Never use when snapshots return empty (that means a modal is blocking — follow the Modal Handling section above). Acceptable uses: reading values (maxLength), removing overlays (Google Translate bar), React modal workarounds, the stuck-button JS fix after steps 1–4.
- **Never \`reload\` during form filling** — it wipes all form state.
- **Never use \`back\`** — use on-page navigation buttons ("Previous", "Go Back") instead. No exceptions.

## Resuming After Interruption

If the previous turn was interrupted mid-task, the browser is still on the last page and mid-form. Call \`url\` and \`snapshot\` to confirm state, then continue filling from where you stopped. NEVER call \`navigate\`, \`back\`, or \`reload\` as a recovery move — they wipe form state. If you can't tell where you are, stop and report to the caseworker; do not re-navigate.

## Parameter Types

Always use correct JSON types — the browser errors on wrong types:

- \`timeout\` must be a number: \`{ action: "wait", timeout: 1000 }\` NOT \`"1000"\`
- \`interactive\` must be a boolean: \`{ action: "snapshot", interactive: true }\` NOT \`"true"\`

## Reference Files

Use \`readReference\` to load:

- \`field-patterns.md\` — JSON examples for text, date, SSN, phone, state, dropdowns, checkboxes, radios
- \`custom-dropdowns.md\` — Select2 / Chosen / Drupal custom widget patterns
- \`browser-commands.md\` — Full command reference with all actions, flags, and options
- \`form-submission.md\` — Advanced JS debugging for stuck submit buttons
`;
