# Customer Support Domain Playbook

## Operational Knowledge
- Support tickets: Base44 SupportTicket + Linear
- Vapi AI Agent (Haley): Handles inbound/outbound calls
- Freshcaller: Human agent phone routing
- GHL: SMS + email threads with customers
- Slack: #jarvis-admin for internal comms, search for customer mentions
- Resend: Transactional email delivery

## Business Context
- Support response SLA: 4 hours for P1, 24 hours for P2
- Stale ticket threshold: >7 days without update
- Escalation path: Agent → Senior Agent → Jennifer

## Anti-Patterns
- DON'T close a ticket without confirming with customer
- DON'T ignore stale ticket warnings
- DON'T ask "should I also check X?" — the Customer 360 routine tells you everything to check

## Safeguards
- If customer has open ticket >7 days: add STALE TICKET warning to findings
- If billingStatus = payment_declined_hard: add CARD BLOCKED warning
- If credit pull >90 days old: add STALE CREDIT suggestion
- If engagementTier = at_risk: flag for retention outreach
- NEVER expose customer PII in Slack or public channels

## Routines

### Routine: Customer 360 Lookup (MANDATORY for any customer query)
Trigger words: 'look up [name]', 'who is [name]', 'check on [name]',
              'pull up [name]', 'customer [name]', "[name]'s status",
              'show me [name]', 'find [name]', 'get info on [name]'

Mandatory steps (DO NOT SKIP, DO NOT ASK USER):

1. **Identity Resolution** (sequential):
   - Search Base44 CustomerProfile by name + email + phone
   - If multiple matches, list all and use most active
   - Extract customer_id, vault_id, email, phone

2. **Financial State** (call all 4 in PARALLEL):
   - PaymentLog: last 24 months (charges, refunds, declines)
   - BillingEvent: last 90 days
   - NMI subscription status via nmi-connector
   - Hyperswitch payment methods if applicable

3. **Service State** (call all 3 in PARALLEL):
   - CustomerActivityLog: last 90 days
   - SupportTicket: open + last 30 days resolved
   - DisputeRound + NegativeItem: if credit customer

4. **Communication History** (call all 5 in PARALLEL):
   - GHL SMS + email threads
   - EmailMessage entity
   - VapiCallEvent: Haley AI calls
   - CallLog: Freshcaller human calls
   - Slack search: #jarvis-admin for customer mentions

5. **Engagement State** (parallel):
   - emailEngagementScore
   - engagementTier
   - billingBehaviorTag
   - lastEmailOpenedAt

6. **Return** (formatted summary):
   - Header: name, status badge, enrollment tier
   - Timeline: merged touchpoints (newest first)
   - Open Issues: callout with severity
   - Suggested Actions: per playbook safeguards

### Routine: 'Resolve Support Ticket'
Trigger words: 'fix ticket', 'resolve ticket', 'close ticket', 'answer ticket'

Mandatory steps:
1. Read ticket details from SupportTicket
2. Pull full Customer 360 context
3. Draft response following brand voice
4. If refund/billing related: trigger billing routine
5. If dispute related: trigger disputes routine
6. Post resolution, update ticket status
7. Notify customer via email/SMS per their channel preference

## Refinement Notes
- 2026-06-11: Customer 360 routine is the single most important workflow. It fires 10+ connectors in parallel. Never skip parallelization.
- 2026-06-11: Stale ticket detection (>7 days) is a mandatory safeguard.
