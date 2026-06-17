---
type: playbook
name: "NewLeaf Operations — Master Playbook"
description: "How NewLeaf Financial operates end-to-end — sales, onboarding, billing, disputes, support, communications, agent workflow"
version: "1.0.0"
updated: "2026-06-17"
domain: customer-enrollment
priority: P0
scope: domain
scope_connectors:
  - base44-connector
  - nmi-connector
  - hyperswitch-connector
  - forth-connector
  - slack-connector
  - vapi-connector
  - ghl-connector
workflows:
  - sales-pipeline
  - onboarding
  - billing-lifecycle
  - dispute-management
  - support-operations
  - communications
  - agent-workflow
tags: ["newleaf", "operations", "master", "p0", "twenty-crm"]
access: internal
---

# NewLeaf Operations — Master Playbook

This is the single source of truth for how NewLeaf Financial operates end-to-end. Every sub-playbook maps to Twenty CRM objects, workflows, and agent skills.

## Sub-Playbooks

| Sub-Playbook | Domain | Twenty Objects | Key Skills |
|-------------|--------|---------------|------------|
| [Sales Pipeline](./sub-playbooks/sales-pipeline.md) | lead-flow | deals, companies, contacts | GHL, VAPI, Slack |
| [Onboarding](./sub-playbooks/onboarding.md) | customer-enrollment | customers, agreements, tasks | Base44, Forth, Email |
| [Billing Lifecycle](./sub-playbooks/billing-lifecycle.md) | billing-flow | payment_logs, nmi_transactions | NMI, Hyperswitch, Base44 |
| [Dispute Management](./sub-playbooks/dispute-management.md) | credit-disputes | dispute_rounds, negative_items | Forth, Base44, Slack |
| [Support Operations](./sub-playbooks/support-operations.md) | support-triage | support_tickets, agent_calls | VAPI, Slack, Base44 |
| [Communications](./sub-playbooks/communications.md) | customer-comms | emails, sms_messages, slack_messages | Resend, Slack, GHL |
| [Agent Workflow](./sub-playbooks/agent-workflow.md) | agent-payments | agent_calls, activity_log | Base44, Slack, VAPI |

## Twenty CRM Integration

This master playbook is consumed by Twenty CRM to render workflow guides for agents:

- **Sales agents** see the Sales Pipeline playbook in their sidebar
- **Support agents** see Support Operations with ticket workflows
- **Billing agents** see Billing Lifecycle with NMI tools
- **Admin** sees all playbooks with RBAC controls

## Cross-Cutting Rules

1. **NMI Vault Sacred Reference:** `6a1f118b` — never modify, always reference
2. **Slack:** All notifications go to `#jarvis-admin` (C0AQDDC3HAB), never `#newleaf-admin`
3. **Base44:** Query with filters, always paginate, never call `hostingerBridge` from off-VPS
4. **Compliance:** All customer interactions logged. FCRA compliance for disputes.
5. **Deploy:** Never push directly to main. Feature branches + PR review.
