---
type: playbook
name: "Support Operations"
description: "Customer support — ticket triage, call handling, issue resolution, escalations"
version: "1.0.0"
updated: "2026-06-17"
domain: support-triage
priority: P1
triggers: [support, ticket, help, issue, escalation, callback]
access: internal
---
# Support Operations
Twenty Objects: support_tickets, agent_calls, activity_log
Flow: Ticket created → Triage (P0-P4) → Agent assigned → Resolution → Customer confirms → Close
Escalation: P0 → #jarvis-admin Slack immediately. VAPI callback within 15 minutes.
