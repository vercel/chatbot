---
connector: nmi
version: 0.4.0
scope: connector
auto_load: true
trigger_tools:
  - nmi:getSubscription
  - nmi:getVault
  - nmi:queryTransactions
  - nmi:refundTransaction
headline: |
  NMI payment gateway via Hyperswitch. Never use source_transaction_id.
  Recurring MIT charges must reference Day 0 CIT. Hard declines 250-254 do not retry.
---

# NMI Connector Playbook (NewLeaf)

## Operational Knowledge

### Architecture
NMI is wrapped **INSIDE Hyperswitch** as a connector. Neptune sends tokens + transactions through Hyperswitch, which uses the NMI security key to call Allied Payments (`ap.transactiongateway.com`).

**Flow:** neptune-chat → vps-tools-bridge → Hyperswitch → NMI → Allied Payments

### Auth
- NMI security key stored on VPS only (never in Neptune env vars)
- Hyperswitch webhook: HMAC-SHA512 of raw body with `payment_response_hash_key`
- API endpoint: `ap.transactiongateway.com` (production) / `sandbox.transactiongateway.com` (test)

### CIT vs MIT (MUST UNDERSTAND)
**CIT (Customer-Initiated Transaction):** First charge, card-on-file setup. CVV **required** (captured via Collect.js iframe). Customer IP **must** be captured. `initiated_by: "customer"`, `stored_credential_indicator: "stored"`. Day 0 authorization authenticates the card for future MIT charges.

**MIT (Merchant-Initiated Transaction):** Recurring subscription charges. No CVV (stored on vault). No customer IP. `initiated_by: "merchant"`, `stored_credential_indicator: "used"`, `billing_method: "recurring"`, `initial_transaction_id` = Day 0 CIT txn ID (consent proof).

### Rate Limits
- Allied Payments: varies by account tier
- Do not retry more than once on hard decline codes (250-254)

## Business Context

### Why NMI via Hyperswitch
NMI is NewLeaf's payment gateway for subscription billing. All customer cards are vaulted through NMI's Customer Vault. Hyperswitch wraps NMI to provide: unified payment routing, webhook delivery, idempotency guarantees, and tokenization abstraction. Direct NMI access is reserved for vault queries, transaction lookups, and legacy refunds.

### Key Business Rules
1. Every subscription requires a Day 0 CIT transaction (the consent anchor)
2. Recurring MIT charges must reference the original CIT via `initial_transaction_id`
3. Vaulted cards stay PCI-compliant because we never touch raw PANs

## Anti-Patterns

### ❌ NEVER:
1. **Use `source_transaction_id`** — this is the raw PAN field. Using it with stored credentials breaks PCI compliance and triggers fraud detection. Use `initial_transaction_id` instead.
2. **Pass raw card numbers in API calls** — always use vault tokens
3. **Retry hard decline codes 250-254 more than once** — triggers **fraud velocity flags** at Allied Payments
4. **Call NMI directly for new flows** — always go through Hyperswitch
5. **Send customer IP on MIT charges** — MIT charges should NOT include customer IP
6. **Cancel subscriptions by deleting them** — use status=canceled to preserve audit trail

### ✅ ALWAYS:
```json
{
  "initial_transaction_id": "<Day 0 CIT txn ID>",
  "customer_vault_id": "<vault ID from NMI>"
}
```

## Safeguards

### Velocity Guard
Block charge if vault has 3+ failures in 24h (memory `6a1f118b`).

### Hard Decline Codes (DO NOT retry)
- **250**: Declined (generic)
- **251**: Insufficient funds (smart retry may apply — once only)
- **252**: Invalid card number
- **253**: Expired card
- **254**: CVV mismatch (CIT only)

### Golden Vault Flow
1. Customer fills card via Collect.js iframe (PCI isolated)
2. $0 auth (CIT) with customer IP + `customer_acceptance` → captures `network_transaction_id` as `nmiDayZeroTransactionId`
3. Create vault from token → stores `customer_vault_id` as `nmiVaultId`
4. Create subscription pointing at vault
5. Every recurring charge passes `initial_transaction_id=<Day 0 txn>`

### Security
- NMI security key: server-side only, never in client code
- Raw PANs: never stored, never logged
- Vault queries: only via authenticated server-to-server calls

## Common Workflows

### Charge a Subscription
```
queryTransactions({ customerVaultId: "xxx" })
→ verify Day 0 CIT exists
→ check velocity guard (no 3+ failures in 24h)
→ Hyperswitch charge with initial_transaction_id
→ handle response
```

### Refund a Transaction
```
queryTransactions({ customerVaultId: "xxx" })
→ find the transaction ID
→ refundTransaction({ transactionId, amount })
→ verify refund status
```

### Look up a Customer's Vault
```
getVault({ customerVaultId: "xxx" })
→ returns billing info + subscriptions
→ use for subscription management
```

## Refinement Notes

- **Version:** 2.0.0
- **Created:** 2026-05 (original), 2026-06-09 (6-section refactor)
- **Last Reviewed:** 2026-06-09
- **Source:** NMI API docs, Hyperswitch integration docs, Base44 Golden Vault Architecture PRD
- **Related:** `source_transaction_id` ban is codified in jarvis/cortex/skills/nmi-golden-vault.md
