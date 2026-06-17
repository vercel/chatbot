---
playbook: reporting
version: 1.0.0
domain: reporting
scope: domain
model_routing:
  default: "deepseek/deepseek-v4-pro"
  reasoning_heavy: "anthropic/claude-sonnet-4-6"
  fast_iteration: "deepseek/deepseek-v4-flash"
  cheap: "deepseek/deepseek-v3.2"
auto_load: false
headline: Operational dashboards, morning pulse, analytics and data queries
priority: P1
scope_connectors:
  - base44-connector
  - slack-connector
  - wiki-connector
triggers:
  - report
  - dashboard
  - snapshot
  - morning pulse
  - analytics
  - metrics
  - KPI
  - overview
workflows:
  - hourly-intelligence-sweep
description: "Reporting SOP — operational dashboards, morning pulse, analytics queries, and data snapshots. Routes to Base44 (reportingHubQuery), Slack, and Wiki connectors."
intent_tags:
  - reporting
  - dashboard
  - analytics
  - morning pulse
  - metrics
  - query
  - aggregate
  - stats
associated_connectors:
  - base44
  - slack
  - wiki
associated_skills:
  - capabilities/research
associated_functions:
  - jarvis_data_guard_query
  - reporting_overview
  - reporting_billing
routines_count: 3
type: "playbook"
access: internal
---

# Reporting Domain Playbook


## 🧠 PRE-CHECK KNOWLEDGE (U7.4)

Before executing any routine in this domain, the agent MUST query the Knowledge Graph:

- `knowledge://reporting/cardinal-rules`
- `knowledge://reporting/query-patterns`

If the user query mentions a specific entity (customer, transaction, deploy, connector), also query that entity for context.

**Cardinal rules from the KG get TOP PRIORITY (confidence=1.0).**
If the KG returns conflicting information with this playbook, NOTE the conflict but FOLLOW the playbook — the U4.1 self-healing loop will resolve.
## Operational Knowledge
- **Primary Data Source:** Base44 reportingHub with 16 report actions
- **SQL Warehouse:** jarvisDataGuard validated_query (read-only, 22 tables, 50K+ records)
- **Entities Tracked:** PaymentLog, CallLog, SupportTicket, VapiCallEvent, EmailMessage, GhlMessage, DisputeRound, NegativeItem, CustomerActivityLog, BillingEvent
- **Key Metrics:** MRR ($33,749.32), 168 active enrolled, 155 confirmed billing
- **Dashboards:** Morning Pulse (daily summary), VAPI Intelligence, Enrollment Intelligence
- **Aggregation:** b44_aggregate for server-side counts/sums without data transfer

## Business Context
- Slack #jarvis-admin: primary channel for scheduled report delivery
- Morning Pulse: daily 9am summary of previous day metrics
- Sync Health: monitors cross-system data freshness (GHL, Slack, Freshcaller, VAPI)
- Lead Flow: tracks lead source → enrolled conversion funnel
- Billing Report: revenue, declines, recoveries, refund breakdown
- Agent Performance: call volume, ticket resolution, response times

## Anti-Patterns (DO NOT DO)
- DON'T pull raw customer data into Slack channels (PII risk)
- DON'T run heavy aggregations without server-side aggregate (b44_aggregate)
- DON'T expose SQL query results containing PII or secrets
- DON'T report on stale data — check sync health first
- DON'T compare metrics across different time windows without normalization
- DON'T include test/synthetic data in production reports
- DON'T run ad-hoc queries on production during peak hours

## Safeguards
1. Before any report: verify data freshness (sync_health report)
2. Before Slack post: redact PII, summarize, add timestamp
3. SQL queries: use jarvisDataGuard validated_query only (no raw SQL)
4. Aggregate queries: use b44_aggregate for server-side computation
5. Report formatting: use numbered lists, tables, clear headers
6. Timezone: all times in UTC unless specified
7. Trend comparison: always include prior period for context
8. Never expose raw customer records in reports

## Routines

### Routine: 'Morning Pulse Report'
Trigger words: 'morning pulse', 'daily report', 'today's numbers',
              'what happened yesterday', 'daily summary'

Mandatory steps:
1. Run reportingHub overview for top-level metrics
2. Run reportingHub billing for revenue + decline stats
3. Run reportingHub enrollments for new/churned customers
4. Run reportingHub communications for engagement stats
5. Run reportingHub sync_health for data freshness
6. Run reportingHub support for ticket volumes
7. Format as structured Morning Pulse: header + 5 sections
8. Post to #jarvis-admin with timestamp

### Routine: 'Customer Metrics Query'
Trigger words: 'how many customers', 'customer count', 'enrollment stats',
              'active customers', 'customer metrics', 'MRR report'

Mandatory steps:
1. Use b44_aggregate to get customer counts grouped by status
2. Use b44_count for exact counts with filters
3. Query billing metrics: MRR, avg payment, decline rate
4. Query engagement: active vs at-risk breakdown
5. Present with trend arrows (↑↓) and comparison to previous period
6. Include data freshness disclaimer

### Routine: 'Sync Health Audit'
Trigger words: 'sync health', 'data freshness', 'check sync',
              'integration health', 'are systems syncing'

Mandatory steps:
1. Run reportingHub sync_health for all integrations
2. Check each system's last sync timestamp
3. Identify stale systems (>4h without sync)
4. Flag DOWN systems (no sync >12h)
5. Report health score per system (green/yellow/red)
6. If any system is DOWN: create admin notification
7. Post health dashboard to #jarvis-admin

## Custom Skills (under connectors/neptune)

### Connectors
| Skill Pack | Actions | Path | Used For |
|-----------|---------|------|----------|
| `ghl` | 35 | `connectors/neptune/skills/ghl/` | Campaign analytics, pipeline reporting |

### Functions
| Function | Path | Used For |
|----------|------|----------|
| `compute-mrr` | `connectors/neptune/functions/compute-mrr.ts` | Monthly Recurring Revenue calculation from subscriptions |
| `usage-telemetry` | `connectors/neptune/functions/usage-telemetry.ts` | Track report generation frequency and errors |

## Refinement Notes
- 2026-06-11: Freshcaller was DOWN (19h no sync) — sync health monitoring now mandatory.
- 2026-06-11: Slack sync was writing 0 records — requires investigation.
- 2026-06-12: Morning Pulse routine formalized with 8-step procedure.
- 2026-06-12: Phase 8 — compute-mrr provides server-side MRR calculation from payment records.
