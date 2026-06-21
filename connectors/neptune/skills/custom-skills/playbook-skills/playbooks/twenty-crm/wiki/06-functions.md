# Twenty CRM — Serverless Functions

## Overview
Server-side TypeScript functions that execute in isolated Node.js sandboxes within Twenty. Functions can be triggered by 6 different event sources and run with permission-scoped API access to the workspace.

## Runtime Environment
- **Execution:** Isolated Node.js process (sandboxed)
- **Environment variables:** `TWENTY_API_URL`, `TWENTY_APP_ACCESS_TOKEN` (short-lived, auto-refreshed)
- **API Clients:** `CoreApiClient` (GraphQL CRUD), `MetadataApiClient` (schema management), `RestApiClient`
- **Utility:** `twenty-sdk/utils → isDefined()` — false for both null and undefined
- **Timeout:** Configurable per function (default 10s, max 30s)

## 6 Trigger Types

### 1. HTTP Route
External HTTP endpoints at `https://crm.newleaf.financial/s/{path}`.
```ts
httpRouteTriggerSettings: {
  path: '/stripe-webhook',
  httpMethod: 'POST',
  isAuthRequired: false,
  forwardedRequestHeaders: ['stripe-signature', 'content-type'],
}
```
Payload: AWS HTTP API v2 format. Headers blocked by default → must opt-in. Return `Response` object for custom status + headers (only 6 allowed headers).

### 2. Database Event
Fires on record lifecycle: `object.created`, `object.updated`, `object.deleted`, `object.destroyed`. Supports wildcards: `*.created`, `person.*`.
```ts
databaseEventTriggerSettings: {
  eventName: 'subscription.updated',
  updatedFields: ['billingHealth'],
}
```
Payload: `{ before, after, diff, updatedFields }`.

### 3. Cron
Standard cron expressions.
```ts
cronTriggerSettings: { pattern: '0 3 * * *' }  // 3 AM daily
```

### 4. Server Webhook
Inbound endpoint: `POST /webhooks/server/{appId}/{functionId}`. Workspace resolved from payload.
```ts
serverWebhookTriggerSettings: {
  workspaceIdResolver: { source: 'body', path: 'tenant_id' },
}
```
⚠️ Platform does NOT verify signatures — handler must verify with `rawBody` + HMAC.

### 5. AI Tool
Exposed to AI chat, MCP, and agent function calling.
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

### 6. Workflow Action
Appears as a custom action in the visual workflow builder.
```ts
workflowActionTriggerSettings: {
  inputSchema: jsonSchemaToInputSchema(myJsonSchema),
}
```

## Complete Example: Hyperswitch Payment Webhook
```ts
import { defineLogicFunction, Response, RoutePayload } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { createHmac, timingSafeEqual } from 'crypto';

export default defineLogicFunction({
  universalIdentifier: 'nl-payment-webhook-0001',
  name: 'hyperswitch-payment-webhook',
  description: 'Process payment webhooks from Hyperswitch',
  timeoutSeconds: 10,
  httpRouteTriggerSettings: {
    path: '/hyperswitch/payment-webhook',
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: ['x-hyperswitch-signature', 'content-type'],
  },
  handler: async (payload: RoutePayload) => {
    // 1. Verify HMAC signature
    const signature = payload.headers['x-hyperswitch-signature'];
    const hmac = createHmac('sha512', process.env.HYPERSWITCH_WEBHOOK_SECRET);
    hmac.update(payload.rawBody);
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(hmac.digest('hex')))) {
      return new Response(401, { 'content-type': 'text/plain' }, 'Invalid signature');
    }

    // 2. Process payment
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

## CLI Commands
```bash
# Execute function with test payload
yarn twenty dev:function:exec -n process-payment-webhook -p '{"amount":9900}'

# Watch live logs
yarn twenty dev:function:logs

# Build + detect functions
yarn twenty dev:build
```

## NewLeaf Function Patterns
| Function | Trigger | Purpose |
|----------|---------|---------|
| hyperswitch-payment-webhook | HTTP Route | Create PaymentRecord from HS |
| nmi-vault-sync | DB Event (paymentRecord.created) | Update subscription health |
| ghl-contact-sync | HTTP Route | Sync GHL contacts to Persons |
| credit-report-parser | AI Tool | PDF → AI extraction → CreditDisputes |
| dispute-letter-generator | Workflow Action | Template → PDF → log mailing |
| monthly-reconciliation | Cron (1st of month) | Twenty vs NMI discrepancy report |
| pipeline-sla-monitor | Cron (daily 9am) | Overdue stages → Slack alert |
| enrollment-health-check | Cron (daily 6am) | Missing docs → SupportTicket |

## Security Considerations
- Logic functions run with App's role permissions — be explicit in role definition
- Verify ALL inbound webhook signatures (HMAC) — platform doesn't do this for you
- Use `TWENTY_APP_ACCESS_TOKEN` (auto-refreshed) — never hardcode API keys
- Sanitize payload data before writing to database
- Rate limit HTTP route endpoints with `isAuthRequired: true` when possible
