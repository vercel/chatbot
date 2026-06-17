# PHASE 38.5 ENHANCED v2: Chat ↔ Discovery Engine Integration + Swarm Generative UI

Date: 2026-06-17 22:00 UTC  
Status: P0 — ENHANCED (VPS research complete, architecture audited)  
Author: Jarvis (enhanced by Claude VPS agent)  
Budget: 18,000t HARD | ETA: 4-5 hours  
Based on: `jarvis/prd/PHASE-38-5-CHAT-DISCOVERY-INTEGRATION-PRD-2026-06-17.md`

---

## 0. ARCHITECTURE RESEARCH FINDINGS

### 0.A. Current Chat Flow (LIVE)
```
POST /api/chat/route.ts (622 lines)
  ├─ auth + rate limit
  ├─ fusionMode === "panel" → executePanel (council/swarm with SSE PanelEvents)
  ├─ ELSE → streamText(getLanguageModel(chatModel), {
  │     tools: { swarmDispatch, pullSlackThread, getNmiTransaction, ...35 tools },
  │     system: systemPrompt + actionGroupCtx
  │   })
  └─ SSE response via createUIMessageStreamResponse
```

**KEY FINDING**: There is NO intent classification step. EVERYTHING goes to streamText. The LLM decides whether to call `swarmDispatch` or other tools. This is why when user asks "audit Slack billing", the LLM calls `swarmDispatch` which spawns agents WITHOUT real connector tools — they simulate data.

### 0.B. Swarm Dispatch (LIVE — THE PROBLEM)
```
lib/ai/tools/swarm-dispatch.ts (443 lines)
  swarmDispatch({ goal, swarmType, agents[], synthesizer })
    ├─ runAgent() → generateText({ model, prompt }) ← NO TOOLS PASSED
    │   └─ Agents have ZERO access to Slack/NMI/Base44
    ├─ Promise.all → collect all results
    └─ runSynthesizer() → merge results → return text
```

**KEY FINDING**: `runAgent()` calls `generateText` with only a prompt. No tools. No SSE events. No streaming. The agents literally cannot access real data. They hallucinate/simulate.

### 0.C. Fusion Panel Swarm (LIVE — has events but separate path)
```
lib/ai/fusion/swarm/execute.ts (135 lines)
  executeSwarm({ preset, messages, onEvent })
    ├─ decomposeTask → emit coordinator:start/complete
    ├─ executeSpecialist × N → emit specialist:start/complete
    └─ integrateSpecialistOutputs → emit integrator:start/complete
  
PanelEvent types already exist: agent:start, agent:token, agent:complete,
  specialist:start, specialist:complete, judge:token, cost:update, etc.
```

**KEY FINDING**: The fusion panel HAS rich SSE events. But this path is only used when user selects a Panel preset in the UI. Normal chat messages don't go through this. Also, specialists also lack tool access.

### 0.D. Discovery Engine (LIVE — working but not called from chat)
```
lib/discovery/ (10 files)
  workflow-orchestrator.ts — executeWorkflow(runId, emitter, config)
  slack-scraper.ts — REAL Slack API via WebClient (rate-limited, paginated)
  multi-source-puller.ts — REAL Base44 SDK + NMI bridge calls
  types.ts — 6 workflow templates defined
  SSE events: step_start, step_progress, step_complete, step_error, step_skip,
              run_complete, run_error

API: POST /api/discovery/run — creates run + executes in background
     GET  /api/discovery/sse?runId=xxx — SSE stream
```

**KEY FINDING**: The engine is PRODUCTION-GRADE. Real Slack, real NMI, real Base44. But NOTHING in the chat router calls it. The engine is an island.

### 0.E. Inline Tools (LIVE — already has pullSlackMessages)
```
lib/agent/inline-tools.ts (1646 lines)
  pullSlackMessages — ALREADY supports channel history (channel, limit, since)
  queryDatabase — SQL access
  getNmiTransaction — single NMI lookup
  pullSlackThread — thread-level only
  getCustomerProfile — single customer
```

**KEY FINDING**: `pullSlackMessages` already wraps `slack.conversations.history`. But it returns raw message data, not the structured ScrapedSlackMessage format from discovery. And it's a local tool — not integrated with the discovery pipeline.

