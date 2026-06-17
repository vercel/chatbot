---
type: "connector"
name: "Api Reference"
description: "Auto-generated description for Api Reference"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Hyperswitch API Reference — U2.3.D Comprehensive

## Overview

Hyperswitch is a self-hosted payment orchestration platform that routes all card payments through the NMI connector. This connector provides 22 actions across 6 categories.

## Categories

| Category | Count | Description |
|----------|-------|-------------|
| PAYMENTS | 5 | Payment lifecycle (create, get, capture, cancel, list) |
| PAYMENT METHODS | 3 | Stored payment method management |
| CUSTOMERS | 3 | Customer profile CRUD |
| REFUNDS | 3 | Refund processing and listing |
| SUBSCRIPTIONS | 4 | Recurring billing management |
| WEBHOOKS | 2 | Event listing and retry |
| CoF | 2 | Gateway failover and card-on-file audit |

## PAYMENT Actions

| Action | Description | Args |
|--------|-------------|------|
| `create_payment` | Create a new payment intent | `amount`, `currency`, `customerId?`, `paymentMethod?` |
| `get_payment` | Get payment by ID | `paymentId` |
| `capture_payment` | Capture an authorized payment | `paymentId`, `amount?` |
| `cancel_payment` | Cancel a pending payment | `paymentId`, `reason?` |
| `list_payments` | List payments with filters | `limit?`, `customerId?`, `status?` |

## PAYMENT METHOD Actions

| Action | Description | Args |
|--------|-------------|------|
| `list_payment_methods` | List stored payment methods | `customerId`, `type?` |
| `get_payment_method` | Get single payment method | `paymentMethodId` |
| `delete_payment_method` | Remove stored payment method | `paymentMethodId` |

## CUSTOMER Actions

| Action | Description | Args |
|--------|-------------|------|
| `create_customer` | Create customer profile | `email`, `name?`, `phone?`, `metadata?` |
| `get_customer` | Get customer by ID | `customerId` |
| `update_customer` | Update customer details | `customerId`, `updates` |

## REFUND Actions

| Action | Description | Args |
|--------|-------------|------|
| `create_refund` | Refund a payment | `paymentId`, `amount?`, `reason?` |
| `get_refund` | Get refund by ID | `refundId` |
| `list_refunds` | List refunds with filters | `paymentId?`, `limit?` |

## SUBSCRIPTION Actions

| Action | Description | Args |
|--------|-------------|------|
| `create_subscription` | Create recurring subscription | `customerId`, `planId`, `amount`, `interval` |
| `get_subscription` | Get subscription details | `subscriptionId` |
| `update_subscription` | Modify subscription | `subscriptionId`, `updates` |
| `cancel_subscription` | Cancel subscription | `subscriptionId`, `reason?` |

## WEBHOOK Actions

| Action | Description | Args |
|--------|-------------|------|
| `list_events` | List webhook events | `type?`, `limit?`, `status?` |
| `retry_event` | Retry failed webhook delivery | `eventId` |

## CoF Actions

| Action | Description | Args |
|--------|-------------|------|
| `gateway_failover` | Trigger gateway failover | `paymentId`, `targetGateway?` |
| `cof_audit` | Audit card-on-file compliance | `customerId` or `vaultId` |

## Connector Architecture

```
Neptune Chat (Vercel)
  └── connectors/hyperswitch/client.ts
        └── VPS Bridge (POST /tool/hyperswitch/*)
              └── Hyperswitch API
                    └── NMI Connector
                          └── NMI Payment Gateway
```

## Response Format

All actions return:
```typescript
{
  success: boolean;
  data?: any;       // Hyperswitch response
  error?: string;   // Error message on failure
  action?: string;  // Action name
}
```

## Integration with NMI

Hyperswitch routes all card payments to NMI. When you process a payment through Hyperswitch:
1. Hyperswitch validates the request
2. Routes to NMI connector
3. NMI processes the card transaction
4. Result flows back through Hyperswitch to Neptune Chat

This gives us NMI processing with Hyperswitch's unified API and failover capabilities.
