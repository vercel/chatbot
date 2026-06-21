---
name: "manage-functions"
description: "Create, test, and deploy TypeScript serverless logic functions in Twenty CRM with 6 trigger types"
version: "1.0.0"
domain: "twenty-crm"
repo_refs:
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/core-modules/logic-function/"
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/core-modules/server-webhook-trigger/"
  - "/home/hermes/repos/twenty/packages/twenty-client-sdk/"
  - "/home/hermes/cortex/research/twenty/features/serverless-functions.md"
api_refs:
  - "defineLogicFunction() — server-side TypeScript handlers with 6 triggers"
  - "CoreApiClient — GraphQL CRUD within function context"
  - "MetadataApiClient — schema management within function context"
  - "HTTP routes at /s/{path}, webhooks at /webhooks/server/{appId}/{fnId}"
---

# Manage Functions Skill

## Overview
Create server-side TypeScript logic functions that execute in isolated Node.js sandboxes within Twenty. Functions can be triggered by HTTP calls, database events, cron schedules, server webhooks, AI tool calls, or workflow actions.

## Runtime Environment
- **Execution:** Isolated Node.js process (sandboxed)
- **Env vars:** `TWENTY_API_URL`, `TWENTY_APP_ACCESS_TOKEN` (short-lived, auto-refreshed)
- **Clients:** `CoreApiClient` (GraphQL CRUD), `MetadataApiClient` (schema), `RestApiClient`
- **Utility:** `twenty-sdk/utils → isDefined()` (false for both null and undefined)
- **Timeout:** Configurable per function (default: 10s, max: 30s)

## 6 Trigger Types

### 1. HTTP Route
```ts
httpRouteTriggerSettings: {
  path: '/stripe-webhook',
  httpMethod: 'POST',
  isAuthRequired: false,
  forwardedRequestHeaders: ['stripe-signature', 'content-type'],
}
```
- URL: `POST https://crm.newleaf.financial/s/{path}`
- Payload: AWS HTTP API v2 format (headers, queryStringParameters, pathParameters, body, rawBody, isBase64Encoded, requestContext)
- Headers blocked by default → must opt-in via `forwardedRequestHeaders`
- Return `Response` object for custom status (100-599) and headers
- Allowed response headers only: content-type, content-language, content-disposition, cache-control, retry-after

### 2. Database Event
```ts
databaseEventTriggerSettings: {
  eventName: 'subscription.updated',
  updatedFields: ['billingHealth'],
}
```
- Events: `object.created`, `object.updated`, `object.deleted`, `object.destroyed`
- Wildcards: `*.created`, `person.*`
- Payload: `{ before, after, diff, updatedFields }`

### 3. Cron
```ts
cronTriggerSettings: { pattern: '0 3 * * *' }  // 3 AM daily
```

### 4. Server Webhook
```ts
serverWebhookTriggerSettings: {
  workspaceIdResolver: { source: 'body', path: 'tenant_id' },
}
```
- Endpoint: `POST /webhooks/server/{appRegistrationId}/{functionId}`
- Workspace resolved from payload (body/query/header dot-path)
- ⚠️ Platform does NOT verify signatures — handler must use `rawBody` + HMAC

### 5. AI Tool
```ts
toolTriggerSettings: {
  inputJsonSchema: {
    type: 'object',
    properties: {
      personId: { type: 'string', description: 'The person record ID' },
    },
    required: ['personId'],
  },
}
```
- Exposed to AI chat, MCP, function calling
- `description` field used for agent tool selection

### 6. Workflow Action
```ts
workflowActionTriggerSettings: {
  inputSchema: jsonSchemaToInputSchema(myJsonSchema),
}
```
- Appears in visual workflow builder as a custom action

