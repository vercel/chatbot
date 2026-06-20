---
name: nmi-skills
version: 1.0.0
connector: nmi
scope: neptune-custom
total_actions: 5
priority: P0
intent_tags:
  - nmi
  - payments
  - billing
  - vault
  - gateway
associated_connectors:
  - base44
  - hyperswitch
  - slack
headline: |
  5 NMI actions: card vault, recurring billing, and transaction queries.
  Payment gateway operations for NewLeaf billing.
type: "skill"
access: internal
---

# NMI Payments Skills — 5 Actions

## Core Intent
Complete NMI payment gateway operations: query transactions, manage customer vaults, check subscriptions, process charges, and issue refunds. All actions proxy through the NMI MCP bridge or Hyperswitch connector.

## Action Catalog

### Transaction Operations (2 actions)
| # | Action | Description |
|---|--------|-------------|
| 1 | `transaction.query` | Query NMI transactions by date range and status |
| 2 | `transaction.refund` | Issue a refund for a prior transaction |

### Vault Management (1 action)
| 3 | `vault.get` | Retrieve customer vault details by vault ID |

### Subscription & Billing (2 actions)
| 4 | `subscription.get` | Get subscription status and details |
| 5 | `customer.charge` | Process a CIT charge against a vault |

## Anti-Patterns
- NEVER pass source_transaction_id in MIT charges
- NEVER use CVV in MIT transactions
- ALWAYS use card_auth=1 + dup_seconds=0 for validate calls
- CIT transactions require CVV + IP; MIT transactions do NOT
