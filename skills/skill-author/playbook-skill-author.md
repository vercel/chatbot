---
playbook: skill-author
version: 1.0.0
domain: engineering
scope: capability
auto_load: false
headline: Autonomous skill/connector creation — scaffold, wire, index, deploy
priority: P1
intent_tags:
  - skill creation
  - connector pack
  - API wrapping
  - scaffolding
  - code generation
  - meta-tooling
associated_connectors:
  - github
  - vercel
associated_skills:
  - capabilities/self-coding
  - connectors/github
  - connectors/vercel
associated_functions:
  - validate-action
routines_count: 3
type: "playbook"
---

# Skill Author Playbook

## Operational Knowledge

- **Runs in:** Neptune Chat (neptune-chat Vercel app)
- **Repo:** /home/neptune/neptune-chat (abhiswami2121/neptune-chat on GitHub)
- **Deploy target:** Vercel REST API (cardinal 6a273f70)
- **Commit author:** abhiswami2121@gmail.com (cardinal 6a29cf6f)
- **CI gates:** pnpm typecheck + pnpm build must pass
- **Script runtime:** Node.js (executed within Neptune Chat process or Vercel Sandbox)
- **Safety scope:** scripts can ONLY edit connectors/_test_*, skills/_test_*, playbooks/_test_* OR connector explicitly named in args

## Business Context

- The skill-author is a META skill — it creates other skills
- A connector pack consists of: SKILL.md, client.ts (action router), docs/ folder, GRAPH-TAG.json
- Available connector domains: billing-flow, credit-disputes, customer-enrollment, support-triage, agent-payments, reporting, customer-comms, lead-flow, compliance-audit, mcp-edits, engineering
- Template connectors to reference: connectors/base44/ (comprehensive with tools/), connectors/slack/ (clean client.ts pattern)
- Always use the slack-style client.ts pattern for new connectors (ActionRequest/ActionResponse types, switch-based router, availableActions export)

## Safeguards

1. Never touch real customer connectors (base44, nmi, slack, hyperswitch, vapi) during testing
2. Only use free, no-auth APIs for testing (cat-facts.dev)
3. Always run pnpm typecheck before committing
4. Always verify deploy is READY after push
5. Never skip CI gates
6. Never commit without verifying the author email
7. Script safety: only edit _test_ scoped or explicitly named targets
8. Master registry regeneration must preserve all existing entries (additive only)

## Anti-Patterns (DO NOT DO)

- DON'T wrap APIs without first ingesting docs (skip step 1 = guessing)
- DON'T commit directly without typecheck + build PASS
- DON'T forget to regenerate master-registry.json (orphaned actions)
- DON'T skip GRAPH-TAG.json — needed for bidirectional graph linking
- DON'T modify real customer connector files during skill-author testing
- DON'T use wildcard file deletion in any script

## Routines

### Routine: Wrap new API endpoint
Trigger words: wrap API, add endpoint to connector, expose API action,
              add action, wire up endpoint

Mandatory steps:
1. execute_skill skills/skill-author scripts/ingest-api-docs.ts {url, connector_name}
2. execute_skill skills/skill-author scripts/wrap-api-endpoint.ts {connector, action, method, endpoint_url, params_schema}
3. execute_skill skills/skill-author scripts/update-master-registry.ts
4. spawn_v2 mode='modify_existing' { goal: 'pnpm typecheck + build + commit + push + verify deploy READY' }

### Routine: Create new connector pack
Trigger words: create connector, add new API integration, wrap entire API,
              new connector pack, scaffold connector, build connector

Mandatory steps:
1. execute_skill skills/skill-author scripts/ingest-api-docs.ts {url, connector_name}
2. execute_skill skills/skill-author scripts/create-connector-pack.ts {name, domain, has_mcp: false}
3. For each endpoint discovered: execute_skill skills/skill-author scripts/wrap-api-endpoint.ts {connector, action, method, endpoint_url, params_schema}
4. execute_skill skills/skill-author scripts/update-playbook-md.ts {playbook_domain, connector_name}
5. execute_skill skills/skill-author scripts/update-master-registry.ts
6. execute_skill skills/skill-author scripts/regenerate-skill-index.ts
7. spawn_v2 mode='modify_existing' { goal: 'pnpm typecheck + build + commit + push + verify deploy READY + smoke test all 3 endpoints' }

### Routine: Create new custom skill (non-API)
Trigger words: create skill, add custom capability, wrap algorithm,
              new skill, custom function

Mandatory steps:
1. Create skills/<name>/SKILL.md with YAML frontmatter matching Anthropic Agent Skills Spec
2. Create skills/<name>/scripts/<main>.ts with core logic (exported function + Zod schemas)
3. execute_skill skills/skill-author scripts/update-master-registry.ts
4. execute_skill skills/skill-author scripts/regenerate-skill-index.ts
5. spawn_v2 mode='modify_existing' { goal: 'pnpm typecheck + build + commit + push + verify deploy READY' }

## Refinement Notes

- 2026-06-12: Initial skill-author capability created for U2.5. Supports 3 routines.
- 2026-06-12: All 6 scripts target Vercel Sandbox for safe file manipulation.
- 2026-06-12: Safety scope: _test_ folders only OR explicitly named connector targets.
