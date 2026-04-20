---
name: custom-dropdowns
description: >
  Use this skill when a native select action fails or has no effect, or when the
  snapshot shows select2-container or chosen-container classes. Covers Select2,
  Chosen, and Drupal custom dropdown patterns.
---

# Custom Dropdowns Skill

The `select` action ONLY works on native `<select>` elements. Custom dropdown widgets (Select2, Chosen) render styled HTML instead.

**How to detect:** `select` fails or has no effect; snapshot shows `<span>` or `<div>` with classes like `select2-container`, `chosen-container`.

## Pattern for Select2/Chosen

```json
// 1. Click the dropdown trigger
{ "action": "click", "selector": "@e5" }
// 2. Wait for the panel to render
{ "action": "wait", "timeout": 300 }
// 3. Snapshot to see options
{ "action": "snapshot", "interactive": true }
// 4. Click the desired option
{ "action": "click", "selector": "@e12" }
// 5. Re-snapshot (DOM changed)
{ "action": "snapshot", "selector": "form" }
```

## Select2 with Search (common in Drupal)

```json
// 1. Click to open
{ "action": "click", "selector": "@e5" }
{ "action": "wait", "timeout": 300 }
// 2. Type into search (auto-focused in Select2)
{ "action": "type", "selector": ":focus", "text": "Riverside" }
{ "action": "wait", "timeout": 300 }
// 3. Snapshot filtered results
{ "action": "snapshot", "interactive": true }
// 4. Click match
{ "action": "click", "selector": "@e12" }
// 5. Re-snapshot
{ "action": "snapshot", "selector": "form" }
```

## Drupal Tips

- Always use `{ action: "snapshot", selector: "form" }` after the initial full snapshot — Drupal pages have heavy nav/sidebar/footer.
- Drupal webforms frequently use Select2 for dropdowns with many options (clinics, locations, languages).
- If clicking the trigger opens a search input inside the dropdown, type into `:focus` rather than finding the search input's ref.
