---
name: skill-author
description: Autonomously creates new skill packs (connectors, custom skills), wires them into the file tree, updates playbooks, and regenerates indexes. Use when user wants to add a new API integration or custom capability.
version: 1.0.0
type: "skill"
access: internal
---

# Skill Author — Autonomous Skill Creation Engine (Shared)

The skill-author capability enables agents to autonomously CREATE new skills/connectors, wire them into the file tree, update playbook markdown files, regenerate the master index, and ship to production.

## When to Use

Use this skill when the user asks to:
- "Wrap a new API" / "Add API integration for..."
- "Create a new connector for..."
- "Add a new custom skill/capability for..."
- "Build a connector pack for..."
- "Scaffold a new skill from spec"

## Architecture

```
skills/skill-author/
  SKILL.md                        ← this file
  playbook-skill-author.md        ← 3 routines + anti-patterns
  scripts/
    create-connector-pack.ts      ← scaffolds connectors/<name>/
    wrap-api-endpoint.ts          ← adds action to client.ts router
    update-playbook-md.ts         ← updates playbook references
    ingest-api-docs.ts            ← pulls API docs into docs/
    regenerate-skill-index.ts     ← updates skills/playbook-skills.md
    update-master-registry.ts     ← regenerates functions/master-registry.json
```

## How It Works

1. Agent loads this skill via `load_skill shared-skills/skill-author`
2. Agent reads the accompanying scripts for the matching routine
3. Agent follows the mandatory steps in order
4. Each step calls the appropriate script
5. Final step: commit → push → deploy → smoke tests

## Safety

- Never wrap APIs that handle real customer data without explicit approval
- Always test new connectors against sandbox/demo environments first
- Generated skills must include error handling and rate limiting
- All new skills must include a SKILL.md with proper frontmatter
