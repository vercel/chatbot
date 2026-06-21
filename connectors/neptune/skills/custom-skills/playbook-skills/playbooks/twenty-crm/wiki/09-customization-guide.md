# Twenty CRM — Customization Guide

## Overview
End-to-end guide for extending Twenty with custom objects, fields, logic functions, workflows, and frontend components. This is the NewLeaf customization workflow.

## Step 1: Define Custom Objects
Create a new object definition file in your app's `define/` directory:

```ts
// define/paymentRecord.ts
import { defineObject, FieldType } from 'twenty-sdk/define';

export default defineObject({
  universalIdentifier: 'nl-payment-record-0001-a1b2c3d4e5f6',
  nameSingular: 'paymentRecord',
  namePlural: 'paymentRecords',
  labelSingular: 'Payment Record',
  labelPlural: 'Payment Records',
  description: 'Customer payment log',
  icon: 'IconCurrencyDollar',
  fields: [
    {
      universalIdentifier: 'nl-pr-field-amount',
      name: 'amount',
      type: FieldType.CURRENCY,
      label: 'Amount',
      icon: 'IconMoneybag',
    },
    {
      universalIdentifier: 'nl-pr-field-success',
      name: 'success',
      type: FieldType.BOOLEAN,
      label: 'Success',
      defaultValue: true,
    },
    {
      universalIdentifier: 'nl-pr-field-txnid',
      name: 'nmiTransactionId',
      type: FieldType.TEXT,
      label: 'NMI Transaction ID',
    },
    {
      universalIdentifier: 'nl-pr-field-status',
      name: 'status',
      type: FieldType.SELECT,
      label: 'Status',
      options: [
        { value: 'succeeded', label: 'Succeeded', position: 0, color: 'green' },
        { value: 'failed', label: 'Failed', position: 1, color: 'red' },
        { value: 'refunded', label: 'Refunded', position: 2, color: 'orange' },
      ],
      defaultValue: `'succeeded'`, // CRITICAL: nested single quotes!
    },
  ],
});
```

## Step 2: Add Logic Functions
```ts
// define/logic-functions/process-payment.ts
import { defineLogicFunction, Response, RoutePayload } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';

export default defineLogicFunction({
  universalIdentifier: 'nl-payment-fn-0001',
  name: 'process-payment-webhook',
  timeoutSeconds: 10,
  httpRouteTriggerSettings: {
    path: '/payment-webhook',
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: ['x-signature'],
  },
  handler: async (payload: RoutePayload) => {
    const body = JSON.parse(payload.body || '{}');
    const client = new CoreApiClient();
    const result = await client.mutation({
      createPaymentRecord: {
        __args: { data: { amount: body.amount, success: body.success } },
        id: true,
      },
    });
    return { id: result.createPaymentRecord.id };
  },
});
```

## Step 3: Define Roles
```ts
// define/roles/billing-system.ts
import { defineRole } from 'twenty-sdk/define';

export default defineRole({
  universalIdentifier: 'nl-billing-role-0001',
  label: 'Billing System',
  description: 'For API key access by Hyperswitch/NMI integrations',
  canReadAllObjectRecords: false,
  canUpdateAllObjectRecords: false,
  canBeAssignedToApiKeys: true,
  objectPermissions: [
    {
      objectUniversalIdentifier: 'nl-payment-record-0001-a1b2c3d4e5f6',
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
  ],
});
```

## Step 4: Build + Test Locally
```bash
# Build (compiles TypeScript, detects entities)
yarn twenty dev:build

# Dry-run (preview schema changes without applying)
yarn twenty dev --once --dry-run

# Test a logic function
yarn twenty dev:function:exec -n process-payment-webhook -p '{"amount": 99.00}'

# Watch logs
yarn twenty dev:function:logs
```

## Step 5: Publish
```bash
# Private deploy to NewLeaf production
yarn twenty remote:add --url https://crm.newleaf.financial --as production
yarn twenty app:publish --private --remote production

# Verify
yarn twenty app:status --remote production
```

## Step 6: Create Workflows
In the Twenty UI:
1. Go to Workflows → + New workflow
2. Choose trigger (Record events → `paymentRecord.created`)
3. Add actions: Search, Update, Filter, HTTP Request
4. Test → Activate

## Step 7: Configure Views
In the Twenty UI:
1. Navigate to the object list (e.g., Payment Records)
2. Configure columns, sort order, filters
3. Save as a named view (e.g., "Failed Payments Today")
4. Share view with team members

## Step 8: Wire Up Integrations
```bash
# Test GraphQL endpoint
curl -X POST http://localhost:3002/graphql \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"query":"{ paymentRecords(first: 5) { edges { node { id amount success } } } }"}'

# Test webhook endpoint
curl -X POST https://crm.newleaf.financial/s/payment-webhook \
  -H "Content-Type: application/json" \
  -d '{"amount": 99.00, "success": true}'
```

## Common Customization Patterns

### Extend Standard Object
```ts
defineField({
  universalIdentifier: 'nl-person-credit-score-field',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'creditScore',
  type: FieldType.NUMBER,
  label: 'Credit Score',
  icon: 'IconChartBar',
});
```

### Add Custom AI Agent
```ts
defineAgent({
  universalIdentifier: 'nl-dispute-agent-0001',
  name: 'credit-dispute-agent',
  label: 'Credit Dispute Assistant',
  prompt: `You are a credit repair specialist...`,
  modelId: 'claude-sonnet-4',
  responseFormat: {
    type: 'json',
    schema: {
      type: 'object',
      properties: {
        totalItemsFound: { type: 'number' },
        disputableItems: { type: 'number' },
        recommendedActions: { type: 'string' },
      },
      required: ['totalItemsFound', 'disputableItems'],
    },
  },
});
```

### Add Frontend Component
```ts
defineFrontComponent({
  universalIdentifier: 'nl-customer-summary-0001',
  name: 'CustomerSummary',
  component: MyCustomerSummary,
  isHeadless: false,
});
```

## Checklist: Before Deploying to Production
- [ ] All universalIdentifiers are valid UUIDv4 (generate fresh)
- [ ] All SELECT options have unique positions starting from 0
- [ ] Default values use nested single quotes: `` `'value'` ``
- [ ] `isNullable: true` set on all nullable fields
- [ ] Roles are explicit (not scaffold defaults)
- [ ] Logic function HMAC verification is implemented
- [ ] `yarn twenty dev:build` passes
- [ ] `yarn twenty dev --once --dry-run` shows expected changes
- [ ] Version bumped in package.json
- [ ] Tested on a staging workspace first
