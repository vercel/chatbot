---
connector: base44
version: 0.3.0
scope: connector
auto_load: true
trigger_tools:
  - base44:createEntity
  - base44:customer360
  - base44:invokeFunction
  - base44:queryEntity
  - base44:reportingHub
  - base44:updateEntity
headline: |
  Base44 central backend for NewLeaf ops. 12 queryable entities, 16 report actions.
  Never call hostingerBridge from off-VPS. Query with filters, always paginate.
type: "playbook"
---

# Base44 Connector Playbook

## Operational Knowledge

### Architecture
Base44 is the central backend for NewLeaf operations — CRM, payments, tickets, calls, automations. The Base44 connector uses `base44Service` from `../client` to authenticate via internal service tokens. Tools expose entity CRUD, customer 360 lookups, reporting hub queries, and backend function invocation.

### API Pattern
All calls go through `base44Service` which handles:
- Internal auth header injection
- Request/response serialization
- Error normalization
- Timeout management (10s default)

### Entity Schema
12 queryable entities: CustomerProfile, PaymentLog, AdminNotification, SupportTicket, SlackSubmission, CallLog, VapiCallEvent, CreditReport, BillingQueue, RecoveryItem, Subscription, NmiTransaction.

### Report Actions
16 pre-aggregated reports: overview, enrollments, lead_flow, billing, communications, calls, agents, support, automations, activity_feed, customer_360, customer_comms, sync_health, morning_pulse, vapi_intelligence, enrollment_intelligence.

## Business Context

### Why Base44
Base44 is the source of truth for NewLeaf. Every customer interaction, payment, ticket, and automation lives here. This connector gives Neptune agents full read/write access to the operational backend, enabling:
1. Customer research (who is this person? what's their history?)
2. Operational reporting (how are enrollments trending?)
3. Data remediation (fix stale records, update statuses)
4. Backend function execution (trigger NMI charges, send Slack messages)

### When to Use
- **Customer research**: Use `customer360` for comprehensive dossiers
- **Operational queries**: Use `queryEntity` for filtered lookups
- **Fast reporting**: Use `reportingHub` for pre-aggregated data
- **Backend operations**: Use `invokeFunction` for authenticated function calls

## Anti-Patterns

### ❌ NEVER:
1. **Query without filters on large entities** — always paginate with `limit`
2. **Use string entity names** — use the `z.enum` values from schema.ts
3. **Invoke arbitrary functions** — only call documented Base44 backend functions
4. **Assume all entities have the same fields** — use `schema_describe` to check first
5. **Create entities without required fields** — check the schema first
6. **Update entities with full objects** — use partial patches (only changed fields)

### ⚠️ DANGEROUS:
- Writing to entities without verifying current state first
- Bulk updates without dry-run or limit
- Invoking `hostingerBridge` from off-VPS — it adds 5-30s latency and risks 403s

## Safeguards

### Query Limits
- Default: 50 records per query
- Max: 500 records per query
- For larger datasets, use `query_all` or cursor-based streaming

### Error Handling
- Missing entity → check `schema_list_entities` for valid names
- Auth failure → verify internal service token
- Timeout → reduce limit, add more specific filters

### Entity Validation
- Always use the entity enum from schema.ts
- `reportingHub` actions must match the 16 supported actions
- `customer360` requires at least one of: customerId, email, phone

## Common Workflows

### Customer 360 Research
```
customer360({ customerId: "xxx" })
→ returns full dossier: profile + payments + calls + emails + tickets
→ use for support triage, billing research, account review
```

### Query Recent Payments
```
queryEntity({ entity: "PaymentLog", filter: { created_date: { $gte: "2026-06-01" } }, sort: "-created_date", limit: 20 })
```

### Run Morning Pulse Report
```
reportingHub({ action: "morning_pulse" })
→ returns pre-aggregated operational health data
```

### Create a Support Ticket
```
createEntity({ entity: "SupportTicket", data: { customerId: "xxx", subject: "...", priority: "high" } })
```

## Refinement Notes

- **Version:** 1.1.0
- **Created:** 2026-05, 2026-06-09 (6-section refactor)
- **Last Reviewed:** 2026-06-09
- **Source:** Base44 API, Base44 MCP tools documentation
- **Related:** Base44 Two-Lane Workflow PRD, jarvis/cortex/skills/tool-routing.md
