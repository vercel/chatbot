---
title: "09 — Self-Evolution Flow"
version: "1.0.0"
last_updated: "2026-06-15"
owner: "playbook-skills meta-skill"
status: ACTIVE
kb_index: 9
type: "spec"
access: internal
---

# 09 — Self-Evolution Flow

The closed-loop system that enables the playbook architecture to learn and improve from every session.

## The Cycle

```
┌─────────────────────────────────────────────────────────────────┐
│                     SELF-EVOLUTION CYCLE                        │
│                                                                 │
│   [1] Chat Session                                              │
│        ↓                                                        │
│   [2] Raw Log → /api/raw-logs                                   │
│        ↓                                                        │
│   [3] Knowledge Extract → /api/knowledge/extract                │
│        ↓                                                        │
│   [4] Wiki Entity → /api/wiki/ingest                            │
│        ↓                                                        │
│   [5] Refinement Loop → /api/cron/refinement-loop               │
│        ↓                                                        │
│   [6] Proposed Patch → playbook-skills/playbooks/*.md           │
│        ↓                                                        │
│   [1] Next Chat Session (with improved playbooks)               │
└─────────────────────────────────────────────────────────────────┘
```

## Step-by-Step

### Step 1: Chat Session
Every user message flows through the intent routing workflow:
- `session-start-handler.ts` initializes context
- `route-intent.ts` matches intent to playbook
- `load-skill.ts` loads the matched playbook
- Agent executes SOP

### Step 2: Raw Log Write
At session end (`onFinish` in chat route):
- `session-end-handler.ts` calls `POST /api/raw-logs`
- Records: session ID, user ID, loaded playbook, tool calls, outcomes, annotations
- Persisted to raw-logs storage for analysis

### Step 3: Knowledge Extraction
Hourly cron or manual trigger:
- `POST /api/knowledge/extract?hoursBack=1`
- Analyzes raw logs for patterns:
  - Which playbooks were used most
  - Which intents had low confidence matches
  - Which errors recurred
  - Which connectors were most utilized

### Step 4: Wiki Entity Creation
Extracted knowledge is ingested:
- `POST /api/wiki/ingest` creates entities for:
  - New intent patterns discovered
  - Connector usage statistics
  - Error patterns and resolutions
  - Session summaries

### Step 5: Refinement Loop
Automated or cron-triggered:
- `POST /api/cron/refinement-loop`
- Analyzes wiki entities for improvement opportunities
- Proposes patches to playbooks:
  - Add new intent routes
  - Update trigger keywords
  - Add safeguards for recurring errors
  - Remove deprecated tool references

### Step 6: Playbook Patch
The refinement loop outputs proposed changes:
- `update-playbook.ts` applies targeted patches
- Changes are staged for commit
- After human review, merged into playbooks
- Next sessions use improved playbooks

## Trigger Points

| Trigger | Frequency | Handler |
|---------|-----------|---------|
| Session end | Every chat turn | `session-end-handler.ts` → `onFinish` hook |
| Knowledge extraction | Hourly | `/api/knowledge/extract` cron |
| Refinement loop | Daily (02:57 UTC) | `/api/cron/refinement-loop` cron |
| Manual review | As needed | Human reviews proposed patches |

## Metrics Tracked

| Metric | Source | Used For |
|--------|--------|----------|
| Playbook usage count | raw-logs | Prioritize improvement efforts |
| Intent match confidence | route-intent.ts | Tune trigger keywords |
| Tool call success rate | raw-logs | Identify broken connectors |
| Session duration | raw-logs | Optimize slow playbooks |
| Error recurrence | raw-logs | Add safeguards |
| Connector utilization | raw-logs | Deprecation decisions |

---

*Phase 21 V3 — Fractal Library + Router-as-Map*
