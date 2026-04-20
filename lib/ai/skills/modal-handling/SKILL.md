---
name: modal-handling
description: >
  Use this skill when you encounter empty/minimal snapshots or elements blocked
  by overlays. Covers modal detection workflow, scoped snapshot strategy, React
  event workarounds for unresponsive modals, county/location selection modals,
  and Google Translate bar removal.
---

# Modal Handling Skill

Empty or minimal snapshots mean a modal is blocking the page — NOT that snapshots are broken. Modals often set `aria-hidden="true"` on the page root, hiding everything from the accessibility tree. Multiple modals can appear in sequence (e.g., address validation then county selection). Always loop until the page is clear.

## Standard Modal Workflow

1. Snapshot the page.
2. If minimal/empty content, a modal is present. Try scoped snapshots in this order:
   - `{ action: "snapshot", selector: "[role=dialog]" }`
   - `{ action: "snapshot", selector: ".ReactModal__Overlay" }`
   - `{ action: "snapshot", selector: "[aria-modal=true]" }`
   - `{ action: "snapshot", selector: ".modal" }`
3. Use refs from that snapshot to interact — if there's a native `<select>`, use `select`; if it's a custom dropdown, click to open, snapshot again, click the option.
4. After dismissing, go back to step 1 — another modal may have appeared.
5. When the full page is visible again, resume normal workflow.

## When Scoped Snapshots Also Return Empty

Some modals (especially on React apps like BenefitsCal) set `aria-hidden="true"` on the root div AND lack standard ARIA attributes — so ALL scoped snapshots return empty. This is common with county selection modals after address entry.

Use ONE evaluate to discover the modal structure:

```js
{ action: "evaluate", script: "document.querySelector('[aria-modal=true], .modal, [role=dialog]')?.outerHTML?.substring(0, 2000) || 'No modal found'" }
```

If that returns nothing, try:

```js
{ action: "evaluate", script: "document.querySelector('body > div:not([aria-hidden])').outerHTML.substring(0, 2000)" }
```

Once you see the modal HTML, identify the select element and button, then interact using CSS selectors (not evaluate):

```json
{ "action": "select", "selector": "#county", "value": "33" }
{ "action": "click", "selector": "#continueBtn" }
```

## React Modals — When Select/Click Doesn't Register

React apps track form values internally. Setting `select.value` programmatically or clicking via `.click()` may not trigger React's state update, so the button stays disabled or the click is ignored.

**Fix: dispatch real browser events that React can detect.**

For selects — clear React's value tracker and fire change events:

```js
{ action: "evaluate", script: "var s = document.querySelector('#county'); var tracker = s._valueTracker; if (tracker) tracker.setValue(''); s.value = '33'; s.dispatchEvent(new Event('change', { bubbles: true }));" }
```

For buttons — dispatch the full mouse event sequence (not just `.click()`):

```js
{ action: "evaluate", script: "var btn = document.querySelector('button'); btn.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, view:window})); btn.dispatchEvent(new MouseEvent('mouseup', {bubbles:true, cancelable:true, view:window})); btn.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, view:window}));" }
```

After the modal closes, re-snapshot to confirm and continue.

## County/Location Selection Modals

These commonly appear after address entry on benefits sites. The typical flow:

1. Try scoped snapshot (`[role=dialog]`, `[aria-modal=true]`)
2. If empty, use evaluate to find the modal HTML (see above)
3. Select the county value with React-aware events
4. Click Continue with the full mouse event sequence
5. Wait briefly (`{ action: "wait", timeout: 1000 }`) then re-snapshot
6. If another modal appears, repeat

## Google Translate Bar

Government and health sites often have a Google Translate bar injected at the top of the page. This floating element can block clicks on form fields below it. **Always keep the form in English** — dismiss the bar if it interferes.

If elements report "blocked by another element" and you suspect the translate bar:

```js
{ action: "evaluate", script: "document.querySelector('.VIpgJd-yAWNEb-hvhgNd') && document.querySelector('.VIpgJd-yAWNEb-hvhgNd').remove()" }
```

Re-snapshot and continue — the form fields should now be accessible.