### 0.F. Component Architecture
```
components/chat/ — message-reasoning, chat-header, greeting, console
components/ai-elements/ — AI Elements UI library components
components/fusion/ — fusion panel UI
components/generative/ — generative OS components
NO components/swarm/ — DOES NOT EXIST
NO components/discovery/ — DOES NOT EXIST

app/discovery/ — DiscoveryRunCard, DiscoveryLiveProgress, DiscoveryFindingsList,
                 DiscoveryWorkflowPicker, DiscoveryReportViewer, DiscoveryActionPanel,
                 DiscoveryCustomerTable, useDiscoverySSE
```

**KEY FINDING**: Discovery UI components exist in `app/discovery/` (not `components/discovery/`). No swarm progress components exist anywhere.

---

## 1. THE 3 FIXES (REFINED)

### FIX 1: Intent Classifier + Auto-Routing (Streams 0-1-5)
- Build lightweight keyword-first classifier (0 tokens for classification, LLM fallback for ambiguous)
- Inject classification BEFORE streamText in chat route
- Route bulk intents to POST /api/discovery/run
- Stream SSE results back to chat via new DiscoveryMissionCard component
- Feature flag: `FEATURE_DISCOVERY_ROUTING` env var for gradual rollout

### FIX 2: Bulk Connector Tools (Streams 2-6)
- Add `runDiscoveryWorkflow` tool — calls /api/discovery/run from chat
- Add `bulkNmiQuery` tool — batch NMI lookups via nmiMcpBridge
- Add `bulkBase44Pull` tool — batch Base44 entity queries
- Enhance existing `pullSlackMessages` → add structured output option
- Add `searchSlackMessages` — cross-channel search
- All tools return paginated, token-tracked results

### FIX 3: Generative UI for Swarm Progress (Streams 3-4-8)
- Add SSE events to swarmDispatch: tool_call_start, tool_call_end, agent_thinking, agent_done, swarm_synthesis_start, swarm_synthesis_end
- Build SwarmProgressCard — per-agent live progress with model name, token counter, status badge
- Build SwarmSynthesisCard — final synthesis with aggregate stats
- Build ToolCallLog — live tool call feed per agent
- Wire all to existing fusion PanelEvent types for consistency

---

## 2. ENHANCED EXECUTION PLAN (10 STREAMS / 18,000t)

### STREAM 0 (1500t): INTENT CLASSIFIER
**File**: `lib/chat/intent-classifier.ts` (NEW)

**Design**: Hybrid keyword-first + LLM fallback
```
Phase 1 — Keyword match (0 tokens, <1ms):
  Patterns → workflow template mapping
  "audit slack" | "audit billing" | "check alignment" → audit-slack-tickets-last-7d
  "misaligned billing" | "billing vs" | "billing mismatch" → find-misaligned-billing
  "stale recovery" | "recovery audit" | "declined payments" → recovery-stale-tasks-audit
  "customer 360" | "deep dive" | "full profile" → customer-360-deep-pull
  "agent promise" | "follow through" | "said they would" → agent-promise-tracker
  "churn risk" | "at risk" | "losing customers" → churn-risk-analysis

Phase 2 — Confidence scoring:
  Multiple keyword matches → confidence > 0.8
  Single keyword match → confidence 0.5-0.7
  No match → confidence 0

Phase 3 — LLM fallback:
  If confidence < 0.5 AND message length > 20 chars → call classifyWithLLM()
  Uses a cheap model (haiku/flash) for 1-token classification
```

**Intent map**:
```
audit-slack-tickets-last-7d: ["audit slack", "audit billing", "check alignment", 
  "slack audit", "billing alignment", "crm alignment", "check vs crm", "cross reference"]
find-misaligned-billing: ["misaligned billing", "billing mismatch", "billing vs", 
  "subscription mismatch", "nmi vs base44", "billing discrepancy"]
recovery-stale-tasks-audit: ["stale recovery", "recovery audit", "declined payments",
  "failed payments audit", "recovery backlog", "retry audit"]
customer-360-deep-pull: ["customer 360", "deep dive", "full profile", "complete history",
  "everything about", "all data for"]
agent-promise-tracker: ["agent promise", "follow through", "said they would",
  "promised to", "agent follow up", "commitment tracking"]
churn-risk-analysis: ["churn risk", "at risk", "losing customers", "cancellation risk",
  "retention risk", "customers leaving"]
```

**Test fixtures**: 20 sample prompts with expected classifications

### STREAM 1 (2000t): CHAT ROUTER UPGRADE
**File**: `app/(chat)/api/chat/route.ts` (MODIFY)

