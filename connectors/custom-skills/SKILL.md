---
name: custom-skills
description: Pure non-API capabilities — playbook refinement, code review, self-coding, research, and response formatting. No external API, operates on local filesystem and knowledge graph.
version: 1.0.0
domain: agent-orchestration
mcp: false
custom_client: false
type: "skill"
---
# Custom Skills Pseudo-Connector

## File Capabilities & Paths
- **No client.ts** — these are pure capabilities, not API connectors
- **Skills live at:** `skills/capabilities/` and `skills/functions/`
- **Reference:** `skills/playbook-skills.md`

## Available Skills
| Skill | Type | Domain |
|-------|------|--------|
| playbook-refiner | capability | agent-orchestration |
| code-review | capability | mcp-edits |
| deploy-yourself | capability | mcp-edits |
| self-coding | capability | mcp-edits |
| research | capability | reporting |
| response-formatting | capability | customer-comms |
| artifact-response-pattern | capability | mcp-edits |
| billing-event-logger | function | billing-flow |
| cof-health-audit | function | billing-flow |
| calculate-refund-eligibility | function | billing-flow |
| validate-action | function | compliance-audit |
| resolve-customer-identity | function | customer-enrollment |
| generate-ai-email | function | customer-comms |
| parse-fcra-credit-report | function | credit-disputes |
| extract-customer-pii | function | compliance-audit |
| build-customer-vde | function | customer-enrollment |
| execute-with-post-verify | function | compliance-audit |

## Execution
These skills are NOT invoked via a connector client.ts. Instead, they are loaded via `load_skill` and executed as internal capability clusters — each contains scripts/ or inline logic.
