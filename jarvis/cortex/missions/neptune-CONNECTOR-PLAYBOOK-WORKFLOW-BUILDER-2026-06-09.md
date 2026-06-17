---
type: "concept"
name: "Neptune CONNECTOR PLAYBOOK WORKFLOW BUILDER 2026 06 09"
description: "Auto-generated description for Neptune CONNECTOR PLAYBOOK WORKFLOW BUILDER 2026 06 09"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# NEPTUNE MEGAMISSION: CONNECTOR-PLAYBOOK ARCHITECTURE + WORKFLOW BUILDER ON CANVAS

**Date:** 2026-06-09 | **Status:** IN EXECUTION | **Turns:** 500  
**SCOPE:** /home/neptune/neptune-chat only — do NOT touch /home/neptune/neptune-v2

---

## OVERVIEW

Two mega-initiatives in one mission:

### INITIATIVE A: Connector-Playbook Architecture
Reorganize `lib/connectors/` so every connector has:
- `index.ts` — unified entry (default export = manifest + named exports from schema)
- `PLAYBOOK.md` — comprehensive operational docs with 6 mandatory sections
- `schema.ts` — extracted Zod schemas for tool inputs/outputs
- `tools/` — individual tool implementations (existing)

Wire playbook auto-load into the chat orchestrator — when a tool from connector X is invoked, inject relevant PLAYBOOK.md sections into the system prompt. Create playbook-refinement cortex skill + script + nightly cron that audits tool usage logs and refines PLAYBOOKs via AI Gateway DeepSeek calls.

### INITIATIVE B: Workflow Builder on Canvas (Tersa-inspired)
Build `/workflows` page with:
- React Flow canvas (dagre layout)
- 7 node types: Trigger, Action, Conditional, Parallel, Transform, AI, Output
- Framer Motion animations (spring scale-in, edge data flow dots, pulse glow on run)
- DAG topological execution engine
- SSE real-time UI updates during execution
- Agent can CREATE workflows from natural language ("every morning pull customer SMS from GHL last 24h post summary to Slack")
- Agent can MANIPULATE workflows (add/remove nodes, rewire edges, change configs)
- 5 starter templates seeded
- Workflow nodes auto-load PLAYBOOK when using connector tool (eats own dog food)

---

## PHASE PLAN

### P0: Deep Research (PRD/TRD)
- Research Tersa repo (github.com/vercel-labs/tersa) for canvas architecture
- Research Relay.app, Victor.ai, n8n, Zapier for workflow builder UX patterns
- Research React Flow examples (drag-drop, custom nodes, edge animations, sub flows)
- Research Vercel Workflow DevKit (@ai-sdk/workflow)
- Write PRD + TRD

### A1: Reorganize Connectors (13 connectors)
**Connectors:** slack, ghl, github, postgres (base44), vercel, redis (n/a), neptune-v2 (vapi), nmi, hyperswitch, linear, forth, affy, wiki, mcp-hub

For EACH connector:
1. Create/update `index.ts` — re-exports manifest as default + schema exports as named
2. Create/update `PLAYBOOK.md` with 6 sections:
   - **Operational Knowledge** — technical details, env vars, API endpoints, auth
   - **Business Context** — why this connector exists, what problems it solves, use cases
   - **Anti-Patterns** — what NEVER to do, dangerous patterns, common mistakes
   - **Safeguards** — rate limits, error handling, security, validation rules
   - **Common Workflows** — step-by-step examples, copy-paste patterns
   - **Refinement Notes** — version, changelog, last reviewed date
3. Create `schema.ts` — Zod schemas for ALL tool inputs/outputs
4. Keep `tools/` as-is

### A2: Wire Playbook Auto-Load
- Modify chat route to detect which connector's tools are being invoked
- Inject relevant PLAYBOOK.md sections into system prompt
- Cache parsed playbooks in memory for performance

