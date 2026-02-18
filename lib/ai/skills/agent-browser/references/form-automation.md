# Form Automation Patterns

Patterns for filling out web forms reliably.

## Snapshot Strategy

Always take a full snapshot first, then scope on complex pages:

```
browser({ action: "snapshot" })                       // Full page — understand structure
browser({ action: "snapshot", selector: "form" })     // Scope to form on complex pages
browser({ action: "snapshot", selector: "main" })     // Alternative scope for main content area
```

**ALWAYS re-snapshot after DOM-changing actions** (click, select, navigation). Refs go stale.

## Selector Priority (use in this order)

### 1. Refs from Snapshot (default)

After every snapshot you get refs like `@e3`, `@e4`. Use them:

```
browser({ action: "snapshot", selector: "form" })
// Output: textbox "First Name" [ref=@e3] [id="firstNameTxt"], textbox "Last Name" [ref=@e4] [id="lastNameTxt"]

browser({ action: "fill", selector: "@e3", value: "John" })
browser({ action: "fill", selector: "@e4", value: "Doe" })
```

### 2. CSS ID Selectors (when snapshot shows element IDs)

When the snapshot output shows `[id="..."]` on an element, use `#id` directly. This is more stable than refs across DOM changes and works without re-snapshotting.

```
// Snapshot shows: textbox "First Name" [ref=@e3] [id="firstNameTxt"]
// You can use either:
browser({ action: "fill", selector: "@e3", value: "John" })         // ref
browser({ action: "fill", selector: "#firstNameTxt", value: "John" }) // CSS ID — equally valid

// CSS IDs are especially useful when you have many fields to fill after one snapshot,
// because they don't go stale if the DOM changes between fills:
browser({ action: "fill", selector: "#firstNameTxt", value: "John" })
browser({ action: "fill", selector: "#lastNameTxt", value: "Doe" })
browser({ action: "fill", selector: "#cityTxt", value: "Riverside" })
browser({ action: "check", selector: "#chkBxApplyYourselfYes" })
```

### 3. Label Locators (last resort, unique labels only)

Use `getbylabel` ONLY when the label text is **globally unique** on the entire page and no refs or IDs are available. Do NOT use for common labels like "Yes", "No", "First Name", "Last Name", "State", "Zip Code", "Birthdate", "Phone" — these appear multiple times on benefit forms and cause strict-mode violations.

**NEVER include asterisks or colons** in the label text (`"First Name"` not `"First Name: *"`).

```
// ONLY acceptable when label is truly unique and no IDs available:
browser({ action: "getbylabel", label: "Social Security Number", subaction: "fill", value: "123456789" })
```

## Field Type Patterns

**CRITICAL — `fill` vs `type`**: Many fields (SSN, date, phone, state, zip) have JavaScript input masks. `fill` sets the value programmatically and **bypasses** JS handlers — the value silently fails or gets wiped. Use `type` with `clear: true` for masked fields. Use `fill` for plain text fields (name, address, city, email).

**CRITICAL — Always check `maxlength`**: Strip dashes, slashes, spaces so the value fits. The browser silently truncates values exceeding `maxlength`.

**Always verify masked fields**: After typing, use `inputvalue` to confirm the value stuck. If empty/wrong, click the field, wait, re-type.

### Text Fields (use `fill`)
```
browser({ action: "fill", selector: "@e3", value: "John Doe" })
// or with CSS ID:
browser({ action: "fill", selector: "#firstNameTxt", value: "John Doe" })
```

### Date Fields (use `type`)
Check `maxlength`. If `maxlength="8"`, digits only (MMDDYYYY). Click first, then type:
```
browser({ action: "click", selector: "@e1" })
browser({ action: "type", selector: "@e1", text: "01152000", clear: true })
browser({ action: "inputvalue", selector: "@e1" })  // Verify
```

Or if using a date picker:
```
browser({ action: "click", selector: "@e1" })          // Opens picker
browser({ action: "snapshot", interactive: true })      // Get picker refs
browser({ action: "click", selector: "@e5" })          // Click desired date
```

### SSN Fields (use `type`)
Check `maxlength`. If `maxlength="9"`, digits only:
```
browser({ action: "click", selector: "@e1" })
browser({ action: "type", selector: "@e1", text: "123456789", clear: true })
browser({ action: "inputvalue", selector: "@e1" })  // Verify
```

### Phone Number Fields (use `type`)
Check `maxlength`. If `maxlength="10"`, digits only:
```
browser({ action: "click", selector: "@e1" })
browser({ action: "type", selector: "@e1", text: "5551234567", clear: true })
browser({ action: "inputvalue", selector: "@e1" })  // Verify
```

