---
name: agent-browser
description: >
  Use this skill before your first browser action. Covers snapshot workflow,
  selectors, masked fields, modals, Cloudflare Turnstile, form submission
  protocol, and forbidden actions. Has reference files for specific situations
  like disabled submit buttons, custom dropdowns, and CAPTCHA handling.
---

# Browser Automation Skill

## Snapshot Strategy (CRITICAL)

Snapshots are your eyes. Without fresh snapshots, you are flying blind.

1. **Full snapshot first**: After navigating, ALWAYS run `{ action: "snapshot" }` (not interactive-only) to understand the full page
2. **Scope on complex pages**: If the page has heavy navigation/sidebar/footer (Drupal, WordPress), immediately follow with `{ action: "snapshot", selector: "form" }` or `{ action: "snapshot", selector: "main" }` to focus on the content area
3. **Re-snapshot after every DOM change**: After click, select, fill-that-triggers-dynamic-fields, or navigation — ALWAYS snapshot again before the next interaction. Refs go stale after DOM changes.
4. **Use `{ action: "snapshot", interactive: true }` sparingly**: Only when you specifically want just interactive refs. Prefer full or scoped snapshots to maintain context.

## Core Workflow

1. **Navigate**: `{ action: "navigate", url: "<url>" }` (already waits for page load internally — do NOT add a separate waitforloadstate)
2. **Snapshot**: `{ action: "snapshot" }` → then `{ action: "snapshot", selector: "form" }` on complex pages
3. **Read the refs**: The snapshot gives you refs like @e3, @e4, @e7. USE THEM for all interactions.
4. **Interact using refs**: `{ action: "fill", selector: "@e3", value: "John" }`
5. **Re-snapshot**: After EVERY DOM-changing action — refs go stale

**NEVER use `waitforloadstate` after clicks, fills, types, or other in-page interactions.** It wastes a tool call. Only use it after navigating to a completely new URL via a link or form submission, and only if the page has heavy async content that loads after the initial page load.

## Selector Strategy

### 1. Refs (@e3) OR CSS IDs (#id) — both are first-class, use whichever is available
After a snapshot you get refs. If the snapshot also shows `[id="..."]` on an element, you can use `#id` directly — CSS IDs are stable across DOM changes and don't go stale. **Use either — they are equally valid.**

```
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
```

### 2. Label Locators (almost never — only for truly unique labels with no ID)
`getbylabel` causes strict-mode violations whenever a label appears more than once. On benefit forms, "First Name", "State", "Yes", "No" etc. appear for applicant, representative, mailing address, and household — always causing failures.

**NEVER use `getbylabel` for**: "Yes", "No", "Male", "Female", "First Name", "Last Name", "Street Address", "City", "State", "Zip Code", "Birthdate", "Phone". **NEVER include** asterisks (`*`) or colons (`:`) in the label text.
```
// Only acceptable when label is globally unique AND no ID available:
browser({ action: "getbylabel", label: "Social Security Number", subaction: "fill", value: "123456789" })
```

### 3. Tab Navigation (when all else fails)
```
browser({ action: "click", selector: "@e3" })  // Focus first field
browser({ action: "press", key: "Tab" })
browser({ action: "type", selector: ":focus", text: "Doe" })
```

## Custom Dropdowns (Select2, Chosen, Drupal)

If `select` fails, the dropdown is a custom widget. Click the trigger → wait → snapshot → click the option → re-snapshot. Use `readSkillFile` to load `references/form-automation.md` for detailed patterns including Select2 search boxes.

## Native <select> with indexed/coded values

Some native `<select>` elements use numeric or coded values that don't match the visible label (e.g. BenefitsCal county picker: "Riverside" is value `"33"`, an alphabetical index). If `select` with the human-readable label fails, do NOT guess — run ONE evaluate to read the real option values, then retry with the correct value:

```
{ action: "evaluate", script: "JSON.stringify(Array.from(document.querySelector('#county').options).map(o => ({value: o.value, text: o.text})))" }
// then, e.g.:
{ action: "select", selector: "#county", values: ["33"] }
```