### A3: Playbook Refinement Skill
- Cortex skill: `jarvis/cortex/skills/playbook-refinement.md`
- Script: `scripts/refine-playbooks.ts` — audits tool usage logs, calls AI Gateway
- Cron: nightly at 3am — auto-refines PLAYBOOKs based on actual usage patterns

### B1: Canvas UI Foundation
- Install React Flow + dagre + framer-motion
- Build `/workflows` page with canvas
- Drag-and-drop nodes from toolbar
- Edge animations (data flow dots)

### B2: 7 Node Types
- Trigger node (cron schedule, webhook, manual trigger)
- Action node (connector tool execution)
- Conditional node (branch on condition)
- Parallel node (fan-out execution)
- Transform node (data mapping/mutation)
- AI node (LLM call with prompt)
- Output node (Slack post, email, webhook callback)

### B3: Execution Engine + SSE
- DAG topological sort execution
- SSE stream for real-time progress
- Per-node status (pending/running/done/error)

### B4: Agent-Driven Creation
- Tool: `createWorkflow({ description, nodes, edges })`
- Tool: `updateWorkflow({ id, operations })`  
- Natural language → structured workflow pipeline
- Auto-load PLAYBOOK sections when connector tool nodes are created

### B5: Templates Library
- Morning Pulse (daily system health check)
- Billing Sweep (process billing queue)
- Slack Digest (aggregate messages)
- Customer Journey Map (GHL contacts → SMS/email sequences)
- Code Review Pipeline (GitHub PR → AI review → Slack notify)

### FINAL: Synthesis
- TypeScript strict typecheck
- Playwright slug tests
- Push to abhiswami2121/neptune-chat main
- Vercel auto-deploys
- Slack both channels (#newleaf-admin, #jarvis-admin) per phase

---

## VISION

Enterprise-ready workflow builder where agents understand connection-specific business context out of the box. When a workflow node uses the Slack connector, the agent automatically knows: don't use `chat.delete`, handle `not_in_channel` errors gracefully, use channel IDs not names. When it uses NMI, it knows CIT vs MIT, the `source_transaction_id` anti-pattern, and the velocity guard. PLAYBOOK.md is the single source of truth that feeds both the chat orchestrator AND the workflow execution engine.

---

## CONNECTOR INDEX

| Connector | manifest | playbook | tools | schema | result-renderers |
|-----------|----------|----------|-------|--------|------------------|
| slack | ✅ | ✅ (mdx) | ✅ (6 tools) | ❌ need | ✅ |
| ghl | ✅ | ✅ (mdx) | ✅ | ❌ need | ❌ |
| github | ✅ | ✅ (mdx) | ✅ | ❌ need | ❌ |
| nmi | ✅ | ✅ (mdx) | ✅ (4 tools) | ❌ need | ✅ |
| vercel | ✅ | ❌ → NEED | ✅ (5 tools) | ❌ need | ❌ |
| hyperswitch | ✅ | ✅ (mdx) | ✅ | ❌ need | ✅ |
| base44 | ✅ | ✅ (mdx) | ✅ | ❌ need | ✅ |
| affy | ✅ | ✅ (mdx) | ✅ | ❌ need | ❌ |
| forth | ✅ | ✅ (mdx) | ✅ | ❌ need | ❌ |
| linear | ✅ | ✅ (mdx) | ✅ | ❌ need | ❌ |
| wiki | ✅ | ✅ (mdx) | ✅ | ❌ need | ❌ |
| vapi | ✅ | ❌ → NEED | ✅ | ❌ need | ❌ |
| mcp-hub | ✅ | ❌ → NEED | ❌ (empty) | ❌ need | ❌ |

---

## GIT STRATEGY

All work on `connector-playbook-workflow-builder` branch. Push to `abhiswami2121/neptune-chat` main only after FINAL synthesis.

- Native tools ONLY (Bash/Read/Write/Edit/Grep/Glob)
- No MCP bridge for file operations (we're ON the VPS)
- CPU CRITICAL — optimize for throughput