### State Fields (use `type`)
Check `maxlength`. If `maxlength="2"`, use abbreviation:
```
browser({ action: "click", selector: "@e1" })
browser({ action: "type", selector: "@e1", text: "CA", clear: true })
browser({ action: "inputvalue", selector: "@e1" })  // Verify
```

### Native Dropdowns (select)
```
browser({ action: "select", selector: "@e1", values: ["Option Value"] })
// or with CSS ID:
browser({ action: "select", selector: "#genderIdentityDrpDwn", values: ["57"] })
```

### Custom Dropdowns (Select2, Chosen, Drupal)

The `select` action ONLY works on native `<select>` elements. Many CMS forms use custom dropdown widgets (Select2, Chosen) that render styled HTML instead of native selects.

**How to detect a custom dropdown:**
- `select` action fails or has no effect
- Snapshot shows `<span>` or `<div>` with classes like `select2-container`, `chosen-container`
- The visible element is a styled container, not a native `<select>`

**Pattern for Select2/Chosen dropdowns:**
```
// 1. Click the dropdown trigger (the visible styled container)
browser({ action: "click", selector: "@e5" })
// 2. Wait for the dropdown panel to render
browser({ action: "wait", timeout: 300 })
// 3. Snapshot to see the options
browser({ action: "snapshot", interactive: true })
// 4. Click the desired option
browser({ action: "click", selector: "@e12" })
// 5. ALWAYS re-snapshot after selection (DOM changed)
browser({ action: "snapshot", selector: "form" })
```

**Select2 with search (common in Drupal):**
```
// 1. Click to open the dropdown
browser({ action: "click", selector: "@e5" })
browser({ action: "wait", timeout: 300 })
// 2. Type into the search box (auto-focused in Select2)
browser({ action: "type", selector: ":focus", text: "Riverside" })
browser({ action: "wait", timeout: 300 })
// 3. Snapshot to find filtered results
browser({ action: "snapshot", interactive: true })
// 4. Click the matching option
browser({ action: "click", selector: "@e12" })
// 5. Re-snapshot
browser({ action: "snapshot", selector: "form" })
```

**Drupal-specific tips:**
- Drupal forms often have deep navigation, sidebars, and footer. Always use `{ action: "snapshot", selector: "form" }` after the initial full snapshot.
- Drupal webforms frequently use Select2 for any dropdown with many options (clinics, locations, languages).
- If clicking the trigger opens a search input inside the dropdown, type into `:focus` rather than trying to find the search input's ref.

### Checkboxes
```
browser({ action: "check", selector: "@e1" })    // Check it
browser({ action: "uncheck", selector: "@e1" })  // Uncheck it
// or with CSS ID:
browser({ action: "check", selector: "#chkBxApplyYourselfYes" })
```

### Radio Buttons
```
browser({ action: "click", selector: "@e1" })  // Click the desired option
// ALWAYS re-snapshot — radio selections often reveal conditional fields
browser({ action: "snapshot", selector: "form" })
```

## Multi-Page Forms

For forms with multiple pages/steps:

```
// Page 1 — fill and submit
browser({ action: "snapshot", selector: "form" })
browser({ action: "fill", selector: "@e1", value: "..." })
browser({ action: "click", selector: "@e10" })  // Next button

// Page 2 — CRITICAL: take fresh snapshot, refs from page 1 are gone
browser({ action: "snapshot", selector: "form" })  // @e1 is now a different element
browser({ action: "fill", selector: "@e1", value: "..." })
```

## Handling Dynamic Forms

### Conditional Fields
When selecting an option reveals new fields:
```
browser({ action: "click", selector: "@e1" })   // Select option
browser({ action: "snapshot", selector: "form" }) // Re-snapshot — new fields may have appeared
browser({ action: "fill", selector: "@e5", value: "..." })  // Fill revealed field
```

### AJAX Validation
```
browser({ action: "fill", selector: "@e1", value: "user@email.com" })
browser({ action: "press", key: "Tab" })          // Trigger blur validation
browser({ action: "snapshot", selector: "form" }) // Check for errors
```

## Error Recovery

### Field Not Found or Interaction Fails
```
// Re-snapshot to get fresh refs
browser({ action: "snapshot", selector: "form" })
// If snapshot shows [id="..."] on the target field, use CSS ID directly:
browser({ action: "fill", selector: "#specificFieldId", value: "..." })
```

### Page Navigation Mid-Form

**WARNING**: `back`, `forward`, and `reload` can wipe form state — all the values you've already filled will be lost. If a page appears blank or a snapshot returns very little content, wait and re-snapshot first. Only use `back` as a last resort if you've truly navigated away, and expect to re-fill the form.

```
// LAST RESORT — only if truly navigated away. Expect form values to be wiped.
browser({ action: "back" })
browser({ action: "snapshot" })  // Check what survived — likely need to re-fill
```