## Commands

The browser tool accepts `{ action, selector, value, ... }` objects. Common actions: `navigate`, `snapshot`, `click`, `fill`, `type`, `select`, `check`, `press`, `wait`, `gettext`, `inputvalue`, `scrollintoview`, `evaluate`. For the full command reference with all options, use `readSkillFile` to load `references/commands.md`.

## Masked/Formatted Fields (CRITICAL)

Many form fields (SSN, birthdate, phone, state, zip) have JavaScript input masks or `maxlength` constraints.

**`fill` vs `type`**: The `fill` action sets values programmatically, **bypassing** JS event handlers — masked fields will silently reject or wipe the value. Use `type` with `clear: true` for these fields, which simulates real keystrokes and triggers the JS formatters.

**Rule of thumb**: `fill` for plain text (name, address, city, email). `type` for anything with formatting (SSN, date, phone, state, zip).

**Respect `maxlength`**: Strip dashes, slashes, spaces so digits fit. Examples:
- SSN `maxlength="9"` → `"123456789"`
- Date `maxlength="8"` → `"01022000"`
- Phone `maxlength="10"` → `"7775551234"`
- State `maxlength="2"` → `"CA"`

**Always verify**: After typing into masked fields, use `inputvalue` to confirm the value stuck. If empty/wrong, click the field, wait, and re-type.

## Modals, Dialogs & Popups

When a modal appears (address validation, county selection, confirmations), scope-snapshot it first to get refs, then interact. Multiple modals may chain (address validation → county selection), so loop until the page is clear.

1. **Scope-snapshot the modal.** Try these selectors in order — stop at the first one that returns content:
   - `{ action: "snapshot", selector: ".ReactModal__Content" }` (BenefitsCal, most React apps)
   - `{ action: "snapshot", selector: "[role=dialog]" }`
   - `{ action: "snapshot", selector: "[aria-modal=true]" }`
   - `{ action: "snapshot", selector: ".modal" }`
2. **Interact with refs from that snapshot** — `select`, `click`, `fill`.
3. **If a native `<select>` rejects the human-readable label** (e.g. BenefitsCal county picker rejects `"Riverside"`), the options use numeric/coded values. Read the real option values with one evaluate, then retry `select` with the correct value:
   ```
   { action: "evaluate", script: "JSON.stringify(Array.from(document.querySelector('#county').options).map(o => ({value: o.value, text: o.text})))" }
   // then, e.g.: { action: "select", selector: "#county", values: ["33"] }
   ```
4. **If ALL scoped snapshots are empty**, the modal lacks standard attributes. One evaluate to read the modal's HTML:
   ```
   { action: "evaluate", script: "document.querySelector('.ReactModal__Content, [aria-modal=true], [role=dialog], .modal')?.outerHTML?.substring(0, 2000) || 'none'" }
   ```
   Then interact using CSS selectors from what you found.
5. **After dismissing, re-snapshot.** Another modal may have appeared. Loop until the main page is visible again.

### React event workarounds (only when plain click/select silently fails)

If `click` on a modal button leaves it disabled, or `select` updates the DOM but the page's state doesn't change (rare — try the indexed-value fix in step 3 first):

- **Button stays disabled / click ignored** — dispatch full mouse sequence:
  ```
  { action: "evaluate", script: "var btn = document.querySelector('button[name=\"common_continue\"]'); ['mousedown','mouseup','click'].forEach(t => btn.dispatchEvent(new MouseEvent(t, {bubbles:true, cancelable:true, view:window})));" }
  ```
- **`<select>` DOM value set but state didn't update** — clear React's internal value tracker:
  ```
  { action: "evaluate", script: "var s = document.querySelector('#county'); var tr = s._valueTracker; if (tr) tr.setValue(''); s.value = '33'; s.dispatchEvent(new Event('change', {bubbles:true}));" }
  ```

**Google Translate bar** blocking clicks: `{ action: "evaluate", script: "document.querySelector('.VIpgJd-yAWNEb-hvhgNd')?.remove()" }`