## Worked Example: Hyperswitch Payment Webhook
```ts
import { defineLogicFunction, Response, RoutePayload } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { createHmac, timingSafeEqual } from 'crypto';

export default defineLogicFunction({
  universalIdentifier: 'nl-payment-webhook-0001',
  name: 'hyperswitch-payment-webhook',
  description: 'Process payment webhooks from Hyperswitch into Twenty PaymentRecords',
  timeoutSeconds: 10,
  httpRouteTriggerSettings: {
    path: '/hyperswitch/payment-webhook',
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: ['x-hyperswitch-signature', 'content-type'],
  },
  handler: async (payload: RoutePayload) => {
    // Verify HMAC signature
    const signature = payload.headers['x-hyperswitch-signature'];
    const hmac = createHmac('sha512', process.env.HYPERSWITCH_WEBHOOK_SECRET);
    hmac.update(payload.rawBody);
    const digest = hmac.digest('hex');
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
      return new Response(401, { 'content-type': 'text/plain' }, 'Invalid signature');
    }

    const body = JSON.parse(payload.body || '{}');
    const client = new CoreApiClient();
    
    const result = await client.mutation({
      createPaymentRecord: {
        __args: {
          data: {
            amount: body.amount / 100,
            success: body.status === 'succeeded',
            nmiTransactionId: body.transaction_id,
            responseCode: body.response_code,
            cardLast4: body.card_last_four,
            actionType: body.action_type,
            chargeDate: new Date().toISOString(),
            person: { connect: { nmiVaultId: body.customer_vault_id } },
          },
        },
        id: true,
      },
    });

    return { paymentRecordId: result.createPaymentRecord.id };
  },
});
```

## Worked Example: NMI Vault Sync (DB Event Trigger)
```ts
import { defineLogicFunction, DatabaseEventPayload } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';

export default defineLogicFunction({
  universalIdentifier: 'nl-nmi-vault-sync-0001',
  name: 'nmi-vault-sync',
  description: 'Sync NMI vault changes to Person records',
  timeoutSeconds: 15,
  databaseEventTriggerSettings: {
    eventName: 'paymentRecord.created',
  },
  handler: async (payload: DatabaseEventPayload) => {
    const client = new CoreApiClient();
    const record = payload.after;
    
    // Update subscription health based on payment success
    if (record.success) {
      await client.mutation({
        updateSubscription: {
          __args: {
            id: record.subscriptionId,
            data: { billingHealth: 'healthy' },
          },
          id: true,
        },
      });
    } else {
      await client.mutation({
        updateSubscription: {
          __args: {
            id: record.subscriptionId,
            data: { billingHealth: 'declining' },
          },
          id: true,
        },
      });
    }
  },
});
```

## CLI Operations
```bash
# Execute a function with test payload
yarn twenty dev:function:exec -n process-payment-webhook -p '{"amount":9900}'

# Watch live logs
yarn twenty dev:function:logs

# Build and detect functions
yarn twenty dev:build

# Deploy
yarn twenty app:publish --private --remote production
```

## NewLeaf Logic Function Patterns
| Function | Trigger | Purpose |
|----------|---------|---------|
| hyperswitch-payment-webhook | HTTP Route | Create PaymentRecord from HS webhook |
| nmi-vault-sync | DB Event | Sync card updates to Person |
| ghl-contact-sync | HTTP Route | Sync GHL contacts/deals/SMS |
| credit-report-parser | AI Tool | PDF → AI extraction → CreditDisputes |
| dispute-letter-generator | Workflow Action | Template + data → PDF → log mailing |
| monthly-reconciliation | Cron | Twenty vs NMI discrepancy report |
| pipeline-sla-monitor | Cron | Overdue stages → Slack alert |
| enrollment-health-check | Cron | Missing docs/overdue → SupportTicket |

## Error Handling
| Error | Cause | Fix |
|-------|-------|-----|
| Function doesn't trigger | Trigger misconfigured? | Check trigger settings, verify event name matches |
| Timeout | Handler taking too long | Increase `timeoutSeconds` (max 30), optimize queries |
| "Cannot find module" | Missing import | Check package.json dependencies |
| API client auth error | Token expired? | `TWENTY_APP_ACCESS_TOKEN` auto-refreshed, redeploy if stuck |
| HMAC mismatch | Wrong secret or algorithm | Verify env var, check algorithm (sha256 vs sha512) |
| "Event name not recognized" | Invalid object name | Use exact `nameSingular` from defineObject, not `labelSingular` |
| Response headers blocked | Not in allowed list | Only content-type, content-language, content-disposition, cache-control, retry-after |
