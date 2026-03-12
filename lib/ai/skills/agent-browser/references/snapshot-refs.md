# Snapshot and Refs Guide

Understanding snapshot modes, ref lifecycle, and selector strategy.

## Selector Priority

### 1. Refs (@e3) or CSS IDs (#id) — PREFERRED
After every snapshot you get refs. If the snapshot also shows `[id="..."]`, you can use `#id` directly — CSS IDs are stable across DOM changes.

```
browser({ action: "snapshot", selector: "form" })
// Output: textbox "First Name" [ref=@e3] [id="firstNameTxt"]

// Either works:
browser({ action: "fill", selector: "@e3", value: "John" })
browser({ action: "fill", selector: "#firstNameTxt", value: "John" })
```

### 2. Label Locators — LAST RESORT
Use `getbylabel` ONLY when the label is globally unique AND the element has no ID. NEVER use for common labels like "Yes", "No", "First Name", "State" — these appear multiple times on benefit forms and cause strict-mode violations.

**NEVER include asterisks or colons** in labels.

```
// Only when label is truly unique and no IDs available:
browser({ action: "getbylabel", label: "Social Security Number", subaction: "fill", value: "123456789" })
```

## Ref Format

```
@e1 [button] "Submit"
@e2 [textbox name="email"] "Enter email"
@e3 [link href="/about"] "About Us"
@e4 [checkbox checked] "Remember me"
```

Each ref includes:
- `@eN` — The reference ID
- `[type attributes]` — Element type and key attributes
- `"text"` — Visible text content

## The Golden Rule

**Refs are invalidated when the page changes.**

Re-snapshot after:
- Page navigation (`open`, clicking links)
- Form submission
- Dropdown/modal opening
- AJAX content loading
- Any DOM mutation

## Snapshot Modes

### `snapshot` (Full Tree)
Shows page structure with labels — useful for understanding the form:
```
heading "Welcome to Our Site"
  paragraph "Please fill out the form below"
  form
    textbox "First Name" [ref=@e1]
    textbox "Last Name" [ref=@e2]
```

### `snapshot -i` (Interactive Only)
Compact view of just interactive elements:
```
textbox "First Name" [ref=@e1]
textbox "Last Name" [ref=@e2]
combobox "State" [ref=@e3]
button "Submit" [ref=@e4]
```

### `snapshot -s "#formId"` (Scoped)
For large pages, scope to a specific container:
```
browser({ action: "snapshot", selector: "#registrationForm" })
```

## Troubleshooting

### "Element not found" errors
**Cause**: Stale ref from old snapshot
**Fix**: Re-snapshot and use new refs

### Clicking wrong element
**Cause**: Page changed since snapshot
**Fix**: Re-snapshot before interacting

### Too many elements in snapshot
**Cause**: Page is large/complex
**Fix**: Use `selector` to scope to a container (`form`, `main`, `#content`)

## Best Practices

1. **Snapshot → Interact → Snapshot** — Always follow this cycle
2. **Scope on complex pages** — Use `selector: "form"` to reduce noise
3. **Check refs before critical actions** — Re-snapshot before submitting
4. **Don't cache refs** — Always use refs from the most recent snapshot
5. **Prefer CSS IDs when available** — More stable than refs across DOM changes
