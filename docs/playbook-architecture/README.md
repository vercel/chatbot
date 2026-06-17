---
title: "Playbook Architecture Knowledge Base — README"
version: "1.0.0"
last_updated: "2026-06-15"
owner: "playbook-skills meta-skill"
status: ACTIVE
kb_index: 0
type: "index"
access: internal
---

# Playbook Architecture Knowledge Base

> **Version:** 1.0.0 | **Date:** 2026-06-15 | **Owner:** playbook-skills meta-skill
> **Phase:** 21 V3 — Fractal Library + Router-as-Map

## What This Is

The definitive source of truth for the Neptune Chat playbook architecture. This KB documents every connector, skill, function, workflow, and playbook in the system — their relationships, redundancies, gaps, and evolution path.

## How to Use

1. **New to the system?** Start with `00-foundations.md`
2. **Looking for what exists?** Browse catalogs 01–05
3. **Checking for duplicates?** See `06-cross-reference-matrix.md` and `07-redundancy-analysis.md`
4. **Identifying what's missing?** See `08-gap-analysis.md`
5. **Understanding self-evolution?** See `09-self-evolution-flow.md`
6. **Porting to another org?** See `10-portability-guide.md`
7. **Setting up a new org?** See `11-bootstrap-new-org.md`

## Document Index

| # | Document | Description | Status |
|---|----------|-------------|--------|
| 00 | [00-foundations.md](./00-foundations.md) | Fractal pattern, architecture principles | ✅ |
| 01 | [01-connectors-catalog.md](./01-connectors-catalog.md) | All 17 connectors with paths | ✅ |
| 02 | [02-skills-catalog.md](./02-skills-catalog.md) | Native + custom skills catalog | ✅ |
| 03 | [03-functions-catalog.md](./03-functions-catalog.md) | Per-skill function inventory | ✅ |
| 04 | [04-workflows-catalog.md](./04-workflows-catalog.md) | All durable workflows | ✅ |
| 05 | [05-playbooks-catalog.md](./05-playbooks-catalog.md) | All 16 business playbooks | ✅ |
| 06 | [06-cross-reference-matrix.md](./06-cross-reference-matrix.md) | Who-uses-what map | ✅ |
| 07 | [07-redundancy-analysis.md](./07-redundancy-analysis.md) | Duplicates identified | ✅ |
| 08 | [08-gap-analysis.md](./08-gap-analysis.md) | Missing pieces | ✅ |
| 09 | [09-self-evolution-flow.md](./09-self-evolution-flow.md) | Logs→Knowledge→Wiki→Playbook cycle | ✅ |
| 10 | [10-portability-guide.md](./10-portability-guide.md) | Org-to-org migration | ✅ |
| 11 | [11-bootstrap-new-org.md](./11-bootstrap-new-org.md) | New org setup ritual | ✅ |

## Key Statistics

- **17 connectors** — NMI, Slack, GitHub, Vercel, Linear, GHL, Base44, Vapi, Wiki, Hyperswitch, Forth, Affy, MCP Hub, Neptune, OpenDesign, Spreadsheet Creator, Playbook Skills
- **16 business playbooks** — Billing, Support, Disputes, Planning, Engineering, Reporting, Deploy, Vercel Discipline, VPS Ops, Agent Orchestration, Marketing, HR, Sales, Video Generation, NewLeaf, Index
- **6 playbook-skills functions** — route-intent, create-playbook, update-playbook, organize-knowledge-graph, session-start-handler, session-end-handler
- **2 playbook-skills workflows** — intent-routing, session-end-logger
- **98+ intent routes** — All mapped through PLAYBOOK-ROUTER.md

## Fractal Library Structure

```
connectors/neptune/skills/custom-skills/playbook-skills/  ← THE meta-skill
├── PLAYBOOK-ROUTER.md         ← Entry point (contains inline fractal MAP)
├── functions/                 ← 6 TS functions
├── playbooks/                 ← 16 business playbooks
└── workflows/                 ← 2 durable workflows
```

## Mirrors

This KB is triple-mirrored:
1. **Primary:** `/docs/playbook-architecture/` in the neptune-chat repo
2. **Cortex:** `jarvis/cortex/playbook-architecture/` via Jarvis FS
3. **Chat:** `app/(chat)/playbook-architecture/page.tsx` browsable in-app

## Canonical Router

The entry point for all agent operations:
```
connectors/neptune/skills/custom-skills/playbook-skills/PLAYBOOK-ROUTER.md
```

Read it FIRST on every user message. It contains the inline fractal library MAP (~500 tokens).

---

*Phase 21 V3 — Fractal Library + Router-as-Map + Swarm Mode + GLM 5.1*
