---
type: "connector"
name: "Connector Routing"
description: "Auto-generated description for Connector Routing"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Hyperswitch Connector Routing — U2.3.D

## How Hyperswitch Routes to NMI

Hyperswitch acts as a payment orchestration layer. It routes all card payment requests to the NMI connector gateway, providing:

1. **Unified API** — Single Hyperswitch endpoint for all payment operations
2. **Connector Abstraction** — Swap underlying processors without code changes
3. **Failover** — Route to backup gateways if NMI is down
4. **Unified Webhooks** — Single event stream regardless of connector

## Routing Flow

```
┌──────────────────────────┐
│   Neptune Chat (Vercel)  │
│   execute({ action:      │
│     "create_payment" })  │
└──────────┬───────────────┘
           │ POST /tool/hyperswitch/createPayment
           ▼
┌──────────────────────────┐
│   VPS (Hostinger)        │
│   Hyperswitch Bridge     │
└──────────┬───────────────┘
           │ Hyperswitch API
           ▼
┌──────────────────────────┐
│   Hyperswitch Core       │
│   Connector Router       │
└──────────┬───────────────┘
           │ Route: card → NMI connector
           ▼
┌──────────────────────────┐
│   NMI Connector          │
│   (Hyperswitch Plugin)   │
└──────────┬───────────────┘
           │ NMI API
           ▼
┌──────────────────────────┐
│   NMI Payment Gateway    │
│   (Authorize.Net/Allied) │
└──────────────────────────┘
```

## NMI Connector Configuration (in Hyperswitch)

```json
{
  "connector_type": "nmi",
  "connector_name": "nmi_primary",
  "connector_account_details": {
    "auth_type": "HeaderKey",
    "api_key": "{{NMI_SECURITY_KEY}}",
    "key1": "{{NMI_CONNECTOR_MCA_ID}}"
  },
  "payment_methods_enabled": [
    { "payment_method": "card" }
  ]
}
```

## Gateway Failover Logic

When the NMI connector fails (timeout, 5xx, declined):

```
1. Primary: NMI connector
   ├── Timeout (>30s) → retry 2x
   ├── 5xx error → mark degraded, try backup
   └── Decline → return decline reason (no failover for declines)

2. Backup: (configurable)
   └── Route to secondary connector if configured
```

**Triggering failover manually:**
```typescript
execute({ action: "gateway_failover", args: {
  paymentId: "pay_123",
  targetGateway: "stripe_backup"  // optional, auto-selects if omitted
}})
```

## Webhook Events

Hyperswitch emits these key events during NMI routing:

| Event | When | Includes |
|-------|------|----------|
| `payment.processing` | Payment routed to NMI | connector: "nmi" |
| `payment.succeeded` | NMI returns success | nmi_transaction_id |
| `payment.failed` | NMI returns failure | error_code, error_message |
| `connector.degraded` | NMI marked degraded | reason, retry_count |
| `connector.restored` | NMI recovered | downtime_seconds |

## CoF Audit via Hyperswitch

The `cof_audit` action traces card-on-file compliance through the Hyperswitch→NMI chain:

```typescript
execute({ action: "cof_audit", args: { customerId: "cust_123" } })
```

Returns:
- All payments routed through NMI for this customer
- NMI vault status (token validity, consent anchor)
- Payment method health (expiry, DPAN status)
- MIT vs CIT breakdown
- Any CoF compliance flags

## Monitoring

Key metrics to watch:
- `connector_latency_ms` — NMI response time (should be <2s)
- `connector_error_rate` — NMI failure percentage (<1%)
- `failover_count` — How often we switch gateways
- `cof_health_score` — Card-on-File compliance percentage
