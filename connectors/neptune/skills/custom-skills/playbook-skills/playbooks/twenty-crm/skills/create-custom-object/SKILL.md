---
name: "create-custom-object"
description: "Define and deploy custom objects in Twenty workspace using defineObject() from twenty-sdk"
version: "1.0.0"
domain: "twenty-crm"
repo_refs:
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/metadata-modules/object-metadata/"
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/metadata-modules/field-metadata/"
  - "/home/hermes/cortex/research/twenty/features/data-model-and-custom-objects.md"
api_refs:
  - "defineObject() from twenty-sdk/define"
  - "defineField() from twenty-sdk/define"
  - "defineRelation() from twenty-sdk/define"
---

# Create Custom Object Skill

## Overview
Define new object types (custom tables) in the Twenty workspace. Custom objects auto-generate GraphQL + REST endpoints with full CRUD.

## defineObject() API
```ts
import { defineObject, FieldType } from 'twenty-sdk/define';

export default defineObject({
  universalIdentifier: 'uuid-v4',     // Stable across deploys — generate fresh UUIDv4
  nameSingular: 'paymentRecord',
  namePlural: 'paymentRecords',
  labelSingular: 'Payment Record',
  labelPlural: 'Payment Records',
  description: 'Customer payment log',
  icon: 'IconCurrencyDollar',
  fields: [
    {
      universalIdentifier: 'field-uuid',
      name: 'amount',
      type: FieldType.CURRENCY,
      label: 'Amount',
      icon: 'IconMoneybag',
    },
    {
      name: 'status',
      type: FieldType.SELECT,
      label: 'Status',
      options: [
        { value: 'succeeded', label: 'Succeeded', position: 0, color: 'green' },
        { value: 'failed', label: 'Failed', position: 1, color: 'red' },
      ],
      defaultValue: `'succeeded'`, // Nested single quotes!
    },
    {
      name: 'chargeDate',
      type: FieldType.DATE_TIME,
      label: 'Charge Date',
      isNullable: true,
      defaultValue: null,
    },
  ],
});
```

## CRITICAL: Default Value Rules
- **Literal strings:** `` `'VALUE'` `` (nested single quotes inside backtick string)
- **Computed defaults:** `'now'` (timestamp), `'uuid'` (UUID generation)
- **Null:** `defaultValue: null` with `isNullable: true`
- **Unquoted string defaults raise build warnings**

## Field Types (most common)
| Type | Use |
|------|-----|
| TEXT | String fields |
| NUMBER | Integer/float |
| CURRENCY | Money amounts |
| SELECT | Single dropdown (requires options array) |
| MULTI_SELECT | Multi-select dropdown |
| DATE_TIME | Timestamps |
| BOOLEAN | True/false |
| RELATION | Link to another object |
| FULL_NAME | Composite person name |
| ADDRESS | Composite postal address |

## Worked Example: Create CreditDispute Object
```ts
export default defineObject({
  universalIdentifier: 'nl-credit-dispute-0001-a1b2c3d4e5f6',
  nameSingular: 'creditDispute',
  namePlural: 'creditDisputes',
  labelSingular: 'Credit Dispute',
  labelPlural: 'Credit Disputes',
  icon: 'IconFileSearch',
  fields: [
    { universalIdentifier: 'nl-cd-field-001', name: 'bureau', type: FieldType.SELECT, label: 'Bureau',
      options: [
        { value: 'equifax', label: 'Equifax', position: 0, color: 'red' },
        { value: 'experian', label: 'Experian', position: 1, color: 'blue' },
        { value: 'transunion', label: 'TransUnion', position: 2, color: 'orange' },
      ]},
    { universalIdentifier: 'nl-cd-field-002', name: 'roundNumber', type: FieldType.NUMBER, label: 'Round' },
    { universalIdentifier: 'nl-cd-field-003', name: 'mailedDate', type: FieldType.DATE_TIME, label: 'Date Mailed', isNullable: true },
    { universalIdentifier: 'nl-cd-field-004', name: 'person', type: FieldType.RELATION, label: 'Customer' },
  ],
});
```

## Deploy Workflow
```bash
yarn twenty dev:build                    # Compile + detect entities
yarn twenty dev --once --dry-run         # Preview changes (no schema mutation)
yarn twenty app:publish --private        # Deploy to Twenty server
```

## Error Handling
| Error | Cause | Fix |
|-------|-------|-----|
| VERSION_ALREADY_EXISTS | Same version redeployed | Bump version in package.json |
| SERVER_VERSION_INCOMPATIBLE | Server too old | Update `engines.twenty` range or upgrade server |
| CANNOT_DOWNGRADE_APPLICATION | Lower version deployed | Only deploy higher versions |
| Build fails | Invalid field definition | Check universalIdentifiers, option positions, default values |
