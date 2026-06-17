---
title: "03 — Functions Catalog"
version: "1.0.0"
last_updated: "2026-06-15"
owner: "playbook-skills meta-skill"
status: ACTIVE
kb_index: 3
functions_cataloged: 25
type: "spec"
access: internal
---

# 03 — Functions Catalog

Complete inventory of all TypeScript functions across all skills.

## playbook-skills Functions (6) ⭐

| # | Function | File | Purpose | Exports |
|---|----------|------|---------|---------|
| 1 | route-intent | `functions/route-intent.ts` | Match user input to playbook via 84+ intent routes | `routeIntent()`, `getAllIntentRoutes()` |
| 2 | create-playbook | `functions/create-playbook.ts` | Scaffold new playbook with YAML frontmatter + SOP template | `createPlaybook()` |
| 3 | update-playbook | `functions/update-playbook.ts` | Targeted updates: SOP steps, intents, safeguards, antipatterns | `updatePlaybook()` |
| 4 | organize-knowledge-graph | `functions/organize-knowledge-graph.ts` | Wiki/knowledge graph integration — index, query, crossref | `organizeKnowledgeGraph()` |
| 5 | session-start-handler | `functions/session-start-handler.ts` | Initialize session context, log start event | `sessionStartHandler()` |
| 6 | session-end-handler | `functions/session-end-handler.ts` | Log outcomes, extract knowledge, trigger refinement | `sessionEndHandler()` |

## AI Agent SDK Functions (4)

| # | Function | Purpose |
|---|----------|---------|
| 7 | read | File read operations |
| 8 | write | File write operations |
| 9 | bash | Shell command execution |
| 10 | edit | File editing / search-replace |

## AI Library Functions

`lib/ai/` contains core AI infrastructure:

| # | Function | File | Purpose |
|---|----------|------|---------|
| 11 | model-router | `lib/ai/model-router.ts` | Task-type → model selection (10 task types) |
| 12 | playbook-model-router | `lib/ai/playbook-model-router.ts` | Playbook-frontmatter → model selection |
| 13 | playbook-loader | `lib/ai/playbook-loader.ts` | Load playbooks for intent + format context |
| 14 | intent-classifier | `lib/ai/intent-classifier.ts` | Classify user intent from message |
| 15 | token-tracker | `lib/ai/token-tracker.ts` | Token estimation, checkpoint generation |
| 16 | providers | `lib/ai/providers.ts` | Language model provider resolution |

## Chat API Tools

Registered in `app/(chat)/api/chat/route.ts`:

| # | Tool | File | Purpose |
|---|------|------|---------|
| 17 | loadSkill | `lib/ai/tools/load-skill.ts` | On-demand skill loading with fractal path resolution |
| 18 | createDocument | `lib/ai/tools/create-document.ts` | Create documents |
| 19 | editDocument | `lib/ai/tools/edit-document.ts` | Edit documents |
| 20 | updateDocument | `lib/ai/tools/update-document.ts` | Update documents |
| 21 | getWeather | `lib/ai/tools/get-weather.ts` | Weather data |
| 22 | requestSuggestions | `lib/ai/tools/request-suggestions.ts` | Context-aware suggestions |
| 23 | selfCode | `lib/ai/tools/self-code.ts` | Inline code fixes (≤50 lines) |
| 24 | spawnCodingAgent | `lib/ai/tools/spawn-coding-agent.ts` | V2 sandbox handoff |
| 25 | planSession | `lib/ai/tools/plan-session.ts` | Session planning |

## Inline Tools (getAvailableTools)

| # | Tool | Purpose |
|---|------|---------|
| 26 | viewFile | Read file contents |
| 27 | executeSkill | Run documented domain procedure |
| 28 | listPlaybooks | Discover available playbooks |

## MCP Tools (Dynamic)

MCP tools are registered dynamically via `getMCPTools()`:
- Base44 MCP: entity CRUD, reporting, NMI bridge, Slack bridge
- NotebookLM MCP: notebook management, research, studio artifacts

## Sandbox Tools

`lib/sandbox/tools.ts` provides E2B sandbox integration tools.

## Connector Functions (varying per connector)

Each connector in `connectors/<name>/functions/` exposes:
- `mcp-server-tools/` — Tool definitions for MCP protocol
- `wrapped-api-docs/` — Wrapped API documentation

## Key Patterns

1. **Fractal:** Functions always live within a Skill, never standalone
2. **Adapter:** Functions resolve both legacy and fractal paths
3. **Progressive:** Only 3 loader tools in progressive disclosure mode
4. **Durability:** Workflow functions use Promise.allSettled for reliability

---

*Phase 21 V3 — Fractal Library + Router-as-Map*
