---
name: HR & People Operations Playbook
description: Agent performance tracking, skill proficiency metrics, team workload distribution, and operational health monitoring.
domain: hr
connectors: [slack, base44]
version: "1.0"
updated: 2026-06-22
---

# HR & People Operations Playbook

## Purpose
Track agent team performance, manage workload distribution, monitor skill proficiency, and maintain operational health metrics.

## Safeguards
- Agent performance data is internal-only
- Never expose individual agent metrics in public channels
- Proficiency scores require 10+ samples before publishing
- Workload alerts trigger at 80% capacity

## Routines

### Routine: Agent Performance Report
1. Query agent activity logs (last 7 days)
2. Calculate: tasks completed, avg resolution time, error rate
3. Score skill proficiency per domain
4. Generate performance dashboard
5. Flag underperforming agents for review

### Routine: Workload Distribution Check
1. Query active tasks by agent
2. Calculate workload percentage
3. Flag agents >80% capacity
4. Recommend redistribution
5. Post workload summary to #jarvis-admin

### Routine: Skill Gap Analysis
1. Audit all agent skill assignments
2. Cross-reference with task completion data
3. Identify domains with <2 proficient agents
4. Recommend training or new agent assignment
5. Update skill registry

### Routine: Operational Health Pulse
1. Check all PM2 processes (17/17 online check)
2. Verify API health endpoints
3. Check deployment queue depth
4. Monitor error rates across services
5. Generate morning pulse report

## Workflows
- **agent-review**: Weekly agent performance review
- **capacity-plan**: Workload capacity planning
- **skill-audit**: Skill proficiency audit

## Anti-Patterns
- Do NOT share individual agent metrics externally
- Do NOT auto-reassign without human approval
- Do NOT trigger alerts for <10 sample sizes
