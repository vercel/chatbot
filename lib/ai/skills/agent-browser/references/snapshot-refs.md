# Snapshot and Refs Guide

Understanding when to use snapshots vs label locators.

## When to Use What

### Use `find label` (PREFERRED for forms)
When the form has visible labels next to fields:
```
browser({ command: "find label \"First Name\" fill \"John\"" })
browser({ command: "find label \"Email\" fill \"john@example.com\"" })
```
No snapshot needed - uses accessibility tree directly.

### Use Snapshot + Refs
When you need to see the page structure or labels aren't working:
```
browser({ command: "snapshot -i" })
# Output: textbox [ref=@e1], button [ref=@e2]
browser({ command: "fill @e1 \"John\"" })
```

### Use CSS Selectors
When IDs are visible and labels/refs don't work:
```
browser({ command: "fill \"#firstName\" \"John\"" })
```

## Ref Format

```
@e1 [button] "Submit"
@e2 [textbox name="email"] "Enter email"
@e3 [link href="/about"] "About Us"
@e4 [checkbox checked] "Remember me"
```

Each ref includes:
- `@eN` - The reference ID
- `[type attributes]` - Element type and key attributes
- `"text"` - Visible text content

## The Golden Rule

**Refs are invalidated when the page changes.**

You MUST re-snapshot after:
- Page navigation (`open`, clicking links)
- Form submission
- Dropdown/modal opening
- AJAX content loading
- Any DOM mutation

## Snapshot Modes

### `snapshot` (Full Tree)
Shows page structure with labels - useful for understanding the form:
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
browser({ command: "snapshot -i -s \"#registrationForm\"" })
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
**Fix**: Use `-s` to scope to a container

### Ref is ambiguous
**Cause**: Multiple similar elements
**Fix**: Use CSS selector if IDs are visible, or use `find first @e1` / `find nth 2 @e1`

## Best Practices

1. **Snapshot → Interact → Snapshot** - Always follow this cycle
2. **Use `-i` for forms** - Cleaner output, less noise
3. **Check refs before critical actions** - Re-snapshot before submitting
4. **Don't cache refs** - Always use refs from the most recent snapshot
