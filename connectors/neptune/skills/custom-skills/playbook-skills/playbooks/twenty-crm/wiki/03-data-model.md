# Twenty CRM — Data Model

## Overview
Twenty's data model is metadata-driven. Objects, fields, and relations are defined declaratively via the SDK, and the platform auto-generates the database schema, GraphQL types, REST endpoints, and UI forms.

## Standard Objects
Twenty ships with standard CRM objects:
- **person** — Individual contacts (firstName, lastName, email, phone, etc.)
- **company** — Organizations (name, domain, employees, etc.)
- **opportunity** — Sales pipeline (name, amount, stage, closeDate, etc.)
- **note** — Rich-text notes linked to records
- **task** — Assignable tasks with due dates
- **activity** — Activity log (calls, emails, meetings)

## Custom Objects
Defined via `defineObject()` in your app:

```ts
import { defineObject, FieldType } from 'twenty-sdk/define';

export default defineObject({
  universalIdentifier: 'nl-payment-record-0001-a1b2c3d4e5f6',
  nameSingular: 'paymentRecord',
  namePlural: 'paymentRecords',
  labelSingular: 'Payment Record',
  labelPlural: 'Payment Records',
  description: 'Customer payment log',
  icon: 'IconCurrencyDollar',
  fields: [ /* ... */ ],
});
```

### Field Types
| Type | Description | Example |
|------|-------------|---------|
| TEXT | String fields | firstName, email |
| NUMBER | Integer/float | roundNumber, age |
| CURRENCY | Money amounts (BigInt cents) | amount |
| SELECT | Single dropdown | status, bureau |
| MULTI_SELECT | Multi-select dropdown | tags |
| DATE_TIME | ISO 8601 timestamps | chargeDate, createdAt |
| BOOLEAN | True/false | success, isActive |
| RELATION | Link to another object | person → subscriptions |
| FULL_NAME | Composite person name | displayName |
| ADDRESS | Composite postal address | billingAddress |
| LINKS | URL fields | website, socialLinks |
| RATING | Star/scale rating | priority |
| ACTOR | User reference | assignedTo |
| FILE | File attachment | disputeLetter |
| PHONE | Formatted phone | mobilePhone |
| EMAIL | Email address | workEmail |
| POSITION | Sort ordering | position |

### Relations
```ts
// One-to-many
{ name: 'person', type: FieldType.RELATION, label: 'Customer' }

// From the other side (auto-created)
// person.paymentRecords — auto-generated reverse relation

// Custom relation config
{
  name: 'subscriptions',
  type: FieldType.RELATION,
  label: 'Subscriptions',
  relation: {
    type: 'ONE_TO_MANY',
    inverseSideFieldUniversalIdentifier: 'subscription-person-field-uuid',
  },
}
```

## CRITICAL: Default Value Rules
- **Literal strings:** `` `'VALUE'` `` (nested single quotes inside backtick)
- **Computed:** `'now'` (timestamp), `'uuid'` (UUID generation)
- **Null:** `defaultValue: null` with `isNullable: true`
- **Unquoted string defaults raise build warnings**

## NewLeaf Custom Objects (Spec'd, Not Yet Deployed)

### PaymentRecord (27 fields)
Customer payment log with NMI integration fields. Fields: amount (CURRENCY), success (BOOLEAN), nmiTransactionId (TEXT), responseCode (TEXT), responseText (TEXT), cardLast4 (TEXT), actionType (SELECT: sale/auth/refund/void/recurring_charge), chargeDate (DATE_TIME), person (RELATION), subscription (RELATION).

### Subscription (28 fields)
Billing subscription tracking. Fields: amount (CURRENCY), frequency (SELECT: monthly/quarterly/annual), status (SELECT: active/cancelled/paused/expired), nextChargeDate (DATE_TIME), nmiVaultId (TEXT), nmiSubscriptionId (TEXT), completedPayments (NUMBER), billingHealth (SELECT: healthy/declining/failed), autoRetryEnabled (BOOLEAN), person (RELATION).

### CreditDispute (14 fields)
Credit report dispute tracking. Fields: bureau (SELECT: equifax/experian/transunion), roundNumber (NUMBER), mailedDate (DATE_TIME), status (SELECT: pending/mailed/responded/resolved), disputeReason (TEXT), responseReceived (BOOLEAN), responseDate (DATE_TIME), resolution (TEXT), person (RELATION).

### Enrollment (10 fields)
Client enrollment pipeline. Fields: stage (SELECT: CONSULTATION/DOCUMENTS_COLLECTED/CREDIT_ANALYSIS/DISPUTE_PREP/ACTIVE_SERVICE), signedAt (DATE_TIME), enrolledBy (RELATION), stageEnteredAt (DATE_TIME), stageSlaHours (NUMBER), person (RELATION).

### RecoveryTask (21 fields)
Post-enrollment recovery action items. Fields: title (TEXT), priority (SELECT: critical/high/medium/low), status (SELECT: pending/in_progress/completed/blocked), assignedTo (RELATION), dueDate (DATE_TIME), completedAt (DATE_TIME), person (RELATION), enrollment (RELATION).

## Schema Management
- Table naming: `_{appName}_{objectName}` for custom objects (e.g., `_newleafFoundation_paymentRecord`)
- Workspace isolation via PostgreSQL schema-level namespacing
- Auto-migration on app install — no manual SQL needed
- `DISABLE_DB_MIGRATIONS=true` on worker prevents duplicate migrations
- Schema changes are transactional with rollback on failure
