---
type: "concept"
name: "CHAT V2 HANDOFF E2E TRACE 2026 06 17"
description: "Auto-generated description for CHAT V2 HANDOFF E2E TRACE 2026 06 17"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Chat ↔ V2 Handoff — E2E Trace
## Phase 28 Stream 3 | 2026-06-17 02:30 UTC

### Test Goal
"Create hello-world utility in V2 sandbox, write to lib/utils/hello-test.ts, no commit, sandbox demo only"

### 16-STEP TRACE RESULTS

| Step | Component | Description | Status | Detail |
|---|---|---|---|---|
| 1 | Chat | spawnCodingAgent builds payload | ✅ PASS | Payload with goal, mode=sandbox, repo |
| 2 | Chat → V2 | POST /api/agent-sessions | ✅ PASS | HTTP 201 in 1.03s |
| 3 | V2 | Token validation | ✅ PASS | NEPTUNE_INTERNAL_TOKEN matches |
| 4 | V2 | Session created | ✅ PASS | ID: 7d46e87e-fc0a-4452-ac06-acc3b42b5ee7 |
| 5 | V2 | Routes to runtime | ✅ PASS | Sandbox mode recognized |
| 6 | V2 | Queries AI Gateway BYOK | ✅ PASS | vck_ key works, 282 models available |
| 7 | Gateway | Routes to DeepSeek | ✅ PASS | deepseek/deepseek-v4-pro CONFIRMED available |
| 8 | Gateway | Returns tokens | ⏭️ SKIP | Not tested in this lightweight run (vibe-code endpoint not used) |
| 9 | V2 | Sandbox executes | ⏭️ SKIP | Not tested (sandbox mode requires E2B, not activated) |
| 10 | V2 | Emits webhook session.started | 🔄 PENDING REDEPLOY | V2_WEBHOOK_SECRET now set on V2, needs redeploy to activate |
| 11 | Chat | HMAC validates webhook | 🔄 PENDING REDEPLOY | HMAC logic verified locally ✅, production needs redeploy |
| 12 | Chat | Updates library_missions | 🔄 PENDING REDEPLOY | Code ready, needs deploy |
| 13 | Chat | SSE to HandoffCard | 🔄 PENDING REDEPLOY | SSE GET handler added, needs deploy |
| 14 | HandoffCard | Shows live progress | 🔄 PENDING REDEPLOY | Auto-reconnect added, reconnecting state |
| 15 | V2 | Emits session.completed | 🔄 PENDING REDEPLOY | Code ready |
| 16 | Chat | Finalizes mission | 🔄 PENDING REDEPLOY | Code ready |

### What Works Now (production)
- V2 session creation (201, verified)
- Token authentication (verified)
- AI Gateway BYOK connectivity (verified, all DeepSeek models available)
- HMAC signing algorithm (verified locally)
- V2_WEBHOOK_SECRET set on BOTH projects (verified via Vercel API)

### What Needs Redeploy to Work
- V2 webhook emitter with new V2_WEBHOOK_SECRET
- Chat v2-webhooks SSE GET handler
- Chat handoff-card auto-reconnect logic
- Chat spawnCodingAgent 3-retry logic

### All fixes will activate after git push → Vercel deploys both projects.
