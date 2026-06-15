---
title: "00 — Foundations: The Fractal Library Pattern"
version: "1.0.0"
last_updated: "2026-06-15"
owner: "playbook-skills meta-skill"
status: ACTIVE
kb_index: 0
---

# 00 — Foundations: The Fractal Library Pattern

## Core Principle

**Every Skill is a mini-library.** The library structure is self-similar at every level — from the top-level project down to individual skills. This fractal pattern eliminates structural ambiguity: once you understand one level, you understand all levels.

## The Fractal Shape

```
Top-level Library:    connectors/   +   playbooks/   +   workflows/
                           ↕                  ↕                  ↕
Skill-level:          functions/    +   playbooks/   +   workflows/
```

### Why Fractal?

1. **Zero Learning Curve:** A new developer/agent who understands the top-level structure immediately understands any skill's internal structure.
2. **Self-Documenting:** The directory tree IS the documentation. No separate index needed for skill internals.
3. **Composable:** Skills can be nested, moved between orgs, or extracted into standalone packages without restructuring.
4. **Router-as-Map:** The PLAYBOOK-ROUTER.md contains the inline fractal library MAP — the router IS the documentation.

## The Three Layers

### Layer 1: Connectors (External Capabilities)

```
connectors/
├── nmi/          — NMI payment gateway
├── slack/        — Slack messaging
├── github/       — GitHub PR/issues
├── vercel/       — Vercel deployments
├── linear/       — Linear project management
├── ghl/          — GoHighLevel CRM
├── base44/       — Base44 entity store
├── wiki/         — Knowledge wiki
├── forth/        — Credit bureau (Equifax/Experian/TransUnion)
├── affy/         — Affiliate/referral system
├── mcp-hub/      — MCP server registry
└── neptune/      — Agent-as-Connector (internal)
```

Each connector follows the same fractal shape:
```
connectors/<name>/
├── skills/       → connector-specific skill
│   └── PLAYBOOK.md
├── functions/    → wrapper functions for the external API
└── workflows/    → durable workflows using this connector
```

### Layer 2: Skills (Agent Capabilities)

Skills live under `neptune/skills/` and are divided into:
- **Native Agent Skills** (`ai-agent-sdk/`) — Core read/write/bash/edit functions
- **Custom Skills** (`custom-skills/`) — Domain-specific skills

```
connectors/neptune/skills/
├── native-agent-skills/
│   └── ai-agent-sdk/
│       └── functions/   (read, write, bash, edit)
└── custom-skills/
    ├── opendesign/           — UI design
    ├── spreadsheet-creator/  — Reports/Excel
    └── playbook-skills/      — THE meta-skill ⭐
```

### Layer 3: Playbooks (Business SOPs)

All 16 business playbooks live inside `playbook-skills/playbooks/`:

| Priority | Count | Playbooks |
|----------|-------|-----------|
| P0 | 4 | billing, support, disputes, planning |
| P1 | 7 | engineering, reporting, deploy, vercel-discipline, vps-ops, agent-orchestration |
| P2 | 4 | marketing, hr, sales, video-generation |
| META | 2 | newleaf (org), index |

## The Meta-Skill: playbook-skills

`playbook-skills` is THE meta-skill that:
1. Contains ALL business playbooks (canonical source)
2. Provides the PLAYBOOK-ROUTER.md entry point with inline fractal MAP
3. Houses 6 lifecycle functions (route, create, update, organize, session-start, session-end)
4. Defines 2 durable workflows (intent-routing, session-end-logger)

## Router-as-Map

The PLAYBOOK-ROUTER.md contains ~500 tokens of self-documenting tree structure. The router IS the map:

```
connectors/neptune/skills/custom-skills/playbook-skills/PLAYBOOK-ROUTER.md
```

Reading this file gives every agent:
- The complete fractal library structure
- All 98+ intent routes with trigger keywords
- All canonical playbook paths
- Anti-patterns and cardinal rules

## Adapter Pattern

The reorg to fractal structure uses the **adapter pattern**:
- New structure built as a wrapper around existing code
- `load_skill` tool resolves paths in both legacy and fractal formats
- `findPlaybookFile` in playbook-model-router checks fractal paths first, then legacy
- `playbooks/` root directory kept with README.md redirect
- All existing tools continue working without modification

