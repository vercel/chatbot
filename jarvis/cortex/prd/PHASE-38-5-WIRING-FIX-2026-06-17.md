# Phase 38.5 Wiring Fix — Enhanced PRD
## 2026-06-17 | Hotfix | Author: abhiswami2121@gmail.com

### Problem Statement
Phase 38.5 classifier built but **never properly wired** to chat flow. Bulk tools existed in `lib/ai/tools/` but were:
1. Never registered in `lib/agent/inline-tools.ts` proper registry
2. Missing `lib/chat/router.ts` clean entry point
3. `pullSlackThread` only works on thread timestamps (not general Slack pull)
4. Discovery engine fallback to simulated data when tools unavailable
5. No `lib/agents/tools/` directory with cursor-paginated implementations

### Root Cause
Route.ts has inline classification + discovery routing (lines 113-120, 341-399) but:
- Classifier keyword map lacks "pull slack", "get messages", "scrape slack" patterns
- LLM agents choose `pullSlackThread` (requires threadTs) over `pullSlackChannelHistory`
- No proper `router.ts` abstraction — classification logic embedded in route handler
- Tools imported directly in route.ts instead of via inline-tools registry

### Architecture Fix
```
User Message
  → router.ts: classifyMessage(text)
    → intent-classifier.ts: classifyIntentSync(text) 
      → isBulkIntent? → dispatchToDiscovery(workflowId, config)
        → POST /api/discovery/run → SSE stream → real Slack/NMI/Base44 data
      → null → fall through to normal LLM flow
```

### Execution Plan (7 Streams)

**STREAM 0: lib/chat/router.ts** — Clean entry point
- Import classifyIntentSync from intent-classifier
- Export classifyMessage(text) → { isBulkIntent, workflowId, config } | null
- Export dispatchToDiscovery(workflowId, config) → fetch POST /api/discovery/run

**STREAM 1: lib/agents/tools/ — 4 bulk files**
- pullSlackChannelHistory.ts — cursor pagination + message classification
- bulkNmiQuery.ts — batch NMI MCP bridge calls
- bulkBase44Pull.ts — Base44 SDK filter+list
- runDiscoveryWorkflow.ts — POST /api/discovery/run wrapper
ALL use ai.tool() with inputSchema (AI SDK v6)

**STREAM 2: lib/agent/inline-tools.ts** — Register 4 tools
- Add imports for new tools
- Add to inlineTools map
- Add to TOOL_REQUIREMENTS map

**STREAM 3: app/(chat)/api/chat/route.ts** — Wire router
- Import classifyMessage from lib/chat/router
- Call BEFORE LLM dispatch
- If bulk intent → dispatch to discovery → SSE response
- Else → continue normal flow

**STREAM 4: Feature Flag** — FEATURE_DISCOVERY_ROUTING=true
- Set in Vercel env via vercel CLI

**STREAM 5: v6 API Audit** — Verify inputSchema
- All new tools use inputSchema (not parameters)
- Scan existing tools for parameters usage

**STREAM 6: E2E Live Test** — pnpm typecheck → pnpm build → commit → push → Vercel deploy → prod test
- Test prompt: "Massive Billing CRM Alignment Slack scrape"
- Verify discovery engine triggers, NOT swarm fallback
- Document in docs/phase-38-5-wiring-fix-validation.md
- Slack #jarvis-admin C0AQDDC3HAB

### Cardinal Rules
- AI SDK v6 inputSchema NOT parameters
- NMI vault SACRED
- Do NOT touch /testing/ paths (Phase 40 cooking)
- abhiswami2121@gmail.com author
- cd /home/neptune/neptune-chat
- Build clean before push
- Slack #jarvis-admin only
- 30-45 min hotfix
