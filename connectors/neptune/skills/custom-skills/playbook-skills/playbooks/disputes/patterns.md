---
type: "playbook"
name: "Patterns"
description: "Auto-generated description for Patterns"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Disputes — Patterns & Anti-Patterns

> **Quick Reference Card — Read BEFORE any dispute action.**

---

## Always Check (Pre-Flight)

- [ ] Customer authorization obtained (written/recorded) before filing
- [ ] Fresh credit report pulled (within 30 days)
- [ ] Negative items identified and verified as inaccurate/incorrect
- [ ] Dispute reason code selected (NM, II, AC, BI, DI, DA, OT)
- [ ] Evidence package complete (ID + address proof + report + docs)
- [ ] Round number verified (max 3 per item without new evidence)
- [ ] New evidence for Round 2/3 (not re-submission of prior rounds)
- [ ] Bureau deadlines tracked in Base44 dispute_rounds
- [ ] Forth connector available for letter generation
- [ ] Furnisher identified and notified (FCRA 623, simultaneous with bureau)

## Anti-Patterns (BANNED)

| Anti-Pattern | Severity | Reason |
|-------------|----------|--------|
| Filing without client authorization | CRITICAL | Legal violation, trust breach |
| Same evidence for multiple rounds | CRITICAL | Bureau rejects as "previously investigated" |
| Missing 30-day response window | CRITICAL | Dispute dismissed, clock reset |
| Disputing accurate information | CRITICAL | FCRA violation, no legal basis |
| Promising specific outcomes | CRITICAL | Deceptive practice, cannot guarantee |
| "Scattershot" filing (all items at once) | HIGH | Bureau may classify as frivolous |
| Emotional language in dispute letters | MEDIUM | Weakens legal standing |
| Skipping credit report pull | HIGH | Cannot identify items accurately |
| Missing furnisher notification | HIGH | Incomplete dispute process |

## Pattern Library

### Pattern: Standard Dispute Filing (Round 1)
```
1. Obtain client written authorization
2. Pull fresh credit report (all 3 bureaus)
3. Identify negative items (verify they are inaccurate)
4. Select dispute reason code for each item
5. Collect evidence package (ID + address + report + supporting docs)
6. Generate dispute letter via Forth connector
7. File with bureau (online + mail for paper trail)
8. Log to Base44 dispute_rounds (round=1, status=filed, date, tracking ID)
9. Set 25-day reminder for deadline check
10. Notify #jarvis-admin of filing
```

### Pattern: Round 2 Escalation
```
1. Review Round 1 response (bureau + furnisher)
2. If rejected as "previously investigated" → identify NEW evidence
3. If "verified as accurate" → escalate to furnisher directly
4. Draft Round 2 letter with new evidence + legal citations
5. Supervisor review required (mandatory gate)
6. File Round 2
7. Update Base44 dispute_rounds (round=2, new evidence listed)
```

### Pattern: Deadline Management
```
1. On filing: log date + tracking number in Base44
2. Day 20: check for bureau response
3. Day 25: if no response, send reminder + post to #jarvis-admin
4. Day 30: if no response, FCRA 611 violation → legal review
5. Day 35: post-response evaluation → determine if Round 2 needed
```

---

*End of disputes/patterns.md*