**Changes**:
1. Import intent classifier
2. After message extraction (line ~103), run classifier
3. If bulk intent detected AND feature flag enabled:
   - Call `dispatchToDiscovery()` with workflow template
   - Return SSE stream that flows back as chat messages
   - Auto-create a DiscoveryMissionCard message
4. Else: continue with normal streamText flow

**dispatchToDiscovery() function**:
```typescript
async function dispatchToDiscovery(workflowId: string, config: Record<string, unknown>, chatId: string) {
  // 1. POST /api/discovery/run to start
  const res = await fetch(`${baseUrl}/api/discovery/run`, {
    method: "POST",
    body: JSON.stringify({ workflowId, config }),
  });
  const { runId } = await res.json();
  
  // 2. Return runId + SSE URL so frontend can connect
  return { runId, sseUrl: `/api/discovery/sse?runId=${runId}`, workflowId };
}
```

**Feature Flag**: `FEATURE_DISCOVERY_ROUTING=true` env var

### STREAM 2 (2000t): BULK CONNECTOR TOOLS
**Files**: 
- `lib/ai/tools/run-discovery-workflow.ts` (NEW)
- `lib/ai/tools/bulk-nmi-query.ts` (NEW)
- `lib/ai/tools/bulk-base44-pull.ts` (NEW)
- `lib/ai/tools/pull-slack-channel-history.ts` (NEW)
- `lib/agent/inline-tools.ts` (MODIFY — register new tools)

**runDiscoveryWorkflow**:
- Wraps POST /api/discovery/run
- Returns runId + SSE URL + workflow info
- Triggers discovery without LLM needing to know about discovery endpoint

**bulkNmiQuery**:
- Accepts customerIds[] (max 50)
- Calls NMI MCP bridge for each
- Rate-limited (6s between calls)
- Returns map of customerId → subscription state
- Token tracking: warns if result > 10K chars
- Pagination: cursor-based for > 50 customers

**bulkBase44Pull**:
- Accepts entity name + ids[] (max 100)
- Uses Base44 SDK filter queries
- Returns map of id → record
- Auto-truncates large fields

**pullSlackChannelHistory**:
- Wraps existing pullSlackMessages + adds structured classification
- Returns message count, channel info, classified messages
- Supports daysBack, maxMessages, includeThreads params

**Registration**: All tools added to `inlineTools` + `TOOL_REQUIREMENTS` + chat route tool lists

### STREAM 3 (2500t): GENERATIVE UI — SWARM PROGRESS CARDS
**Files**:
- `components/swarm/SwarmProgressCard.tsx` (NEW)
- `components/swarm/SwarmSynthesisCard.tsx` (NEW)
- `components/swarm/ToolCallLog.tsx` (NEW)
- `components/swarm/SwarmProgressFeed.tsx` (NEW — container)

**SwarmProgressCard design**:
```
┌─────────────────────────────────────────┐
│ 🔵 Kimi K2.7 Code    ⚡ Running  3.2K tokens │
│ ─────────────────────────────────────────│
│ Current: querying Slack #newleaf-admin   │
│ ████████████░░░░░░░░ 67%                │
│ └─ Last tool: pullSlackMessages(7.2s)   │
│                                          │
│ Preview: "Found 247 messages in #newleaf-│
│ admin. Extracted 32 unique customer..."  │
└─────────────────────────────────────────┘
```

**SwarmSynthesisCard design**:
```
┌─────────────────────────────────────────┐
│ 📊 Swarm Complete — 4 agents, 12.3s     │
│ ─────────────────────────────────────────│
│ Agents: 4/4 succeeded                    │
│ Total tokens: 18,450                     │
│ Est. cost: $0.042                        │
│ ─────────────────────────────────────────│
│ [View Synthesis] [Show Agent Details]     │
└─────────────────────────────────────────┘
```

**ToolCallLog design**: Collapsed accordion per tool call showing input args (JSON), output preview (first 500 chars), duration, status

### STREAM 4 (2000t): SSE PROTOCOL UPGRADE
**File**: `lib/ai/tools/swarm-dispatch.ts` (MODIFY)

**New SSE event types** (aligned with existing PanelEvent pattern):
```typescript
type SwarmSseEvent =
  | { type: "tool_call_start"; agentId: string; tool: string; args: Record<string, unknown> }
  | { type: "tool_call_end"; agentId: string; tool: string; result: unknown; durationMs: number }
  | { type: "agent_thinking"; agentId: string; preview: string }
  | { type: "agent_done"; agentId: string; finalText: string; tokens: number; durationMs: number }
  | { type: "swarm_synthesis_start"; judgeModel: string }
  | { type: "swarm_synthesis_end"; synthesis: string; totalTokens: number; totalDurationMs: number }
```

