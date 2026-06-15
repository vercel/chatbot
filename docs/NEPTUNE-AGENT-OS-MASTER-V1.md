# NEPTUNE AGENT OS — DEFINITIVE MASTER DOCUMENT V1

**Document Type:** PRD/TRD/Design Doc/App Flow/Launch Checklist (Unified)
**Version:** V1.0 | **Date:** 2026-06-15 23:00 UTC
**Scope:** Complete Neptune Chat + Neptune V2 Production Reference
**Status:** CANONICAL — Replace All Prior Fragmented Docs
**Cross-References:** 32 Prior PRDs | 16 Connectors | 21 DB Tables | 103 API Routes | 170 Components
**Phase:** 20 — Mega Verification + Multi-Model Routing + Agent OS Definitive

---

## ═══════════════════════════════════════════════════════════════
## SECTION 1: EXECUTIVE SUMMARY — THE AGENT OS VISION
## ═══════════════════════════════════════════════════════════════

### What We Are Building

Neptune Agent OS is an AI-native operating system for software creation and business operations. It is not a chatbot. It is not a code editor. It is the **operating environment** in which AI agents plan, code, deploy, analyze, bill, support, and manage every aspect of a fintech business — NewLeaf Financial — and its software infrastructure.

### The OS Metaphor

```
╔══════════════════════════════ NEPTUNE AGENT OS ══════════════════════════════╗
║                                                                              ║
║  🧠 THE BRAIN (Neptune Chat)                                                 ║
║    • Multi-model routing (DeepSeek / Claude / Kimi / GLM / Qwen / GPT)      ║
║    • Planning sessions with planSession tool                                ║
║    • Artifact generation (durable, resumable, deployable)                   ║
║    • Tool use ecosystem (18+ tools across MCP, sandbox, library)            ║
║    • Skill discovery (50+ cortex skills, 18 playbooks)                      ║
║    • Progressive disclosure mode for massive context savings                ║
║                                                                              ║
║  ✋ THE HANDS (Neptune V2)                                                    ║
║    • Long-running coding sessions in sandboxed Firecracker microVMs         ║
║    • GitHub integration (clone, branch, commit, PR)                         ║
║    • Vercel auto-deploy with deploy-ready polling                           ║
║    • Multi-session parallel execution (max 4, skill-injected)               ║
║    • Plan-linked execution (planId → V2 session context)                    ║
║                                                                              ║
║  📚 THE LIBRARY (Workspace Canvas)                                            ║
║    • 9 Canvas modes (function-detail, connector-detail, skill-detail, etc.) ║
║    • 1247+ functions mapped with constraints                                 ║
║    • 16 connectors with playbooks and tools                                  ║
║    • 50+ skills, 32 PRDs, 18 playbooks                                       ║
║    • Generative UI with immersive glass-card design                         ║
║    • Knowledge Graph (pgvector + ltree) for semantic discovery              ║
║                                                                              ║
║  🔄 THE PIPELINE (Workflows)                                                  ║
║    • 8-step PRD-to-Deploy flow: Plan → Spec → V2 → Validate → PR → Merge   ║
║    • Multi-session orchestration with parallel V2 spawns                    ║
║    • Validation gates: build, lint, type-check, test, smoke-deploy          ║
║    • Durable workflows with checkpoint/pause/resume                          ║
║                                                                              ║
║  📡 THE INFRASTRUCTURE (Vercel-Native Stack)                                  ║
║    • AI Gateway Pro (multi-model, 7+ providers)                             ║
║    • E2B Sandbox (Firecracker microVMs)                                     ║
║    • Workflow DevKit (durable execution)                                     ║
║    • Fluid Compute (auto-scaling)                                            ║
║    • AI Elements (UI primitives)                                             ║
║    • PostgreSQL (Neon/Supabase) + Redis (Upstash)                           ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### The 5-Layer Architecture

1. **Layer 1 — Brain (Chat):** Multi-model LLM inference with intelligent routing, planning, and execution-tool dispatch. The user's primary interface.
2. **Layer 2 — Hands (V2):** Sandboxed coding execution — clones repos, applies edits, validates, commits, creates PRs, deploys to Vercel.
3. **Layer 3 — Library (Canvas):** The knowledge layer — every function, connector, skill, playbook, and model mapped, searchable, discoverable.
4. **Layer 4 — Pipeline (Workflows):** The orchestration layer — connects Brain planning to Hands execution through durable, resumable workflows.
5. **Layer 5 — Infrastructure (Stack):** Vercel-native deployment, AI Gateway, sandbox, database, auth, and all external connectors.

### Key Metrics (as of Phase 20)

| Metric | Count |
|--------|-------|
| API Routes | 103 |
| Components | 170 |
| Database Tables | 21 |
| Registered Models | 11 (expanding to 15+) |
| Connectors | 16 |
| Playbooks | 18 |
| Skills (cortex) | 50+ |
| PRDs Cross-Referenced | 32 |
| Env Vars | 93 |
| Chat Tools | 18+ |
| Canvas Modes | 9 |
| V2 Parallel Sessions (max) | 4 |

---

## ═══════════════════════════════════════════════════════════════
## SECTION 2: THE BRAIN — NEPTUNE CHAT (FULL AUDIT)
## ═══════════════════════════════════════════════════════════════

### 2.1 Repository Overview

**Path:** `/home/neptune/neptune-chat`
**Framework:** Next.js 16 + React 18 + Tailwind v4
**Language:** TypeScript (strict)
**AI SDK:** Vercel AI SDK v5 (`ai` package)
**Database:** PostgreSQL via Drizzle ORM
**Package Manager:** pnpm
**Deployment:** Vercel (project: `neptune-chat`, team: `abhiswami2121-2555s-projects`)

### 2.2 Directory Structure

```
neptune-chat/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication routes
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── api/auth/[...nextauth]/route.ts
│   │   └── api/auth/guest/route.ts
│   ├── (chat)/                   # Main application routes
│   │   ├── page.tsx              # Chat home (renders null — layout-driven)
│   │   ├── layout.tsx            # App shell layout
│   │   ├── chat/[id]/page.tsx    # Chat thread page
│   │   ├── api/chat/route.ts     # MAIN CHAT ENDPOINT (POST, 300s timeout)
│   │   ├── api/chat/[id]/stream/route.ts  # SSE stream (204 noop)
│   │   ├── api/chat/resume/route.ts
│   │   ├── api/chat/checkpoint/route.ts
│   │   ├── api/chat/schema.ts
│   │   ├── api/history/route.ts
│   │   ├── api/memory/route.ts
│   │   ├── api/context/route.ts
│   │   ├── api/messages/route.ts
│   │   ├── api/suggestions/route.ts
│   │   ├── api/document/route.ts
│   │   ├── api/vote/route.ts
│   │   ├── api/models/route.ts
│   │   ├── tools/page.tsx
│   │   ├── connectors/page.tsx
│   │   ├── workflows/page.tsx, workflows/prd-to-deploy/page.tsx
│   │   ├── v2-sessions/page.tsx, v2-sessions/[id]/page.tsx
│   │   ├── handoff/[sessionId]/page.tsx
│   │   ├── playbooks/page.tsx
│   │   ├── skills/page.tsx
│   │   ├── wiki/page.tsx
│   │   ├── vault/page.tsx
│   │   ├── memory/page.tsx
│   │   ├── knowledge/page.tsx
│   │   ├── capabilities/page.tsx
│   │   ├── diagnostics/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── telemetry/page.tsx
│   │   ├── secrets/page.tsx
│   │   ├── integrations/page.tsx
│   │   └── sessions/page.tsx
│   ├── api/                      # Global API routes
│   │   ├── v2-bridge/            # V2 handoff bridge
│   │   ├── v2/                   # V2 sessions API
│   │   ├── sandbox/              # E2B sandbox API
│   │   ├── library/              # Library graph API (tree, models, skills, usage)
│   │   ├── canvas/               # Canvas synthesis API
│   │   ├── workflow/             # Workflow engine API
│   │   ├── plan-mode/            # Planning mode API
│   │   ├── mcp/                  # MCP hub API
│   │   ├── connector-graph/      # Connector graph API
│   │   ├── connectors/           # Connector playbook API
│   │   ├── research/             # Deep research API
│   │   ├── evals/                # Evaluation API
│   │   ├── wiki/                 # Wiki API
│   │   ├── knowledge/            # Knowledge extraction API
│   │   ├── admin/                # Admin API (dashboard, vps-health, agent-sim)
│   │   ├── marketplace/          # Vercel marketplace API
│   │   ├── vercel/webhook/       # Vercel deploy webhook
│   │   ├── function-registry/    # Function registry API
│   │   ├── function-trace/       # Function trace API
│   │   ├── shared-skills/        # Shared skills API
│   │   ├── raw-logs/             # Raw logs query API
│   │   ├── playbooks/            # Playbook mod API
│   │   ├── prds/                 # PRD API
│   │   ├── annotations/          # Annotation API
│   │   ├── chat/abort/           # Chat abort endpoint
│   │   └── health/route.ts       # Health check
│   ├── admin/                    # Admin pages
│   │   ├── dashboard/page.tsx
│   │   ├── function-inventory/page.tsx
│   │   ├── evals/page.tsx
│   │   ├── connector-wizard/page.tsx
│   │   ├── agent-sim/page.tsx
│   │   └── marketplace/page.tsx
│   └── access-denied/page.tsx
├── components/                   # React components
│   ├── chat/                     # Chat UI (50+ components)
│   ├── ai-elements/              # AI SDK UI elements (13 components)
│   ├── canvas/                   # Canvas workspace (modes + primitives)
│   ├── library/                  # Library grid/card/table
│   ├── connectors/               # Connector UI (card, grid, detail)
│   ├── model-picker/             # Model selector UI
│   ├── workflow/                 # Workflow canvas + nodes
│   ├── wiki/                     # Wiki components
│   ├── sidebar/                  # Navigation sidebar
│   ├── v2/                       # V2 session components
│   ├── ui/                       # Base UI (shadcn: 30+ primitives)
│   └── artifact/                 # Artifact viewer
├── lib/                          # Core library
│   ├── ai/                       # AI subsystem
│   │   ├── models.ts             # Model registry (11 models)
│   │   ├── providers.ts          # Model provider resolution
│   │   ├── prompts.ts            # System prompt assembly
│   │   ├── tools/                # 18+ chat tools
│   │   ├── token-tracker.ts      # Token usage tracking
│   │   ├── entitlements.ts       # Feature gating by user type
│   │   ├── playbook-loader.ts    # Playbook auto-load
│   │   └── intent-classifier.ts  # Intent detection
│   ├── db/                       # Database layer
│   │   ├── schema.ts             # 21 Drizzle table definitions
│   │   ├── queries.ts            # Core DB queries
│   │   └── migrate.ts            # Migration runner
│   ├── sandbox/                  # E2B sandbox integration
│   ├── v2/                       # V2 bridge + skills loader
│   ├── mcp/                      # MCP client + hub
│   ├── workflow/                 # Workflow engine
│   ├── canvas/                   # Canvas synthesis + store
│   ├── library/                  # Library types
│   ├── agent/                    # Agent inline tools
│   ├── connectors/               # Connector registry + catalog
│   ├── auth/                     # Auth helpers
│   ├── research/                 # Parallel research engine
│   ├── knowledge/                # Knowledge graph client
│   ├── editor/                   # Code editor config
│   ├── marketplace/              # Vercel marketplace integration
│   ├── deploy/                   # Deploy verification
│   ├── raw-logs/                 # Raw log collection
│   ├── plan-mode/                # Plan mode detector
│   └── sentiment/                # Sentiment detection
├── connectors/                   # 16 connector integrations
├── playbooks/                    # 18 domain playbooks
├── skills/                       # 5 core skills (bridge, capabilities, etc.)
├── shared-skills/                # 6 shared skills
├── secrets/                      # Secrets management
├── functions/                    # 1247+ function registry
├── scripts/                      # Build scripts
├── workflows/                    # Workflow definitions
└── tests/                        # Test suite
```

### 2.3 Every API Route Documented

#### Auth Routes
| Route | Method | Purpose | Auth Required |
|-------|--------|---------|---------------|
| `/api/auth/[...nextauth]/route.ts` | ALL | NextAuth.js handler | No |
| `/api/auth/guest/route.ts` | POST | Guest/anonymous auth | No |

#### Chat Routes (Core)
| Route | Method | Purpose | Auth Required | Max Duration |
|-------|--------|---------|---------------|--------------|
| `/api/chat/route.ts` | POST | Main chat completion with streaming, tool use, playbook auto-load | Yes | 300s |
| `/api/chat/[id]/stream/route.ts` | GET | SSE stream connection (204 no-op placeholder) | Yes | — |
| `/api/chat/resume/route.ts` | POST | Resume from checkpoint | Yes | — |
| `/api/chat/checkpoint/route.ts` | POST | Save checkpoint | Yes | — |
| `/api/chat/abort/route.ts` | POST | Abort running stream | Yes | — |
| `/api/chat/schema.ts` | — | Zod schema for chat request body | — | — |
| `/api/history/route.ts` | GET | Chat history | Yes | — |
| `/api/memory/route.ts` | GET/POST | Conversation memory | Yes | — |
| `/api/context/route.ts` | GET | Context retrieval | Yes | — |
| `/api/messages/route.ts` | GET/POST | Message CRUD | Yes | — |
| `/api/suggestions/route.ts` | POST | AI suggestions | Yes | — |
| `/api/document/route.ts` | GET/POST | Document CRUD | Yes | — |
| `/api/vote/route.ts` | POST | Message voting | Yes | — |
| `/api/models/route.ts` | GET | Available models | Yes | — |
| `/api/files/upload/route.ts` | POST | File upload | Yes | — |

#### V2 Bridge Routes
| Route | Method | Purpose | Auth Required |
|-------|--------|---------|---------------|
| `/api/v2-bridge/route.ts` | POST | V2 handoff bridge | Internal token |
| `/api/v2-bridge/stream/[sid]/route.ts` | GET | V2 session SSE stream | Internal token |
| `/api/v2-bridge/cancel/route.ts` | POST | Cancel V2 session | Internal token |
| `/api/v2/sessions/route.ts` | GET/POST | List/create V2 sessions | Yes |
| `/api/v2/sessions/[sessionId]/stream/route.ts` | GET | Stream V2 session | Yes |
| `/api/v2/sessions/[sessionId]/control/route.ts` | POST | Control V2 session | Yes |

#### Sandbox Routes
| Route | Method | Purpose | Auth Required |
|-------|--------|---------|---------------|
| `/api/sandbox/stream/[id]/route.ts` | GET | Sandbox execution stream | Yes |

#### Library Routes
| Route | Method | Purpose | Auth Required |
|-------|--------|---------|---------------|
| `/api/library/tree/route.ts` | GET | Full library tree | Yes |
| `/api/library/graph/route.ts` | GET | Library knowledge graph | Yes |
| `/api/library/models/route.ts` | GET | Model library | Yes |
| `/api/library/models/[identifier]/route.ts` | GET | Single model detail | Yes |
| `/api/library/model-usage/route.ts` | GET | Model usage stats | Yes |
| `/api/library/load/[type]/[name]/route.ts` | GET | Load skill/playbook | Yes |
| `/api/library/log-usage/route.ts` | POST | Log usage event | Yes |
| `/api/library/reverse-refs/[type]/[name]/route.ts` | GET | Reverse references | Yes |
| `/api/library/skill/[name]/route.ts` | GET | Single skill | Yes |

#### Workflow Routes
| Route | Method | Purpose | Auth Required |
|-------|--------|---------|---------------|
| `/api/workflow/[id]/route.ts` | GET | Workflow status | Yes |
| `/api/workflow/generate/route.ts` | POST | Generate workflow | Yes |
| `/api/workflow/run/route.ts` | POST | Run workflow | Yes |
| `/api/workflows/code-refactor/route.ts` | POST | Code refactor workflow | Yes |
| `/api/workflows/data-audit/route.ts` | POST | Data audit workflow | Yes |
| `/api/workflows/research-swarm/route.ts` | POST | Research swarm workflow | Yes |

#### Canvas Routes
| Route | Method | Purpose | Auth Required |
|-------|--------|---------|---------------|
| `/api/canvas/synthesize/[type]/[name]/route.ts` | POST | Synthesize canvas content | Yes |

#### Admin Routes
| Route | Method | Purpose | Auth Required |
|-------|--------|---------|---------------|
| `/api/admin/dashboard/route.ts` | GET | Admin dashboard data | Admin |
| `/api/admin/function-inventory/route.ts` | GET | Function inventory | Admin |
| `/api/admin/vps-health/route.ts` | GET | VPS health check | Admin |
| `/api/admin/agent-sim/route.ts` | POST | Agent simulation | Admin |

#### Additional API Routes
| Route | Method | Purpose | Auth Required |
|-------|--------|---------|---------------|
| `/api/mcp/tools/route.ts` | GET/POST | MCP tool listing | Yes |
| `/api/mcp/route.ts` | POST | MCP client proxy | Yes |
| `/api/connector-graph/route.ts` | GET | Connector graph | Yes |
| `/api/connectors/route.ts` | GET | Connector listing | Yes |
| `/api/connectors/[name]/playbook/route.ts` | GET | Connector playbook | Yes |
| `/api/research/status/route.ts` | GET | Research task status | Yes |
| `/api/research/execute/route.ts` | POST | Execute research | Yes |
| `/api/evals/route.ts` | GET/POST | Eval CRUD | Yes |
| `/api/evals/run/route.ts` | POST | Run eval | Yes |
| `/api/evals/leaderboard/route.ts` | GET | Eval leaderboard | Yes |
| `/api/wiki/route.ts` | GET/POST | Wiki CRUD | Yes |
| `/api/wiki/ingest/route.ts` | POST | Wiki ingestion | Yes |
| `/api/wiki/entity/[id]/route.ts` | GET | Wiki entity | Yes |
| `/api/wiki/search/route.ts` | GET | Wiki search | Yes |
| `/api/knowledge/extract/route.ts` | POST | Knowledge extraction | Yes |
| `/api/function-registry/route.ts` | GET | Function registry | Yes |
| `/api/function-trace/route.ts` | POST | Trace function call | Yes |
| `/api/shared-skills/route.ts` | GET | Shared skills | Yes |
| `/api/raw-logs/stats/route.ts` | GET | Raw log statistics | Yes |
| `/api/raw-logs/query/route.ts` | POST | Query raw logs | Yes |
| `/api/playbooks/list/route.ts` | GET | Playbook listing | Yes |
| `/api/playbooks/load/route.ts` | GET | Load playbook | Yes |
| `/api/playbooks/propose-mod/route.ts` | POST | Propose playbook mod | Yes |
| `/api/playbooks/approve-mod/route.ts` | POST | Approve playbook mod | Yes |
| `/api/playbooks/revert-mod/route.ts` | POST | Revert playbook mod | Yes |
| `/api/prds/route.ts` | GET/POST | PRD management | Yes |
| `/api/annotations/route.ts` | GET/POST | Annotation CRUD | Yes |
| `/api/annotations/digest/route.ts` | GET | Annotation digest | Yes |
| `/api/marketplace/sandbox-test/route.ts` | POST | Marketplace sandbox test | Yes |
| `/api/marketplace/vercel-search/route.ts` | GET | Vercel marketplace search | Yes |
| `/api/marketplace/community-search/route.ts` | GET | Community search | Yes |
| `/api/marketplace/adopt/route.ts` | POST | Adopt marketplace item | Yes |
| `/api/vercel/webhook/route.ts` | POST | Vercel deploy webhook | Webhook secret |
| `/api/vercel/events/route.ts` | GET | Vercel events | Yes |
| `/api/webhooks/deploy/route.ts` | POST | Deploy webhook | Webhook secret |
| `/api/cron/refinement-loop/route.ts` | GET | Self-healing refinement cron | Cron secret |
| `/api/vault/route.ts` | GET/POST | Secret vault | Yes |
| `/api/vault/test/[keyName]/route.ts` | POST | Test vault key | Yes |
| `/api/secrets/audit/route.ts` | GET | Secrets audit | Yes |
| `/api/tools/route.ts` | GET | Tool listing | Yes |
| `/api/capabilities/route.ts` | GET | Capabilities | Yes |
| `/api/diagnostics/route.ts` | GET | Diagnostics | Yes |
| `/api/telemetry/route.ts` | GET | Telemetry | Yes |
| `/api/file-tree/route.ts` | GET | File tree | Yes |
| `/api/wizard/sandbox-test/route.ts` | POST | Wizard sandbox test | Yes |
| `/api/wizard/discover-api/route.ts` | POST | Wizard API discovery | Yes |
| `/api/wizard/check-mcp/route.ts` | POST | Wizard MCP check | Yes |
| `/api/wizard/adopt/route.ts` | POST | Wizard adopt | Yes |
| `/api/wizard/generate-skill/route.ts` | POST | Wizard generate skill | Yes |
| `/api/plan-mode/propose/route.ts` | POST | Propose plan | Yes |
| `/api/plan-mode/approve/route.ts` | POST | Approve plan | Yes |
| `/api/parallel-agents/route.ts` | POST | Parallel agent dispatch | Yes |
| `/api/integrations/route.ts` | GET | Integrations listing | Yes |
| `/api/health/route.ts` | GET | Health check | No |
| `/api/skills/route.ts` | GET | Skills listing | Yes |
| `/api/skills/[name]/route.ts` | GET | Single skill | Yes |
| `/api/skill/[name]/route.ts` | GET/POST | Skill detail | Yes |
| `/api/skill/[name]/[action]/route.ts` | POST | Skill action | Yes |
| `/api/proxy/connector/route.ts` | POST | Proxy connector call | Yes |

### 2.4 Every Tool Documented

The chat route registers these tools for AI agent use:

| # | Tool Name | Purpose | Phase Added |
|---|-----------|---------|-------------|
| 1 | `createDocument` | Create artifact (code/text/sheet) | Base |
| 2 | `editDocument` | Targeted find-and-replace edits in artifacts | Base |
| 3 | `updateDocument` | Full artifact rewrite | Base |
| 4 | `getWeather` | Get weather data | Base (demo) |
| 5 | `requestSuggestions` | AI suggestions for documents | Base |
| 6 | `planSession` | Enter formal planning mode, draft PRD outline | Phase 19 |
| 7 | `spawnCodingAgent` | Handoff to V2 sandbox for multi-step coding | Phase 19 |
| 8 | `loadSkill` | Load a cortex skill at runtime | Phase 12 |
| 9 | `queryKnowledge` | Query knowledge graph for facts/patterns | Phase 7 |
| 10 | `selfCode` | Self-modify neptune-chat code (small changes) | Phase 10-C |
| 11 | `getV2Session` | Get V2 session status | Phase 19 |
| 12 | `listV2Sessions` | List all V2 sessions | Phase 19 |
| 13 | `streamV2Progress` | Stream V2 session progress | Phase 19 |
| 14 | `createWorkflow` | Create durable workflow | Phase 15 |
| 15 | `runWorkflow` | Execute workflow step | Phase 15 |
| 16 | `progressiveDisclosure` | Discover capabilities at runtime | Phase 12.C |
| 17 | `loadPlaybook` | Load domain playbook | Phase 12 |
| 18 | `loadConnector` | Load connector instructions | Phase 12 |

### 2.5 System Prompt Architecture

The system prompt is assembled from 7 layers in `lib/ai/prompts.ts`:

1. **NEPTUNE.md** — Traffic controller (router-first protocol, 6 gatekeeper tools)
2. **regularPrompt** — Core identity: "SOP-executing AI agent under playbook-first orchestration"
3. **requestPrompt** — Geo-location context from Vercel
4. **playbookRouter** — PLAYBOOK-ROUTER.md (82 intent→playbook routes, 11 domains, 13 connectors)
5. **preCheckKnowledge** — Knowledge Graph query directive (U7.4 Pattern A+2)
6. **artifactsPrompt** — Artifact creation/editing rules
7. **selfModRouting** — Self-modification routing (Phase 10-C)

**Progressive Disclosure Mode** (`PROGRESSIVE_DISCLOSURE_ENABLED=true`):
- Starts with ALMOST NOTHING — just identity + one routing instruction
- All capabilities discovered at runtime via `loadPlaybook`/`loadConnector`/`loadFunction`
- Verified 100% pass rate vs 79% for bloated baseline (AGENTS.md evals)

### 2.6 Model Registry (Current State — Before Phase 20)

| Model ID | Provider | Route Type | Description |
|----------|----------|------------|-------------|
| `deepseek-v4-pro` | deepseek | direct | User's own API key, bypasses Gateway |
| `deepseek-reasoner` | deepseek | direct | DeepSeek R1 reasoning |
| `deepseek/deepseek-v4-pro` | deepseek | gateway | Default — through Vercel AI Gateway |
| `deepseek/deepseek-v3.2` | deepseek | gateway | Fast, capable with tool use |
| `deepseek/deepseek-v4-flash` | deepseek | gateway | Faster V4 variant |
| `moonshotai/kimi-k2.5` | moonshotai | gateway | Moonshot AI flagship |
| `openai/gpt-oss-20b` | openai | gateway | Compact reasoning |
| `openai/gpt-oss-120b` | openai | gateway | 120B parameter model |
| `xai/grok-4.1-fast-non-reasoning` | xai | gateway | Fast non-reasoning |
| `anthropic/claude-sonnet-4-6` | anthropic | gateway | Anthropic balanced |
| `google/gemini-2-flash` | google | gateway | Fast multimodal |

**Default Model:** `deepseek/deepseek-v4-pro`

### 2.7 Model Provider Resolution (`lib/ai/providers.ts`)

```
User selects model ID
    │
    ├── Test environment? → Mock provider
    │
    ├── Direct DeepSeek model (deepseek-v4-pro, deepseek-reasoner)?
    │   ├── DEEPSEEK_API_KEY present? → Direct API (https://api.deepseek.com/v1)
    │   └── No? → Graceful fallback to Vercel AI Gateway
    │
    └── Gateway model? → Vercel AI Gateway (needs AI_GATEWAY_API_KEY)
```

### 2.8 Intent Classification Pipeline

1. User sends message → Chat route receives it
2. `playbook-os-client.ts` → `discoverActionGroup()` matches intent to domain
3. `playbook-loader.ts` → `loadPlaybooksForIntent()` auto-loads relevant playbooks
4. `formatPlaybookContext()` injects playbook context into system prompt
5. AI agent routes to correct tool based on playbook SOP

### 2.9 Key UI Components Mapped

**Chat UI (50+ components):**
- `chat-header.tsx` — App header with model selector, sidebar toggle, status bar
- `messages.tsx` — Message list with streaming, auto-scroll
- `message.tsx` — Single message with reasoning, tool calls, artifacts
- `multimodal-input.tsx` — Rich input with file upload, slash commands
- `artifact.tsx` — Side panel artifact viewer (code, text, sheet)
- `model-selector.tsx` — Model picker dropdown in header
- `tool-call-grouper.tsx` — Groups tool calls by type
- `tool-result-renderer.tsx` — Renders tool results by type
- `routine-progress-card.tsx` — Shows playbook routine progress
- `handoff-tile.tsx` — V2 handoff status display
- `plan-mode-proposal.tsx` — Planning mode proposal UI

**Canvas (Workspace):**
- `canvas-shell.tsx` — Canvas container with breadcrumb, mode switching
- `mode-renderer.tsx` — Routes to correct canvas mode component
- 9 modes: function-detail, connector-detail, skill-detail, playbook-detail, library-overview, wiki-browser, kg-explorer, workflow-canvas-mode, add-new
- Primitives: glass-card, action-button, plan, queue, schema-display, snippet

**Model Picker:**
- `model-library.tsx` — Grid of model cards with filtering, sorting, playbook-aware scoring
- `model-card.tsx` — Individual model display with capabilities
- `model-tooltip.tsx` — Detailed model info on hover
- `filter-bar.tsx` — Provider, capability, and cost filters

**Workflow Canvas:**
- `WorkflowCanvas.tsx` — React Flow-based visual workflow editor
- 8 node types: TriggerNode, AINode, ActionNode, ConditionalNode, TransformNode, ParallelNode, OutputNode
- `AnimatedWorkflowEdge.tsx` — Animated edges between nodes

---

## ═══════════════════════════════════════════════════════════════
## SECTION 3: THE HANDS — NEPTUNE V2
## ═══════════════════════════════════════════════════════════════

### 3.1 Repository Overview

**Path:** `/home/neptune/neptune-v2`
**Architecture:** Turborepo Monorepo
**Primary App:** `apps/web` (Next.js 16)
**Packages:** Shared utilities in `packages/`
**Deployment:** Vercel (project: `neptune-v2`, URL: `https://neptune-v2.vercel.app`)

### 3.2 V2 Sandbox Architecture

```
Chat Request → spawnCodingAgent tool → VPS Bridge → V2 API
                                                    │
                                          ┌─────────┴──────────┐
                                          │  V2 API Handler     │
                                          │  • Auth (internal)  │
                                          │  • Skill injection  │
                                          │  • Plan context     │
                                          │  • Validation plan  │
                                          └─────────┬──────────┘
                                                    │
                                          ┌─────────┴──────────┐
                                          │  Sandbox Spawner    │
                                          │  • E2B API          │
                                          │  • Firecracker VM   │
                                          │  • Git clone        │
                                          └─────────┬──────────┘
                                                    │
                                          ┌─────────┴──────────┐
                                          │  Agent Run Loop     │
                                          │  • LLM calls        │
                                          │  • File edits       │
                                          │  • Build validation │
                                          │  • Commit + PR      │
                                          └─────────┬──────────┘
                                                    │
                                          ┌─────────┴──────────┐
                                          │  Deploy             │
                                          │  • Vercel API       │
                                          │  • Poll READY       │
                                          │  • Return URL       │
                                          └────────────────────┘
```

### 3.3 V2 Bridge Protocol

Chat ↔ V2 communication via `/api/v2-bridge/route.ts`:
- **Auth:** `NEPTUNE_INTERNAL_TOKEN` or `NEPTUNE_V2_HANDOFF_SECRET`
- **Payload:** `{ goal, context, modelId, sessionId }`
- **Response:** `{ success, sessionId, sseUrl, sandboxId }`
- **Streaming:** SSE endpoint at `/api/v2-bridge/stream/[sid]/route.ts`
- **Cancel:** POST to `/api/v2-bridge/cancel/route.ts`

### 3.4 V2 Key Libraries

| Library | Purpose |
|---------|---------|
| `lib/sandbox/lifecycle.ts` | E2B sandbox create/connect/destroy lifecycle |
| `lib/sandbox/spawn.ts` | Sandbox provisioning with templates |
| `lib/sandbox/config.ts` | Sandbox runtime configuration |
| `lib/github/client.ts` | GitHub API client (repos, commits, PRs, tokens) |
| `lib/github/commit.ts` | Git commit with file operations |
| `lib/github/pulls.ts` | PR creation and management |
| `lib/vercel/projects.ts` | Vercel project management |
| `lib/vercel/token.ts` | Vercel token management |
| `lib/session/store.ts` | Session persistence |
| `lib/playbook-os-client.ts` | Playbook OS integration |
| `lib/handoff/vps-bridge.ts` | VPS bridge for cross-service communication |
| `lib/chat-streaming-state.ts` | Streaming state management |
| `lib/models.ts` | V2 model configuration |

### 3.5 V2 Agent Flow

1. **Receive handoff** from Chat via bridge
2. **Load skills** if specified in `spawnCodingAgent` call
3. **Inject plan context** if `planId` is provided
4. **Clone repo** into sandbox filesystem
5. **Execute agent loop:**
   - LLM analyzes goal + context
   - Applies file edits
   - Runs validation steps (build, lint, type-check, test, smoke-deploy)
   - Fixes failures automatically (retry loop)
   - Commits changes
6. **Create PR** on GitHub
7. **Deploy preview** to Vercel (if requested)
8. **Return results** (PR URL, deploy URL) to Chat
9. **Record session** in `library_v2_sessions` table

---

## ═══════════════════════════════════════════════════════════════
## SECTION 4: THE LIBRARY — WORKSPACE CANVAS
## ═══════════════════════════════════════════════════════════════

### 4.1 Canvas Architecture

The Library Canvas is the knowledge layer of Agent OS. It provides a unified interface for discovering and exploring every asset in the system.

**Canvas Modes (9):**

| Mode | Component | Purpose |
|------|-----------|---------|
| Function Detail | `function-detail.tsx` | Explore any of 1247+ functions — signature, dependencies, constraints |
| Connector Detail | `connector-detail.tsx` | Explore 16 connectors — tools, playbooks, auth config |
| Skill Detail | `skill-detail.tsx` | Read any cortex skill — triggers, SOPs, anti-patterns |
| Playbook Detail | `playbook-detail.tsx` | Read any playbook — domain, routines, edge cases |
| Library Overview | `library-overview.tsx` | Top-down library map with search and filtering |
| Wiki Browser | `wiki-browser.tsx` | Browse the knowledge wiki |
| KG Explorer | `kg-explorer.tsx` | Explore the knowledge graph (pgvector + ltree) |
| Workflow Canvas | `workflow-canvas-mode.tsx` | Visual workflow editor |
| Add New | `add-new.tsx` | Create new assets |

**Canvas Primitives:**
- `glass-card.tsx` — Aurora Glass design system card
- `action-button.tsx` — Action trigger with loading states
- `plan.tsx` — Plan display with phases and ACs
- `queue.tsx` — Action queue visualization
- `schema-display.tsx` — Database schema display
- `snippet.tsx` — Code snippet with syntax highlighting

### 4.2 Library Database Tables

| Table | Purpose | Records |
|-------|---------|---------|
| `library_connectors` | Connector metadata | 16 |
| `library_skills` | Skill definitions with constraints | 50+ |
| `library_functions` | Function registry with signatures | 1247+ |
| `library_playbooks` | Playbook metadata and content | 18 |
| `library_workflows` | Workflow definitions | — |
| `library_edges` | Graph edges connecting nodes | — |
| `library_models` | AI model metadata with scores | 11 (expanding) |
| `library_plans` | Planning session plans | — |
| `library_v2_sessions` | V2 coding session records | — |
| `library_usage_logs` | Skill/function usage tracking | — |
| `library_model_usage_logs` | Model usage tracking | — |
| `library_evals` | Evaluation test cases | — |
| `library_eval_runs` | Evaluation run results | — |

### 4.3 Connector Inventory

| Connector | Domain | MCP Enabled | Tools | Dependencies |
|-----------|--------|-------------|-------|-------------|
| `base44` | CRM/Core | ✅ | 20+ | Base44 API |
| `github` | Dev/CI | ✅ | 10+ | GitHub API |
| `vercel` | Deploy | ✅ | 5+ | Vercel API |
| `slack` | Comms | ✅ | 4+ | Slack API |
| `nmi` | Billing | ✅ | 8+ | NMI API |
| `hyperswitch` | Payments | ✅ | 6+ | HyperSwitch API |
| `linear` | Project Mgmt | ✅ | 6+ | Linear API |
| `vapi` | Voice AI | — | 3+ | Vapi API |
| `ghl` | Marketing | — | 5+ | GoHighLevel API |
| `forth` | Credit | — | 3+ | Forth API |
| `affy` | Affiliate | — | 2+ | Affy API |
| `cat-facts` | Demo | — | 1 | — |
| `custom-skills` | Skills | — | — | — |
| `mcp-hub` | MCP | — | — | — |
| `neptune` | Self | — | 2+ | Internal |
| `wiki` | Knowledge | — | 3+ | Internal |

### 4.4 Function Registry

The function registry at `functions/` and `lib/` maps 1247+ functions with:
- Name and signature
- File path and line number
- Dependencies and incompatibilities
- Domain classification
- Skill associations
- Context token estimates
- Latency and cost estimates
- Optimal/suboptimal use cases

### 4.5 Skill Discovery System

Skills are organized across 4 locations:
1. **jarvis/cortex/skills/** (canonical, Base44-hosted) — 50+ skills
2. **playbooks/** (domain playbooks) — 18 playbooks
3. **skills/** (bridge skills) — 5 core skills
4. **shared-skills/** (shared across agents) — 6 skills

Skills at runtime:
- `loadSkill` tool loads a skill by name from cortex
- Skills inject SOPs, anti-patterns, and guardrails into agent context
- Progressive Disclosure mode starts with NO skills pre-loaded
- Playbook Router maps user intent → correct playbook → correct skill

---

## ═══════════════════════════════════════════════════════════════
## SECTION 5: THE PIPELINE — WORKFLOWS
## ═══════════════════════════════════════════════════════════════

### 5.1 PRD-to-Deploy Flow

```
  1. DISCUSS       2. PLAN         3. SPEC          4. DISPATCH
  User says      planSession     Refine plan      spawnCodingAgent
  "Let's plan"   tool creates    with clarifying  tool → V2
                 library_plans   questions        sandbox
       │              │              │                │
       ▼              ▼              ▼                ▼
  5. BUILD         6. VALIDATE     7. PR            8. DEPLOY
  V2 edits       build/lint/     GitHub PR        Vercel deploy
  files in       type-check/     created with     → poll READY
  sandbox        test/smoke      all changes      → live URL
```

### 5.2 Workflow Engine

Located at `lib/workflow/engine.ts`:
- **Durable workflows:** Survive server restarts
- **Checkpoint/resume:** Save state, resume from any step
- **Parallel execution:** Multiple V2 sessions for large scopes (max 4)
- **Validation gates:** Build, lint, type-check, test, smoke-deploy
- **Retry logic:** Auto-retry transient failures (build flakes, network timeouts)

### 5.3 Workflow Templates

Pre-built templates at `lib/workflow/templates.ts`:
- **Code Refactor** — Analyze → Plan → Edit → Validate → PR
- **Data Audit** — Query → Analyze → Report → Action items
- **Research Swarm** — Parallel research → Synthesize → Document
- **Feature Build** — Spec → Scaffold → Implement → Test → Deploy
- **Bug Fix** — Reproduce → Diagnose → Fix → Validate → PR

### 5.4 Multi-Session Orchestration

Phase 19 introduced parallel V2 sessions:
- `parallel: true` in `spawnCodingAgent` fires up to 4 V2 sessions
- Each session gets its own sandbox + skill injection
- Sessions tracked in `library_v2_sessions` with `parallelGroup` field
- Results merged back to Chat as individual completion messages

---

## ═══════════════════════════════════════════════════════════════
## SECTION 6: THE INFRASTRUCTURE — VERCEL-NATIVE STACK
## ═══════════════════════════════════════════════════════════════

### 6.1 Core Infrastructure

| Service | Provider | Purpose |
|---------|----------|---------|
| **Hosting** | Vercel | Next.js deployment, Edge Functions, Fluid Compute |
| **AI Gateway** | Vercel AI Gateway Pro | Multi-model routing, unified billing, fallback chains |
| **Database** | Neon/Supabase (PostgreSQL) | Primary data store (21 tables) |
| **Cache** | Upstash Redis | Session store, rate limiting, real-time state |
| **Sandbox** | E2B (Firecracker) | Isolated code execution microVMs |
| **Auth** | NextAuth.js + Better Auth | Authentication with multiple providers |
| **Secrets** | Vercel Env Vars | Production secrets management |
| **CI/CD** | Vercel Git Integration | Auto-deploy on push to main |
| **Monitoring** | Langfuse | LLM observability and tracing |
| **Webhooks** | Vercel + GitHub | Deploy events, PR events |

### 6.2 Environment Variables Reference (Key Ones)

| Variable | Purpose | Service |
|----------|---------|---------|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway authentication | Vercel |
| `DEEPSEEK_API_KEY` | Direct DeepSeek API (bypasses Gateway) | DeepSeek |
| `ANTHROPIC_API_KEY` | Claude API key | Anthropic |
| `KIMI_API_KEY` | Kimi/Moonshot API key | Moonshot AI |
| `OPENAI_API_KEY` | GPT API key (pending) | OpenAI |
| `XAI_API_KEY` | Grok API key (pending) | xAI |
| `POSTGRES_URL` | Database connection string | Neon/Supabase |
| `REDIS_URL` | Redis connection string | Upstash |
| `GITHUB_TOKEN` | GitHub API authentication | GitHub |
| `VERCEL_TOKEN` | Vercel API authentication | Vercel |
| `VERCEL_API_TOKEN` | Vercel API (alternate) | Vercel |
| `E2B_API_KEY` | E2B sandbox API key | E2B |
| `NEPTUNE_INTERNAL_TOKEN` | Internal service auth (V2 bridge) | Internal |
| `NEPTUNE_V2_HANDOFF_SECRET` | V2 handoff auth | Internal |
| `BASE44_API_KEY` | Base44 CRM API | Base44 |
| `NMI_SECURITY_KEY` | NMI payment gateway | NMI |
| `HYPERSWITCH_API_KEY` | HyperSwitch payments | HyperSwitch |
| `SLACK_BOT_TOKEN` | Slack bot integration | Slack |
| `LINEAR_API_KEY` | Linear project management | Linear |
| `VAPI_API_KEY` | Voice AI integration | Vapi |
| `GHL_API_KEY` | GoHighLevel marketing | GHL |
| `FORTH_DPP_API_KEY` | Forth credit API | Forth |
| `N8N_API_KEY` | n8n workflow automation | n8n |
| `SMITHERY_API_KEY` | Smithery MCP marketplace | Smithery |
| `RESEND_API_KEY` | Email delivery | Resend |
| `JDI_API_KEY` | Ringless voicemail | JDI |
| `GODADDY_API_KEY` | Domain management | GoDaddy |
| `TWENTY_APP_SECRET` | Twenty CRM | Twenty |
| `LANGFUSE_PUBLIC_KEY` | LLM observability | Langfuse |
| `AUTH_SECRET` | NextAuth.js encryption | NextAuth |
| `BETTER_AUTH_SECRET` | Better Auth encryption | Better Auth |
| `CLERK_SECRET_KEY` | Clerk auth (dev) | Clerk |
| `VERCEL_WEBHOOK_SECRET` | Webhook signature verification | Vercel |
| `HYPERSWITCH_WEBHOOK_SECRET` | Payment webhook verification | HyperSwitch |

### 6.3 Database Schema (21 Tables)

| # | Table Name | Purpose |
|---|-----------|---------|
| 1 | `User` | User accounts and authentication |
| 2 | `Chat` | Chat sessions with parent chain + checkpoints |
| 3 | `Message_v2` | Chat messages with token tracking + artifact drafts |
| 4 | `Vote_v2` | Message upvote/downvote tracking |
| 5 | `Document` | Persisted documents (text/code/image/sheet) |
| 6 | `Suggestion` | AI suggestions on documents |
| 7 | `Stream` | Stream session tracking |
| 8 | `SandboxRun` | E2B sandbox execution records |
| 9 | `handoff_sessions` | V2 coding agent handoff tracking |
| 10 | `chat_checkpoints` | Chat checkpoint/summary snapshots |
| 11 | `library_connectors` | Connector metadata registry |
| 12 | `library_skills` | Skill definitions with constraints |
| 13 | `library_functions` | Function registry with signatures |
| 14 | `library_playbooks` | Playbook metadata and content |
| 15 | `library_workflows` | Workflow definitions |
| 16 | `library_edges` | Knowledge graph edges |
| 17 | `library_usage_logs` | Skill/function usage tracking |
| 18 | `library_models` | AI model metadata with benchmark scores |
| 19 | `library_model_usage_logs` | Model usage with cost tracking |
| 20 | `library_evals` | Evaluation test cases |
| 21 | `library_eval_runs` | Evaluation run results |
| 22 | `library_plans` | Planning session plans |
| 23 | `library_v2_sessions` | V2 coding session records |

### 6.4 Auth Flow

1. **NextAuth.js** handles OAuth + credentials via `app/(auth)/api/auth/[...nextauth]/route.ts`
2. **Guest auth** for anonymous users via `/api/auth/guest/route.ts`
3. **Allowlist** gating for production: `lib/auth/require-allowlist.ts`
4. **Internal token auth** for service-to-service (V2 bridge, cron jobs)
5. **Webhook verification** via `VERCEL_WEBHOOK_SECRET` and `HYPERSWITCH_WEBHOOK_SECRET`
6. **Rate limiting** via `lib/ratelimit.ts` (Upstash Redis)
7. **Bot detection** via `botid/server`

---

## ═══════════════════════════════════════════════════════════════
## SECTION 7: APP NAVIGATION FLOW (EVERY USER JOURNEY)
## ═══════════════════════════════════════════════════════════════

### Journey 1: Sign-In → Chat (Primary Flow)

```
Landing Page → Login (/login) → Auth (/api/auth) → Chat Home (/)
    │                                                      │
    │  ┌─────────────────────────────────────────────────────┘
    │  ▼
    │  Chat Layout (layout.tsx)
    │  ├── Sidebar (history, library, admin)
    │  ├── Chat Header (model selector, status bar)
    │  ├── Messages Area (infinite scroll, streaming)
    │  ├── Input Area (multimodal, slash commands)
    │  └── Artifact Panel (side panel, collapsible)
```

### Journey 2: Chat → Library Canvas

```
Chat → Click Library Tab (sidebar) → Library Overview Canvas
    │                                       │
    │  ┌────────────────────────────────────┘
    │  ▼
    │  Canvas Shell
    │  ├── Mode Selector (9 modes)
    │  ├── Breadcrumb Navigation
    │  ├── Content Area (mode-specific)
    │  │   ├── Function Detail → Click function → Detail view
    │  │   ├── Connector Detail → Click connector → Detail sheet
    │  │   ├── Skill Detail → Click skill → Detail view
    │  │   └── etc.
    │  └── Action Queue (pending actions)
```

### Journey 3: Chat → Plan Session → V2 Handoff

```
Chat → User: "Let's plan X" → planSession tool
    │                              │
    │  ┌───────────────────────────┘
    │  ▼
    │  Plan displayed in chat:
    │  ├── Title + Summary
    │  ├── 3-4 Phases with goals
    │  ├── Acceptance Criteria
    │  ├── Files Affected
    │  ├── Clarifying Questions (max 3)
    │  └── Next Actions: "Approve", "Refine", "Execute with V2"
    │
    │  User: "Approved, execute with V2"
    │     │
    │     ▼
    │  spawnCodingAgent tool:
    │  ├── planId linked for context
    │  ├── Skills loaded for V2 system prompt
    │  ├── V2 sandbox spawned
    │  ├── Progress streamed via SSE
    │  └── Results: PR URL + Deploy URL
    │
    │  Results displayed in:
    │  ├── handoff-tile.tsx (in chat)
    │  ├── v2-live-panel.tsx (live updates)
    │  └── /handoff/[sessionId] page (full detail)
```

### Journey 4: Chat → Workflow → PR → Deploy

```
Chat → User: "Build a landing page" → /workflows page
    │                                     │
    │  ┌──────────────────────────────────┘
    │  ▼
    │  Workflow Canvas:
    │  ├── Select template (Feature Build, Code Refactor, etc.)
    │  ├── Customize nodes (Trigger → AI → Action → Validate → Deploy)
    │  ├── Set validation gates
    │  └── Run workflow
    │       │
    │       ▼
    │  Workflow Engine:
    │  ├── Step 1: Spec (planSession)
    │  ├── Step 2: Build (spawnCodingAgent)
    │  ├── Step 3: Validate (build + lint + type-check)
    │  ├── Step 4: PR (GitHub PR creation)
    │  └── Step 5: Deploy (Vercel deploy → poll READY)
    │
    │  Results:
    │  ├── GitHub PR URL
    │  ├── Vercel Preview URL
    │  └── Workflow canvas updated with green checkmarks
```

### Journey 5: Admin Dashboard

```
Chat → Sidebar Admin Tab → /admin/dashboard
    │                              │
    │  ┌───────────────────────────┘
    │  ▼
    │  Admin Pages:
    │  ├── Dashboard: System health, usage stats, active sessions
    │  ├── Function Inventory: 1247+ functions with search/filter
    │  ├── Connector Wizard: Step-by-step connector setup
    │  ├── Agent Sim: Test agent responses against eval suite
    │  ├── Evals: View eval results, run new evals
    │  └── Marketplace: Browse/adopt Vercel marketplace integrations
```

### Journey 6: Mobile Flow

```
Mobile → Responsive Chat Layout
    │
    ├── Mobile Header (hamburger menu, model selector)
    ├── Sheet-based Navigation (bottom sheets replace sidebars)
    ├── Library Canvas → Drawer-based mode switching
    ├── Connector Detail → Bottom sheet overlay
    ├── V2 Sessions → Card-based list with expand
    └── Settings → Full-page modal
```

### Journey 7: Connector Exploration

```
Chat → /connectors → Connector Grid
    │                    │
    │  ┌─────────────────┘
    │  ▼
    │  ConnectorGrid:
    │  ├── FilterBar (domain, MCP status, search)
    │  ├── ConnectorCards (16 connectors)
    │  └── Click → ConnectorDetailSheet
    │       ├── Tools list with signatures
    │       ├── Playbook preview
    │       ├── Auth configuration
    │       └── "Load Playbook" button → injects into chat context
```

### Journey 8: Knowledge Exploration

```
Chat → /knowledge → Knowledge Card Grid
    │                    │
    │  ┌─────────────────┘
    │  ▼
    │  Knowledge Graph:
    │  ├── Search: Full-text + semantic (pgvector)
    │  ├── Filter: Domain, type, recency
    │  ├── Detail: Entity cards with provenance links
    │  └── Extract: AI-powered knowledge extraction from messages
```

---

## ═══════════════════════════════════════════════════════════════
## SECTION 8: CROSS-REFERENCE MATRIX (32 PRIOR PRDs)
## ═══════════════════════════════════════════════════════════════

### PRD Cross-Reference Table

| # | PRD Title | Date | Status | Implementation State |
|---|-----------|------|--------|---------------------|
| 1 | PHASE-20-MEGA-VERIFICATION-PRD | 2026-06-15 | IN PROGRESS | This document is the output |
| 2 | unified-billing-infrastructure-master-prd | 2026-06-15 | SPEC | Implemented in Base44, referenced by connectors/nmi |
| 3 | unified-billing-infrastructure-trd | 2026-06-15 | SPEC | API routes + entity schemas in Base44 |
| 4 | portal-billing-experience-master-prd | 2026-06-15 | SPEC | Portal billing page design spec |
| 5 | portal-billing-experience-trd | 2026-06-15 | SPEC | Portal API and entity design |
| 6 | portal-billing-experience-design | 2026-06-15 | SPEC | Aurora Glass design system for portal |
| 7 | portal-billing-experience-app-flow | 2026-06-15 | SPEC | Billing user journey state machine |
| 8 | portal-support-center-unified-hub-prd | 2026-06-13 | SPEC | Support center page in customer portal |
| 9 | portal-credit-report-and-navigation-prd | 2026-06-13 | SPEC | Credit report + navigation overhaul |
| 10 | nmi-billing-winning-formulas-prd | 2026-06-15 | IMPLEMENTED | NMI billing patterns captured in playbooks |
| 11 | nmi-billing-master-playbook | 2026-06-15 | IMPLEMENTED | Canonical NMI billing SOP |
| 12 | ticket-lifecycle-prd | 2026-05 | IMPLEMENTED | Ticket lifecycle in support system |
| 13 | streaming-gap-fix-prd | 2026-05 | IMPLEMENTED | Streaming smoothness improvements |
| 14 | prd-implementation-standard | 2026-05 | IMPLEMENTED | Standard for code-ready PRDs |
| 15 | mcp-edit-orchestration-v2 | 2026-05 | IMPLEMENTED | MCP edit fire→poll→detect→respond loop |
| 16 | mcp-edit-execution (v8) | 2026-05 | IMPLEMENTED | PRD bundle → MCP edit pipeline |
| 17 | mcp-edit-prd-driven | 2026-05 | IMPLEMENTED | PRD-referenced MCP edits |
| 18 | mcp-edit-prompt-engineering | 2026-05 | IMPLEMENTED | MCP edit prompt construction |
| 19 | mcp-edit-error-handling | 2026-05 | IMPLEMENTED | MCP error resilience |
| 20 | mcp-controlled-iteration-master | 2026-05 | IMPLEMENTED | Lane separation methodology |
| 21 | hyperswitch-master-expert | 2026-05 | IMPLEMENTED | HyperSwitch payment integration skill |
| 22 | hyperswitch-payment-playbooks | 2026-05 | IMPLEMENTED | Payment flow recipes |
| 23 | hyperswitch-payment-link-customization | 2026-05 | IMPLEMENTED | Payment link branding |
| 24 | k26-swarm-autonomous-engine | 2026-05 | IMPLEMENTED | K2.6 autonomous coding engine |
| 25 | god-mode-execution-protocol | 2026-05 | IMPLEMENTED | Execution protocol for mission-critical ops |
| 26 | dispatch-instruction-canonical-format | 2026-06 | IMPLEMENTED | VPS dispatch instruction format |
| 27 | deep-research-ingestion-mastery | 2026-05 | IMPLEMENTED | Research ingestion protocol |
| 28 | jarvis-os-clean-deploy | 2026-05 | IMPLEMENTED | Clean deploy workflow |
| 29 | inline-coding-skill | 2026-05 | IMPLEMENTED | Inline code editing skill |
| 30 | github-first-development | 2026-05 | IMPLEMENTED | GitHub-first dev pipeline |
| 31 | lane-b-end-to-end-mastery | 2026-05 | IMPLEMENTED | Lane B (GitHub) mastery |
| 32 | cross-session-context-continuity | 2026-05 | IMPLEMENTED | Context persistence across sessions |

### Implementation Coverage by PRD

- **Fully Implemented:** 25 PRDs (78%)
- **In Spec/Design Phase:** 5 PRDs (16%) — billing infrastructure, portal pages
- **In Progress:** 1 PRD (3%) — Phase 20 (this document)
- **Superseded:** 1 PRD (3%) — older MCP edit patterns replaced by v2

### Key Drifts (PRD vs Implementation)

| PRD | Drift | Severity | Action |
|-----|-------|----------|--------|
| portal-billing-experience | Portal not yet deployed on Vercel | MEDIUM | Deploy after Base44 billing unification |
| unified-billing-infrastructure | CollectJS form needs Base44 integration | MEDIUM | Wire into CRM customer pages |
| Phase 20 multi-model | Model-router.ts doesn't exist yet | HIGH | STREAM C of Phase 20 |

---

## ═══════════════════════════════════════════════════════════════
## SECTION 9: GAP ANALYSIS
## ═══════════════════════════════════════════════════════════════

### Critical Gaps (BLOCK production launch)

1. **No `/settings/models` page** — Users cannot configure per-task model preferences, view cost dashboards, or compare latency between models. REQUIRED for multi-model routing.

2. **No `lib/ai/model-router.ts`** — No intelligent routing logic exists. The model selector is purely user-driven. The system needs automatic task→model mapping (planning→Claude, coding→Kimi, long-context→GLM, multilingual→Qwen, general→DeepSeek).

3. **Missing model registrations** — GLM 5.2 (Zhipu), Kimi K2.7 (Moonshot), and Qwen 3 235B (Alibaba) are not registered in `lib/ai/models.ts`.

4. **V2 model selector missing** — The `spawnCodingAgent` tool has no model selection parameter for V2 sessions. V2 currently defaults to whatever the bridge passes.

5. **No multi-model cost tracking** — Without per-model cost dashboards, users can't optimize for cost.

### High Priority Gaps (SHOULD fix before launch)

6. **Model fallback chains** — When a model errors/timeout, there's no automatic fallback to another model. Gateway Pro supports this but it's not configured.

7. **Model capability caching** — `getCapabilities()` fetches from Gateway API with 24h `revalidate`. Newly added models won't show capabilities until cache expires.

8. **Mobile model selector** — The model picker UI may not be mobile-optimized for all screen sizes.

9. **Settings page route** — No `/settings` route exists in the app directory — only `/settings/models` is planned but neither exists.

### Medium Priority Gaps

10. **No A/B testing framework for models** — Cannot compare model quality side-by-side.

11. **No rate limit awareness in model router** — If a model hits rate limits, router doesn't know to switch.

12. **Artifact generation model selection** — Artifacts use the chat model, but different artifact types might benefit from different models.

13. **Progressive disclosure model awareness** — When in progressive mode, the agent can't discover which models are available.

### Low Priority / Nice-to-Have

14. **Model warm-up** — First call to a new model has cold-start latency.

15. **Token pricing sync** — Prices in `library_models` may drift from actual Gateway pricing.

16. **Model deprecation warnings** — No mechanism to warn users when a model is nearing deprecation.

### Bugs Identified

17. **Stream 204 no-op** — `GET /api/chat/[id]/stream` returns `204 No Content`. The SSE streaming appears to be handled differently (likely through the chat POST response itself).

18. **Title generation model mismatch** — `titleModel` uses `moonshotai/kimi-k2.5` but the gateway order is `["fireworks", "bedrock"]` which may not match.

19. **DeepSeek direct fallback** — When `DEEPSEEK_API_KEY` is not set, the graceful fallback constructs `deepseek/model-id` which may not match Gateway model IDs exactly.

---

## ═══════════════════════════════════════════════════════════════
## SECTION 10: PRODUCTION LAUNCH CHECKLIST (30+ ITEMS)
## ═══════════════════════════════════════════════════════════════

### Auth & Security
- [ ] 1. All 103 API routes have auth checks (no unprotected routes leaking data)
- [ ] 2. Internal token auth verified for V2 bridge endpoints
- [ ] 3. Webhook signature verification active for Vercel, HyperSwitch, GitHub
- [ ] 4. Rate limiting enabled on all public endpoints (Upstash Redis)
- [ ] 5. CORS configured correctly for production domains
- [ ] 6. Secrets audit: no hardcoded keys in source code (all in .env.local/Vercel env)
- [ ] 7. CSP headers configured (next.config.ts)

### Build & Deploy
- [ ] 8. `pnpm build` passes with 0 TypeScript errors
- [ ] 9. `pnpm lint` passes with 0 errors
- [ ] 10. `pnpm type-check` passes (separate from build)
- [ ] 11. Vercel deploy hook triggers correctly on git push to main
- [ ] 12. Preview deployments work for PR branches
- [ ] 13. Build size < 50MB (gzipped) for first-load JS

### Core Functionality
- [ ] 14. Chat: Send message → receive streaming response (all 7+ models)
- [ ] 15. Chat: Tools work (planSession, spawnCodingAgent, createDocument, etc.)
- [ ] 16. Chat: Artifact panel opens, edits, closes without errors
- [ ] 17. Chat: Checkpoint saves and resumes correctly
- [ ] 18. Chat: Abort stops in-progress generation

### V2 Handoff
- [ ] 19. spawnCodingAgent → V2 bridge → sandbox spawns → edits → PR created
- [ ] 20. V2 session SSE streaming shows real-time progress
- [ ] 21. V2 parallel sessions (2-4) work without interference
- [ ] 22. V2 handoff failure → graceful error message (not crash)

### Library & Canvas
- [ ] 23. Library tree loads all connectors, skills, functions, playbooks
- [ ] 24. All 9 canvas modes render without errors
- [ ] 25. Canvas search and filtering work correctly
- [ ] 26. Function detail shows correct signature, dependencies, constraints

### Multi-Model Routing (Phase 20)
- [ ] 27. Model selector in chat header shows all 15+ models
- [ ] 28. Intelligent routing maps tasks to correct models
- [ ] 29. GLM 5.2 — at least 1 successful chat completion
- [ ] 30. Kimi K2.7 — at least 1 successful chat completion
- [ ] 31. Qwen 3 235B — at least 1 successful chat completion
- [ ] 32. Model swap mid-conversation works without losing context
- [ ] 33. `/settings/models` page renders with cost dashboard
- [ ] 34. V2 spawn UI includes model selector

### Mobile
- [ ] 35. All chat pages responsive (320px min)
- [ ] 36. Bottom sheets work for canvas, connector detail, model picker
- [ ] 37. Touch targets ≥ 44px on all interactive elements

### Performance
- [ ] 38. Time to first byte < 1s on chat load
- [ ] 39. Streaming latency < 200ms for first token
- [ ] 40. Canvas mode switch < 300ms
- [ ] 41. Library search results < 500ms

### Observability
- [ ] 42. Langfuse tracing active for all LLM calls
- [ ] 43. Error tracking configured (Sentry or equivalent)
- [ ] 44. Vercel Analytics enabled for Web Vitals
- [ ] 45. Health check endpoint returns 200

### Documentation
- [ ] 46. NEPTUNE-AGENT-OS-MASTER-V1.md deployed and accessible
- [ ] 47. README.md updated with multi-model instructions
- [ ] 48. .env.example updated with new model env vars

---

## ═══════════════════════════════════════════════════════════════
## SECTION 11: MULTI-MODEL ROUTING SPECIFICATION
## ═══════════════════════════════════════════════════════════════

### 11.1 New Model Additions (Phase 20)

| Model ID | Name | Provider | Gateway Order | Primary Use Case |
|----------|------|----------|---------------|-----------------|
| `zhipuai/glm-5.2` | GLM 5.2 | Zhipu AI | `["zhipuai"]` | Long-context reasoning (200K tokens) |
| `moonshotai/kimi-k2.7` | Kimi K2.7 | Moonshot AI | `["moonshotai"]` | Coding & technical tasks |
| `alibaba/qwen3-235b` | Qwen 3 235B | Alibaba Cloud | `["alibaba"]` | Multilingual + complex reasoning |

### 11.2 Intelligent Router Specification (`lib/ai/model-router.ts`)

```typescript
// ── Task → Model Mapping ──────────────────────────────────────────

interface RoutingRule {
  taskType: TaskType;
  primaryModel: string;
  fallbackModel: string;
  reasoning: string;
}

type TaskType = 
  | "planning"        // Architecture, design, spec writing
  | "coding"          // Code generation, refactoring, bug fixes
  | "long_context"    // Large file analysis, multi-document synthesis
  | "multilingual"    // Non-English queries, translation
  | "fast_chat"       // Quick Q&A, simple responses
  | "tool_heavy"      // Multi-tool orchestration
  | "reasoning"       // Complex logic, math, analysis
  | "creative"        // Content creation, design ideas
  | "analysis"        // Data analysis, pattern recognition
  | "general";        // Catch-all

const ROUTING_RULES: RoutingRule[] = [
  {
    taskType: "planning",
    primaryModel: "anthropic/claude-sonnet-4-6",
    fallbackModel: "deepseek/deepseek-v4-pro",
    reasoning: "Claude Sonnet 4.6 excels at structured planning with clear reasoning chains"
  },
  {
    taskType: "coding",
    primaryModel: "moonshotai/kimi-k2.7",
    fallbackModel: "deepseek/deepseek-v4-pro",
    reasoning: "Kimi K2.7 is purpose-built for code generation and technical tasks"
  },
  {
    taskType: "long_context",
    primaryModel: "zhipuai/glm-5.2",
    fallbackModel: "deepseek/deepseek-v4-pro",
    reasoning: "GLM 5.2 handles 200K tokens natively with strong recall"
  },
  {
    taskType: "multilingual",
    primaryModel: "alibaba/qwen3-235b",
    fallbackModel: "deepseek/deepseek-v4-pro",
    reasoning: "Qwen 3 235B is trained on multilingual data across 100+ languages"
  },
  {
    taskType: "fast_chat",
    primaryModel: "deepseek/deepseek-v4-flash",
    fallbackModel: "deepseek/deepseek-v3.2",
    reasoning: "Fastest response times for simple queries"
  },
  {
    taskType: "tool_heavy",
    primaryModel: "deepseek/deepseek-v4-pro",
    fallbackModel: "anthropic/claude-sonnet-4-6",
    reasoning: "DeepSeek V4 Pro has strong tool-use capabilities with low cost"
  },
  {
    taskType: "reasoning",
    primaryModel: "deepseek/deepseek-v4-pro",
    fallbackModel: "alibaba/qwen3-235b",
    reasoning: "DeepSeek V4 Pro with reasoning effort for complex problems"
  },
  {
    taskType: "creative",
    primaryModel: "anthropic/claude-sonnet-4-6",
    fallbackModel: "alibaba/qwen3-235b",
    reasoning: "Claude excels at creative content and nuanced writing"
  },
  {
    taskType: "analysis",
    primaryModel: "deepseek/deepseek-v4-pro",
    fallbackModel: "zhipuai/glm-5.2",
    reasoning: "DeepSeek for structured analysis, GLM for very large datasets"
  },
  {
    taskType: "general",
    primaryModel: "deepseek/deepseek-v4-pro",
    fallbackModel: "deepseek/deepseek-v3.2",
    reasoning: "Default to DeepSeek V4 Pro — best cost/performance ratio"
  }
];

// ── Intent Detection → Task Type ───────────────────────────────────

function detectTaskType(userMessage: string, systemContext?: string): TaskType {
  const msg = userMessage.toLowerCase();
  
  // Planning signals
  if (/plan|design|architecture|spec|roadmap|structure|system design/i.test(msg)) {
    return "planning";
  }
  
  // Coding signals
  if (/code|build|implement|scaffold|component|function|api|route|fix|debug|refactor|bug/i.test(msg)) {
    return "coding";
  }
  
  // Long context signals
  if (/analyze.*file|review.*codebase|audit.*all|comprehensive|entire|whole.*repo/i.test(msg)) {
    return "long_context";
  }
  
  // Multilingual signals — Unicode range detection for non-ASCII
  if (/[^\x00-\x7F]/.test(userMessage) || /spanish|french|chinese|arabic|hindi|translate/i.test(msg)) {
    return "multilingual";
  }
  
  // Tool-heavy signals
  if (/using.*tools|with.*tool|and.*then|orchestrat|workflow|pipeline/i.test(msg)) {
    return "tool_heavy";
  }
  
  // Reasoning signals
  if (/why|explain|analyze|reason|logic|math|calculate|compare|evaluate|prove/i.test(msg)) {
    return "reasoning";
  }
  
  // Creative signals
  if (/write|create|story|blog|article|content|design.*idea|brainstorm|draft/i.test(msg)) {
    return "creative";
  }
  
  return "general";
}

// ── Model Router ───────────────────────────────────────────────────

export function routeModel(
  userMessage: string,
  systemContext?: string,
  preferredModel?: string
): { modelId: string; routed: boolean; reasoning: string } {
  // User explicitly selected a model → use it
  if (preferredModel) {
    return {
      modelId: preferredModel,
      routed: false,
      reasoning: "User selected model explicitly"
    };
  }
  
  const taskType = detectTaskType(userMessage, systemContext);
  const rule = ROUTING_RULES.find(r => r.taskType === taskType);
  
  if (!rule) {
    return {
      modelId: "deepseek/deepseek-v4-pro",
      routed: true,
      reasoning: "Default model — no matching routing rule"
    };
  }
  
  return {
    modelId: rule.primaryModel,
    routed: true,
    reasoning: `${taskType} → ${rule.primaryModel}: ${rule.reasoning}`
  };
}

export function getRoutingRule(taskType: TaskType): RoutingRule | undefined {
  return ROUTING_RULES.find(r => r.taskType === taskType);
}
```

### 11.3 Model Selector UI Updates

**Chat Header:**
- Existing model selector dropdown in `chat-header.tsx` with `model-selector.tsx`
- Add 3 new models: GLM 5.2, Kimi K2.7, Qwen 3 235B
- Add "Auto (Router)" option — let intelligent router choose
- Show small badge indicating routing reason when in auto mode

**V2 Spawn UI:**
- Add model selector in `spawnCodingAgent` invocation UI
- Default: `deepseek/deepseek-v4-pro` for coding
- Options: All coding-capable models (Kimi K2.7, DeepSeek V4 Pro, Claude Sonnet)

**Settings Page (`/settings/models`):**
- Per-task model preferences (override router defaults)
- Cost dashboard: per-model usage + cost over time
- Latency comparison: avg response time per model
- Token usage breakdown by model
- Enable/disable models from selector

### 11.4 Model Capabilities Matrix

| Model | Tools | Vision | Reasoning | Context Window | Best For |
|-------|-------|--------|-----------|---------------|----------|
| DeepSeek V4 Pro | ✅ | — | ✅ | 128K | General, Tool Use, Cost-Effective |
| DeepSeek V3.2 | ✅ | — | — | 128K | Fast Chat, Simple Tasks |
| DeepSeek V4 Flash | ✅ | ✅ | ✅ | 128K | Speed + Reasoning |
| DeepSeek R1 (Direct) | — | — | ✅ | 128K | Deep Reasoning |
| Claude Sonnet 4.6 | ✅ | ✅ | ✅ | 200K | Planning, Creative, Architecture |
| GLM 5.2 | ✅ | — | ✅ | 200K | Long Context, Document Analysis |
| Kimi K2.7 | ✅ | — | ✅ | 128K | Coding, Technical Tasks |
| Qwen 3 235B | ✅ | — | ✅ | 128K | Multilingual, Complex Reasoning |
| GPT OSS 20B | ✅ | — | ✅ | 32K | Compact, Fast |
| GPT OSS 120B | ✅ | — | ✅ | 128K | Balance of Size/Speed |
| Grok 4.1 Fast | ✅ | — | — | 128K | Fast, Non-Reasoning |
| Gemini 2.0 Flash | ✅ | ✅ | — | 1M | Multimodal, Large Context |

### 11.5 Fallback Chain Configuration

```
For each Gateway model, configure in Vercel AI Gateway:

GLM 5.2:
  Primary: zhipuai/glm-5.2
  Fallback: deepseek/deepseek-v4-pro
  Timeout: 30s

Kimi K2.7:
  Primary: moonshotai/kimi-k2.7
  Fallback: deepseek/deepseek-v4-pro
  Timeout: 60s (coding tasks can be longer)

Qwen 3 235B:
  Primary: alibaba/qwen3-235b
  Fallback: deepseek/deepseek-v4-pro
  Timeout: 30s
```

### 11.6 LIVE TEST Proof Requirements

For each new model, capture:
1. Model ID
2. Input prompt
3. Response text (first 200 chars)
4. Latency (ms)
5. Token count (in/out)
6. Success marker (true/false)
7. Timestamp (ISO 8601)

Save to: `/home/hermes/data/phase20_model_test_proof.json`

---

## ═══════════════════════════════════════════════════════════════
## SECTION 12: FUTURE ROADMAP (PHASE 21+)
## ═══════════════════════════════════════════════════════════════

### Phase 21: Model A/B Testing + Quality Monitoring
- Side-by-side model comparison
- Automated regression testing on evals
- Quality score tracking per model over time
- Alert on quality degradation

### Phase 22: Cost Optimization Engine
- Automatic model selection based on task complexity
- Budget caps per user/session
- Cost prediction before execution
- Cheapest-model-that-meets-quality-bar routing

### Phase 23: Advanced Workflow Platform
- Visual workflow builder with drag-and-drop
- Workflow marketplace (community templates)
- Scheduled/recurring workflows
- Workflow analytics dashboard

### Phase 24: Customer Portal Launch
- Deploy portal-billing-experience
- Deploy portal-support-center
- Deploy portal-credit-report
- Unify auth across Chat + Portal

### Phase 25: Enterprise Features
- Team workspaces
- Role-based access control (RBAC)
- Audit logging
- SSO integration
- Usage-based billing

### Phase 26: Agent Swarm
- Multi-agent collaborative coding
- Agent-to-agent communication
- Swarm leader election
- Distributed task decomposition

### Phase 27: Mobile App
- React Native mobile app
- Push notifications
- Offline support
- Mobile-first model selection

---

## APPENDIX A: File Reference Index

### Key Files to Know

| File | Purpose | Criticality |
|------|---------|------------|
| `lib/ai/models.ts` | Model registry — where new models are added | P0 |
| `lib/ai/providers.ts` | Model provider resolution | P0 |
| `lib/ai/model-router.ts` | NEW — intelligent task→model routing | P0 |
| `lib/ai/prompts.ts` | System prompt assembly | P0 |
| `app/(chat)/api/chat/route.ts` | Main chat endpoint (300s timeout) | P0 |
| `lib/db/schema.ts` | All 23 table definitions | P0 |
| `lib/v2/bridge.ts` | V2 handoff bridge | P1 |
| `lib/ai/tools/spawn-coding-agent.ts` | V2 spawn with planning support | P1 |
| `lib/ai/tools/plan-session.ts` | Formal planning mode | P1 |
| `components/chat/chat-header.tsx` | Chat header with model selector | P1 |
| `components/model-picker/model-library.tsx` | Model library grid | P1 |
| `lib/sandbox/manager.ts` | E2B sandbox lifecycle | P1 |
| `lib/workflow/engine.ts` | Durable workflow execution | P2 |
| `lib/ai/token-tracker.ts` | Token usage + checkpoint triggers | P2 |
| `lib/mcp/client.ts` | MCP client connection | P2 |
| `lib/connectors/registry.ts` | Connector registry | P2 |

---

## APPENDIX B: Glossary

| Term | Definition |
|------|-----------|
| **Agent OS** | The Neptune operating system — Chat (brain) + V2 (hands) + Library (knowledge) + Pipeline (orchestration) |
| **V2** | Neptune V2 — the sandboxed coding agent execution environment |
| **Handoff** | The act of Chat delegating a coding task to V2 |
| **Canvas** | The workspace UI that displays function, connector, skill, playbook, and workflow details |
| **Playbook** | A domain-specific Standard Operating Procedure (SOP) for the AI agent |
| **Skill** | A loaded instruction set from the cortex that provides specialized knowledge |
| **Connector** | An integration with an external service (GitHub, Slack, NMI, etc.) |
| **Progressive Disclosure** | Minimal context mode — agent discovers capabilities at runtime |
| **Gateway Pro** | Vercel AI Gateway with multi-model support and unified billing |
| **Library** | The knowledge graph of all functions, skills, connectors, and playbooks |
| **Plan Session** | Formal planning mode where the agent creates structured plans with phases + ACs |
| **V2 Session** | A single execution of a coding task in a V2 sandbox |
| **Checkpoint** | A saved snapshot of conversation state for resume/recovery |
| **Intelligent Router** | The system that auto-selects the best model for each task type |
| **Cortex** | The shared brain — 50+ skills stored in Base44's Jarvis FS |
| **PRD-to-Deploy** | The 8-step workflow from planning to live deployment |

---

---

## APPENDIX C: Complete Connector Catalog (Deep Dive)

### C.1 Base44 Connector
**Path:** `connectors/base44/`
**Domain:** CRM / Core Operations
**MCP Enabled:** Yes
**Tools:** entity_query, entity_get, entity_create, entity_update, b44_count, b44_stream, reporting_hub, cross_system_lookup, fs_read, fs_write, fs_search, query_cortex_graph, query_code_graph, create_task, emit_finding, emit_action
**Auth:** BASE44_API_KEY + BASE44_APP_ID
**Playbook:** Base operations CRM with entity management, reporting, and cross-system intelligence
**Key Functions:**
- `base44McpBridge` — MCP client for Base44 tools
- `reportingHubQuery` — Aggregate reporting across all entities
- `jarvisDataEngine` — Paginated data queries
- `jarvisFileSystem` — Cortex skill + PRD storage
**Usage:** Primary CRM backend — all customer operations, billing records, support tickets, agent actions flow through Base44

### C.2 GitHub Connector
**Path:** `connectors/github/`
**Domain:** Development / CI/CD
**MCP Enabled:** Yes
**Tools:** github_read, github_search, github_list_dir, github_context, github_create_pr, github_commit, github_push
**Auth:** GITHUB_TOKEN
**Playbook:** GitHub-first development pipeline — all code changes go through GitHub
**Key Functions:**
- `githubProxy` — GitHub API client
- `createPR` — Pull request creation with branch management
- `commitFiles` — Multi-file commit with message
**Usage:** V2 sandbox clones repos, Chat reads/search code, both create PRs

### C.3 Vercel Connector
**Path:** `connectors/vercel/`
**Domain:** Deployment
**MCP Enabled:** Yes
**Tools:** vercel_deploy, vercel_list_projects, vercel_get_deployment, vercel_webhook
**Auth:** VERCEL_TOKEN + VERCEL_TEAM_ID
**Playbook:** Vercel-native deployment pipeline
**Key Functions:**
- `vercelProxy.createDeployment` — Create and trigger deployment
- `pollDeployReady` — Poll until READY/ERROR
- `createVercelProject` — Programmatic project creation
**Usage:** Auto-deploy on PR merge, preview deploys for V2 sessions, project scaffolding

### C.4 Slack Connector
**Path:** `connectors/slack/`
**Domain:** Communications
**MCP Enabled:** Yes
**Tools:** post_message, post_thread, get_channel_history, get_user_info, react, update_message
**Auth:** SLACK_BOT_TOKEN
**Playbook:** Slack message delivery to #jarvis-admin (#C0AQDDC3HAB)
**Key Functions:**
- `slackMcpBridge` — Slack MCP client
- `slackLanding` — Formatted deployment notifications
**Usage:** ALL production notifications go here. NEVER #newleaf-admin. Landing cards with commit SHA, deploy URL, verification proof.

### C.5 NMI Connector
**Path:** `connectors/nmi/`
**Domain:** Billing / Payments
**MCP Enabled:** Yes
**Tools:** charge, refund, void, vault_create, vault_update, subscription_create, subscription_cancel, transaction_query, customer_vault_query
**Auth:** NMI_SECURITY_KEY + NMI_CONNECTOR_MCA_ID
**Playbook:** NMI Billing Master Playbook — CIT/MIT rules, vault operations, subscription management
**Critical Rules:**
- CIT (Customer Initiated Transaction) REQUIRES CVV + IP for first charge
- MIT (Merchant Initiated Transaction) — NO CVV, recurring only after CIT anchor
- source_transaction_id is BANNED — causes CVV validation failures (code 225)
- card_auth=1 + dup_seconds=0 REQUIRED on validate calls
- Golden Vault stores DPAN (network token) with customer_vault_id

### C.6 HyperSwitch Connector
**Path:** `connectors/hyperswitch/`
**Domain:** Payments / Checkout
**MCP Enabled:** Yes
**Tools:** payment_link_create, payment_intent, customer_create, subscription_create, webhook_verify
**Auth:** HYPERSWITCH_API_KEY + HYPERSWITCH_PROFILE_ID
**Playbook:** Payment link generation, hosted checkout, subscription management
**Key Functions:**
- `createPaymentLink` — Generate branded checkout URL
- `verifyWebhook` — Signature verification
- `reconciliationCheck` — Cross-reference NMI + HyperSwitch records

### C.7 Linear Connector
**Path:** `connectors/linear/`
**Domain:** Project Management
**MCP Enabled:** Yes
**Tools:** issue_create, issue_update, issue_search, sprint_list, team_list, comment_create
**Auth:** LINEAR_API_KEY
**Playbook:** Issue tracking and sprint management

### C.8 Vapi Connector
**Path:** `connectors/vapi/`
**Domain:** Voice AI
**Tools:** call_create, call_status, transcript_get
**Auth:** VAPI_API_KEY
**Usage:** AI phone calls for customer support, enrollment, payment collection

### C.9 GoHighLevel (GHL) Connector
**Path:** `connectors/ghl/`
**Domain:** Marketing Automation
**Auth:** GHL_API_KEY + GHL_LOCATION_ID
**Usage:** Lead tracking, campaign management, pipeline automation

### C.10 Forth Connector
**Path:** `connectors/forth/`
**Domain:** Credit Reports
**Auth:** FORTH_DPP_API_KEY
**Usage:** Credit report pulls, dispute tracking, credit monitoring

---

## APPENDIX D: Complete Playbook System

### D.1 Playbook Architecture

Playbooks are domain-specific Standard Operating Procedures. Each playbook defines:
1. **Domain Scope** — What types of tasks this playbook covers
2. **Trigger Conditions** — Keywords/regex that route to this playbook
3. **Routine Steps** — Deterministic step-by-step procedure
4. **Anti-Patterns** — What NOT to do (common mistakes)
5. **Edge Cases** — Special situations and their handling
6. **Connector Dependencies** — Which connectors are needed
7. **Validation Gates** — How to verify completion

### D.2 Playbook Inventory (18)

| # | Playbook | Domain | Priority | Status |
|---|----------|--------|----------|--------|
| 1 | PLAYBOOK-ROUTER.md | Router | P0 | ACTIVE |
| 2 | playbook-newleaf.md | NewLeaf Core | P0 | ACTIVE |
| 3 | billing | Billing Operations | P0 | ACTIVE |
| 4 | disputes | Credit Disputes | P0 | ACTIVE |
| 5 | customer-support | Support Triage | P1 | ACTIVE |
| 6 | code-review | Code Quality | P1 | ACTIVE |
| 7 | deploy-vercel-github | Deployment | P1 | ACTIVE |
| 8 | agent-orchestration | Agent Dispatch | P1 | ACTIVE |
| 9 | debugging-incident | Incident Response | P1 | ACTIVE |
| 10 | system-audit | Security Audit | P1 | ACTIVE |
| 11 | feature-build | Feature Development | P2 | ACTIVE |
| 12 | engineering | Engineering Standards | P2 | ACTIVE |
| 13 | planning-research | Planning & Research | P2 | ACTIVE |
| 14 | reporting | Reporting & Analytics | P2 | ACTIVE |
| 15 | vps-ops | VPS Operations | P2 | ACTIVE |
| 16 | vercel-discipline | Vercel Best Practices | P2 | ACTIVE |
| 17 | marketing | Marketing Operations | P2 | ACTIVE |
| 18 | HR | HR Operations | P2 | ACTIVE |

### D.3 PLAYBOOK-ROUTER.md (Intent Map)

The router maps 82 intent patterns to playbooks across 11 domains and 13 connectors:
- **Billing Flow:** "charge customer", "create subscription", "refund", "update card", "billing issue"
- **Credit Disputes:** "dispute", "credit report", "negative item", "Forth", "Equifax"
- **Customer Enrollment:** "new customer", "sign up", "onboarding", "enrollment", "wizard"
- **Support Triage:** "help", "issue", "problem", "not working", "stuck", "error"
- **Agent Payments:** "commission", "agent payout", "Jerry payment", "sales agent"
- **Reporting:** "report", "stats", "metrics", "dashboard", "analytics"
- **Customer Comms:** "email customer", "text", "SMS", "notify", "send message"
- **Lead Flow:** "lead", "prospect", "pipeline", "follow up", "cold"
- **MCP Edits:** "edit base44", "deploy to base44", "update CRM", "fix app"
- **Deploy Vercel:** "deploy", "ship", "launch", "push to prod", "vercel"
- **Code Review:** "review", "PR", "pull request", "code quality"
- **Debugging:** "debug", "fix", "broken", "bug", "crash"
- **System Audit:** "audit", "security", "check config", "verify"

### D.4 Skill Hierarchy

```
Skills are loaded in priority order:
1. Playbook Router → determines domain
2. Domain Playbook → provides SOP
3. Connector Skills → provides tool-specific instructions
4. Shared Skills → cross-cutting concerns
5. Bridge Skills → agent-to-agent communication
```

---

## APPENDIX E: Environment Variable Complete Reference

### E.1 By Service Category

**Vercel / Deployment:**
| Variable | Used In | Critical |
|----------|---------|----------|
| VERCEL_TOKEN | deploy, connector/vercel | P0 |
| VERCEL_API_TOKEN | deploy (alternate) | P1 |
| VERCEL_TEAM_ID | vercel API calls | P0 |
| VERCEL_PARTNER_TEAM_ID | vercel partner API | P1 |
| VERCEL_WEBHOOK_SECRET | webhook verification | P0 |
| VERCEL_OIDC_TOKEN | OIDC auth | P1 |
| NEPTUNE_V2_VERCEL_PROJECT_ID | V2 deploy target | P1 |
| NEPTUNE_V2_VERCEL_TEAM | V2 team ID | P1 |

**AI / LLM:**
| Variable | Used In | Critical |
|----------|---------|----------|
| AI_GATEWAY_API_KEY | Gateway Pro | P0 |
| DEEPSEEK_API_KEY | Direct DeepSeek | P0 |
| ANTHROPIC_API_KEY | Claude via Gateway | P1 |
| KIMI_API_KEY | Kimi K2.7 (NEW Phase 20) | P1 |
| OPENAI_API_KEY | GPT models (pending) | P2 |
| XAI_API_KEY | Grok (pending) | P2 |
| GROQ_API_KEY | Groq fallback (pending) | P2 |
| GOOGLE_API_KEY | Gemini (pending) | P2 |
| OLLAMA_KEY | Local LLM | P3 |

**Database / Cache:**
| Variable | Used In | Critical |
|----------|---------|----------|
| POSTGRES_URL | Primary DB (Neon/Supabase) | P0 |
| REDIS_URL | Cache (Upstash) | P0 |

**Auth:**
| Variable | Used In | Critical |
|----------|---------|----------|
| AUTH_SECRET | NextAuth encryption | P0 |
| BETTER_AUTH_SECRET | Better Auth encryption | P0 |
| CLERK_SECRET_KEY | Clerk auth (dev) | P2 |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Clerk frontend | P2 |

**Service Integration:**
| Variable | Used In | Critical |
|----------|---------|----------|
| BASE44_API_KEY | Base44 CRM | P0 |
| BASE44_APP_ID | Base44 app ID | P0 |
| BASE44_APP_API_KEY | Base44 app auth | P0 |
| NMI_SECURITY_KEY | NMI payments | P0 |
| NMI_CONNECTOR_MCA_ID | NMI merchant | P0 |
| HYPERSWITCH_API_KEY | Payments | P0 |
| HYPERSWITCH_PROFILE_ID | Payment profile | P0 |
| HYPERSWITCH_MERCHANT_ID | Merchant ID | P0 |
| HYPERSWITCH_PUBLISHABLE_KEY | Frontend payments | P1 |
| HYPERSWITCH_WEBHOOK_SECRET | Payment webhooks | P1 |
| SLACK_BOT_TOKEN | Slack integration | P0 |
| LINEAR_API_KEY | Linear PM | P1 |
| VAPI_API_KEY | Voice AI | P2 |
| GHL_API_KEY | GoHighLevel | P2 |
| FORTH_DPP_API_KEY | Credit reports | P1 |
| JDI_API_KEY | Ringless voicemail | P2 |
| SMITHERY_API_KEY | MCP marketplace | P2 |
| RESEND_API_KEY | Email delivery | P2 |
| GODADDY_API_KEY | Domain management | P2 |
| GODADDY_API_SECRET | Domain auth | P2 |

**Internal Services:**
| Variable | Used In | Critical |
|----------|---------|----------|
| NEPTUNE_INTERNAL_TOKEN | V2 bridge auth | P0 |
| NEPTUNE_V2_HANDOFF_SECRET | V2 handoff auth | P0 |
| NEPTUNE_V2_API_BASE | V2 API URL | P1 |
| OPEN_AGENTS_API_KEY | V2 API key | P1 |
| OPEN_AGENTS_URL | V2 URL | P1 |
| VPS_BRIDGE_TOKEN | VPS bridge auth | P1 |
| VPS_BRIDGE_URL | VPS bridge endpoint | P1 |
| HERMES_KEY | Hermes agent auth | P1 |
| DIAGNOSTICS_API_KEY | Diagnostics auth | P2 |
| WEBHOOK_SIGNING_SECRET | Webhook signing | P1 |

**Twenty CRM:**
| Variable | Used In | Critical |
|----------|---------|----------|
| TWENTY_SERVER_URL | CRM base URL | P2 |
| TWENTY_APP_SECRET | CRM encryption | P2 |
| TWENTY_DATABASE_PASSWORD | CRM DB | P2 |
| TWENTY_ENCRYPTION_KEY | CRM encryption | P2 |
| TWENTY_REDIS_URL | CRM cache | P2 |
| TWENTY_API_KEY_PLACEHOLDER | CRM API | P2 |

**n8n Workflow:**
| Variable | Used In | Critical |
|----------|---------|----------|
| N8N_API_KEY | n8n automation | P2 |
| N8N_BASIC_PASS | n8n auth | P2 |
| N8N_ENCRYPTION_KEY | n8n encryption | P2 |
| N8N_POSTGRES_PASS | n8n DB | P2 |
| N8N_USER_PASS | n8n user | P2 |

**Sandbox:**
| Variable | Used In | Critical |
|----------|---------|----------|
| E2B_API_KEY | E2B sandbox | P0 |
| E2B_ACCESS_TOKEN | E2B auth (alt) | P1 |
| E2B_JARVIS_TEMPLATE_ID | Sandbox template | P1 |
| E2B_DESKTOP_TEMPLATE_ID | Desktop template | P2 |

---

## APPENDIX F: Chat Route Request/Response Schema

### F.1 Request Schema (`app/(chat)/api/chat/schema.ts`)

```typescript
{
  id: string;                          // Chat session ID
  message: string;                     // User message text
  messages: ChatMessage[];             // Full conversation history
  selectedChatModel: string;           // Model ID from registry
  selectedVisibilityType: "public" | "private";  // Chat visibility
  attachments?: FileAttachment[];      // Optional file attachments
  sessionId?: string;                  // V2 session ID for context
}
```

### F.2 Response Flow

```
POST /api/chat → 
  1. Validate request body (Zod schema)
  2. Authenticate user (NextAuth session)
  3. Validate model ID (allowedModelIds Set)
  4. Check IP rate limit (Upstash Redis)
  5. Determine user type (entitlements gating)
  6. Load playbooks for intent (discoverActionGroup)
  7. Build system prompt (NEPTUNE.md + playbook context + router)
  8. Resolve language model (direct vs gateway)
  9. Stream response via AI SDK streamText()
     - Tool calls interleaved with text
     - Token tracking active
     - Checkpoint auto-save on context threshold
  10. Save messages to DB (Message_v2)
  11. Generate title (async, non-blocking)
  12. Return streaming response
```

### F.3 Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `bad_request:api` | 400 | Invalid request body |
| `unauthorized:chat` | 401 | No valid session |
| `rate_limited:ip` | 429 | IP rate limit exceeded |
| `invalid_model` | 400 | Model not in allowed set |
| `missing_tokens` | 400 | Required API keys not configured |

---

## APPENDIX G: Detailed Component Map

### G.1 Chat Components (52 total)

| Component | File | Purpose |
|-----------|------|---------|
| ChatLayoutClient | `chat-layout-client.tsx` | App shell layout with sidebar + main |
| ChatHeader | `chat-header.tsx` | Header bar with model selector |
| Messages | `messages.tsx` | Message list with streaming auto-scroll |
| Message | `message.tsx` | Single message bubble |
| MultimodalInput | `multimodal-input.tsx` | Rich text + file + slash commands |
| PromptInput | `prompt-input.tsx` | AI Elements prompt input wrapper |
| Artifact | `artifact.tsx` | Side panel for artifact viewing |
| ArtifactActions | `artifact-actions.tsx` | Artifact toolbar (copy, deploy, download) |
| ArtifactCloseButton | `artifact-close-button.tsx` | Close artifact panel |
| ArtifactMessages | `artifact-messages.tsx` | Messages scoped to artifact |
| CodeEditor | `code-editor.tsx` | Monaco-based code editor |
| TextEditor | `text-editor.tsx` | Rich text editor |
| SheetEditor | `sheet-editor.tsx` | Spreadsheet editor |
| ImageEditor | `image-editor.tsx` | Image preview + editor |
| Console | `console.tsx` | Console output display |
| Shell | `shell.tsx` | Terminal/shell output |
| DiffView | `diffview.tsx` | Side-by-side diff viewer |
| Preview | `preview.tsx` | Web preview iframe |
| DocumentPreview | `document-preview.tsx` | Document preview |
| DocumentSkeleton | `document-skeleton.tsx` | Loading skeleton |
| CreateArtifact | `create-artifact.tsx` | Artifact creation UI |
| DataStreamHandler | `data-stream-handler.tsx` | AI SDK stream processing |
| DataStreamProvider | `data-stream-provider.tsx` | Stream context provider |
| StreamingIndicator | `streaming-indicator.tsx` | Typing indicator during stream |
| StopButton | `stop-button.tsx` | Stop generation button |
| SubmitButton | `submit-button.tsx` | Send message button |
| SuggestedActions | `suggested-actions.tsx` | Quick action chips |
| MessageActions | `message-actions.tsx` | Copy, edit, retry, delete |
| MessageEditor | `message-editor.tsx` | Edit sent message |
| MessageReasoning | `message-reasoning.tsx` | Reasoning display |
| Suggestion | `suggestion.tsx` | AI suggestion display |
| ToolCallGrouper | `tool-call-grouper.tsx` | Group tool calls by type |
| ToolResultRenderer | `tool-result-renderer.tsx` | Render tool results |
| RoutineProgressCard | `routine-progress-card.tsx` | Playbook routine progress |
| HandoffTile | `handoff-tile.tsx` | V2 handoff status card |
| SandboxRunner | `sandbox-runner.tsx` | Sandbox execution UI |
| CommandPalette | `command-palette.tsx` | ⌘K command palette |
| SlashCommands | `slash-commands.tsx` | Slash command menu |
| ChatSettingsProvider | `chat-settings-provider.tsx` | Chat settings context |
| ChatStatusBar | `chat-status-bar.tsx` | Connection/model status |
| StreamErrorBoundary | `stream-error-boundary.tsx` | Stream error catch |
| PlanModeProposal | `plan-mode-proposal.tsx` | Plan display |
| PlaybookModProposal | `playbook-mod-proposal.tsx` | Playbook modification UI |
| V2LivePanel | `v2-live-panel.tsx` | V2 session live updates |
| MultiSessionPanel | `v2/multi-session-panel.tsx` | Multi-V2 session view |
| SidebarHistory | `sidebar-history.tsx` | Chat history sidebar |
| SidebarHistoryItem | `sidebar-history-item.tsx` | Single history item |
| SidebarToggle | `sidebar-toggle.tsx` | Sidebar open/close |
| SidebarUserNav | `sidebar-user-nav.tsx` | User menu in sidebar |
| AuthForm | `auth-form.tsx` | Login/register form |
| SignOutForm | `sign-out-form.tsx` | Sign out button |

### G.2 AI Elements Components (13)

| Component | Purpose |
|-----------|---------|
| Conversation | AI SDK conversation wrapper |
| Message | AI SDK message bubble |
| PromptInput | AI SDK prompt input |
| ModelSelector | AI SDK model selector |
| Reasoning | AI SDK reasoning display |
| Suggestion | AI SDK suggestion |
| Tool | AI SDK tool call display |
| CodeBlock | AI SDK code block |
| Terminal | AI SDK terminal output |
| WebPreview | AI SDK web preview |
| JSXPreview | AI SDK JSX preview |
| Shimmer | AI SDK loading shimmer |
| FileTree | AI SDK file tree |
| Agent | AI SDK agent display |

---

## APPENDIX H: Key Severity Classification

| Severity | Definition | Example |
|----------|-----------|---------|
| P0 / CRITICAL | Blocks production use, data loss risk | auth bypass, billing failure, crash loop |
| P1 / HIGH | Major feature broken, user impact | model selector not working, V2 handoff failure |
| P2 / MEDIUM | Degraded experience, edge case | missing mobile layout, slow canvas load |
| P3 / LOW | Nice to have, cosmetic | unused import, suboptimal animation |
| INFO | Observation, no action needed | documentation note |

---

## APPENDIX I: Neptune Chat Research Findings (Stream A Summary)

### I.1 Repository Statistics
- **Total TS/TSX Files (excl node_modules):** 318
- **API Routes:** 103
- **Components:** 170
- **Database Tables:** 23 (Drizzle definitions)
- **Connectors:** 16
- **Playbooks:** 18
- **Skills (cortex):** 50+
- **Shared Skills:** 6
- **Core Skills:** 5
- **Registered Models:** 11 (expanding to 15+)
- **Chat Tools:** 18+
- **Env Vars:** 93
- **Canvas Modes:** 9
- **Workflow Templates:** 5
- **Admin Pages:** 6
- **Test Files:** 30+

### I.2 Architecture Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Next.js 16 + App Router | Vercel-native, RSC support | Initial |
| Drizzle ORM over Prisma | Lighter, better TypeScript integration | Initial |
| Tailwind v4 | Utility-first, rapid UI | Initial |
| Vercel AI SDK v5 | Streaming, tool use, multi-model | Initial |
| PostgreSQL via Neon/Supabase | Serverless-friendly, pgvector support | Initial |
| E2B over self-hosted sandbox | Firecracker microVMs, managed | Initial |
| Progressive Disclosure | 100% eval pass rate vs 79% baseline | Phase 12.C |
| Playbook-First Architecture | SOP-driven agent behavior | Phase 12 |
| Plan Session Tool | Structured planning before execution | Phase 19 |
| Multi-V2 Sessions | Parallel coding for large scopes | Phase 19 |
| Aurora Glass Design | Dark surface, glass-morphism, cyan/emerald palette | Phase 4+ |

### I.3 Anti-Patterns Cataloged

| Anti-Pattern | Detection | Remediation |
|-------------|-----------|------------|
| Agent outputting code in chat instead of using tools | Message contains code blocks for self-modification | selfCode tool or spawnCodingAgent |
| Using source_transaction_id in NMI | Causes code 225 CVV validation failures | card_auth=1 + dup_seconds=0 pattern |
| Tool chaining (multiple tool calls in one response) | artifact tool called then immediately editDocument | One tool per response, stop after tool call |
| Skipping playbook load | Agent acts without playbook context | playbook auto-load in chat route |
| Posting to #newleaf-admin instead of #jarvis-admin | Wrong channel ID | Hardcoded #jarvis-admin channel C0AQDDC3HAB |
| hostingerBridge from VPS | 5-30s latency + Cloudflare 403 risk | Native Bash/Read/Write/Edit/Grep/Glob |
| Bypassing validation gates | Build fails but PR created anyway | Required validation before PR |

---

## APPENDIX J: Multi-Session V2 Orchestration Detail

### J.1 Parallel Session Lifecycle

```
spawnCodingAgent({ parallel: true, parallelCount: 3 })
│
├─ Session 1 → Sandbox A → Clone repo → Edit subset A → Validate → Commit
├─ Session 2 → Sandbox B → Clone repo → Edit subset B → Validate → Commit  
├─ Session 3 → Sandbox C → Clone repo → Edit subset C → Validate → Commit
│
└─ All complete → Merge results → Single PR → Vercel deploy → READY
```

### J.2 Session States

| State | Meaning | User-Visible |
|-------|---------|-------------|
| `spawning` | E2B sandbox being provisioned | Spinner in handoff-tile |
| `running` | Agent executing edits | Live stream in V2 panel |
| `validating` | Running build/lint/type-check | Progress bar |
| `committing` | Creating git commit | "Committing changes..." |
| `pr_created` | GitHub PR opened | PR URL + link |
| `deploying` | Vercel deploy in progress | Polling progress |
| `complete` | All steps done | Green checkmark + URLs |
| `failed` | Error at any step | Red X + error message |
| `cancelled` | User stopped session | Greyed out |

### J.3 Validation Pipeline

```
Session Edit Complete
    │
    ├─ 1. pnpm build ────── Fail → Auto-fix → Retry (max 3)
    │       │
    │       Pass
    │       ▼
    ├─ 2. pnpm lint ─────── Fail → Auto-fix → Retry (max 3)
    │       │
    │       Pass
    │       ▼
    ├─ 3. pnpm type-check ── Fail → Auto-fix → Retry (max 3)
    │       │
    │       Pass
    │       ▼
    ├─ 4. pnpm test ─────── Fail → Report (manual fix)
    │       │
    │       Pass
    │       ▼
    ├─ 5. smoke-deploy ──── Fail → Report (manual fix)
    │       │
    │       Pass
    │       ▼
    └─ Ready for PR
```

---

## APPENDIX K: Phase 20 Stream C Implementation Plan

### K.1 Files to Create
1. `lib/ai/model-router.ts` — Intelligent task→model routing
2. `app/(chat)/settings/models/page.tsx` — Model settings page
3. `app/(chat)/settings/layout.tsx` — Settings layout shell

### K.2 Files to Modify
1. `lib/ai/models.ts` — Add GLM 5.2, Kimi K2.7, Qwen 3 235B
2. `components/chat/chat-header.tsx` — Add "Auto (Router)" option
3. `components/model-picker/model-library.tsx` — Include new models
4. `app/(chat)/api/chat/route.ts` — Integrate model router
5. `app/(chat)/api/models/route.ts` — Return routing info

### K.3 New Model Definitions
```typescript
// GLM 5.2 — Zhipu AI, long-context reasoning
{
  id: "zhipuai/glm-5.2",
  name: "GLM 5.2",
  provider: "zhipuai",
  description: "Zhipu AI — 200K context, strong long-document reasoning",
  gatewayOrder: ["zhipuai"],
  routeType: "gateway",
},

// Kimi K2.7 — Moonshot AI, coding specialist
{
  id: "moonshotai/kimi-k2.7",
  name: "Kimi K2.7",
  provider: "moonshotai",
  description: "Moonshot AI coding specialist — technical tasks, code generation",
  gatewayOrder: ["moonshotai"],
  routeType: "gateway",
},

// Qwen 3 235B — Alibaba Cloud, multilingual + reasoning
{
  id: "alibaba/qwen3-235b",
  name: "Qwen 3 235B",
  provider: "alibaba",
  description: "Alibaba Cloud — 235B params, multilingual, complex reasoning",
  gatewayOrder: ["alibaba"],
  routeType: "gateway",
},
```

---

**Document Status:** CANONICAL V1
**Maintained By:** Hermes (Jarvis Agent OS)
**Next Update:** Post Phase 20 launch verification
**Cross-References:** See Section 8 for full PRD cross-reference matrix
**Companion Files:**
- `/home/hermes/data/phase20_research.json` — Raw research data
- `/home/hermes/data/phase20_model_test_proof.json` — Live model test results
- `/home/neptune/neptune-chat/docs/PHASE-20-VPS-DEEP-ANALYSIS.md` — VPS deep analysis
