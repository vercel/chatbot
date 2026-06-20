---
type: "skill-index"
collection: "pocock-engineering"
version: "1.0.0"
updated: "2026-06-20"
framework: "Matt Pocock's Agentic Engineering (aihero.dev)"
---

# Pocock Engineering Skills — Index

8 skills + 2 engines ported from Matt Pocock's framework with KEY INNOVATION: Automated Grill.

## Skills (Phase Aligned)

| # | Skill | Phase | When to Use |
|---|-------|-------|-------------|
| 1 | `automated-grill` | 1 — GRILL | Before ANY feature work |
| 2 | `grill-with-docs` | 2 — RESEARCH | External deps, complex domains |
| 3 | `prototype` | 3 — PROTOTYPE | UI/UX design uncertainty |
| 4 | `to-prd` | 4 — PRD | After grill, write end-state spec |
| 5 | `to-issues` | 5 — PLAN | Decompose PRD into tickets |
| 6 | `tdd` | 6 — BUILD | Red-Green-Refactor execution |
| 7 | `improve-codebase-architecture` | 6+ — REFACTOR | After every 5 features |
| 8 | `handoff` | 6-7 — HANDOFF | Pass context to V2/new session |

## Engines (TypeScript)

| Engine | File | Purpose |
|--------|------|---------|
| Automated Grill | `automated-grill.ts` | Self-answering design tree, 3 modes |
| Handoff | `handoff.ts` | V2 context compression, prompt generation |

## Playbook

- `playbooks/agentic-engineering/PLAYBOOK.md` — Full 7-phase master playbook
