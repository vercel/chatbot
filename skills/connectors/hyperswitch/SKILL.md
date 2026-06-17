---
name: hyperswitch-connector
version: 1.0.0
kind: connector
primary_domain: billing-flow
also_in: [agent-payments]
tools: [createPaymentLink, listPayments, refundPayment, createSubscription]
dependencies: [nmi-connector]
headline: |
  Hyperswitch payment orchestration. All new payment flows go through here.
  Refunds need idempotency keys. Never poll — use webhooks.
type: "skill"
access: internal
---

# Hyperswitch Connector Skill

## Operational Knowledge
Payment orchestration layer wrapping NMI and other processors. HMAC-SHA512 webhook verification.

## Tools
| Tool | Description |
|------|-------------|
| createPaymentLink | Generate payment URL |
| listPayments | Query payment history |
| refundPayment | Issue refund with idempotency |
| createSubscription | Set up recurring billing |

## Anti-Patterns
- NEVER poll for payment status — use webhooks
- NEVER skip idempotency key on mutations

## Safeguards
- Idempotency key required for all payment mutations
- Webhook HMAC verification before processing
- Verify payment_response_hash_key matches
