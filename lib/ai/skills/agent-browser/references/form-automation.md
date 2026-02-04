# Form Automation Patterns

Patterns for filling out web forms reliably.

## Primary Strategy: Label Locators

Most forms have labeled fields. Use `find label` as your first approach:

```
browser({ command: "open https://example.com/application" })
browser({ command: "wait --load networkidle" })

# Fill fields by their visible labels
browser({ command: "find label \"First Name\" fill \"John\"" })
browser({ command: "find label \"Last Name\" fill \"Doe\"" })
browser({ command: "find label \"Email\" fill \"john@example.com\"" })
browser({ command: "find label \"Phone\" fill \"5551234567\"" })

# Checkboxes and radio buttons
browser({ command: "find label \"Yes\" click" })
browser({ command: "find label \"Male\" click" })

# Dropdowns
browser({ command: "find label \"State\" select \"California\"" })
```

This is the most efficient approach because:
- Uses accessibility tree (token efficient, no DOM inspection needed)
- Works without discovering IDs or waiting for refs
- Self-documenting - you can see what field you're targeting

## Fallback: Refs from Snapshot

If labels don't work, use snapshot refs:

```
browser({ command: "snapshot -i" })
# Output: textbox [ref=@e1], textbox [ref=@e2], button [ref=@e3]
browser({ command: "fill @e1 \"John\"" })
browser({ command: "fill @e2 \"Doe\"" })
```

## Fallback: CSS Selectors

If refs aren't available but IDs are visible:

```
browser({ command: "fill \"#firstName\" \"John\"" })
browser({ command: "fill \"#lastName\" \"Doe\"" })
browser({ command: "check \"#agreeToTerms\"" })
```

## Field Type Patterns

### Text Fields
```
browser({ command: "fill @e1 \"John Doe\"" })
```

### Date Fields
Click first to activate any date picker, then type:
```
browser({ command: "click @e1" })
browser({ command: "type @e1 \"01/15/1990\"" })
```

Or if using a date picker:
```
browser({ command: "click @e1" })  # Opens picker
browser({ command: "snapshot -i" })  # Get picker refs
browser({ command: "click @e5" })  # Click desired date
```

### Phone Number Fields
Some fields have masks. Type digits only:
```
browser({ command: "click @e1" })
browser({ command: "type @e1 \"5551234567\"" })
```

### Dropdowns (select)
```
browser({ command: "select @e1 \"Option Value\"" })
```

If it's a custom dropdown (not native select):
```
browser({ command: "click @e1" })  # Open dropdown
browser({ command: "snapshot -i" })  # Get options
browser({ command: "click @e5" })  # Click option
```

### Checkboxes
```
browser({ command: "check @e1" })    # Check it
browser({ command: "uncheck @e1" })  # Uncheck it
```

### Radio Buttons
```
browser({ command: "click @e1" })  # Click the desired option
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
