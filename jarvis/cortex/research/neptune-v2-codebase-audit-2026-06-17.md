---
type: "research"
name: "Neptune V2 Codebase Audit 2026 06 17"
description: "Auto-generated description for Neptune V2 Codebase Audit 2026 06 17"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Neptune V2 ("open-agents") Codebase Audit — 2026-06-17

> **Phase:** Pre-Phase 33 baseline research
> **Repo:** `open-agents` monorepo at `/home/neptune/neptune-v2`
> **Deploy URL:** `https://neptune-v2.vercel.app`
> **Scope:** Read-only structural audit, zero code changes

---

## 1. Codebase Size (cloc — excluding node_modules, .next, dist)

| Language     | Files | Blank  | Comment | Code    |
|--------------|-------|--------|---------|---------|
| TypeScript   | 610   | 12,211 | 5,043   | 95,197  |
| JavaScript   | 4     | 396    | 1,262   | 40,406  |
| JSON         | 95    | 0      | 0       | 35,952  |
| Markdown     | 127   | 3,883  | 0       | 11,797  |
| YAML         | 3     | 2,431  | 0       | 10,415  |
| SQL          | 39    | 1      | 34      | 405     |
| CSS          | 1     | 41     | 56      | 474     |
| Shell        | 4     | 52     | 110     | 96      |
| SVG          | 6     | 0      | 0       | 10      |
| Text         | 1     | 2      | 0       | 9       |
| **TOTAL**    | **890** | **19,017** | **6,505** | **194,761** |

**Size delta vs Chat:** +42K LOC (+27%). V2 is larger despite fewer TypeScript files (610 vs 734) due to the 40K of bundled JS packages (likely vendored).

---

## 2. Monorepo Architecture

```
neptune-v2/
├── apps/
│   └── web/                        # Main Next.js app
│       ├── app/
│       │   ├── api/ (70 routes)    # REST API
│       │   ├── [username]/         # User profiles
│       │   ├── codespace/          # Sandbox code editor
│       │   ├── sessions/           # Session pages [sessionId]
│       │   ├── tasks/              # Task queue
│       │   ├── workflows/          # Workflow pages
│       │   ├── settings/           # User settings
│       │   ├── shared/             # Shared sessions
│       │   ├── deploy-your-own/    # Self-deploy flow
│       │   └── get-started/        # Onboarding
│       ├── components/
│       │   ├── ai-elements/        # AI SDK UI components
│       │   ├── auth/               # Auth provider UI
│       │   ├── chat/               # Chat interface
│       │   ├── landing/            # Landing page
│       │   ├── tool-call/          # Tool call renderers
│       │   └── ui/                 # Shared UI primitives
│       ├── lib/
│       │   ├── admin/              # Admin APIs
│       │   ├── auth/               # Better Auth config
│       │   ├── chat/               # Chat + runtime logic
│       │   ├── db/                 # Drizzle schema + 39 migrations
│       │   ├── deploy/             # Pre-flight validator
│       │   ├── deployment/         # Resource profile detection
│       │   ├── diff/               # Git diff engine
│       │   ├── git/                # Git commands (actions/queries)
│       │   ├── github/             # GitHub App integration
│       │   ├── handoff/            # VPS handoff bridge
│       │   ├── memory/             # Agent memory system
│       │   ├── sandbox/            # Sandbox management
│       │   ├── session/            # Server session helpers
│       │   ├── skills/             # Skill discovery
│       │   ├── usage/              # Usage tracking
│       │   └── vercel/             # Vercel API client
│       ├── hooks/                  # React hooks
│       ├── docs/                   # Documentation
│       └── types/                  # TypeScript type defs
├── packages/
│   ├── sandbox/                    # Shared sandbox package
│   │   ├── vercel/sandbox.ts       # Vercel Sandbox adapter (Firecracker)
│   │   ├── interface.ts            # Sandbox abstraction interface
│   │   └── config.ts               # Sandbox configuration
│   ├── agent/                      # Shared agent package
│   │   ├── system-prompt.ts        # Claude system prompt builder
│   │   └── skills/loader.ts        # Skill discovery + loading
│   └── shared/                     # Shared utilities
│       └── lib/webhook-emitter.ts  # HMAC-signed webhook emitter
└── .agents/                        # 26 agent skill definitions
    └── skills/                     # a11y, ai-sdk, chat-sdk, code-review,
                                    # deploy-yourself, plan-mode, self-coding, etc.
```

