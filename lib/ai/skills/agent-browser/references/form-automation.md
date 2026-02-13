# Form Automation Patterns

Patterns for filling out web forms reliably.

## Snapshot Strategy

Always take a full snapshot first, then scope on complex pages:

```
browser({ action: "snapshot" })                       # Full page — understand structure
browser({ action: "snapshot", selector: "form" })     # Scope to form on complex pages
browser({ action: "snapshot", selector: "main" })     # Alternative scope for main content area
```

**ALWAYS re-snapshot after DOM-changing actions** (click, select, navigation). Refs go stale.

## Primary Strategy: Refs from Snapshot

Once you have a snapshot, use the refs it provides. They are unambiguous and reliable:

```
browser({ action: "snapshot", selector: "form" })
# Output: textbox "First Name" [ref=@e3], textbox "Last Name" [ref=@e4], checkbox "Yes" [ref=@e7]
browser({ action: "fill", selector: "@e3", value: "John" })
browser({ action: "fill", selector: "@e4", value: "Doe" })
browser({ action: "click", selector: "@e7" })
```

## Label Locators (only when labels are unique)

Use `getbylabel` only when the label text is **unique** on the page. Do NOT use for generic labels like "Yes", "No", "Male", "Female" — these appear on many fields and cause strict-mode violations. Do NOT include asterisks or required-field indicators (use "First Name" not "First Name: *").

```
browser({ action: "getbylabel", label: "First Name", subaction: "fill", value: "John" })
browser({ action: "getbylabel", label: "Email", subaction: "fill", value: "john@example.com" })
```

## Fallback: CSS Selectors

If refs aren't available but IDs are visible:

```
browser({ action: "fill", selector: "#firstName", value: "John" })
browser({ action: "fill", selector: "#lastName", value: "Doe" })
browser({ action: "check", selector: "#agreeToTerms" })
```

## Field Type Patterns

**CRITICAL — `fill` vs `type`**: Many fields (SSN, date, phone, state, zip) have JavaScript input masks. `fill` sets the value programmatically and **bypasses** JS handlers — the value silently fails or gets wiped. Use `type` with `clear: true` for masked fields. Use `fill` for plain text fields (name, address, city, email).

**CRITICAL — Always check `maxlength`**: Strip dashes, slashes, spaces so the value fits. The browser silently truncates values exceeding `maxlength`.

**Always verify masked fields**: After typing, use `inputvalue` to confirm the value stuck. If empty/wrong, click the field, wait, re-type.

### Text Fields (use `fill`)
```
browser({ action: "fill", selector: "@e1", value: "John Doe" })
```

### Date Fields (use `type`)
Check `maxlength`. If `maxlength="8"`, digits only (MMDDYYYY). Click first, then type:
```
browser({ action: "click", selector: "@e1" })
browser({ action: "type", selector: "@e1", text: "01152000", clear: true })
browser({ action: "inputvalue", selector: "@e1" })  # Verify
```

Or if using a date picker:
```
browser({ action: "click", selector: "@e1" })  # Opens picker
browser({ action: "snapshot", interactive: true })  # Get picker refs
browser({ action: "click", selector: "@e5" })  # Click desired date
```

### SSN Fields (use `type`)
Check `maxlength`. If `maxlength="9"`, digits only:
```
browser({ action: "click", selector: "@e1" })
browser({ action: "type", selector: "@e1", text: "123456789", clear: true })
browser({ action: "inputvalue", selector: "@e1" })  # Verify
```

### Phone Number Fields (use `type`)
Check `maxlength`. If `maxlength="10"`, digits only:
```
browser({ action: "click", selector: "@e1" })
browser({ action: "type", selector: "@e1", text: "5551234567", clear: true })
browser({ action: "inputvalue", selector: "@e1" })  # Verify
```

### State Fields (use `type`)
Check `maxlength`. If `maxlength="2"`, use abbreviation:
```
browser({ action: "click", selector: "@e1" })
browser({ action: "type", selector: "@e1", text: "CA", clear: true })
browser({ action: "inputvalue", selector: "@e1" })  # Verify
```

### Native Dropdowns (select)
```
browser({ command: "select @e1 \"Option Value\"" })
```

### Custom Dropdowns (Select2, Chosen, Drupal)

The `select` command ONLY works on native `<select>` elements. Many CMS forms use custom dropdown widgets (Select2, Chosen) that render styled HTML instead of native selects.

