---
title: "01 — Connectors Catalog"
version: "1.0.0"
last_updated: "2026-06-15"
owner: "playbook-skills meta-skill"
status: ACTIVE
kb_index: 1
connectors_cataloged: 17
---

# 01 — Connectors Catalog

Complete inventory of all 17 connectors in the neptune-chat system.

## Connector Inventory

### P0: Core Payment & Billing

| # | Connector | Path | Type | Primary Use | Status |
|---|-----------|------|------|-------------|--------|
| 1 | NMI | `connectors/nmi/` | Payment Gateway | Credit card vault, charges, refunds, subscriptions | ✅ ACTIVE |
| 2 | Hyperswitch | `connectors/hyperswitch/` | Payment Router | Multi-gateway payment routing | ✅ ACTIVE |

### P0: Customer & Compliance

| # | Connector | Path | Type | Primary Use | Status |
|---|-----------|------|------|-------------|--------|
| 3 | Base44 | `connectors/base44/` | Entity Store | Customer profiles, tickets, payment logs, all entities | ✅ ACTIVE |
| 4 | Forth | `connectors/forth/` | Credit Bureau | Dispute letters, credit reports, bureau communication | ✅ ACTIVE |

### P1: Communication & Collaboration

| # | Connector | Path | Type | Primary Use | Status |
|---|-----------|------|------|-------------|--------|
| 5 | Slack | `connectors/slack/` | Messaging | #jarvis-admin notifications, alerts, status updates | ✅ ACTIVE |
| 6 | GitHub | `connectors/github/` | Version Control | PR creation, code review, commit management | ✅ ACTIVE |
| 7 | Linear | `connectors/linear/` | Project Mgmt | Issue tracking, sprint management, backlog | ✅ ACTIVE |

### P1: Deployment & Infrastructure

| # | Connector | Path | Type | Primary Use | Status |
|---|-----------|------|------|-------------|--------|
| 8 | Vercel | `connectors/vercel/` | Hosting | Deploy preview/production, env vars, domains | ✅ ACTIVE |

### P2: Marketing & CRM

| # | Connector | Path | Type | Primary Use | Status |
|---|-----------|------|------|-------------|--------|
| 9 | GHL | `connectors/ghl/` | CRM | Campaign management, pipeline, lead nurture, SMS/email | ✅ ACTIVE |

### P2: Knowledge & Docs

| # | Connector | Path | Type | Primary Use | Status |
|---|-----------|------|------|-------------|--------|
| 10 | Wiki | `connectors/wiki/` | Knowledge Base | Documentation, knowledge graph, wiki entities | ✅ ACTIVE |
| 11 | MCP Hub | `connectors/mcp-hub/` | Tool Registry | MCP server registration, tool discovery | ✅ ACTIVE |

### P2: Voice & Affiliate

| # | Connector | Path | Type | Primary Use | Status |
|---|-----------|------|------|-------------|--------|
| 12 | Vapi | `connectors/vapi/` | Voice AI | Phone calls, transcripts, Haley AI agent | ✅ ACTIVE |
| 13 | Affy | `connectors/affy/` | Affiliate | Partner tracking, referral commissions | ✅ ACTIVE |

### Internal: Agent Capabilities

| # | Connector | Path | Type | Primary Use | Status |
|---|-----------|------|------|-------------|--------|
| 14 | Neptune | `connectors/neptune/` | Agent Runtime | The agent itself — skills, playbooks, workflows | ✅ ACTIVE |
| 15 | OpenDesign | `custom-skills/opendesign/` | UI Design | Frontend design, component creation, review | ✅ ACTIVE |
| 16 | Spreadsheet Creator | `custom-skills/spreadsheet-creator/` | Reports | Excel/CSV generation, billing sheets, agent reports | ✅ ACTIVE |
| 17 | Playbook Skills | `custom-skills/playbook-skills/` | Meta-Skill | THE meta-skill — contains all playbooks, router, functions | ✅ ACTIVE |

## Connector Pattern

Every connector follows the same fractal shape:

```
connectors/<name>/
├── PLAYBOOK.md          ← Connector mastery guide
├── SKILL.md             ← Skill definition
├── functions/           ← Wrapped API functions
│   ├── mcp-server-tools/
│   └── wrapped-api-docs/
├── playbooks/           ← Connector-specific playbooks (if any)
└── workflows/           ← Durable workflows using this connector
```

## Connector Health

| Metric | Value |
|--------|-------|
| Total connectors | 17 |
| ACTIVE | 17 |
| DEPRECATED | 0 |
| P0 (critical) | 4 |
| P1 (important) | 4 |
| P2 (supporting) | 6 |
| Internal (agent) | 3 |

## Cross-References

- See `02-skills-catalog.md` for which skills use which connectors
- See `06-cross-reference-matrix.md` for full dependency map

---

*Phase 21 V3 — Fractal Library + Router-as-Map*