---

## 3. API Routes — 70 Total

### Sessions (CRUD + Lifecycle)
```
POST   /api/sessions                              # Create session + sandbox
GET    /api/sessions                              # List sessions
DELETE /api/sessions/[sessionId]                  # Archive session
POST   /api/sessions/[sessionId]/share            # Share session
POST   /api/sessions/[sessionId]/skills           # Discover sandbox skills
GET    /api/sessions/[sessionId]/files            # List sandbox files
POST   /api/sessions/[sessionId]/files/content    # Read sandbox file
GET    /api/sessions/[sessionId]/diff             # Git diff
POST   /api/sessions/[sessionId]/diff/patch       # Apply git patch
POST   /api/sessions/[sessionId]/diff/cached      # Cached diff
POST   /api/sessions/[sessionId]/generate-commit-message
POST   /api/sessions/[sessionId]/checks/fix       # Auto-fix CI checks
POST   /api/sessions/[sessionId]/code-editor      # Code editor launch
POST   /api/sessions/[sessionId]/dev-server       # Dev server launch
```

### Chat + Runtime
```
POST   /api/chat                                  # Create chat + stream
POST   /api/chat/[chatId]/stream                  # Stream chat response
POST   /api/chat/[chatId]/stop                    # Abort streaming
```

### Chat Sessions (within sandbox sessions)
```
GET    /api/sessions/[sessionId]/chats            # List chats in session
POST   /api/sessions/[sessionId]/chats            # Create chat fork
GET    /api/sessions/[sessionId]/chats/[chatId]   # Get chat details
POST   /api/sessions/[sessionId]/chats/[chatId]/fork        # Fork chat
POST   /api/sessions/[sessionId]/chats/[chatId]/read        # Mark read
POST   /api/sessions/[sessionId]/chats/[chatId]/share       # Share chat
GET    /api/sessions/[sessionId]/chats/[chatId]/messages
POST   /api/sessions/[sessionId]/chats/[chatId]/messages
DELETE /api/sessions/[sessionId]/chats/[chatId]/messages/[messageId]
```

### Sandbox Management
```
POST   /api/sandbox/reconnect                     # Reconnect sandbox
POST   /api/sandbox/extend                        # Extend sandbox timeout
GET    /api/sandbox/status                        # Sandbox status
POST   /api/sandbox/snapshot                      # Create sandbox snapshot
POST   /api/sandbox/activity                      # Report activity heartbeat
```

### Agent Sessions (VPS handoff tracking)
```
POST   /api/agent-sessions                        # Create VPS agent session
GET    /api/agent-sessions/[id]                   # Get agent session
GET    /api/agent-sessions/[id]/stream            # Stream agent progress
GET    /api/agent-sessions/[id]/events            # Agent events SSE
```

### GitHub Integration
```
POST   /api/github/webhook                        # GitHub webhook receiver
GET    /api/github/user                           # Current user GitHub info
GET    /api/github/orgs                           # List orgs
GET    /api/github/orgs/install-status            # Check app installed
GET    /api/github/installations                  # List installations
GET    /api/github/installations/repos            # List repos for installation
POST   /api/github/create-repo                    # Create repo
GET    /api/github/connection-status              # Check connection
GET    /api/github/branches                       # List branches
POST   /api/github/post-link                      # Link post-install
GET    /api/github/app/callback                   # GitHub App OAuth callback
GET    /api/github/app/install                    # GitHub App install
```

### Auth
```
ALL    /api/auth/[...all]                         # Better Auth handler
GET    /api/auth/info                             # Auth provider info
```

### Vercel
```
POST   /api/vercel/deploy                         # Deploy to Vercel
GET    /api/vercel/projects/[idOrName]/env        # Read Vercel env vars
GET    /api/vercel/repo-projects                  # List repo-linked projects
```

