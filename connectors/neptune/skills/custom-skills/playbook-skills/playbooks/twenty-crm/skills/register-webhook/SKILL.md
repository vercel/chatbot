---
name: "register-webhook"
description: "Register, verify, and receive Twenty CRM webhooks with HMAC SHA256 signature verification"
version: "1.0.0"
domain: "twenty-crm"
repo_refs:
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/core-modules/server-webhook-trigger/"
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/metadata-modules/webhook/"
  - "/home/hermes/cortex/research/twenty/features/webhooks-and-events.md"
api_refs:
  - "Outbound webhooks fire on ALL objects (standard + custom) for created/updated/deleted"
  - "Inbound via Workflow Webhook Trigger or Logic Function HTTP Route"
  - "HMAC SHA256 signing with X-Twenty-Webhook-Signature header"
---

# Register Webhook Skill

## Overview
Register and handle webhooks for Twenty CRM. Twenty provides outbound webhooks that fire on record lifecycle events across ALL objects (standard + custom). Inbound webhooks are received via Workflow Webhook Triggers or Logic Function HTTP Routes.

## Outbound Webhooks (Twenty → External)

### Registration
1. Navigate to Settings → APIs & Webhooks → Webhooks
2. Click + Create webhook
3. Enter target URL (your receiver endpoint)
4. Save — activates immediately

### Event Types
Three operations across ALL object types (standard + custom):
- `{object}.created` — Record created
- `{object}.updated` — Record updated  
- `{object}.deleted` — Record deleted/soft-deleted

Examples: `person.created`, `paymentRecord.updated`, `creditDispute.deleted`

### Payload Structure
```json
{
  "event": "person.created",
  "data": {
    "id": "abc12345",
    "firstName": "Alice",
    "lastName": "Doe",
    "email": "alice@example.com",
    "createdAt": "2025-02-10T15:30:45Z",
    "createdBy": "user_123"
  },
  "timestamp": "2025-02-10T15:30:50Z"
}
```

### HMAC SHA256 Verification
Every webhook is cryptographically signed:
- `X-Twenty-Webhook-Signature` — HMAC SHA256 signature hex
- `X-Twenty-Webhook-Timestamp` — Request timestamp

**Verification code:**
```ts
import { createHmac, timingSafeEqual } from 'crypto';

function verifyTwentyWebhook(req: Request, secret: string): boolean {
  const signature = req.headers['x-twenty-webhook-signature'];
  const timestamp = req.headers['x-twenty-webhook-timestamp'];
  const payload = JSON.stringify(req.body);

  const hmac = createHmac('sha256', secret);
  hmac.update(`${timestamp}:${payload}`);
  const computed = hmac.digest('hex');

  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computed)
  );
}
```

### Recommended Receiver Architecture
```ts
export async function handleTwentyWebhook(req, res) {
  // 1. Verify HMAC signature — reject early
  if (!verifyTwentyWebhook(req, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. Acknowledge immediately (2xx within 5s)
  res.status(200).json({ received: true });

  // 3. Process asynchronously
  const { event, data, timestamp } = req.body;
  await processEvent(event, data);
}
```

Key: Acknowledge with 2xx BEFORE processing. Non-2xx = delivery failure logged.

## Inbound Webhooks (External → Twenty)

### Option A: Workflow Webhook Trigger
1. Create/Edit workflow → Add Webhook trigger
2. Copy the generated webhook URL
3. External system POSTs to that URL
4. Workflow actions process the payload

### Option B: Logic Function HTTP Route
```ts
defineLogicFunction({
  httpRouteTriggerSettings: {
    path: '/nmi-webhook',
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: ['x-nmi-signature'],
  },
  handler: async (payload: RoutePayload) => {
    // Verify NMI signature
    // Process inbound data
    // Create/update Twenty records
  },
});
```
URL: `POST https://crm.newleaf.financial/s/nmi-webhook`

## Webhooks vs Workflows vs Logic Functions
| Method | Direction | Filtering | Transformation | Best For |
|--------|-----------|-----------|----------------|----------|
| Outbound Webhooks | Twenty→External | None (all events) | None | Simple notifications |
| Workflow + HTTP Request | Twenty→External | Yes (filter action) | Yes (code/transform) | Conditional, transformed |
| Workflow Webhook Trigger | External→Twenty | Via trigger config | Yes (code actions) | Receiving data |
| Logic Function HTTP Route | External↔Twenty | Via handler | Full programmatic | Complex processing |

## NewLeaf Webhook Integration Patterns

### Outbound (Twenty → External)
```
person.created → Webhook → n8n → GHL contact sync
paymentRecord.created → Webhook → HTTP Request → Slack #jarvis-admin
creditDispute.updated → Webhook → n8n → Affy letter print
subscription.updated (health=declining) → Webhook → Slack alert
enrollment.stageEntered → Webhook → n8n → welcome email sequence
```

### Inbound (External → Twenty)
```
NMI charge webhook → Logic Function HTTP Route → Create PaymentRecord
GHL contact webhook → Logic Function HTTP Route → Upsert Person
Typeform submission → Workflow Webhook Trigger → Create Lead
Hyperswitch webhook → Logic Function HTTP Route → PaymentRecord + Subscription update
```

## Webhook Registration via GraphQL (Programmatic)
```graphql
mutation {
  createWebhook(data: {
    targetUrl: "https://hooks.newleaf.financial/twenty-events",
    description: "NewLeaf integration webhook",
    operations: ["person.created", "person.updated", "paymentRecord.created"]
  }) {
    id targetUrl secret
  }
}
```
Note: The `secret` field is returned once at creation — store securely, cannot be retrieved later.

## Error Handling
| Error | Cause | Fix |
|-------|-------|-----|
| Webhook not firing | Event type correct? URL reachable? | Check webhook settings, verify receiver is up |
| 401 on receiver | HMAC verification failing | Check webhook secret, algorithm (SHA256), timestamp:payload format |
| Payload missing fields | Object fields not in response? | Webhook sends ALL object fields — check object definition |
| Duplicate events | No deduplication built in | Track processed event IDs in receiver, handle idempotently |
| Signature missing | Behind proxy stripping headers? | Ensure reverse proxy forwards `X-Twenty-Webhook-*` headers |
| Receiver timeout | Processing too slow | Ack immediately (200), process async in background queue |
