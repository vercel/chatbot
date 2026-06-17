---
type: "concept"
name: "CHAT V2 HANDOFF AUDIT 2026 06 17"
description: "Auto-generated description for CHAT V2 HANDOFF AUDIT 2026 06 17"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Chat ↔ V2 Handoff — Complete Audit & Diagnosis
## 2026-06-17 02:20 UTC | Phase 28 Stream 0

### 0. EXECUTIVE SUMMARY

**Verdict: V2_WEBHOOK_SECRET is the #1 root cause.** Without it, V2 never emits webhooks and Chat's HandoffCard never receives live updates. Four additional structural issues compound the problem.

**7 failures found. 3 are CRITICAL (P0), 3 HIGH (P1), 1 MEDIUM (P2).**

---

### 1. ENVIRONMENT VARIABLE AUDIT

| Env Var | Chat Vercel | V2 Vercel | VPS | Match? |
|---|---|---|---|---|
| NEPTUNE_INTERNAL_TOKEN | ✅ | ✅ | ✅ | ✅ Same across all |
| AI_GATEWAY_API_KEY | ✅ | ✅ | ✅ | ✅ vck_2FUJmn... |
| DEEPSEEK_API_KEY | ✅ | ✅ | ❌ (not on VPS) | ✅ |
| ANTHROPIC_API_KEY | ✅ | ✅ | ❌ (not on VPS) | ✅ |
| **V2_WEBHOOK_SECRET** | ❌ MISSING | ❌ MISSING | ❌ MISSING | 🔴 CRITICAL |
| NEPTUNE_CHAT_WEBHOOK_URL | N/A | ❌ MISSING | N/A | 🟡 Uses default |
| NEPTUNE_CHAT_API_URL | N/A | ❌ MISSING | N/A | 🟡 Not used |
| NEPTUNE_V2_API_BASE | ✅ | N/A | N/A | ✅ Maps to V2_BASE_URL |
| V2_AGENT_TOKEN | ❌ MISSING | N/A | N/A | 🟠 Falls back to NEP_INT |
| NEPTUNE_V2_HANDOFF_SECRET | ✅ | ❌ MISSING | N/A | 🟠 Only on Chat |
| NEPTUNE_V2_CHAT_URL | ❌ MISSING | N/A | N/A | 🟡 Uses default URL |

---

### 2. FAILURE POINT ANALYSIS

#### 🔴 CRITICAL #1: V2_WEBHOOK_SECRET missing — webhooks dead
- **Root cause:** V2_WEBHOOK_SECRET env var not set on EITHER Vercel project or VPS
- **Impact Chat side:** `v2-webhooks/route.ts` line 19: `const WEBHOOK_SECRET = process.env.V2_WEBHOOK_SECRET || "";` — empty string, but still checks HMAC. ALL webhooks from V2 fail HMAC validation → HandoffCard never updates.
- **Impact V2 side:** `webhook-emitter.ts` line 90-94: `if (!WEBHOOK_SECRET) { console.warn("V2_WEBHOOK_SECRET not configured — skipping webhook"); return; }` — **V2 NEVER EMITS webhooks at all**. Silent failure, no log visible to user.
- **Fix:** Generate a shared secret (e.g., `openssl rand -hex 32`), set as V2_WEBHOOK_SECRET on BOTH Chat and V2 Vercel projects via REST API.

