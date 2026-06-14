# Playbook Skills — Master Index

Auto-generated master index of all skills, connectors, and capabilities.  
Source of truth for the Progressive Disclosure skill loading system (U2).

*Regenerated: 2026-06-12T06:02:00.850Z by skill-author/regenerate-skill-index*

## 📚 Playbooks (10 domains)

| Domain | Path | Playbook File |
|--------|------|---------------|
| HR | playbooks/HR/ | playbook-HR.md |
| Agent Orchestration | playbooks/agent-orchestration/ | playbook-agent-orchestration.md |
| Billing | playbooks/billing/ | playbook-billing.md |
| Customer Support | playbooks/customer-support/ | playbook-customer-support.md |
| Disputes | playbooks/disputes/ | playbook-disputes.md |
| Engineering | playbooks/engineering/ | playbook-engineering.md |
| Marketing | playbooks/marketing/ | playbook-marketing.md |
| Reporting | playbooks/reporting/ | playbook-reporting.md |
| Vercel Discipline | playbooks/vercel-discipline/ | playbook-vercel-discipline.md |
| VPS Ops | playbooks/vps-ops/ | playbook-vps-ops.md |

## 🔌 Connectors (17 integration packs)

| Connector | Path | Domain | MCP | Description |
|-----------|------|--------|-----|-------------|
| Affy | connectors/affy/ | billing-flow | - | Chargeback disputes — affidavits, evidence, and defense automation |
| AI SDK 6 | connectors/ai-sdk-6/ | mcp-edits | - | Vercel AI SDK v6 — streamText, generateText, ToolLoopAgent, resumable streams, MCP tools |
| Base44 | connectors/base44/ | customer-enrollment | - | Entity queries, customer 360, reporting hub, and function invocation |
| Cat-facts | connectors/cat-facts/ | engineering | - | Cat Facts API — random feline trivia from catfact.ninja |
| Custom-skills | connectors/custom-skills/ | agent-orchestration | - | Pure non-API capabilities — playbook refinement, code review, self-coding, research, and response formatting. No external API, operates on local filesystem and knowledge graph. |
| Forth | connectors/forth/ | credit-disputes | - | Debt Protection Program — dispute management and credit repair |
| Ghl | connectors/ghl/ | customer-comms | - | CRM — contacts, SMS, email, conversations, and pipeline |
| Github | connectors/github/ | engineering | - | Repo access, code search, PR management, and V2 coding handoff |
| Hyperswitch | connectors/hyperswitch/ | billing-flow | ✓ | Self-hosted payment orchestration — NMI connector, payment links, webhooks |
| Linear | connectors/linear/ | engineering | - | Issue tracking and project management |
| Mcp-hub | connectors/mcp-hub/ | mcp-edits | - | Multi-server MCP aggregator — GitHub, Filesystem, Brave Search |
| Nmi | connectors/nmi/ | billing-flow | - | Card vault, recurring billing, and transaction queries via Hyperswitch |
| Slack | connectors/slack/ | comms | ✓ | Channel messaging, history search, and notifications |
| Vapi | connectors/vapi/ | support-triage | - | Voice AI — call logs, transcripts, and agent analytics |
| Vercel | connectors/vercel/ | engineering | - | Manage Vercel projects, deployments, build logs, and webhook events |
| Wiki | connectors/wiki/ | reporting | - | Karpathy-style second brain — ingest, query, lint, and manage knowledge |
| Workflow DevKit | connectors/workflow-devkit/ | mcp-edits | - | Durable workflows — createWorkflow, step.run, hooks.waitFor, sleep, crash recovery |

## ✨ Capabilities (7 agent skills)

| Skill | Path | Domain |
|-------|------|--------|
| artifact-response-pattern | skills/capabilities/artifact-response-pattern/ | coding |
| code-review | skills/capabilities/code-review/ | coding |
| deploy-yourself | skills/capabilities/deploy-yourself/ | engineering |
| playbook-refiner | skills/capabilities/playbook-refiner/ | agent-orchestration |
| research | skills/capabilities/research/ | reporting |
| response-formatting | skills/capabilities/response-formatting/ | support-triage |
| self-coding | skills/capabilities/self-coding/ | engineering |

## 🔧 Functions (10 domain functions)

| Function | Path | Domain |
|----------|------|--------|
| billing-event-logger | skills/functions/billing-event-logger/ | billing-flow |
| build-customer-vde | skills/functions/build-customer-vde/ | customer-enrollment |
| calculate-refund-eligibility | skills/functions/calculate-refund-eligibility/ | billing-flow |
| cof-health-audit | skills/functions/cof-health-audit/ | billing-flow |
| execute-with-post-verify | skills/functions/execute-with-post-verify/ | compliance-audit |
| extract-customer-pii | skills/functions/extract-customer-pii/ | compliance-audit |
| generate-ai-email | skills/functions/generate-ai-email/ | customer-comms |
| parse-fcra-credit-report | skills/functions/parse-fcra-credit-report/ | credit-disputes |
| resolve-customer-identity | skills/functions/resolve-customer-identity/ | customer-enrollment |
| validate-action | skills/functions/validate-action/ | compliance-audit |

## 🔗 Connector Skills (15 per-connector docs)

| Skill | Path |
|-------|------|
| affy | skills/connectors/affy/ |
| ai-sdk-6 | skills/connectors/ai-sdk-6/ |
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
| workflow-devkit | skills/connectors/workflow-devkit/ |

## Load via `load_skill`

```
playbooks/HR
connectors/affy
capabilities/artifact-response-pattern
skills/functions/billing-event-logger
```

## Totals

- **10** playbook domains
- **17** connector integration packs
- **7** capabilities
- **10** functions
- **15** connector skill docs
- **59** total loadable skill paths

*Regenerated 2026-06-12T06:02:00.850Z*
