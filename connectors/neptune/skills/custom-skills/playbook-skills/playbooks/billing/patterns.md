---
type: "playbook"
name: "Patterns"
description: "Auto-generated description for Patterns"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Billing — Patterns & Anti-Patterns

> **Quick Reference Card — Read BEFORE any billing tool call.**

---

## Always Check (Pre-Flight)

- [ ] Customer has valid payment method in NMI vault (`customer_vault_id` present and active)
- [ ] Day 0 CIT consent anchor exists (required for MIT charges)
- [ ] CVV provided for CIT transactions (`card_auth=1`)
- [ ] `dup_seconds=0` set in validate calls
- [ ] Amount matches agreement/contract in Base44
- [ ] Subscription schedule aligned with billing cycle (no double-charge risk)
- [ ] Card expiry is in the future (> 30 days buffer)
- [ ] For high-risk BINs: routed to Allied Payments (not NMI)
- [ ] Dunning retry count under limit (max 3 attempts)
- [ ] Void only if same calendar day (before settlement cutoff)

## Anti-Patterns (BANNED)

| Anti-Pattern | Severity | Reason |
|-------------|----------|--------|
| `source_transaction_id` for recurring | CRITICAL | Causes CVV errors on MIT. Use `customer_vault_id`. |
| Missing `card_auth=1` on CIT | CRITICAL | Card validation fails without CVV auth flag. |
| Retrying hard declines after 3 attempts | CRITICAL | Harms customer relationship, wastes fees. Send billing link. |
| Storing raw PAN anywhere | CRITICAL | PCI DSS violation. Vault only. |
| Charging without CIT Day 0 consent | CRITICAL | Chargeback risk, regulatory exposure. |
| Void after settlement | HIGH | Will fail silently. Use refund instead. |
| Forgetting `dup_seconds=0` | HIGH | False positive on duplicate detection. |
| Cross-domain mixing (billing + support) | MEDIUM | Different safeguards. Complete billing first. |

## Pattern Library

### Pattern: Safe Charge Flow
```
1. Verify customer_vault_id exists
2. Check CIT consent anchor (Day 0)
3. Validate card (dup_seconds=0, card_auth=1)
4. Execute sale/recurring
5. Log to Base44 payment_logs
6. Post confirmation to #jarvis-admin
```

### Pattern: Decline Recovery Flow
```
1. Read NMI response code
2. Classify: soft_decline vs hard_decline
3. Soft → retry with backoff (max 3x over 9 days)
4. Hard → send billing link (Collect.js)
5. Update Base44 with decline + recovery attempt
6. Track in decline_recovery workflow
```

### Pattern: Subscription Cancel Flow
```
1. Verify identity (customer name + last 4 digits)
2. Check active subscriptions in NMI
3. Execute NMI subscription_cancel
4. Update Base44 subscription entity
5. Post to #jarvis-admin
6. Cool-down: 48h before deletion (undo window)
```

---

*End of billing/patterns.md*