**Swarm executor upgrade**:
- Refactor `runAgent()` to accept `onEvent` callback
- Emit `agent_thinking` periodically (not possible with generateText — use streaming instead)
- **REALITY CHECK**: `generateText` doesn't support streaming tool_call events natively. We have two options:
  1. Wrap each agent in a lightweight `streamText` call that forwards events
  2. Add pre/post event emitters (tool_call_start before generateText, tool_call_end after)

**IMPLEMENTATION DECISION**: Use streamText per agent instead of generateText. This allows real-time token streaming AND tool call visibility. Each agent gets its own streamText with tools passed in. Events are forwarded through the onEvent callback.

**Key change**: `runAgent()` switches from `generateText` to `streamText` + `onStepFinish` callback to capture tool calls.

### STREAM 5 (2000t): DISCOVERY MISSION CARD UI
**Files**:
- `components/discovery/DiscoveryMissionCard.tsx` (NEW)
- Wire to chat message rendering

**Design**:
```
┌──────────────────────────────────────────┐
│ 🔍 Discovery: Audit Slack Tickets (7d)    │
│ Run #run-a3f2b91c                        │
│ ─────────────────────────────────────────│
│ Step 1/6: Scrape Slack            ✅      │
│ Step 2/6: Pull Customer Data      🔄      │
│   └─ Pulling 32 customers... 12/32       │
│ Step 3/6: Cross-Reference         ⏳      │
│ Step 4/6: Validate Alignment      ⏳      │
│ Step 5/6: Analyze Patterns        ⏳      │
│ Step 6/6: Generate Report         ⏳      │
│ ─────────────────────────────────────────│
│ Live: Found 247 messages, 3 misalignments │
│ [Open Full Report] [Cancel]               │
└──────────────────────────────────────────┘
```

**Auto-render**: When chat dispatches to discovery engine, inject a "discovery_mission" message type that renders as DiscoveryMissionCard. The card connects to SSE for live updates.

### STREAM 6 (1500t): SLACK CONNECTOR EXPANSION
**File**: `lib/ai/tools/search-slack-messages.ts` (NEW)

**Enhancements** to existing Slack tools:
1. `pullSlackChannelHistory` — ALREADY covered by `pullSlackMessages` in inline-tools, enhance with:
   - Return message classification (billing_alert, support_ticket, etc.)
   - Return extracted customer mentions
   - Add `includeClassification` param
2. `searchSlackMessages` — NEW: cross-channel text search
   - Wraps Slack search API
   - Returns matching messages with channel context
3. `listSlackChannels` — NEW: list accessible channels
   - Caches channel list for 5 min
   - Returns name, id, member count, topic

### STREAM 7 (2000t): CHAT INTEGRATION E2E TEST
**File**: `docs/chat-discovery-integration-validation-2026-06-17.md` (NEW)

**Test scenario** (exact user complaint):
```
BEFORE Phase 38.5:
  User: "Audit Slack billing alignment for last 7 days"
  Chat: streamText → LLM calls swarmDispatch
  Swarm: 4 agents generateText WITHOUT tools
  Agents: "Based on simulated data, here are 5 fictional customers..."
  User: 😠 "This is simulated!"

AFTER Phase 38.5:
  User: "Audit Slack billing alignment for last 7 days"
  Classifier: bulk_intent=true, confidence=0.92, workflow=audit-slack-tickets-last-7d
  Chat: dispatchToDiscovery() → POST /api/discovery/run
  UI: DiscoveryMissionCard appears
  Engine: Step 1 scrape #newleaf-admin → 247 real messages ✅
  Engine: Step 2 pull 32 customers from Base44 ✅  
  Engine: Step 3 cross-reference Slack↔CRM ✅
  Engine: Step 4 validate 3 misalignments found ✅
  Engine: Step 5 analyze patterns ✅
  Engine: Step 6 generate report ✅
  Report: 8 customers analyzed, 3 critical misalignments (real customers!)
  User: 😍 "These are real customers with real issues!"
```

**Validation criteria**:
- Slack messages pulled: REAL, not simulated
- NMI subscriptions: REAL vault data
- Base44 profiles: REAL customer records
- Misalignments: REAL discrepancies found
- Report: Actionable, with real customer names and flags

