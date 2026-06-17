# Phase 38.5 Wiring Fix — Validation Report
## 2026-06-17 | Hotfix | Author: abhiswami2121@gmail.com

### What Was Fixed

**Problem:** Phase 38.5 classifier built but never wired to chat flow. Bulk tools existed in `lib/ai/tools/` but were not registered in the canonical `lib/agent/inline-tools.ts` registry. No `lib/chat/router.ts` entry point. `pullSlackThread` only worked on thread timestamps — not general Slack pulling. Discovery engine fallback to simulated data when tools unavailable.

**Root Cause:** 
1. Chat route had inline classification + discovery routing (implemented directly in route.ts), but no clean router abstraction
2. `pullSlackThread` requires `threadTs` parameter — LLM agents chose it over `pullSlackChannelHistory` for general pulls
3. Tools imported directly in route.ts rather than via inline-tools registry
4. Classifier keyword map missing common user phrases like "pull Slack"

### Files Changed (8 files, +1119/-45)

| File | Action | Purpose |
|------|--------|---------|
| `lib/chat/router.ts` | NEW | Clean entry point: `classifyMessage()` + `dispatchToDiscovery()` |
| `lib/agents/tools/pullSlackChannelHistory.ts` | NEW | Cursor-paginated Slack channel history with message classification |
| `lib/agents/tools/bulkNmiQuery.ts` | NEW | Batch NMI MCP bridge queries (5/batch, 7s delay) |
| `lib/agents/tools/bulkBase44Pull.ts` | NEW | Batch Base44 SDK entity pulls (10/batch) |
| `lib/agents/tools/runDiscoveryWorkflow.ts` | NEW | Discovery engine wrapper with workflow descriptions |
| `lib/agent/inline-tools.ts` | MODIFIED | Registered 4 new V2 tools + env requirements |
| `app/(chat)/api/chat/route.ts` | MODIFIED | Uses `dispatchToDiscovery()` instead of inline fetch |
| `jarvis/cortex/prd/PHASE-38-5-WIRING-FIX-2026-06-17.md` | NEW | Enhanced PRD |

### Verification

- ✅ All 4 new tools use `inputSchema` (AI SDK v6) — NOT `parameters`
- ✅ Zero type errors from changed files (`tsc --noEmit` clean for our paths)
- ✅ `lib/chat/router.ts` properly bridges classifier → discovery engine
- ✅ `FEATURE_DISCOVERY_ROUTING=true` in `.env.local`
- ✅ No `/testing/` paths touched (Phase 40 territory preserved)
- ✅ NMI vault operations remain SACRED (read-only queries only)
- ✅ All imports resolve correctly
- ✅ Commit: `d30d478` pushed to `origin/main`

### Test Prompt

User input: **"Massive Billing CRM Alignment Slack scrape"**

Expected behavior:
1. `classifyMessage()` → `isBulkIntent: true`, `workflowId: "audit-slack-tickets-last-7d"`
2. `dispatchToDiscovery()` → `POST /api/discovery/run` returns `runId`
3. Discovery Engine scrapes REAL Slack channels (not simulated)
4. Cross-references with Base44 CRM data
5. SSE stream delivers live progress to frontend

### Known Issue

Pre-existing build failure from `lib/testing/browser-agent.ts` (Phase 40 territory) — `playwright` not installed. NOT caused by this fix. Addressed in separate Phase 40 session.

### Slack Landing

Posted to #jarvis-admin C0AQDDC3HAB
