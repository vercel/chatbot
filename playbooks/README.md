---
type: "playbook"
name: "README"
description: "Auto-generated description for README"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# playbooks/ — Canonical Location Redirect

> ⚠️ **This directory is kept for backward compatibility only.**

## Canonical Playbook Location

All business playbooks now live under the `playbook-skills` meta-skill:

```
connectors/neptune/skills/custom-skills/playbook-skills/
├── PLAYBOOK-ROUTER.md          ← THE entry point (contains fractal MAP)
├── functions/
│   ├── route-intent.ts
│   ├── create-playbook.ts
│   ├── update-playbook.ts
│   ├── organize-knowledge-graph.ts
│   ├── session-start-handler.ts
│   └── session-end-handler.ts
├── playbooks/                   ← ALL business playbooks live HERE
│   ├── playbook-billing.md
│   ├── playbook-support.md
│   ├── playbook-disputes.md
│   ├── playbook-engineering.md
│   ├── playbook-marketing.md
│   ├── playbook-hr.md
│   ├── playbook-planning.md
│   ├── playbook-reporting.md
│   ├── playbook-agent-orchestration.md
│   ├── playbook-deploy.md
│   ├── playbook-vercel-discipline.md
│   ├── playbook-vps-ops.md
│   ├── playbook-newleaf.md
│   ├── playbook-index.md
│   ├── playbook-sales.md
│   └── playbook-video-generation.md
└── workflows/
    ├── intent-routing.workflow.ts
    └── session-end-logger.workflow.ts
```

## Fractal Pattern

Every Skill is a mini-library:
- `functions/` ↔ `connectors/` at top level
- `playbooks/` ↔ `playbooks/` at top level
- `workflows/` ↔ workflow definitions

## Knowledge Base

Full architecture documentation at `/docs/playbook-architecture/`:
- 12 docs covering connectors, skills, functions, workflows, playbooks
- Cross-reference matrix, redundancy analysis, gap analysis
- Self-evolution flow, portability guide, bootstrap guide

## Router

The canonical router is at:
```
connectors/neptune/skills/custom-skills/playbook-skills/PLAYBOOK-ROUTER.md
```

Read it FIRST on every user message. It contains the inline fractal library MAP.

---

**Last updated:** 2026-06-15 · Phase 21 V3
