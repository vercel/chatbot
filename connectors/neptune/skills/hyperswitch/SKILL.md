---
name: hyperswitch-skills
version: 1.0.0
connector: hyperswitch
scope: neptune-custom
total_actions: 4
priority: P0
intent_tags:
  - hyperswitch
  - payments
  - orchestration
  - billing
  - webhooks
associated_connectors:
  - nmi
  - base44
  - slack
headline: |
  4 Hyperswitch actions: payment links, payment queries, refunds, and webhook
  ingestion. Self-hosted payment orchestration for NewLeaf.
type: "skill"
access: internal
---

# Hyperswitch Payment Orchestration Skills — 4 Actions

## Core Intent
Complete Hyperswitch payment orchestration: generate payment links for customers, search payment records, process refunds, and ingest webhook events. Hyperswitch is the primary payment orchestration layer for NewLeaf billing.

## Action Catalog

### Payment Operations (3 actions)
| # | Action | Description |
|---|--------|-------------|
| 1 | `payment.link` | Generate a payment link for a customer |
| 2 | `payment.query` | Search payment records by filters |
| 3 | `payment.refund` | Issue a refund through Hyperswitch |

### Webhook Integration (1 action)
| 4 | `webhook.ingest` | Ingest Hyperswitch webhook events |

## Anti-Patterns
- NEVER hardcode payment URLs — use payment link generation
- NEVER skip webhook verification
- ALWAYS log webhook events before processing
- NEVER retry a payment without checking idempotency