## Form Submission, Turnstile & CAPTCHA

### Turnstile & reCAPTCHA

The browser runs in Kernel stealth mode with an **auto-solver** that handles Cloudflare Turnstile, reCAPTCHA, and similar challenges automatically in the background. Do NOT click on challenge widgets or checkboxes — the auto-solver handles them.

If elements report "blocked by another element", the auto-solver is likely mid-solve. Wait briefly (`{ action: "wait", timeout: 3000 }`) and retry.

### Expand / Acknowledge Sections

Many benefit forms have collapsible "Expand" or "Read and acknowledge" sections that **must be opened before submit enables**. These appear in snapshots as text like "+ Expand" or "Please expand and read below information."

**Click these using snapshot refs — NOT evaluate.** Take a snapshot, find the expand element's ref, click it. If the snapshot doesn't give you a clickable ref (the element may be a div with a jQuery handler), use ONE evaluate to click it by its CSS class:
```
{ action: "evaluate", script: "document.querySelector('.header').click();" }
```
Then wait for animation: `{ action: "wait", timeout: 700 }`

### When the submit button is disabled

1. **Snapshot once.** Verify ALL required fields are filled and any expand/acknowledge sections are open (click them using refs if not). Do NOT loop on waits or extra snapshots.
2. **Still disabled? Force-enable in one evaluate.** The caseworker reviews before submitting — we don't actually click submit, so any re-disable by the page's JS doesn't matter:
   ```
   { action: "evaluate", script: "document.querySelector('#btnSubmit').removeAttribute('disabled')" }
   ```
   Adjust the selector to match the actual submit button.

### After unlocking submit

Do NOT click submit. Proceed with `formSummary` so the caseworker can review and submit manually.

## Forbidden Actions

### Navigation Boundaries
Once you navigate to the target application, **stay on that domain.** NEVER click social media links (Facebook, Twitter/X, Instagram, YouTube, LinkedIn, TikTok), "Share"/"Follow" buttons, footer links to external sites, banner ads, or any link to a different domain. Focus ONLY on the form content area (`main`, `form`, `#content`). After `navigate` is used to reach the application initially, treat navigation as one-way: do NOT call `navigate` again to "return" or "recover." Re-navigating wipes filled form state. If you accidentally click a wrong link, stop and report to the caseworker.

### Evaluate
- **Turnstile, CAPTCHA, disabled submit, or expand sections → follow the Form Submission protocol above FIRST.** Complete steps 1–4 before any evaluate calls.
- NEVER use `evaluate` to find, click, fill, select, or check elements — use proper actions
- NEVER use `evaluate` as a fallback when snapshots return empty/minimal content. Empty snapshots mean a modal is blocking — find and dismiss the modal.
- NEVER use `evaluate` to modify form state or hidden fields
- Acceptable uses: reading simple values (e.g. maxLength), removing third-party overlays (Google Translate bar), clicking expand sections when no ref is available (see above), and the stuck-button JS fix after completing steps 1–4

### Destructive Actions
- NEVER use `reload` while filling a form — reloading wipes all form state.
- NEVER use `back` (browser back button) — it can navigate away from the application entirely, forcing you to start over. Always use the on-page navigation buttons (e.g., "Previous", "Back to ...", "Go Back") instead. These keep you within the application flow. There are NO exceptions to this rule.

## Parameter Types

Always use correct JSON types — the browser will error on wrong types:
- `timeout` must be a number: `{ action: "wait", timeout: 1000 }` NOT `"1000"`
- `interactive` must be a boolean: `{ action: "snapshot", interactive: true }` NOT `"true"`

## Reference Files

For detailed guidance on specific topics, use `readSkillFile` to load:
- `references/form-automation.md` — Custom dropdowns (Select2/Chosen/Drupal), multi-page forms, error recovery
- `references/commands.md` — Full command reference with all options and parameters
- `references/snapshot-refs.md` — Ref lifecycle, snapshot modes, troubleshooting
