---
connector: vapi
version: 0.2.0
scope: connector
auto_load: true
trigger_tools:
  - vapi:listV2Sessions
  - vapi:getV2Session
  - vapi:postV2Session
  - vapi:streamV2Progress
  - vapi:controlV2Session
headline: |
  Neptune V2 coding engine bridge. Posts to NEPTUNE_V2_CHAT_URL with handoff secret.
  Sessions run in E2B sandboxes. Always use SSE streaming — never poll in tight loops.
type: "playbook"
access: internal
---

# Vapi (Neptune V2) Connector Playbook

## Operational Knowledge

### Architecture
Vapi is the bridge between Neptune Chat (the chat UI) and Neptune V2 (the coding engine based on vercel-labs/open-agents). It calls the Neptune V2 API at `NEPTUNE_V2_CHAT_URL` (default: `https://neptune-v2.vercel.app`) with Bearer token auth via `NEPTUNE_V2_HANDOFF_SECRET`.

### Flow
```
User (Chat) → ToolLoopAgent → Vapi Connector → Neptune V2 API → Sandbox/Agent → Result
                                            ↑ SSE streaming for progress
```

### Auth
- `NEPTUNE_V2_HANDOFF_SECRET` — shared secret for Chat→V2 communication
- `NEPTUNE_V2_CHAT_URL` — V2 deployment URL
- Auth is optional (degraded mode without secret) but recommended for production

### Tools Exposed
| Tool | Purpose | Endpoint |
|------|---------|----------|
| listV2Sessions | List coding sessions by status | GET /api/sessions/list |
| getV2Session | Get session details + status | GET /api/sessions/{id} |
| postV2Session | Hand off coding task to V2 | POST /api/sessions |
| streamV2Progress | Get SSE stream URL for session | GET /api/sessions/{id}/stream |
| controlV2Session | Pause/resume/cancel session | POST /api/sessions/{id}/control |

### Session Lifecycle
1. **Created**: `postV2Session` → V2 spawns sandbox, starts agent
2. **Running**: SSE stream provides real-time progress (thinking, tool calls, code output)
3. **Paused**: `controlV2Session({action:"pause"})` freezes execution
4. **Resumed**: `controlV2Session({action:"resume"})` continues from checkpoint
5. **Completed**: Task finishes, results available via `getV2Session`
6. **Cancelled**: `controlV2Session({action:"cancel"})` terminates

### Timeouts
- Request timeout: 8-15 seconds per API call
- Sandbox hard timeout: 5 hours
- Sandbox inactivity: 30 minutes

## Business Context

### Why Vapi (Neptune V2 Bridge)
Neptune Chat is the interaction layer — users type, ask, explore. Neptune V2 is the execution engine — it spins up sandboxes, runs code, manages repos. Vapi bridges the two:
1. **Separation of concerns**: Chat handles conversation, V2 handles computation
2. **Resource isolation**: Sandbox crashes don't affect chat
3. **Independent scaling**: Chat and V2 scale separately on Vercel
4. **Reusable sessions**: Multiple chat messages can reference the same V2 session

### Use Cases
- **Code generation**: "Build a Next.js landing page" → V2 spawns sandbox, scaffolds project, returns preview URL
- **Bug fixing**: "Fix the type error in user.ts" → V2 clones repo, patches, opens PR
- **PRD execution**: "Build the user auth module from PRD X" → V2 follows specification
- **Long-running tasks**: SSH into sandbox, run pnpm install, run tests, report results

### Neptune V2 Architecture (for context)
- Repo: abhiswami2121/neptune-v2 (fork of vercel-labs/open-agents)
- Bun + Turbo monorepo: apps/web, packages/agent, packages/sandbox, packages/shared
- PostgreSQL via Drizzle (shared Supabase)
- Sandbox: E2B cloud sandboxes with hibernate/resume lifecycle
- Better Auth for OAuth (Vercel + GitHub)

## Anti-Patterns

### ❌ NEVER:
1. **Post sessions without a prompt** — V2 requires a task description
2. **Assume all sessions APIs exist** — check `res.ok` and handle 404 gracefully
3. **Poll session status in a tight loop** — use SSE streaming (streamV2Progress)
4. **Leave sessions running** — cancel when no longer needed
5. **Post duplicate sessions** — check if a similar task is already running
6. **Parse V2 session output as JSON** — output is streaming text, may be HTML or markdown
7. **Call V2 without abort controller timeout** — all calls should have 8-15s timeouts
8. **Assume NEPTUNE_V2_HANDOFF_SECRET is always set** — provide degraded mode

### ⚠️ DANGEROUS:
- Passing unsanitized user input as V2 context without validation
- Running V2 sessions with full repo access without user confirmation
- Canceling a session that's mid-commit (can leave repo in dirty state)

## Safeguards

### Error Handling
- V2 unreachable → return `{ error: "V2 unreachable: ..." }` (never throw)
- 404 from V2 → V2 may not have that endpoint yet
- Auth missing → proceed without Bearer header (V2 may accept unauthenticated)
- Session not found → return `{ error: "Session not found" }`
- Timeout → AbortController with clearTimeout

### Validation
- `sessionId` is required for all session-specific operations
- `prompt` is required for session creation
- `action` enum: "pause", "resume", "cancel" only
- `status` filter enum: "running", "completed", "failed", "all"

### Security
- NEPTUNE_V2_HANDOFF_SECRET never exposed in responses
- V2 URLs always point to production Vercel deployment (not localhost)
- Session URLs returned include both chat proxy and direct V2 URLs
- No user data leaked between sessions

## Common Workflows

### Hand Off a Coding Task
```typescript
// 1. Create a V2 coding session
const session = await postV2Session({
  prompt: "Build a Next.js landing page with hero, features, and CTA sections",
  context: "Use Tailwind CSS, shadcn/ui components, dark mode",
  model: "deepseek-v4-pro"
});
// Returns: { sessionId, sessionUrl, sseUrl }

// 2. Monitor progress via SSE
// GET /api/v2/sessions/{sessionId}/stream
// Events: { step: "thinking"|"tool_call"|"code"|"done", text: "..." }

// 3. Check final result
const result = await getV2Session({ sessionId: session.sessionId });
```

### Cancel a Long-Running Task
```typescript
await controlV2Session({
  sessionId: "ses_abc123",
  action: "cancel"
});
```

### List Active Coding Sessions
```typescript
const sessions = await listV2Sessions({ status: "running", limit: 5 });
// Each: { id, status, createdAt, task }
```

## Refinement Notes

- **Version:** 1.0.0
- **Created:** 2026-06-09
- **Last Reviewed:** 2026-06-09
- **Source:** Neptune V2 API (neptune-v2.vercel.app), open-agents SDK
- **Related:** neptune-v2 repo (abhiswami2121/neptune-v2), NEPTUNE_V2_HANDOFF_SECRET env var
- **Note:** Named "vapi" in the connectors directory but conceptually the "Neptune V2 Bridge". The name derives from V(2) API.