## The Twin View Architecture ⭐ (Abhi's Portable Playbook Package)

The playbook-skills meta-skill supports TWO simultaneous views:

### VIEW A: Library View (Canonical, Single Source of Truth)

```
connectors/neptune/skills/custom-skills/playbook-skills/  ← THE LIBRARY
├── PLAYBOOK-ROUTER.md         ← Entry point (contains MAP)
├── functions/                 ← 6 TS functions
├── playbooks/                 ← 16 business playbooks (canonical copies)
└── workflows/                 ← 2 durable workflows
```

**Properties:**
- **Canonical:** This is THE source of truth. All edits happen here.
- **Complete:** Contains all playbooks, functions, workflows in one place.
- **Connected:** Functions reference live connectors, live APIs, live models.
- **Evolving:** Self-evolution loop continuously improves playbooks.

### VIEW B: Portable Package View (Self-Contained, Copyable Bundle)

```
playbook-skills/               ← COPY THIS ENTIRE FOLDER
├── PLAYBOOK-ROUTER.md
├── functions/                 ← Comes with all functions
├── playbooks/                 ← Comes with all 16 playbooks
│   └── playbook-billing/
│       └── manifest.yaml      ← Per-playbook manifest
├── workflows/                 ← Comes with all workflows
└── manifest.yaml              ← Root manifest (what this package needs)
```

**Properties:**
- **Self-Contained:** Copy this ONE folder and you have the entire library.
- **Portable:** Any org can clone `playbook-skills/` and get all playbooks + functions + workflows.
- **Snapshot:** Packages are snapshots from canonical — they don't auto-sync.
- **Manifest-Driven:** Each playbook has a `manifest.yaml` declaring its requirements.
- **Connector-Aware:** Manifests declare which connectors, skills, and functions are needed.

### manifest.yaml Schema

```yaml
# Root manifest (at playbook-skills/manifest.yaml)
playbook: playbook-skills
organization: newleaf-financial
version: "2.0.0"
description: "Complete playbook library — portable AI agent knowledge package"
requires:
  connectors: [nmi, slack, github, vercel, base44, ghl, linear, forth, wiki, vapi]
  skills: [ai-agent-sdk, opendesign, spreadsheet-creator]
  functions: [route-intent, create-playbook, update-playbook, organize-knowledge-graph, session-start-handler, session-end-handler]
  workflows: [intent-routing, session-end-logger]

# Per-playbook manifest (at playbook-skills/playbooks/playbook-billing/manifest.yaml)
playbook: billing
organization: newleaf-financial
version: "2.0.0"
requires:
  connectors: [nmi, hyperswitch, base44, slack]
  skills: [nmi-connector]
  functions: [charge-customer, refund-customer, vault-health-check]
  workflows: [payment-reminders]
```

### The Twin View Truth

| Property | VIEW A (Library) | VIEW B (Portable Package) |
|----------|-----------------|--------------------------|
| **Source of truth** | ✅ Yes | ❌ Snapshot from A |
| **Editable** | ✅ Live edits | ⚠️ Needs re-sync from A |
| **Self-contained** | ❌ Connected to org | ✅ Copy-paste portable |
| **Complete** | ✅ Everything | ✅ Everything (snapshot) |
| **Connected** | ✅ Live APIs | ❌ Needs org setup |
| **Use case** | Active development | Org bootstrapping, sharing |

**KEY INSIGHT:** Anybody could copy the `playbook-skills/` folder and get ALL playbooks + connectors + skills + functions. It's a portable AI agent library. The canonical source lives and evolves in the Library View (A). Portable packages are snapshots for distribution (B).

## Cardinal Rules

1. **FRACTAL is sacred** — every skill follows the same shape
2. **Functions live within Skills** — never standalone
3. **playbook-skills is THE meta-skill** — canonical source for all playbooks
4. **Router has inline MAP** — self-documenting, no separate index
5. **NEPTUNE.md stays at root** — Anthropic SDK convention
6. **Adapter pattern** — don't break existing tools
7. **KB triple-mirrored** — repo + cortex + Chat page
8. **Single atomic commit** — Phase 21 V3 ships in one commit
9. **Twin View** — Library View (A) is canonical; Portable Package (B) is snapshot
10. **Manifests required** — every playbook declares its requirements

---

*Phase 21 V3 — Fractal Library + Router-as-Map*
