---
name: Customer Support Playbook
description: Support ticket triage, customer communication, Vapi call management, and resolution workflows.
domain: customer-support
connectors: [vapi, slack, ghl, forth]
version: "1.0"
updated: 2026-06-22
---

# Customer Support Playbook

## Purpose
Manage customer support operations including ticket triage, AI call handling, Slack-based support, and multi-channel communication.

## Safeguards
- Never expose customer PII in Slack public channels
- Always verify customer identity before discussing account details
- Escalate billing disputes to disputes domain
- Vapi calls must include proper consent acknowledgment

## Routines

### Routine: Ticket Triage
1. Pull new support tickets (status=new)
2. Classify: billing | disputes | technical | general
3. Assign priority: critical (P0) | high (P1) | medium (P2) | low (P3)
4. Route to appropriate domain skill
5. Post summary to #jarvis-admin for high priority

### Routine: Customer 360 Pull
1. Accept customerId, email, or phone
2. Call `crossSystemLookup` for full profile
3. Aggregate: Base44 profile + NMI txns + Slack mentions + SMS + tickets
4. Present structured CustomerProfileCard in chat
5. Identify actionable gaps

### Routine: Vapi Call Analysis
1. Retrieve call by callSid from Vapi
2. Extract transcript, sentiment, outcome
3. Cross-reference with support tickets
4. Generate call summary with action items
5. Log findings to reporting hub

### Routine: Slack Support Response
1. Monitor #jarvis-admin for customer mentions
2. Pull customer context via crossSystemLookup
3. Draft response with relevant account details
4. Post reply in thread
5. Log interaction to activity_log

## Workflows
- **ticket-triage**: Auto-classify and route new tickets
- **customer-360-deep**: Full cross-system customer investigation
- **sentiment-analysis**: Analyze customer sentiment across calls + messages

## Anti-Patterns
- Do NOT make promises in Slack without ticket tracking
- Do NOT share payment links in public channels
- Do NOT override Vapi call dispositions manually
