---
playbook: customer-support
version: "1.0.0"
domain: support-triage
scope: domain
scope_connectors:
  - slack-connector
  - vapi-connector
  - ghl-connector
  - base44-connector
  - linear-connector
triggers:
  - ticket
  - support
  - customer issue
  - help
  - escalate
  - stale ticket
  - customer complaint
  - call log
workflows:
  - enrollment-stage-engine
  - lifecycle-automation
description: "Customer support SOP — ticket triage, escalation, customer 360 lookup, Vapi call analysis, and Slack comms. Routes to Slack, Vapi, GHL, Base44, and Linear connectors."
model_routing:
  default: "deepseek/deepseek-v4-flash"
  fast_iteration: "deepseek/deepseek-v4-flash"
  reasoning_heavy: "anthropic/claude-sonnet-4-6"
  cheap: "groq/llama-4-maverick"
type: "playbook"
access: internal
---

# Customer Support Domain Playbook


## 🧠 PRE-CHECK KNOWLEDGE (U7.4)

Before executing any routine in this domain, the agent MUST query the Knowledge Graph:

- `knowledge://support/cardinal-rules`
- `knowledge://support/recent-patterns`
- `knowledge://support/connector-quirks`

If the user query mentions a specific entity (customer, transaction, deploy, connector), also query that entity for context.

**Cardinal rules from the KG get TOP PRIORITY (confidence=1.0).**
If the KG returns conflicting information with this playbook, NOTE the conflict but FOLLOW the playbook — the U4.1 self-healing loop will resolve.
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

## Custom Skills (under connectors/neptune)

### Connectors
| Skill Pack | Actions | Path | Used For |
|-----------|---------|------|----------|
| `ghl` | 35 | `connectors/neptune/skills/ghl/` | SMS/email threads, automation sequences, contact management |

### Functions
| Function | Path | Used For |
|----------|------|----------|
| `parse-decline-reason` | `connectors/neptune/functions/parse-decline-reason.ts` | Classify payment declines for support triage |
| `annotation-collector` | `connectors/neptune/functions/annotation-collector.ts` | Capture support resolution outcomes for learning |
| `usage-telemetry` | `connectors/neptune/functions/usage-telemetry.ts` | Track support function usage patterns |

## Refinement Notes
- 2026-06-11: Customer 360 routine is the single most important workflow. It fires 10+ connectors in parallel. Never skip parallelization.
- 2026-06-11: Stale ticket detection (>7 days) is a mandatory safeguard.
- 2026-06-12: Phase 8 — GHL connector provides 35 SMS/email/contact actions via neptune skills.
