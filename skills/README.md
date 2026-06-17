---
type: "concept"
name: "README"
description: "Auto-generated description for README"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Agent Skills Library v1.0.0

Universal, shareable skill library for all agent instances across all orgs.

## Architecture (3 Layers)

### Layer 1: SKILLS (here)
Modular, syntax-static, universal. Shared across all orgs.

### Layer 2: PLAYBOOKS (per-org repos)
Org-specific policy, thresholds, channels, approvers. References skills by name.

### Layer 3: AGENT INSTANCES
Runtime binding: loads playbook → references skills → executes.

## Catalog Summary

| Category | Count |
|----------|-------|
| Connector Skills | 13 |
| Function Skills | 10 |
| Capability Skills | 5 |
| **Total** | **28** |

## Connector Skills (13)

| Skill | Domain | Tools | Dependencies |
|-------|--------|-------|-------------|
| nmi-connector | billing-flow | 5 | hyperswitch-connector |
| slack-connector | comms | 6 | - |
| github-connector | coding | 7 | vercel-connector |
| linear-connector | support-triage | 5 | - |
| base44-connector | customer-enrollment | 7 | - |
| ghl-connector | customer-comms | 5 | base44-connector |
| hyperswitch-connector | billing-flow | 4 | nmi-connector |
| forth-connector | credit-disputes | 5 | base44-connector |
| vapi-connector | support-triage | 5 | - |
| vercel-connector | coding | 6 | github-connector |
| mcp-hub-connector | mcp-edits | 4 | - |
| wiki-connector | reporting | 4 | - |
| affy-connector | customer-comms | 3 | - |

## Function Skills (10)

| Skill | Domain |
|-------|--------|
| calculate-refund-eligibility | billing-flow |
| billing-event-logger | billing-flow |
| cof-health-audit | billing-flow |
| validate-action | compliance-audit |
| execute-with-post-verify | compliance-audit |
| extract-customer-pii | compliance-audit |
| resolve-customer-identity | customer-enrollment |
| build-customer-vde | customer-enrollment |
| generate-ai-email | customer-comms |
| parse-fcra-credit-report | credit-disputes |

## Capability Skills (5)

| Skill | Domain |
|-------|--------|
| code-review | coding |
| response-formatting | support-triage |
| research | reporting |
| playbook-refiner | agent-orchestration |
| artifact-response-pattern | coding |

## Base44 Function Classification (A-G)

- **A (Connector-Covered):** 6 functions already in connectors
- **B (New Connector Needed):** 4 new connector candidates
- **C (Custom Functions):** 7 new TypeScript function skills (built)
- **D (Workflow Skills):** 9 Vercel Workflow DevKit candidates
- **E (Sandbox Tasks):** 2 sandbox task candidates
- **F (Stays on Base44):** Existing stable automations
- **G (Stays on VPS):** Hermes brain, Hyperswitch core, daemons

## Bridge Endpoint

V2 accesses skills via HTTP bridge:
```
GET  /api/skill/[name]          → skill info + documentation
POST /api/skill/[name]/[action]  → invoke skill action
```

Auth: `Bearer NEPTUNE_INTERNAL_TOKEN`

## Version Pinning

Skills use semver. Playbooks reference skills with version constraints:
```yaml
skills:
  - nmi-connector@^1.0.0
  - calculate-refund-eligibility@^1.2.0
```

## Multi-Org Support

- One skill library shared across all orgs
- Per-org playbook repos reference skills by name + version
- Skill updates auto-propagate; playbook refinements stay isolated