### Other
```
POST   /api/tasks/create                          # Create background task
GET    /api/tasks                                 # List tasks
POST   /api/vibe-code                             # Vibe-code endpoint
POST   /api/workflow/run                          # Run sandbox lifecycle
POST   /api/generate-pr                           # Generate PR from diff
POST   /api/generate-title                        # AI-generated chat title
GET    /api/models                                # Available AI models
POST   /api/transcribe                            # Voice transcription
GET    /api/usage                                 # Usage stats
GET    /api/usage/rank                            # Usage leaderboard
GET    /api/context                               # Context provider
GET    /api/shared/[shareId]/status               # Shared session status
GET    /api/shared/[shareId]/markdown             # Shared session export
GET    /api/settings/preferences                  # User preferences
GET    /api/settings/model-variants               # Model variant settings
GET    /api/shared-skills                         # Shared skills registry
GET    /api/diagnostic                            # Diagnostic endpoint
GET    /api/health                                # Health check
```

---

## 4. V2 Runtime Architecture — Claude SDK + Codex

### Chat Runtime Flow
```
User Prompt → createChatRuntime()
  ├── connectSandbox(sandboxState, { ports })
  │     └── @vercel/sandbox SDK → Firecracker VM
  │         ├── Network policy: GitHub token brokering
  │         ├── Ports: [3000, 5173, 4321, 8000]
  │         └── Timeout: 5h (standard) / 40min (hobby)
  ├── loadSessionSkills(sessionId, sandboxState, sandbox)
  │     ├── Check skills cache (Redis/in-memory)
  │     ├── Discover project-level skills from sandbox
  │     └── Merge with global skills registry
  └── Claude SDK chat with sandbox + skills
        ├── AI SDK stream with tool calls
        ├── Git diff/commit/push via sandbox shell
        └── Deploy via Vercel API
```

### Sandbox Configuration
```
DEFAULT_TIMEOUT:      5h (standard) / 40min (hobby)
VCPU:                 4 (standard) / 1 (hobby)
PORTS:                [3000 (Next.js), 5173 (Vite), 4321 (Astro), 8000 (code-server)]
WORKING_DIR:          /vercel/sandbox
BASE_SNAPSHOT:        Optional VERCEL_SANDBOX_BASE_SNAPSHOT_ID
EXTENSION_WINDOW:     20 min
INACTIVITY_TIMEOUT:   30 min → hibernation
LIFECYCLE_GRACE:      2 min
LIFECYCLE_POLL:       5 sec min
FIREWALL:             GitHub token brokering for x-access-token
```

### Webhook Emitter (Phase 28)
```
NEPTUNE_CHAT_WEBHOOK_URL:  https://neptune-chat-ashy.vercel.app/api/v2-webhooks
SIGNING:                   HMAC-SHA256 (V2_WEBHOOK_SECRET)
RETRY:                     Exponential backoff, max 5 attempts, 30s total
EVENT_TYPES:               started | running | ready_for_preview | 
                           ready_to_merge | completed | failed
DEAD_LETTER:               In-memory queue (max 100), DB persistence planned
IDEMPOTENCY:               eventId per webhook payload
```

### Handoff to VPS (vps-bridge.ts)
```
TRIGGER:          Runtime > 30min or multi-repo or system-level ops
PROTOCOL:         POST to VPS claude-agent-api with MissionBrief
MISSION_STATUSES: queued → running → completed | failed | cancelled | timed_out
RESULT:           Artifacts (path, url, summary) + PR/deploy URLs
```

---

## 5. Auth Architecture — Better Auth v5 + Vercel OAuth

```typescript
// Providers:
- GitHub OAuth  (primary)
- Vercel OAuth  (secondary)
- Email/Password (fallback)

// isProgrammaticAuth: supports VERCEL_OIDC_TOKEN for machine-to-machine
// Allowed hosts: localhost:3000, Vercel preview URLs, production domain
// Session: Better Auth cookie-based with Drizzle adapter
// Admin: is_admin flag on users table (migration 0034)
```

**Key difference from Chat:** V2 uses Better Auth natively (not Better Auth v5 beta wrapper). Chat uses `next-auth` 5.0.0-beta.25. Both ultimately share Better Auth core.

---

## 6. Database Schema — 39 Migrations

**Migrations count:** 39 (vs 17 in Chat — 2.3x more evolution)

Key tables:
- `users`, `accounts`, `auth_sessions`, `verifications` — Better Auth core
- `sessions` — Sandbox sessions (sandboxState JSON, repoUrl, branch, title)
- `chats` — Chat forks within sessions (forkId, visibility, title)
- `messages` — Chat messages (role, content, toolCalls, model)
- `skills` — Global skills registry
- `skill_installs` — Per-session skill installations
- `agent_sessions` — VPS agent handoff tracking
- `agent_events` — Agent session events
- `vercel_project_links` — Vercel project ↔ repo mappings
- `shared_sessions` — Shared session tokens
- `tasks` — Background task queue
- `usage_logs` — Model usage tracking
- `user_preferences` — Per-user settings