### STREAM 8 (1500t): SWARM TOOL CALL VISIBILITY TEST
**File**: `docs/swarm-tool-call-visibility-test-2026-06-17.md` (NEW)

**Test plan**:
1. Dispatch a 4-agent swarm via chat
2. Verify SwarmProgressCard renders per-agent
3. Verify tool calls visible: pullSlackMessages, getCustomerProfile, etc.
4. Verify token counter updates live
5. Verify streaming preview updates
6. Verify SwarmSynthesisCard shows final
7. Take screenshots of before/after UX

### STREAM 9 (1000t): COMMIT + DEPLOY + SLACK LAND
1. `cd /home/neptune/neptune-chat`
2. `pnpm build` — verify 0 errors, 0 warnings
3. `pnpm lint` — verify clean
4. `git add -A`
5. `git config user.email "abhiswami2121@gmail.com"`
6. `git commit -m "feat(phase-38.5): Chat ↔ Discovery integration + bulk connector tools + swarm generative UI"`
7. `git push origin main`
8. Wait Vercel READY
9. Live test with real user prompt
10. Slack #jarvis-admin landing message

---

## 3. GAP ANALYSIS (from research)

| # | Gap | Status | Solution |
|---|-----|--------|----------|
| 1 | No intent classification | MISSING | Stream 0: keyword-first classifier |
| 2 | No discovery routing from chat | MISSING | Stream 1: dispatchToDiscovery() |
| 3 | Swarm agents have NO tool access | CRITICAL | Stream 4: pass tools to agent generateText |
| 4 | No swarm SSE events | MISSING | Stream 4: new event types + streaming |
| 5 | No SwarmProgressCard component | MISSING | Stream 3: 3 new components |
| 6 | No DiscoveryMissionCard in chat | MISSING | Stream 5: new component + SSE wiring |
| 7 | Discovery UI in wrong directory | EXISTS (app/discovery/) | Keep existing, add components/discovery/ for chat |
| 8 | pullSlackMessages exists but unintegrated | EXISTS | Stream 6: enhance + wire |
| 9 | NMI bridge wrapper exists in puller | EXISTS | Stream 2: expose as tool |
| 10 | PanelEvent types exist for fusion | EXISTS | Reuse pattern for swarm SSE |

---

## 4. ALTERNATIVES CONSIDERED

### Intent Classification
- ❌ Pure LLM: +500-2000 tokens per message, ~$0.001/msg, slow
- ❌ Pure keyword: Misses ambiguous queries like "can you look at our billing situation"
- ✅ **Hybrid**: Keyword first (free, instant), LLM fallback for low-confidence (<5% of messages)

### Swarm SSE vs Poll
- ❌ Poll: Simple but 2s latency, wasteful requests
- ✅ **SSE via streamText**: Real-time, uses existing Vercel AI SDK patterns, reuses SSE infrastructure

### Tool Registration
- ❌ Connector manifests: Proper architecture but requires manifest files, registry, init
- ✅ **Direct registration in route.ts**: Follows existing pattern, faster to ship, refactor later

### UI Components
- ❌ AI Elements (ai-elements/): Heavy, Tailwind v4, might conflict
- ✅ **Custom Tailwind v3**: Matches existing codebase, no dependency risk

---

## 5. PITFALLS & MITIGATIONS

| Pitfall | Risk | Mitigation |
|---------|------|------------|
| Build breakage | HIGH | Test `pnpm build` after each stream |
| Over-routing (false positive bulk intent) | MEDIUM | Confidence threshold 0.65 + feature flag |
| Race condition: SSE before run starts | MEDIUM | DiscoveryMissionCard polls /api/discovery/run until active |
| Token cost from LLM classification | LOW | Keyword-first means LLM used <5% of time |
| Swarm agent tool hallucinations | MEDIUM | Pass only read-only tools; audit tool descriptions |
| Breaking existing chat flows | HIGH | Feature flag gate; only route on explicit match |
| streamText timeout (300s) | LOW | Discovery runs are async (background), SSE separate |
| Vercel deployment failure | MEDIUM | Test pnpm build before push |

---

## 6. TEST CASES (25 total)

