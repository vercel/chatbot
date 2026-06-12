---
connector: hyperswitch
version: 0.2.0
scope: connector
auto_load: true
trigger_tools:
  - hyperswitch:createPaymentLink
  - hyperswitch:listPayments
  - hyperswitch:refundPayment
headline: |
  Hyperswitch payment orchestration. All new payment flows go through here, not NMI directly.
  Refunds need idempotency keys. Never poll — use webhooks for event-driven flows.
---

# Hyperswitch Connector Playbook

## Operational Knowledge

### Architecture
Hyperswitch tools proxy through `VPS_TOOLS_BRIDGE_URL/tool/hyperswitch/*`. API keys and secrets remain on the VPS. Each tool call is a POST to the bridge which forwards to the Hyperswitch API.

### Auth
- Hyperswitch API key: stored on VPS only
- VPS tools bridge auth: internal token
- Webhook verification: HMAC-SHA512 with `payment_response_hash_key`

### Rate Limits
- Hyperswitch API: depends on plan tier
- VPS bridge: unlimited (local network)
- Refund: 1 per payment (idempotency key: payment_id)

### Payment Lifecycle
1. `createPaymentLink` → generates branded URL (pay.newleaf.financial)
2. Customer completes payment on Hyperswitch-hosted page
3. Webhook fires → Neptune receives `payment.succeeded`/`payment.failed`
4. `listPayments` → query payment status

## Business Context

### Why Hyperswitch
Hyperswitch is the payment orchestration layer sitting between Neptune and NMI. It provides:
1. Unified payment API regardless of underlying processor
2. Branded payment links (pay.newleaf.financial)
3. Webhook delivery with retry logic
4. Idempotency for refund operations

### Key Business Rules
- All new payment flows go through Hyperswitch, not directly to NMI
- Direct NMI is ONLY for: vault queries, transaction lookups, legacy refunds
- Payment links use the `newleaf-sub-signup` styleId for brand consistency

## Anti-Patterns

### ❌ NEVER:
1. Call NMI directly for new payment flows — always use Hyperswitch
2. Create payment links without amount validation (must be positive)
3. Refund without verifying payment is in "succeeded" state
4. Poll `listPayments` in tight loops — use webhooks for event-driven flows
5. Hardcode payment link URLs — always use the returned URL from `createPaymentLink`

### ⚠️ DANGEROUS:
- Refunding payments that are still in "processing" state
- Creating payment links with test amounts in production
- Sharing raw payment IDs with customers (use payment link URLs instead)

## Safeguards

### Amount Validation
- All amounts in cents (integer, positive)
- Minimum: 1 cent
- Maximum: configurable per account

### Error Handling
- Bridge unreachable → return `{ error: "Hyperswitch bridge unreachable" }`
- Invalid payment ID → return `{ error: "Payment not found" }`
- Refund failed → return reason code from Hyperswitch
- Rate limited → exponential backoff with jitter

### Idempotency
- Payment links: unique per request (no idempotency needed)
- Refunds: idempotency key = `refund_{paymentId}`

## Common Workflows

### Create a Payment Link
```
createPaymentLink({
  amount: 12999,  // $129.99
  customerId: "cust_xyz",
  description: "Monthly subscription - June 2026"
})
→ returns paymentLink (URL), paymentId
```

### List Recent Successful Payments
```
listPayments({ status: "succeeded", limit: 20 })
→ returns array of payment objects
```

### Refund a Payment
```
refundPayment({
  paymentId: "pay_abc123",
  amount: 12999,
  reason: "Customer requested cancellation"
})
→ returns refundId, status
```

## Refinement Notes

- **Version:** 1.0.0
- **Created:** 2026-06-09
- **Last Reviewed:** 2026-06-09
- **Source:** Hyperswitch API docs, Base44 Hyperswitch Bridge architecture
- **Related:** NMI Connector Playbook (upstream processor)
