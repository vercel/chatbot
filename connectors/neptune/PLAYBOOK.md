---
connector: neptune
version: 1.0.0
scope: connector
auto_load: true
priority: P1
headline: |
  Neptune Custom Skills Connector — canonical home for all agent-authored skills.
  All skill-author output lands here under skills/<connector>/.
type: "playbook"
---

# Neptune Connector Playbook

## Operational Knowledge

### Architecture
The Neptune connector is the canonical library for all custom-authored skills and functions. When skill-author wraps a new API or creates a new capability, the output lands here — not scattered across the filesystem.

### How to Use
1. Agent needs a capability → checks PLAYBOOK-ROUTER.md
2. Router directs to appropriate domain playbook
3. Domain playbook references skills under `connectors/neptune/skills/<connector>/`
4. Agent loads the skill via `load_skill`
5. Client.ts resolves to the correct SKILL.md

### Skill Discovery
```
connectors/neptune/skills/
├── github/SKILL.md   — 35 actions (search, PR, branch, commit, review, etc.)
├── ghl/SKILL.md      — 35 actions (contacts, SMS, email, pipeline, campaigns)
├── linear/SKILL.md   — 25 actions (issues, projects, teams, cycles, views)
├── vercel/SKILL.md   — 25 actions (deploy, project, domain, env, analytics)
├── forth/SKILL.md    — 30 actions (disputes, reports, enrollments, contacts)
├── wiki/SKILL.md     — 20 actions (pages, search, lint, ingest, index)
├── mcp-hub/SKILL.md  — 15 actions (servers, tools, connect, health, resources)
└── affy/SKILL.md     — 15 actions (chargebacks, evidence, affidavits, disputes)
```

## Anti-Patterns

- NEVER create skills outside connectors/neptune/skills/
- NEVER skip the PLAYBOOK-ROUTER when looking for skills
- NEVER duplicate skills that already exist in another connector
- NEVER author a skill without updating the connector's PLAYBOOK.md

## Safeguards

- All skills MUST have YAML frontmatter per Anthropic spec
- All functions MUST be typed TypeScript modules
- Skill-author outputs are verified before being added to master-registry.json
- Duplicate detection: check existing skills before authoring new ones

## Refinement Notes
- Version 1.0.0 — Phase 8 initial creation (2026-06-12)
- 200+ actions across 8 connectors
