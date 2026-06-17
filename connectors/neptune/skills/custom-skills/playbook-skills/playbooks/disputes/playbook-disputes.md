---
playbook: disputes
version: "1.0.0"
domain: credit-disputes
scope: domain
scope_connectors:
  - forth-connector
  - base44-connector
  - slack-connector
  - ghl-connector
triggers:
  - dispute
  - credit report
  - negative item
  - credit repair
  - FCRA
  - debt validation
  - credit restoration
workflows:
  - dispute-orchestrator
  - credit-restoration-engine
description: "Credit disputes SOP — debt validation, FCRA compliance, credit report parsing, and dispute orchestration. Routes to Forth, Base44, and Slack connectors."
model_routing:
  default: "anthropic/claude-sonnet-4-6"
  reasoning_heavy: "anthropic/claude-opus-4-6"
  fast_iteration: "deepseek/deepseek-v4-flash"
  long_context: "google/gemini-2-pro"
type: "playbook"
access: internal
---

# Disputes Domain Playbook


## 🧠 PRE-CHECK KNOWLEDGE (U7.4)

Before executing any routine in this domain, the agent MUST query the Knowledge Graph:

- `knowledge://disputes/cardinal-rules`
- `knowledge://disputes/recent-patterns`

If the user query mentions a specific entity (customer, transaction, deploy, connector), also query that entity for context.

**Cardinal rules from the KG get TOP PRIORITY (confidence=1.0).**
If the KG returns conflicting information with this playbook, NOTE the conflict but FOLLOW the playbook — the U4.1 self-healing loop will resolve.
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

## Custom Skills (under connectors/neptune)

### Connectors
| Skill Pack | Actions | Path | Used For |
|-----------|---------|------|----------|
| `forth` | 30 | `connectors/neptune/skills/forth/` | DPP credit repair: reports, enrollments, disputes, resolutions, compliance |
| `affy` | 15 | `connectors/neptune/skills/affy/` | Chargeback defense: disputes, evidence, affidavits, tracking, analytics |

### Functions
| Function | Path | Used For |
|----------|------|----------|
| `annotation-collector` | `connectors/neptune/functions/annotation-collector.ts` | Capture dispute execution outcomes for learning |
| `usage-telemetry` | `connectors/neptune/functions/usage-telemetry.ts` | Track dispute function usage patterns |

## Refinement Notes
- 2026-06-11: 3-rejection auto-escalate rule prevents infinite dispute loops.
- 2026-06-11: Credit report must be <90 days old per FCRA guidelines. Stale credit trigger at 90 days.
- 2026-06-12: Phase 8 — Forth (30) + Affy (15) provide complete credit repair + chargeback defense tooling.