**How to detect a custom dropdown:**
- `select` command fails or has no effect
- Snapshot shows `<span>` or `<div>` with classes like `select2-container`, `chosen-container`
- The visible element is a styled container, not a native `<select>`
- The actual `<select>` is hidden (`display: none` or `aria-hidden`)

**Pattern for Select2/Chosen dropdowns:**
```
# 1. Click the dropdown trigger (the visible styled container)
browser({ command: "click @e5" })

# 2. Wait for the dropdown panel to render
browser({ command: "wait 300" })

# 3. Snapshot to see the options
browser({ command: "snapshot -i" })

# 4. Click the desired option
browser({ command: "click @e12" })

# 5. ALWAYS re-snapshot after selection (DOM changed)
browser({ command: "snapshot -s \"form\"" })
```

**Select2 with search (common in Drupal):**
```
# 1. Click to open the dropdown
browser({ command: "click @e5" })
browser({ command: "wait 300" })

# 2. Type into the search box (auto-focused in Select2)
browser({ command: "type \":focus\" \"Riverside\"" })
browser({ command: "wait 300" })

# 3. Snapshot to find filtered results
browser({ command: "snapshot -i" })

# 4. Click the matching option
browser({ command: "click @e12" })

# 5. Re-snapshot
browser({ command: "snapshot -s \"form\"" })
```

**Drupal-specific tips:**
- Drupal forms often have deep navigation, sidebars, and footer. Always use `snapshot -s "form"` after the initial full snapshot.
- Drupal webforms frequently use Select2 for any dropdown with many options (clinics, locations, languages).
- The Select2 trigger element usually has a class containing `select2` — look for it in the snapshot.
- If clicking the trigger opens a search input inside the dropdown, type into `:focus` rather than trying to find the search input's ref.

### Checkboxes
```
browser({ command: "check @e1" })    # Check it
browser({ command: "uncheck @e1" })  # Uncheck it
```

### Radio Buttons
```
browser({ command: "click @e1" })  # Click the desired option
# ALWAYS re-snapshot — radio selections often reveal conditional fields
browser({ command: "snapshot -s \"form\"" })
```

### File Uploads
```
browser({ command: "upload @e1 \"/path/to/file.pdf\"" })
```

## Multi-Page Forms

For forms with multiple pages/steps:

```
# Page 1
browser({ command: "snapshot -i" })
browser({ command: "fill @e1 \"...\"" })
browser({ command: "click @e10" })  # Next button

# Wait for page 2
browser({ command: "wait --load networkidle" })
browser({ command: "snapshot -i" })  # CRITICAL: new refs for new page
browser({ command: "fill @e1 \"...\"" })  # @e1 is now a different element
```

## Handling Dynamic Forms

### Conditional Fields
When selecting an option reveals new fields:
```
browser({ command: "select @e1 \"Yes\"" })
browser({ command: "wait 500" })  # Wait for fields to appear
browser({ command: "snapshot -i" })  # Get new refs
browser({ command: "fill @e5 \"...\"" })  # Fill revealed field
```

### AJAX Validation
```
browser({ command: "fill @e1 \"user@email.com\"" })
browser({ command: "press Tab" })  # Trigger blur validation
browser({ command: "wait 1000" })  # Wait for validation
browser({ command: "snapshot -i" })  # Check for errors
```

## Using CSS Selectors

When snapshot shows clear HTML IDs, use them directly:
```
browser({ command: "fill \"#firstName\" \"John\"" })
browser({ command: "fill \"#lastName\" \"Doe\"" })
browser({ command: "check \"#agreeToTerms\"" })
```

Benefits:
- More stable than refs across re-renders
- Self-documenting (you can see what field it is)
- Works even if snapshot order changes

Use CSS selectors when:
- IDs are visible in the snapshot (e.g., `[id="firstName"]`)
- The page uses consistent naming conventions
- You need to interact without re-snapshotting

## Error Recovery

### Field Not Found
```
# Try re-snapshotting
browser({ command: "snapshot -i" })
# Look for the field with a different ref
```

### Wrong Value Entered
```
# Clear and re-fill
browser({ command: "fill @e1 \"\"" })  # Clear
browser({ command: "fill @e1 \"correct value\"" })
```

### Page Navigation Mid-Form
```
# If accidentally navigated away
browser({ command: "back" })
browser({ command: "wait --load networkidle" })
browser({ command: "snapshot -i" })  # Form state may be preserved
```