---

## 7. Pre-Flight Validator (Safety Pipeline)

Before every V2 sandbox commit:
1. **Secret leak detection** — API keys, tokens, env vars in diff
2. **CVE check** — package.json against known-vulnerable versions
3. **Build dry-run** — pnpm install + pnpm build
4. **Type check** — tsc --noEmit
5. **Auto-fix loop** — max 3 attempts for fixable errors
6. **Post-deploy watcher** — monitors Vercel deployment, auto-remediates failures

Error classes: MISSING_DEP | TYPE_ERROR | MISSING_FILE | LOCKFILE_STALE | OOM | MISSING_ENV | EDGE_TIMEOUT

---

## 8. Testing Discipline

V2 has significantly better test coverage than Chat:
- Route tests: `route.test.ts` for sandbox, auth, models, reconnect, snapshot, status
- Lib tests: model-access, model-availability, model-options, sandbox archive/lifecycle
- Auth tests: username validation
- Test runner: Bun test with JUnit reporter
- Isolated test mode: `pnpm test:isolated`

---

## 9. Key Differences: Neptune Chat vs V2

| Dimension | Neptune Chat | Neptune V2 |
|-----------|-------------|------------|
| **Primary purpose** | AI chat + connector hub | Claude Code sandbox IDE |
| **Codebase size** | 153K LOC | 195K LOC |
| **API routes** | 106 | 70 |
| **Auth** | Better Auth 5 beta (next-auth wrapper) | Better Auth directly |
| **GitHub** | Via connector | Native GitHub App integration |
| **AI runtime** | V1: API chat + V2: bridge | Claude SDK direct to sandbox |
| **Sandbox** | Vercel Sandbox via bridge | Native @vercel/sandbox SDK |
| **Deploy** | Vercel via API connector | Native Vercel deploy + pre-flight |
| **Webhooks** | Multiple (GitHub, Vercel, Twenty, deploy) | Single emitter (to Chat) |
| **Tests** | Playwright E2E only | Bun + unit tests per route |
| **Agent skills** | Connector-based (14 connectors) | Filesystem-based (26 .agents/skills) |
| **DB migrations** | 17 | 39 |
| **Monorepo** | Single app | Turbo monorepo (apps + packages) |
| **Session model** | Chat checkpoints | Sandbox sessions + chat forks |
| **Handoff** | V2 bridge (receive) | VPS bridge (send) |

---

## 10. Technology Stack (apps/web/package.json)

**Runtime:** Next.js (canary), React 19, Node 24.x, pnpm 11.5.1

**AI:** `@ai-sdk/*` ecosystem, Claude via `@anthropic-ai/sdk`, Vercel AI Gateway

**Sandbox:** `@vercel/sandbox` SDK (Firecracker microVM), code-server (VS Code in browser)

**Auth:** Better Auth v1.x, GitHub App OAuth, Vercel OIDC

**Data:** Drizzle ORM, `@vercel/postgres`, Upstash Redis

**Git:** `isomorphic-git`, GitHub REST API, Octokit

**Frontend:** Radix UI, Tailwind CSS v4, Framer Motion, Shiki, CodeMirror

**Testing:** Bun test, JUnit reporter, isolated mode

**Linting:** oxlint, oxfmt, Turbo

---

## 11. Risks & Gaps

| Risk | Severity | Detail |
|------|----------|--------|
| Sandbox costs | High | Firecracker VMs at scale — need cost governance |
| Session persistence | Medium | Sandbox snapshots not guaranteed across long hibernation |
| Handoff latency | Medium | VPS bridge adds 2-5s dispatch overhead |
| Webhook reliability | Medium | Dead letter is in-memory, DB persistence not shipped |
| Auth drift | Medium | Chat and V2 use slightly different Better Auth configs |
| No e2e tests | Medium | Unit tests exist but no Playwright/Cypress |
| Monorepo complexity | Low | Turbo + pnpm workspaces add CI complexity |

---

*Generated 2026-06-17 · Neptune V2 Codebase Audit · Stream 1 of 7 · Read-only*