#### 🔴 CRITICAL #2: HandoffCard SSE endpoint doesn't exist
- **Root cause:** `handoff-card.tsx` line 119 connects to `/api/v2-webhooks/stream?sessionId=...` but `v2-webhooks/route.ts` only has a `POST` handler — no `GET` handler for SSE.
- **Impact:** HandoffCard tries to connect, immediately fails (onerror handler closes connection), falls silently to initial state. No live progress ever shown.
- **Fix:** Add GET handler to v2-webhooks/route.ts that serves SSE stream, OR fix HandoffCard to use a different streaming endpoint (V2's SSE stream proxied through Chat).

#### 🔴 CRITICAL #3: Two divergent V2 handoff paths in Chat
- **Root cause:** Chat has TWO separate V2 client implementations:
  1. `lib/v2/bridge.ts` → calls `/api/chat` (legacy endpoint, returns SSE) — uses `secrets.neptuneV2.chatUrl`
  2. `lib/v2/handoff-client.ts` → calls `/api/agent-sessions` (new endpoint, REST) — uses `V2_BASE_URL`
- **spawnCodingAgent tool** tries handoff-client first, then bridge as fallback. They use different auth tokens and different endpoints.
- **Impact:** Confusion about which path works. bridge.ts uses `/api/chat` which might not be properly implemented on V2 (vibe-code.ts is the SSE-streaming endpoint under `/api/vibe-code`, not `/api/chat`).
- **Fix:** Standardize on `/api/agent-sessions` path. Remove bridge.ts fallback or redirect to agent-sessions.

#### 🟠 HIGH #4: V2 /api/chat endpoint mismatch
- **Root cause:** `bridge.ts` line 27: `V2_CHAT_ENDPOINT = ${NEPTUNE_V2_URL}/api/chat` — but V2 doesn't have `/api/chat`. The streaming endpoint is `/api/vibe-code`.
- **Impact:** The bridge.ts fallback path always fails silently, wasting the retry budget.
- **Fix:** Either add `/api/chat` on V2 as a wrapper, or fix bridge.ts to call `/api/vibe-code` or `/api/agent-sessions`.

#### 🟠 HIGH #5: V2 /api/health missing
- **Root cause:** `bridge.ts` line 424-433: `pingV2()` calls `/api/health` — but V2 has no such endpoint (returns Next.js HTML page).
- **Impact:** Health checks always fail, making monitoring useless.
- **Fix:** Add `/api/health` on V2 returning `{ status: "ok", timestamp }` with DB + Gateway connectivity.

#### 🟠 HIGH #6: Webhook events not persisted — no idempotency
- **Root cause:** `v2-webhooks/route.ts` has no event ID checking. A duplicate webhook could cause double updates.
- **Impact:** If V2 retries webhooks, Chat processes duplicates. Loss of audit trail.
- **Fix:** Add `eventId` field to payload, check against `library_handoff_events` table before processing.

#### 🟡 MEDIUM #7: AI Gateway BYOK config OK but not verified in diagnostics
- **Root cause:** AI_GATEWAY_API_KEY is set on both projects. Gateway connectivity verified (200 OK from ai-gateway.vercel.sh). But V2 has no `/api/diagnostic` to expose Gateway status.
- **Impact:** When Gateway has issues, no way to diagnose without manual curl.
- **Fix:** Add `/api/diagnostic` on V2.

---

### 3. ACTUAL HANDOFF TEST RESULTS

```
Test: POST to https://neptune-v2.vercel.app/api/agent-sessions
Auth: Bearer NEPTUNE_INTERNAL_TOKEN
Result: ✅ 201 Created
Session ID: c8860812-2418-4d25-ac09-7542457f09c5
Response time: 1.53s
Status: works

Test: PATCH session status (should trigger webhook)
Auth: Bearer NEPTUNE_INTERNAL_TOKEN
Result: ✅ 200 OK
Session updated: status → "running"
Webhook emitted: ❌ SKIPPED (V2_WEBHOOK_SECRET not configured)

Test: Chat webhook receiver (no HMAC)
Result: ✅ 401 Invalid signature (correctly rejects unsigned)
```

**The core handoff API works.** The breaking point is entirely the webhook loopback.

---

### 4. FIX PRIORITY ORDER

| Priority | Issue | Fix Location | Stream |
|---|---|---|---|
| P0 | Add V2_WEBHOOK_SECRET to both Vercel projects | Vercel REST API | Stream 1,2 |
| P0 | Add SSE GET handler to v2-webhooks or fix HandoffCard | Chat repo | Stream 1 |
| P0 | Standardize handoff path (agent-sessions) | Chat repo | Stream 1 |
| P1 | Fix bridge.ts /api/chat → working endpoint | Chat repo | Stream 1 |
| P1 | Add /api/health to V2 | V2 repo | Stream 2 |
| P1 | Add event ID + idempotency to webhooks | Both repos | Stream 1,2 |
| P2 | Add /api/diagnostic to V2 | V2 repo | Stream 2 |

---

### 5. REPO & DEPLOYMENT MAP

| Component | GitHub Repo | Vercel Project | Production URL |
|---|---|---|---|
| Chat (Frontend + API) | abhiswami2121/neptune-chat | prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl | neptune-chat-ashy.vercel.app |
| V2 (Agent Engine) | abhiswami2121/neptune-v2 | prj_lEoqz6p4zgdrLlObPl845TI2ApOm | neptune-v2.vercel.app |
| VPS (Secrets + SkilLS) | N/A | N/A | hermes@187.127.250.171 |

---

### 6. TOKEN ARCHITECTURE

```
Chat (neptune-chat):
  V2_AGENT_TOKEN (missing, falls back →)
  └─ NEPTUNE_V2_HANDOFF_SECRET (set on Chat only)
  └─ NEPTUNE_INTERNAL_TOKEN (REDACTED) ← matches V2

V2 (neptune-v2):
  validateProgrammaticAuth checks: NEPTUNE_INTERNAL_TOKEN (REDACTED)
  vibe-code isProgrammaticAuth checks: NEPTUNE_INTERNAL_TOKEN | NEPTUNE_TEST_TOKEN | NEPTUNE_E2E_TEST_TOKEN

VPS (/etc/newleaf/.env):
  NEPTUNE_INTERNAL_TOKEN: REDACTED (64-char hex)
  AI_GATEWAY_API_KEY: REDACTED (vck_... format)
```

**Note: NEPTUNE_TEST_TOKEN and NEPTUNE_INTERNAL_TOKEN share the SAME VALUE on V2's .env.local** — this means there's no segregation between test and production auth.

---

### 7. REQUIRED ENV VARS TO ADD

**Chat Vercel (prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl):**
- `V2_WEBHOOK_SECRET` = (newly generated HMAC secret)

**V2 Vercel (prj_lEoqz6p4zgdrLlObPl845TI2ApOm):**
- `V2_WEBHOOK_SECRET` = (same value as Chat)
- `NEPTUNE_CHAT_WEBHOOK_URL` = `https://neptune-chat-ashy.vercel.app/api/v2-webhooks`
- `NEPTUNE_CHAT_API_URL` = `https://neptune-chat-ashy.vercel.app`

---

**Audit complete. Proceeding to STREAM 1 (Chat fixes).**
