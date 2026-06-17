---
type: "playbook"
name: "Patterns"
description: "Auto-generated description for Patterns"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Customer Support — Patterns & Anti-Patterns

> **Quick Reference Card — Read BEFORE any support interaction.**

---

## Always Check (Pre-Flight)

- [ ] Pull full customer 360 before responding (NEVER answer without complete context)
- [ ] Verify customer identity (name + email + last 4 of phone or security question)
- [ ] Check for existing open tickets (avoid duplicates)
- [ ] Identify priority level based on issue type + sentiment
- [ ] Check SLA clock (response time tracked from ticket creation)
- [ ] Review recent communications history (last 7 days)
- [ ] Check active subscriptions and payment method health
- [ ] Look for active disputes (avoid conflicting actions)
- [ ] Note sentiment keywords for escalation triggers

## Anti-Patterns (BANNED)

| Anti-Pattern | Severity | Reason |
|-------------|----------|--------|
| Responding without full 360 | CRITICAL | Incomplete context = incorrect response |
| Discussing another customer's data | CRITICAL | Privacy violation, legal liability |
| Promising credit score improvements | CRITICAL | Deceptive practice, compliance risk |
| Guaranteeing dispute outcomes | CRITICAL | FCRA violation, false promises |
| Sharing raw credit report data | CRITICAL | Data exposure, privacy violation |
| Communicating outside approved channels | CRITICAL | No audit trail |
| Creating duplicate tickets | HIGH | Fragmented context |
| Closing tickets without confirmation | HIGH | Unresolved issues |
| Making billing changes without identity verification | HIGH | Fraud risk |
| Ignoring sentiment signals | HIGH | Missed escalation |

## Pattern Library

### Pattern: Standard Support Flow
```
1. Pull customer 360 (cross_system_lookup)
2. Check for existing tickets (avoid duplicates)
3. Classify priority (P0-P3 based on impact + sentiment)
4. Create/update ticket in Base44
5. Research issue using domain-specific tools
6. Draft response (include: what happened, why, what's next, when)
7. Get customer confirmation before closing
8. Log outcome to ticket + Refinement Notes
```

### Pattern: Escalation Flow
```
1. Identify escalation trigger (SLA breach, sentiment keyword, legal threat)
2. Classify severity
3. Post to #jarvis-admin with: customer name + issue + priority + action needed
4. If legal threat → add legal team to thread
5. If chargeback risk → hand off to disputes playbook
6. Update ticket with escalation note
7. Monitor for response within escalation SLA
```

### Pattern: Ticket Resolution
```
1. Verify issue is fully resolved (test if possible)
2. Draft resolution summary (what was done, why, when)
3. Share with customer for confirmation
4. Wait for explicit confirmation ("yes", "thank you", "resolved")
5. Close ticket with resolution notes
6. 48-hour cooldown before archive (reopen window)
```

---

*End of customer-support/patterns.md*
