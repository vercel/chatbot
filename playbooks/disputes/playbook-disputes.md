# Disputes Domain Playbook

## Operational Knowledge
- Forth: Credit bureau dispute engine
- parse-fcra-credit-report: Extract actionable items from credit reports
- DisputeRound: Tracked per bureau per customer
- NegativeItem: Individual items being disputed
- Credit bureaus: TransUnion, Experian, Equifax
- Response window: 30 days per FCRA

## Business Context
- Each dispute round targets specific negative items
- Bureau responses come via mail or e-OSCAR
- After 3 rejections: escalate to senior agent for manual review
- Successful removal: update customer credit report status

## Anti-Patterns
- DON'T promise removal — FCRA only guarantees investigation
- DON'T dispute the same item more than 3 times without escalation
- DON'T submit disputes without verified customer identity
- DON'T skip parsing the credit report before identifying dispute targets

## Safeguards
- Verify customer identity before submitting dispute
- Check for previous dispute rounds on same item
- Validate credit report date (<90 days old)
- If bureau rejected 3x: BLOCK, escalate to senior agent
- Log every dispute round to DisputeRound entity
- Post dispute summary to #jarvis-admin

## Routines

### Routine: 'Start Dispute Round'
Trigger words: 'dispute', 'challenge', 'remove from credit', 'fix credit'

Mandatory steps:
1. Load customer 360 (use customer-support playbook routine)
2. Parse latest credit report via parse-fcra-credit-report function
3. Identify disputable negative items
4. Filter: skip items already disputed 3x (escalate those)
5. For each item: prepare Forth dispute letter
6. Submit via Forth connector
7. Create DisputeRound + NegativeItem records
8. Notify customer of dispute submission

### Routine: 'Track Dispute Response'
Trigger words: 'dispute status', 'dispute update', 'credit bureau response'

Mandatory steps:
1. Load customer's active DisputeRounds
2. For each: check Forth for bureau response status
3. If response received: parse result, update NegativeItem status
4. If removed: celebrate, update customer profile
5. If rejected: increment round counter, prepare for re-dispute or escalate
6. If no response >30 days: flag as overdue, follow up

## Refinement Notes
- 2026-06-11: 3-rejection auto-escalate rule prevents infinite dispute loops.
- 2026-06-11: Credit report must be <90 days old per FCRA guidelines. Stale credit trigger at 90 days.
