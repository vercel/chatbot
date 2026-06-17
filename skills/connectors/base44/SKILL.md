---
name: base44-connector
version: 1.0.0
kind: connector
primary_domain: customer-enrollment
also_in: [billing-flow, credit-disputes, support-triage, reporting, agent-payments, comms]
tools: [createEntity, customer360, invokeFunction, queryEntity, reportingHub, updateEntity, aggregateEntity]
dependencies: []
headline: |
  Base44 central backend for NewLeaf ops. 12 queryable entities, 16 report actions.
  Never call hostingerBridge from off-VPS. Query with filters, always paginate.
type: "skill"
---

# Base44 Connector Skill

## Operational Knowledge
Central entity persistence and business logic backend for NewLeaf Financial.

### Entities (12)
CustomerProfile, PaymentLog, SupportTicket, CallLog, VapiCallEvent, AdminNotification,
NmiTransaction, SlackMessage, Email, Agreement, CreditReport, RecoveryItem

### Reports (16 actions)
overview, enrollments, lead_flow, billing, communications, calls, agents, support,
automations, activity_feed, customer_360, customer_comms, sync_health, morning_pulse,
vapi_intelligence, enrollment_intelligence

## Tools
| Tool | Description |
|------|-------------|
| queryEntity | MongoDB-style filtered query |
| createEntity | Create new record |
| updateEntity | Patch existing record |
| customer360 | Full customer dossier |
| invokeFunction | Call backend function |
| reportingHub | Aggregated reports |
| aggregateEntity | Server-side aggregation |

## Anti-Patterns
- NEVER call hostingerBridge from off-VPS
- NEVER query without filters on large entities
- NEVER skip pagination

## Safeguards
- Always paginate queries (default 250 limit)
- Use b44_count before b44_query for large datasets
