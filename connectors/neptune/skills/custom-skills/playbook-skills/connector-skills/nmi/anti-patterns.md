---
type: "playbook"
name: "Anti Patterns"
description: "Auto-generated description for Anti Patterns"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# NMI Anti-Patterns — BANNED Operations

## CRITICAL (Never Do)

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|--------------|------------------|
| `source_transaction_id` for recurring | Causes CVV error (NMI code 225) on MIT transactions | Always use `customer_vault_id` |
| Missing `card_auth=1` on CIT | Card validation fails without CVV auth flag | Set `card_auth=1` on all validate/sale with CVV |
| Retrying hard declines > 3x | Harms customer relationship, wastes gateway fees | Send billing link after 3rd failure |
| Storing raw PAN anywhere | PCI DSS violation — massive compliance risk | Only store in NMI vault, reference by `customer_vault_id` |
| Charging without CIT Day 0 consent | Chargeback risk, regulatory exposure | Always ensure Day 0 CIT completed first |

## HIGH (Avoid)

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|--------------|------------------|
| Void after settlement cutoff | Will fail silently — same-day only | Use refund instead (within 180 days) |
| Forgetting `dup_seconds=0` | False positive on duplicate detection | Always set on validate calls |
| Cross-domain billing + support mixing | Different safeguards, conflicting actions | Complete billing flow before support actions |
| Using same vault for multiple unrelated customers | Confused payment history, reconciliation nightmare | One vault per customer |
| Charging without amount verification | Wrong amount charged, difficult to reverse | Always verify amount against Base44 agreement |

## MEDIUM (Use Caution)

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|--------------|------------------|
| Not logging NMI response codes | Can't debug failures without response context | Log full response to payment_logs |
| Bypassing smart retry engine | Missing recovery opportunities | Let smart retry handle soft declines |
| Creating subscriptions without test mode first | Production errors hard to undo | Test in NMI sandbox first |
| Ignoring `cofIndicator` responses | Can't verify card-on-file status | Always check and log `cofIndicator` |
