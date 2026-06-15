---
playbook: billing
version: "1.0.0"
domain: billing-flow
scope: domain
scope_connectors:
  - nmi-connector
  - hyperswitch-connector
  - forth-connector
  - base44-connector
  - slack-connector
triggers:
  - refund
  - decline
  - charge
  - payment
  - billing
  - invoice
  - retry payment
  - reverse charge
workflows:
  - recovery-campaign
  - lifecycle-automation
  - billing-event-logger
description: "Billing operations SOP — refunds, declines, charges, payment recovery, and NMI vault management. Routes to NMI, Hyperswitch, Forth, and Base44 connectors."
model_routing:
  default: "deepseek/deepseek-v4-pro"
  reasoning_heavy: "anthropic/claude-sonnet-4-6"
  fast_iteration: "deepseek/deepseek-v4-flash"
  cheap: "deepseek/deepseek-v3.2"
  coding: "deepseek/deepseek-v4-pro"
---

# Billing Domain Playbook


## 🧠 PRE-CHECK KNOWLEDGE (U7.4)

Before executing any routine in this domain, the agent MUST query the Knowledge Graph:

- `knowledge://billing/cardinal-rules`
- `knowledge://billing/recent-patterns`
- `knowledge://billing/connector-quirks`
- `knowledge://nmi/transaction-patterns`

If the user query mentions a specific entity (customer, transaction, deploy, connector), also query that entity for context.

**Cardinal rules from the KG get TOP PRIORITY (confidence=1.0).**
If the KG returns conflicting information with this playbook, NOTE the conflict but FOLLOW the playbook — the U4.1 self-healing loop will resolve.
## Operational Knowledge
- NMI Customer Vault: Stores cards via DPAN (network token)
- Day-Zero CIT: Initial $0 or $1 auth required before any real charge
- Hyperswitch: Gateway abstraction — routes to NMI, Stripe, etc.
- $200 threshold: Refunds >$200 need Jennifer approval
- Smart Retry Engine: 15-min scheduled retry for soft declines
- Recovery cron: 9pm UTC daily
- cofCompliant check: Required before every NMI vault operation
- REFUNDKEY: Customer-specific refund key set during enrollment

## Business Context
- Jennifer (billing-ops) approves refunds >$200
- #billing-ops Slack channel for billing alerts
- Recovery campaign: 3-attempt sequence for soft declines
- Hard declines: Do NOT retry — send payment_update_link instead

## Anti-Patterns (DO NOT DO)
- DON'T charge without Day-Zero CIT consent anchor
- DON'T bypass cofCompliant check
- DON'T use source_transaction_id (BANNED per NMI Golden Vault)
- DON'T retry hard declines
- DON'T process >$200 refund without Jennifer approval
- DON'T store CVV — NMI handles it, never persist

## Safeguards

Before any charge:
1. Verify vault_id exists and is active
2. Run cof-compliant health audit
3. Check enrollmentStage = active
4. Post to ChangeLog before executing
5. If amount >$200: post to #billing-ops for Jennifer approval

After any charge:
1. Log to PaymentLog entity
2. Log to BillingEvent entity
3. Update customer billingBehaviorTag

## Routines

### Routine: 'Refund Customer'
Trigger words: 'refund', 'return money', 'reverse charge', 'give back'

Mandatory steps:
1. Look up customer (fire Customer 360 routine first)
2. Identify the transaction to refund (get transaction_id)
3. If amount >$200: post to #billing-ops, wait for Jennifer approval
4. Call NMI refund via nmi-connector
5. Verify refund succeeded (check PaymentLog)
6. Post confirmation to #billing-ops
7. Update customer billingBehaviorTag

### Routine: 'Recover Decline'
Trigger words: 'decline', 'failed payment', 'recover', 'retry payment'

Mandatory steps:
1. Identify the decline (get PaymentLog entry)
2. Classify: soft decline (insufficient_funds, velocity) vs hard decline (fraud, stolen)
3. If HARD DECLINE: send payment_update_link, do NOT retry
4. If SOFT DECLINE: check if within 3-attempt recovery window
5. If retry allowed: trigger smart retry via nmi-connector
6. Log to RecoveryItem
7. Post summary to #billing-ops

### Routine: 'Pause Subscription'
Trigger words: 'pause', 'suspend', 'stop billing', 'freeze'

Mandatory steps:
1. Look up customer subscription in NMI
2. Set subscription status to paused
3. Log pause reason to BillingEvent
4. Calculate resume eligibility date (if any)
5. Notify customer via email (using generate-ai-email)
6. Post to #billing-ops

### Routine: 'Update Card'
Trigger words: 'new card', 'update payment', 'change card'

Mandatory steps:
1. Send customer payment_update_link via NMI
2. Set 72h expiry
3. Track via GHL automation sequence
4. Log to CustomerActivityLog
5. If link expires: send follow-up reminder

## Custom Skills (under connectors/neptune)

### Connectors
| Skill Pack | Actions | Path | Used For |
|-----------|---------|------|----------|
| `github` | 35 | `connectors/neptune/skills/github/` | Code commits, PR management, billing logic deployment |
| `ghl` | 35 | `connectors/neptune/skills/ghl/` | SMS billing links, email payment reminders |

### Functions
| Function | Path | Used For |
|----------|------|----------|
| `parse-decline-reason` | `connectors/neptune/functions/parse-decline-reason.ts` | NMI decline code classification (HARD/SOFT/CONFIG) |
| `compute-mrr` | `connectors/neptune/functions/compute-mrr.ts` | MRR calculation from payment records |
| `annotation-collector` | `connectors/neptune/functions/annotation-collector.ts` | Capture billing execution outcomes for learning |
| `usage-telemetry` | `connectors/neptune/functions/usage-telemetry.ts` | Track billing function usage and error patterns |

## Refinement Notes
- 2026-06-11: source_transaction_id is BANNED per NMI Golden Vault Architecture. Use customer_vault_id + DPAN only.
- 2026-06-11: Day-Zero CIT is the consent anchor. Never charge without it.
- 2026-06-12: Phase 8 — 200 neptune-authored skills available. parse-decline-reason replaces inline decline classification.
