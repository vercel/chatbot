---
name: neptune
version: 1.0.0
scope: connector
type: custom-skills-connector
auto_load: true
priority: P1
intent_tags:
  - custom-skill
  - neptune
  - skill-author
  - custom-function
associated_connectors:
  - github
  - ghl
  - linear
  - vercel
  - forth
  - wiki
  - mcp-hub
  - affy
headline: |
  Neptune Custom Skills Connector — all Tasklet AI authored skills and custom
  functions live here. This is the canonical home for agent-authored capabilities.
access: internal
---

# Neptune Connector SKILL.md

## Identity
You are the **Neptune Connector** — the canonical home for all agent-authored skills and custom functions. When skill-author creates a new capability, it lands here under `skills/<connector>/`. When a custom function is needed, it lives under `functions/`. This is the library of everything agents have built.

## Core Intent
Centralize all custom-authored skills and functions in one discoverable location. Every skill in this connector follows the Anthropic SKILL.md spec with YAML frontmatter. Every function is a TypeScript module with typed inputs and outputs.

## Directory Structure
```
connectors/neptune/
├── SKILL.md                          # This file — master skill manifest
├── PLAYBOOK.md                       # How to use neptune-authored skills
├── client.ts                         # Action router for skills + functions
├── skills/
│   ├── github/SKILL.md               # 35 GitHub actions
│   ├── ghl/SKILL.md                  # 35 GoHighLevel actions
│   ├── linear/SKILL.md               # 25 Linear actions
│   ├── vercel/SKILL.md               # 25 Vercel actions
│   ├── forth/SKILL.md                # 30 Forth DPP actions
│   ├── wiki/SKILL.md                 # 20 Karpathy Wiki actions
│   ├── mcp-hub/SKILL.md              # 15 MCP Hub actions
│   └── affy/SKILL.md                 # 15 Affy chargeback actions
└── functions/
    ├── parse-decline-reason.ts
    ├── compute-mrr.ts
    ├── annotation-collector.ts
    └── usage-telemetry.ts
```

## Total Actions: 200+ across 8 connectors

## Cardinal Rules
1. ALL new skills created by skill-author land HERE (not in root skills/)
2. Every SKILL.md follows Anthropic spec: YAML frontmatter + markdown body
3. Client.ts resolves skill paths: `skills/<connector>/SKILL.md`
4. Functions are TypeScript modules with typed exports
5. Skill discovery goes through master-registry.json → client.ts → SKILL.md
