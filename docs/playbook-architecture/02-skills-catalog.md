---
title: "02 — Skills Catalog"
version: "1.0.0"
last_updated: "2026-06-15"
owner: "playbook-skills meta-skill"
status: ACTIVE
kb_index: 2
skills_cataloged: 15
---

# 02 — Skills Catalog

Complete inventory of all skills across the neptune-chat system.

## Skill Categories

### Native Agent Skills (ai-agent-sdk)

These are the foundational skills that every agent has access to:

| # | Skill | Path | Functions | Purpose |
|---|-------|------|-----------|---------|
| 1 | ai-agent-sdk | `native-agent-skills/ai-agent-sdk/` | read, write, bash, edit | Core agent capabilities — file operations, shell access |

### Custom Skills

Domain-specific skills built on top of native capabilities:

#### Design & UI

| # | Skill | Path | Playbooks | Workflows | Purpose |
|---|-------|------|-----------|-----------|---------|
| 2 | opendesign | `custom-skills/opendesign/` | ui-design, coding | frontend-design, review-landing | UI component design, review, deployment |

#### Reporting & Data

| # | Skill | Path | Playbooks | Workflows | Purpose |
|---|-------|------|-----------|-----------|---------|
| 3 | spreadsheet-creator | `custom-skills/spreadsheet-creator/` | reporting | daily-billing, agent-perf | Excel/CSV reports, billing sheets |

#### Planning & Research (Neptune Skills)

Under `connectors/neptune/skills/planning-research-suite/`:

| # | Skill | Path | Purpose |
|---|-------|------|---------|
| 4 | deep-research | `planning-research-suite/deep-research/` | 5-source parallel research engine |
| 5 | draft-prd | `planning-research-suite/draft-prd/` | 12-section PRD template |
| 6 | draft-trd | `planning-research-suite/draft-trd/` | C4 diagrams + OpenAPI contracts |
| 7 | draft-impl-plan | `planning-research-suite/draft-impl-plan/` | Phase plans + budgets |
| 8 | gap-analysis | `planning-research-suite/gap-analysis/` | 8-dimension systematic diff |
| 9 | architecture-diagrammer | `planning-research-suite/architecture-diagrammer/` | 8 Mermaid diagram types |
| 10 | cardinal-rules-extract | `planning-research-suite/cardinal-rules-extract/` | Memory + cortex rule extraction |
| 11 | source-synthesis | `planning-research-suite/source-synthesis/` | Weighted source merge |
| 12 | mission-dispatcher | `planning-research-suite/mission-dispatcher/` | YAML mission + hybridDispatch |
| 13 | workflow-designer | `planning-research-suite/workflow-designer/` | YAML workflow scaffolding |
| 14 | save-to-cortex | `planning-research-suite/save-to-cortex/` | Canonical artifact persistence |

#### Meta-Skill

| # | Skill | Path | Functions | Playbooks | Workflows | Purpose |
|---|-------|------|-----------|-----------|-----------|---------|
| 15 | playbook-skills ⭐ | `custom-skills/playbook-skills/` | 6 TS functions | 16 business playbooks | 2 workflows | THE meta-skill — orchestrates all playbook operations |

## Skill Pattern (Fractal)

Every skill follows the same shape:

```
skills/<name>/
├── SKILL.md             ← Skill definition + documentation
├── functions/           ← TypeScript functions owned by this skill
├── playbooks/           ← Domain playbooks (if any)
└── workflows/           ← Durable workflows (if any)
```

## Per-Connector Skills

Each connector also exposes skills:

| Connector | Skill Path | Type |
|-----------|-----------|------|
| NMI | `connectors/nmi/skills/` | Payment operations |
| Slack | `connectors/slack/PLAYBOOK.md` | Messaging |
| GitHub | `connectors/github/PLAYBOOK.md` | Version control |
| Vercel | `connectors/vercel/PLAYBOOK.md` | Deployment |
| Linear | `connectors/linear/PLAYBOOK.md` | Project mgmt |
| GHL | `connectors/ghl/PLAYBOOK.md` | CRM |
| Base44 | `connectors/base44/PLAYBOOK.md` | Entity store |
| Wiki | `connectors/wiki/PLAYBOOK.md` | Knowledge base |
| Forth | `connectors/forth/PLAYBOOK.md` | Credit bureau |
| Affy | `connectors/affy/PLAYBOOK.md` | Affiliate |
| MCP Hub | `connectors/mcp-hub/PLAYBOOK.md` | Tool registry |
| Neptune | `connectors/neptune/skills/` | Agent runtime |

## Cross-References

- See `03-functions-catalog.md` for per-skill function inventory
- See `06-cross-reference-matrix.md` for which skills use which connectors

---

*Phase 21 V3 — Fractal Library + Router-as-Map*
