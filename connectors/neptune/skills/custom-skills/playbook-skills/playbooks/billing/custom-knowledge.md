# Billing — Custom Business Knowledge (NewLeaf Financial)

> **Domain:** billing-flow | **Priority:** P0 | **Playbook:** playbook-billing.md
> **Last Updated:** 2026-06-16 | **Phase:** 24

---

## NMI Customer Vault Doctrine (CARDINAL)

### The Golden Vault Architecture
- ALWAYS use `customer_vault_id` for recurring charges
- NEVER use `source_transaction_id` (BANNED — causes CVV errors on MIT transactions)
- Day 0 CIT transaction = consent anchor (required before any MIT charges)
- DPAN (network token) stored in vault, not raw PAN
- CVV required for CIT (customer-initiated), NOT for MIT (merchant-initiated)
- `dup_seconds=0` required in validate calls to prevent duplicate detection false positives

### Vault Operations
| Operation | API Call | Notes |
|-----------|----------|-------|
| Create vault | `nmi_mcp_bridge` action: vault_create | Collect.js or direct API |
| Update vault | `nmi_mcp_bridge` action: vault_update | Card update, expiry change |
| Query vault | `nmi_mcp_bridge` action: customer_vault_query | Check card on file health |
| Delete vault | `nmi_mcp_bridge` action: vault_delete | Soft-delete preferred |

### Transaction Types
| Type | CVV Required | dup_seconds | Use Case |
|------|-------------|-------------|----------|
| CIT (Customer-Initiated) | YES | 0 | Day 0 consent, one-time payments |
| MIT (Merchant-Initiated) | NO | N/A | Recurring subscriptions, scheduled payments |
| Validate Only | YES | 0 | Pre-auth, card verification |
| Auth + Capture | YES | 0 | Standard sale |
| Refund | NO | N/A | Return funds (within 180 days) |
| Void | NO | N/A | Cancel same-day transaction |

---

## Hyperswitch Routing

### Gateway Architecture
- **Primary processor:** NMI (default gateway for all transactions)
- **Fallback processors:** Allied Payments, ClearAccept
- **Routing decision based on:** card BIN (first 6 digits), transaction amount, currency, merchant category code
- **Test mode:** Sandbox credentials configured in `.env.local` (NMI test gateway + Hyperswitch sandbox)

### Routing Rules
```
IF card BIN in high_risk_bins THEN route to Allied Payments
IF amount > 5000 USD THEN split across primary + fallback
IF currency != USD THEN route to ClearAccept (better forex rates)
ELSE route to NMI (default)
```

### Hyperswitch Integration Points
- `POST /api/payments` — unified payment endpoint
- `GET /api/payments/:id` — payment status lookup
- `POST /api/payments/:id/refund` — refund via original gateway
- Webhook: `payment.succeeded`, `payment.failed`, `refund.processed`

---

## Allied Payments Specifics
- **Separate merchant account** for high-risk transactions (MCC 5967 — direct marketing)
- **Settlement schedule:** T+3 (vs T+1 for NMI standard)
- **Additional KYC per transaction** — requires customer name + address + last 4 SSN for transactions > $1000
- **Higher decline rate** on international cards (use NMI for non-US cards)
- **Gateway-specific error codes:** AP-001 (KYC required), AP-002 (amount exceeds limit), AP-003 (high-risk block)

---

## Common Billing Operations

### 1. One-Time Charge
```
nmi_mcp_bridge action: "sale"
  → customer_vault_id, amount, currency, order_description
  → card_auth=1, dup_seconds=0
  → CIT mode (customer present, CVV provided)
```

### 2. Recurring Subscription
```
nmi_mcp_bridge action: "subscription_create"
  → customer_vault_id, plan_id, start_date, billing_cycle
  → MIT mode (no CVV needed after Day 0 CIT)
  → Sync with Base44 subscription entity
```

### 3. Invoice Payment
```
nmi_mcp_bridge action: "validate" → action: "sale"
  → Validate card first (dup_seconds=0)
  → Then capture payment
  → Link to Base44 payment_logs
```

### 4. Refund
```
nmi_mcp_bridge action: "refund"
  → transaction_id, amount (partial or full)
  → Must be within 180 days of original transaction
  → Update Base44 payment_logs with refund status
```

### 5. Void (Same-Day Only)
```
nmi_mcp_bridge action: "void"
  → transaction_id
  → Must be same calendar day as original transaction (before settlement cutoff)
  → After settlement: use refund instead
```

### 6. Decline Recovery
```
1. Check decline code (NMI response code)
2. If insufficient_funds → retry max 3x, spaced 3 days apart
3. If hard_decline → DO NOT retry, send billing link for new card
4. If config_decline/225 → add card_auth=1 + dup_seconds=0, retry once
5. If do_not_honor → send billing link, do not retry original card
```

---

## Anti-Patterns (NEVER DO)

| # | Anti-Pattern | Why Wrong | Fix |
|---|-------------|----------|-----|
| 1 | Using `source_transaction_id` for recurring | CVV errors on MIT | Use `customer_vault_id` |
| 2 | Storing raw card numbers | PCI DSS violation, massive liability | NMI vault only |
| 3 | Skipping CVV on CIT transactions | Decline risk, no consent proof | Always collect CVV for CIT |
| 4 | Retrying hard declines (insufficient_funds > 3x) | Harms customer relationship, wastes gateway fees | Send billing link |
| 5 | Charging without consent anchor (CIT Day 0) | Chargeback risk, regulatory violation | CIT Day 0 required |
| 6 | Using NMI for high-risk BINs without routing | Higher decline rate | Route to Allied Payments |
| 7 | Forgetting to set `dup_seconds=0` | Duplicate transaction false positives | Always set in validate calls |
| 8 | Voiding after settlement cutoff | Void will fail | Use refund after cutoff |

---

## Error Code Reference

### NMI Response Codes
| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Transaction approved |
| 225 | Invalid CVV / Config Decline | Add `card_auth=1` + `dup_seconds=0`, retry once |
| 300 | Declined (generic) | Check subtype: insufficient_funds vs hard_decline |
| 301 | Insufficient Funds | Retry max 3x with 3-day spacing |
| 302 | Do Not Honor | Send billing link, do not retry |
| 303 | Card Expired | Send billing link for new card |
| 304 | Stolen Card / Pick Up | Cease all charges, flag account |
| 305 | Processor Decline | Route to fallback processor (Hyperswitch) |
| 400 | Validation Error | Check request payload, fix and retry |
| 500 | Gateway Error | Retry with exponential backoff (max 3x) |

### Hyperswitch Error Codes
| Code | Meaning | Action |
|------|---------|--------|
| HS-001 | No route found | Check card BIN + amount, add fallback processor |
| HS-002 | Gateway timeout | Retry with alternate gateway |
| HS-003 | Authentication failed | Verify sandbox/production credentials |

---

## Subscription Management
- **Active subscriptions tracked in:** Base44 `subscriptions` entity + NMI gateway
- **Billing cycle sync:** Daily cron checks NMI subscription status against Base44 records
- **Dunning management:** 3 retry attempts before subscription suspension
- **Cancellation flow:** NMI subscription_cancel → Base44 status update → Slack notification to #jarvis-admin
- **Pause/Resume:** Supported via NMI subscription_update with `paused` status

---

*End of billing/custom-knowledge.md — Phase 24 Stream 1*
