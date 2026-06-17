---
type: playbook
name: "Sales Pipeline"
description: "End-to-end sales pipeline from lead capture to deal close"
version: "1.0.0"
updated: "2026-06-17"
domain: lead-flow
priority: P2
scope: domain
scope_connectors: [ghl-connector, vapi-connector, slack-connector, base44-connector]
triggers: [lead, prospect, deal, pipeline, sales, follow-up, SMS, email campaign]
model_routing:
  default: "deepseek/deepseek-v4-pro"
  reasoning_heavy: "anthropic/claude-sonnet-4-6"
access: internal
---

# Sales Pipeline

## Twenty CRM Objects
- **Deals:** Pipeline stages (New → Contacted → Qualified → Proposal → Closed Won/Lost)
- **Companies:** Prospect organizations
- **Contacts:** Individual decision-makers
- **Tasks:** Follow-up tasks assigned to agents

## Lead Flow
1. **Lead Capture:** GHL forms, VAPI inbound calls, website
2. **Qualification:** Base44 enrichment (credit report, existing customer?)
3. **Assignment:** Round-robin to available sales agents
4. **Follow-up:** Automated SMS (GHL) + email sequences
5. **Pipeline:** Tracked in Twenty CRM deals
6. **Closed:** Won → Onboarding | Lost → Nurture campaign

## Agent Workflow
- Check GHL for new leads (morning routine)
- Review Twenty CRM deal pipeline
- Prioritize by deal stage and last contact date
- Call via VAPI, log to Base44 CallLog
- Update deal stage in Twenty CRM
- Post daily summary to #jarvis-admin
