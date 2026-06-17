---
name: nmi-connector
version: 1.0.0
kind: connector
primary_domain: billing
also_in: [agent-payments, customer-enrollment]
tools: [getSubscription, getVault, queryTransactions, refundTransaction, createSubscription]
dependencies: [hyperswitch-connector, vps-bridge-connector]
headline: |
  NMI payment gateway via Hyperswitch. Never use source_transaction_id.
  Recurring MIT charges must reference Day 0 CIT. Hard declines 250-254 do not retry.
type: "skill"
access: internal
---

# NMI Connector Skill

## Operational Knowledge

NMI is wrapped **INSIDE Hyperswitch** as a connector. Neptune sends tokens + transactions through Hyperswitch, which uses the NMI security key to call Allied Payments (`ap.transactiongateway.com`).

**Flow:** neptune-chat → vps-tools-bridge → Hyperswitch → NMI → Allied Payments

### CIT vs MIT
- **CIT (Customer-Initiated):** First charge, CVV required. Day 0 authorization authenticates card.
- **MIT (Merchant-Initiated):** Recurring charges. No CVV. Must reference Day 0 CIT `initial_transaction_id`.

### Auth
- NMI security key on VPS only
- Hyperswitch webhook: HMAC-SHA512

## Tools

| Tool | Description |
|------|-------------|
| getSubscription | Retrieve subscription + payment history |
| getVault | Retrieve customer vault by vault ID |
| queryTransactions | Query by date range + status |
| refundTransaction | Process refund for settled transaction |
| createSubscription | Create recurring subscription from vault |

## Anti-Patterns
- NEVER use source_transaction_id
- NEVER retry hard declines (250-254) more than once
- NEVER call NMI directly — always route through Hyperswitch

## Safeguards
- Verify CIT Day 0 exists before creating MIT subscription
- Refunds over $200 need approval per playbook
- Idempotency key required for all payment mutations
