# Field Type Patterns

JSON examples for the most common form controls. Load when you need an exact action shape.

## Text Fields (use `fill`)

```json
{ "action": "fill", "selector": "@e3", "value": "John Doe" }
{ "action": "fill", "selector": "#firstNameTxt", "value": "John Doe" }
```

## Date Fields (use `type`)

Check `maxlength`. If `maxlength="8"`, use digits only (MMDDYYYY). Click first, then type:

```json
{ "action": "click", "selector": "@e1" }
{ "action": "type", "selector": "@e1", "text": "01152000", "clear": true }
{ "action": "inputvalue", "selector": "@e1" }
```

Or if using a date picker:

```json
{ "action": "click", "selector": "@e1" }
{ "action": "snapshot", "interactive": true }
{ "action": "click", "selector": "@e5" }
```

## SSN Fields (use `type`)

Check `maxlength`. If `maxlength="9"`, digits only:

```json
{ "action": "click", "selector": "@e1" }
{ "action": "type", "selector": "@e1", "text": "123456789", "clear": true }
{ "action": "inputvalue", "selector": "@e1" }
```

## Phone Number Fields (use `type`)

Check `maxlength`. If `maxlength="10"`, digits only:

```json
{ "action": "click", "selector": "@e1" }
{ "action": "type", "selector": "@e1", "text": "5551234567", "clear": true }
{ "action": "inputvalue", "selector": "@e1" }
```

## State Fields (use `type`)

Check `maxlength`. If `maxlength="2"`, use abbreviation:

```json
{ "action": "click", "selector": "@e1" }
{ "action": "type", "selector": "@e1", "text": "CA", "clear": true }
{ "action": "inputvalue", "selector": "@e1" }
```

## Native Dropdowns (select)

```json
{ "action": "select", "selector": "@e1", "values": ["Option Value"] }
{ "action": "select", "selector": "#genderIdentityDrpDwn", "values": ["57"] }
```

## Checkboxes

```json
{ "action": "check", "selector": "@e1" }
{ "action": "uncheck", "selector": "@e1" }
{ "action": "check", "selector": "#chkBxApplyYourselfYes" }
```

## Radio Buttons

```json
{ "action": "click", "selector": "@e1" }
```

ALWAYS re-snapshot after a radio click — radio selections often reveal conditional fields:

```json
{ "action": "snapshot", "selector": "form" }
```