### Intent Classifier (10)
1. "audit Slack billing alignment" → audit-slack-tickets-last-7d, confidence > 0.8
2. "find misaligned billing between Slack and CRM" → find-misaligned-billing
3. "check for stale recovery tasks" → recovery-stale-tasks-audit
4. "deep dive into customer John Doe" → customer-360-deep-pull
5. "did our agents follow through on promises?" → agent-promise-tracker
6. "which customers are at risk of churning?" → churn-risk-analysis
7. "what's the weather?" → null (not bulk)
8. "write me a poem" → null (not bulk)
9. "help me with billing audit" → audit-slack-tickets-last-7d (LLM fallback: "audit" keyword low confidence, LLM classifies)
10. "check if our CRM matches what's in Slack" → audit-slack-tickets-last-7d

### Discovery Routing (5)
11. Bulk intent routes to /api/discovery/run
12. Non-bulk intent continues to normal streamText
13. Feature flag OFF → no routing, normal flow
14. DiscoveryMissionCard renders with live progress
15. Cancelled run stops SSE and updates card

### Bulk Tools (5)
16. runDiscoveryWorkflow returns valid runId
17. bulkNmiQuery returns real subscription data
18. bulkBase44Pull returns real entity records
19. pullSlackChannelHistory returns classified messages
20. Tool warns when result exceeds size limit

### UI Components (5)
21. SwarmProgressCard shows live tool calls
22. SwarmSynthesisCard shows aggregate stats
23. ToolCallLog shows collapsed tool details
24. DiscoveryMissionCard shows step progress
25. All components render without console errors

---

## 7. BUDGET ESTIMATE

| Stream | Description | Est. tokens |
|--------|-------------|-------------|
| 0 | Intent Classifier | 1,500 |
| 1 | Chat Router Upgrade | 2,000 |
| 2 | Bulk Connector Tools | 2,000 |
| 3 | Swarm Progress UI | 2,500 |
| 4 | SSE Protocol Upgrade | 2,000 |
| 5 | Discovery Mission Card UI | 2,000 |
| 6 | Slack Connector Expansion | 1,500 |
| 7 | E2E Integration Test | 2,000 |
| 8 | Swarm Visibility Test | 1,500 |
| 9 | Commit + Deploy + Landing | 1,000 |
| **TOTAL** | | **18,000** |

---

## 8. CARDINAL RULES (ENHANCED)

1. NO PLAN MODE, NO ExitPlanMode — EXECUTE directly
2. Feature flag FEATURE_DISCOVERY_ROUTING for gradual rollout
3. NMI vault SACRED (memory 6a1f118b) — NEVER override
4. Reuse Phase 38 engine — don't duplicate
5. Auto-route bulk — don't bypass engine
6. Generative UI must show REAL progress, not placeholders
7. Bulk tools must have pagination + token tracking
8. abhiswami2121@gmail.com author on all commits
9. Slack #jarvis-admin only for landings
10. cd /home/neptune/neptune-chat for all work
11. Reserve 1000t buffer for landing
12. pnpm build clean before push
13. Live URL verification > local proof
14. Test the EXACT user scenario from tonight
15. Show before/after comparison in docs
16. **NEW**: Keyword-first classification (0 tokens for most messages)
17. **NEW**: streamText per agent instead of generateText (enables tool visibility)
18. **NEW**: Pass real tools to swarm agents (read-only: pullSlackMessages, getCustomerProfile, queryDatabase)
19. **NEW**: Align SSE events with existing PanelEvent pattern
20. **NEW**: DiscoveryMissionCard polls /api/discovery/run until SSE connects

---

## 9. ROLLBACK PLAN

If deployment breaks chat:
1. Set `FEATURE_DISCOVERY_ROUTING=false` → instant fallback to normal flow
2. All new components are additive (no existing component modified)
3. All new tools are additive to existing tool lists
4. `git revert` the commit if needed
5. Monitor #jarvis-admin for error reports

---

## 10. STRATEGIC OUTCOME

### BEFORE:
```
User: "Audit Slack billing alignment"
Chat: streamText → LLM calls swarmDispatch → agents simulate → fake report
User: 😠
```

### AFTER:
```
User: "Audit Slack billing alignment"
Classifier: bulk_intent=true → audit-slack-tickets-last-7d
Chat: dispatchToDiscovery() → DiscoveryMissionCard appears
Engine: Scrape 247 real Slack msgs → Pull 32 real Base44 profiles → 
        Query NMI live → Cross-reference → 3 real misalignments
Report: 8 real customers, real flags, real actions
User: 😍
```

**= REAL DATA, REAL INSIGHTS, REAL ACTIONS**

---

END ENHANCED PRD v2
