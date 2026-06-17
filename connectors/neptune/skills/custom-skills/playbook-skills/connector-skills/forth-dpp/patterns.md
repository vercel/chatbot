---
type: "playbook"
name: "Patterns"
description: "Auto-generated description for Patterns"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Forth DPP Patterns — Always-Check Rules

## Pre-Flight (ALWAYS)
- [ ] Client authorization obtained (written/recorded)
- [ ] Fresh credit report pulled (< 30 days)
- [ ] Negative items identified and verified as inaccurate
- [ ] Dispute reason code selected (NM, II, AC, BI, DI, DA, OT)
- [ ] Evidence package complete
- [ ] Round number verified (< 3 without new evidence)
- [ ] Bureau deadlines tracked
- [ ] Furnisher notification included (FCRA 623)

## Pattern: Standard Dispute Filing
1. Obtain client written authorization
2. Pull fresh credit report (all 3 bureaus)
3. Identify inaccurate negative items
4. Prepare evidence package
5. Generate letter via Forth
6. File with bureau(s)
7. Notify furnisher(s) simultaneously
8. Track 30-day response window
9. Process bureau response
10. Update dispute_rounds in Base44
