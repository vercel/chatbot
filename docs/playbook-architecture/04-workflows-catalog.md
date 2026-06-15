---
title: "04 — Workflows Catalog"
version: "1.0.0"
last_updated: "2026-06-15"
owner: "playbook-skills meta-skill"
status: ACTIVE
kb_index: 4
workflows_cataloged: 6
---

# 04 — Workflows Catalog

Complete inventory of all durable workflows.

## playbook-skills Workflows (2) ⭐

| # | Workflow | File | Trigger | Steps | Durability |
|---|----------|------|---------|-------|------------|
| 1 | intent-routing | `workflows/intent-routing.workflow.ts` | Every user message | 4 steps (start → route → load → end) | `use workflow` fallback |
| 2 | session-end-logger | `workflows/session-end-logger.workflow.ts` | Chat session end (onFinish) | 4 steps (log → extract → wiki → refine) | `use workflow` fallback |

## Planning-Research Workflows

Under `playbooks/planning-research/workflows/`:

| # | Workflow | File | Purpose |
|---|----------|------|---------|
| 3 | deep-research | `deep-research.yaml` | 5-source parallel research |
| 4 | mission-dispatch | `mission-dispatch.yaml` | YAML mission dispatch |
| 5 | gap-analysis | `gap-analysis.yaml` | 8-dimension gap analysis |
| 6 | plan-mode-propose | `plan-mode-propose.yaml` | Multi-phase plan proposal |
| 7 | implementation-plan | `implementation-plan.yaml` | Implementation plan generation |
| 8 | master-prd | `master-prd.yaml` | Master PRD generation |
| 9 | tech-design-doc | `tech-design-doc.yaml` | Technical design document |

## Connector Workflows

| Connector | Workflows | Purpose |
|-----------|-----------|---------|
| NMI | `nmi-slack-reconciliation/`, `payment-reminders/` | Billing reconciliation, payment reminders |
| OpenDesign | `frontend-design/`, `review-landing/` | UI design, landing page review |

## Intent Routing Workflow (Detail)

The `intent-routing.workflow.ts` executes 4 steps per user message:

```
User Message
    ↓
[1] sessionStartHandler()     — Initialize context, log session start
    ↓
[2] routeIntent()              — Match against 84+ intent routes
    ↓
[3] loadSkill (tool-mediated)  — Load matched playbook
    ↓
[4] sessionEndHandler()        — Log outcomes, extract knowledge, refine
```

## Session-End Logger Workflow (Detail)

The `session-end-logger.workflow.ts` closes the self-evolution loop:

```
Session End
    ↓
[1] POST /api/raw-logs         — Write raw session log
    ↓
[2] POST /api/knowledge/extract — Extract knowledge from log
    ↓
[3] POST /api/wiki/ingest       — Create wiki entity
    ↓
[4] POST /api/cron/refinement-loop — Propose playbook improvements
```

## Durability Pattern

Workflows use Promise.allSettled for concurrent steps and graceful degradation.
When Vercel Workflow DevKit is available, they wrap in `use workflow` for:
- Automatic retry on failure
- State persistence
- Resume from any step

---

*Phase 21 V3 — Fractal Library + Router-as-Map*
