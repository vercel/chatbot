# Playbook Skills — Master Index

Auto-generated master index of all skills, connectors, and capabilities.  
Source of truth for the Progressive Disclosure skill loading system (U2).

## 📚 Playbooks (11 domains)

| Domain | Path | Playbook File |
|--------|------|---------------|
| Agent Orchestration | playbooks/agent-orchestration/ | playbook-agent-orchestration.md |
| Billing | playbooks/billing/ | playbook-billing.md |
| Customer Support | playbooks/customer-support/ | playbook-customer-support.md |
| Deploy (Vercel + GitHub) | playbooks/deploy-vercel-github/ | playbook-deploy.md |
| Disputes | playbooks/disputes/ | playbook-disputes.md |
| Engineering | playbooks/engineering/ | playbook-engineering.md |
| HR | playbooks/HR/ | playbook-HR.md |
| Marketing | playbooks/marketing/ | playbook-marketing.md |
| Reporting | playbooks/reporting/ | playbook-reporting.md |
| Vercel Discipline | playbooks/vercel-discipline/ | playbook-vercel-discipline.md |
| VPS Ops | playbooks/vps-ops/ | playbook-vps-ops.md |

## 🔌 Connectors (13 integration packs)

| Connector | Path | Domain | MCP | Description |
|-----------|------|--------|-----|-------------|
| Base44 CRM | connectors/base44/ | customer-enrollment | - | Entity queries, customer 360, reporting hub |
| Slack | connectors/slack/ | comms | - | Channel messaging, history search, notifications |
| NMI Payments | connectors/nmi/ | billing-flow | - | Card vault, recurring billing, transaction queries |
| Hyperswitch | connectors/hyperswitch/ | billing-flow | - | Payment orchestration, payment links, webhooks |
| Linear | connectors/linear/ | engineering | - | Issue tracking and project management |
| GitHub | connectors/github/ | engineering | - | Repo access, PR management, V2 coding handoff |
| Vapi Voice AI | connectors/vapi/ | support-triage | - | Call logs, transcripts, agent analytics |
| GHL CRM | connectors/ghl/ | customer-comms | - | Contacts, SMS, email, pipeline |
| Forth Credit | connectors/forth/ | credit-disputes | - | Dispute management, credit repair |
| Vercel Deploy | connectors/vercel/ | engineering | - | Projects, deployments, webhooks |
| Wiki | connectors/wiki/ | reporting | - | Karpathy-style second brain |
| Affy Chargebacks | connectors/affy/ | billing-flow | - | Chargeback disputes and defense |
| MCP Hub | connectors/mcp-hub/ | mcp-edits | - | Multi-server MCP aggregator |

## ✨ Capabilities (7 agent skills)

| Skill | Path | Domain |
|-------|------|--------|
| Artifact Response Pattern | skills/capabilities/artifact-response-pattern/ | coding |
| Code Review | skills/capabilities/code-review/ | coding |
| Deploy Yourself | skills/capabilities/deploy-yourself/ | engineering |
| Playbook Refiner | skills/capabilities/playbook-refiner/ | agent-orchestration |
| Research | skills/capabilities/research/ | reporting |
| Response Formatting | skills/capabilities/response-formatting/ | support-triage |
| Self Coding | skills/capabilities/self-coding/ | coding |

## 🔧 Functions (10 domain functions)

| Function | Path | Domain |
|----------|------|--------|
| Billing Event Logger | skills/functions/billing-event-logger/ | billing-flow |
| Build Customer VDE | skills/functions/build-customer-vde/ | customer-enrollment |
| Calculate Refund Eligibility | skills/functions/calculate-refund-eligibility/ | billing-flow |
| CoF Health Audit | skills/functions/cof-health-audit/ | billing-flow |
| Execute with Post-Verify | skills/functions/execute-with-post-verify/ | compliance-audit |
| Extract Customer PII | skills/functions/extract-customer-pii/ | compliance-audit |
| Generate AI Email | skills/functions/generate-ai-email/ | customer-comms |
| Parse FCRA Credit Report | skills/functions/parse-fcra-credit-report/ | credit-disputes |
| Resolve Customer Identity | skills/functions/resolve-customer-identity/ | customer-enrollment |
| Validate Action | skills/functions/validate-action/ | compliance-audit |

## 🔗 Connector Skills (13 per-connector docs)

| Skill | Path |
|-------|------|
| affy | skills/connectors/affy/ |
| base44 | skills/connectors/base44/ |
| forth | skills/connectors/forth/ |
| ghl | skills/connectors/ghl/ |
| github | skills/connectors/github/ |
| hyperswitch | skills/connectors/hyperswitch/ |
| linear | skills/connectors/linear/ |
| mcp-hub | skills/connectors/mcp-hub/ |
| nmi | skills/connectors/nmi/ |
| slack | skills/connectors/slack/ |
| vapi | skills/connectors/vapi/ |
| vercel | skills/connectors/vercel/ |
| wiki | skills/connectors/wiki/ |

## Load via `load_skill`

```
playbooks/billing
connectors/slack
capabilities/self-coding
skills/functions/validate-action
```

## Totals

- **11** playbook domains
- **13** connector integration packs
- **7** capabilities
- **10** functions
- **13** connector skill docs
- **54** total loadable skill paths
