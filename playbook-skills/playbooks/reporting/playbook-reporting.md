---
name: Reporting & Analytics Playbook
description: Operational reporting, business intelligence, data aggregation, and dashboard generation for NewLeaf Financial.
domain: reporting
connectors: [base44, nmi, slack, vapi]
version: "1.0"
updated: 2026-06-22
---

# Reporting & Analytics Playbook

## Purpose
Generate operational reports, business intelligence dashboards, and data aggregation across all NewLeaf systems.

## Safeguards
- Reports must not expose customer PII externally
- Financial data requires audit trail
- Aggregated data must be verified against source systems
- Report generation should not impact production API performance

## Routines

### Routine: Morning Pulse Report
1. Call `reportingHub` with action=morning_pulse
2. Compile: enrollments, billing, support tickets, agent calls
3. Compare against 7-day averages
4. Flag anomalies (>2 sigma deviation)
5. Post summary to #jarvis-admin

### Routine: Enrollment Intelligence
1. Call `reportingHub` with action=enrollment_intelligence
2. Pull lead flow, conversion rates, drop-off points
3. Analyze time-to-enroll metrics
4. Identify bottlenecks
5. Generate enrollment funnel report

### Routine: Billing Report
1. Call `reportingHub` with action=billing
2. Aggregate: total processed, success rate, decline rate, recovery rate
3. Break down by payment method, COF indicator
4. Compare month-over-month
5. Flag billing anomalies

### Routine: Agent Performance Report
1. Call `reportingHub` with action=agents
2. Pull: calls handled, resolution rate, avg duration
3. Score agents by customer satisfaction
4. Identify training opportunities
5. Generate agent scorecard

### Routine: Sync Health Report
1. Call `reportingHub` with action=sync_health
2. Verify: Base44 ↔ NMI sync, Slack ↔ tickets sync
3. Check data freshness (last sync timestamp)
4. Flag sync delays or errors
5. Generate sync health dashboard

## Workflows
- **morning-pulse**: Automated morning report generation
- **weekly-business-review**: Full weekly business intelligence
- **sync-audit**: Cross-system data sync verification

## Anti-Patterns
- Do NOT generate reports during peak API hours
- Do NOT expose raw customer data in reports
- Do NOT skip source verification for aggregated metrics
