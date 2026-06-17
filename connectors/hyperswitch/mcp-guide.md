---
type: "connector"
name: "Mcp Guide"
description: "Auto-generated description for Mcp Guide"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Hyperswitch MCP Integration Guide — U2.3.D

## Architecture: MCP + Custom Client Hybrid

The Hyperswitch connector uses a **dual-layer approach**:

1. **MCP Layer** (`@juspay/hyperswitch-mcp`): Handles 17 standard payment operations natively. These are token-efficient and auto-discoverable by AI agents.

2. **Custom Client Layer** (`connectors/hyperswitch/client.ts`): Adds 5 specialized operations: gateway failover, CoF audit, webhook event management, and payment method deletion.

## MCP Coverage (17 operations)

| Operation | Hyperswitch API | MCP? |
|-----------|-----------------|------|
| Create payment | `POST /payments` | Yes |
| Retrieve payment | `GET /payments/:id` | Yes |
| Capture payment | `POST /payments/:id/capture` | Yes |
| Cancel payment | `POST /payments/:id/cancel` | Yes |
| List payments | `GET /payments` | Yes |
| List payment methods | `GET /payment_methods` | Yes |
| Retrieve payment method | `GET /payment_methods/:id` | Yes |
| Create customer | `POST /customers` | Yes |
| Retrieve customer | `GET /customers/:id` | Yes |
| Update customer | `POST /customers/:id` | Yes |
| Create refund | `POST /refunds` | Yes |
| Retrieve refund | `GET /refunds/:id` | Yes |
| List refunds | `GET /refunds` | Yes |
| Create subscription | `POST /subscriptions` | Yes |
| Retrieve subscription | `GET /subscriptions/:id` | Yes |
| Update subscription | `POST /subscriptions/:id` | Yes |
| Cancel subscription | `POST /subscriptions/:id/cancel` | Yes |

## Custom Client Extensions (5 operations)

| Operation | Why Custom |
|-----------|------------|
| `gateway_failover` | NMI connector routing with fallback logic — not in base MCP |
| `cof_audit` | Card-on-File audit trail across NMI gateway — custom workflow |
| `list_events` | Webhook event listing and filtering |
| `retry_event` | Retry failed webhook deliveries |
| `delete_payment_method` | Payment method removal (not in base MCP subset) |

## Connector Routing (NMI via Hyperswitch)

Hyperswitch routes all card payments through the NMI connector. This gives us:

```
Payment Request → Hyperswitch → NMI Connector → NMI Gateway → Card Network
```

Benefits:
- Single Hyperswitch API for all payment operations
- NMI-specific configuration lives in Hyperswitch connector settings
- Gateway failover: if NMI is down, route to backup connector
- Unified webhook events regardless of underlying connector

## When to Use MCP vs Custom Client

**Use MCP for:**
- Standard payment CRUD (create, retrieve, capture, cancel, list)
- Customer management
- Refund processing
- Subscription lifecycle

**Use Custom Client for:**
- Gateway failover orchestration
- CoF compliance audits across NMI
- Webhook event management
- Payment method deletion

## Configuration

```json
{
  "hyperswitch": {
    "command": "npx",
    "args": ["-y", "@juspay/hyperswitch-mcp"],
    "env": {
      "HYPERSWITCH_API_KEY": "${HYPERSWITCH_API_KEY}",
      "HYPERSWITCH_BASE_URL": "${HYPERSWITCH_BASE_URL}"
    }
  }
}
```

## Security

- Hyperswitch API key is stored in `secrets.hyperswitch.apiKey` on Vercel
- VPS bridge routes calls through the VPS with `BASE44_API_KEY` auth
- NMI security key never leaves the VPS
- All payment data is encrypted in transit (TLS 1.3)
