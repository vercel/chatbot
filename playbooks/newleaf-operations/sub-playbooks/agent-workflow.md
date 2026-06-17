---
type: playbook
name: "Agent Workflow"
description: "Daily agent workflow — morning pulse, task routing, call handling, activity logging"
version: "1.0.0"
updated: "2026-06-17"
domain: agent-payments
priority: P1
scope: domain
scope_connectors: [base44-connector, slack-connector, vapi-connector]
workflows: [morning-pulse]
triggers: [agent, workflow, morning, routine, call, activity, task]
access: internal
---

# Agent Workflow

## Morning Pulse
1. **Login:** Twenty CRM + Slack
2. **Morning Pulse:** reportingHub:morning_pulse shows today's priorities
3. **Queue:** Check assigned tasks and active disputes
4. **Calls:** VAPI queue for scheduled/return calls
5. **Slack:** Review #jarvis-admin for overnight alerts

## During Day
1. **Handle Tasks:** Twenty CRM task queue prioritized by deadline
2. **Calls:** Inbound (VAPI routing) + Outbound (scheduled follow-ups)
3. **Disputes:** Process dispute rounds, file responses
4. **Billing:** Handle decline recovery, refund requests
5. **Documentation:** Log all activities to Base44 activity_log

## End of Day
1. **Status Update:** Update Twenty CRM with progress
2. **Handoff:** Document pending items for next shift
3. **Metrics:** Review daily KPIs (calls handled, disputes resolved)
4. **Slack:** EOD summary to team channel

## Twenty CRM Views
- **My Tasks:** Personal task queue
- **Pipeline:** Deals by stage
- **Active Disputes:** Open dispute rounds
- **Failed Payments:** Billing queue for follow-up
