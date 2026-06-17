---
type: "research"
name: "Neptune Chat Codebase Audit 2026 06 17"
description: "Auto-generated description for Neptune Chat Codebase Audit 2026 06 17"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Neptune Chat Codebase Audit — 2026-06-17

> **Phase:** Pre-Phase 33 baseline research
> **Project:** `prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl` at Vercel
> **Deploy URL:** `https://neptune-chat-ashy.vercel.app`
> **Scope:** Read-only structural audit, zero code changes

---

## 1. Codebase Size (cloc — excluding node_modules, .next)

| Language     | Files | Blank  | Comment | Code    |
|--------------|-------|--------|---------|---------|
| TypeScript   | 734   | 11,536 | 10,392  | 99,908  |
| JSON         | 120   | 28     | 0       | 21,331  |
| Markdown     | 253   | 4,300  | 0       | 18,774  |
| YAML         | 61    | 1,965  | 82      | 10,484  |
| SQL          | 16    | 113    | 216     | 1,036   |
| CSS          | 1     | 89     | 19      | 648     |
| JavaScript   | 2     | 56     | 12      | 415     |
| Python       | 2     | 74     | 61      | 355     |
| Shell        | 1     | 10     | 9       | 42      |
| Text         | 1     | 2      | 0       | 9       |
| **TOTAL**    | **1,191** | **18,173** | **10,791** | **153,002** |

**Key takeaway:** Massive TypeScript codebase (100K LOC), heavily documented (18.7K markdown), with significant configuration surface (21K JSON + 10K YAML). This is a mature Next.js 16 application.

---

## 2. App Router Structure (`app/`)

```
app/
├── (auth)/                   # Authentication group
│   ├── api/auth/             # Auth API (Better Auth v5)
│   ├── login/                # Login page
│   └── register/             # Registration page
├── (chat)/                   # Main chat group
│   ├── api/chat/, connectors/, context/, document/, files/
│   ├── api/history/, memory/, messages/, models/, playbooks/
│   ├── api/skills/, suggestions/, vote/
│   ├── api/v2/, v2-bridge/, v2-handoffs/, v2-sessions/, v2-webhooks/
│   ├── chat/[id]/            # Individual chat session
│   ├── capabilities/         # Capability discovery page
│   ├── connectors/, handoff/, integrations/
│   ├── knowledge/, library/ (8 sub-pages)
│   ├── memory/, playbooks/, reports/, secrets/
│   ├── sessions/, settings/, skills/
│   ├── telemetry/, tools/, vault/
│   ├── v2-sessions/[id]/     # V2 coding session viewer
│   ├── wiki/, workflows/     # PRD-to-deploy workflow
│   └── playbook-architecture/
├── (harness)/
│   └── command-center/       # Base44 Command Center
├── access-denied/            # 403 page
├── admin/
│   ├── agent-sim/            # Agent simulator
│   ├── audit/                # Audit logs
│   ├── connector-wizard/     # MCP connector wizard
│   ├── dashboard/            # Admin dashboard
│   ├── evals/                # Eval leaderboard
│   ├── function-inventory/   # Function inventory
│   ├── marketplace/          # Connector marketplace
│   └── migration/            # Data migration tools
└── api/ (106 route.ts files — see §4)
```

### Component Architecture (`components/`)

```
components/
├── agent/          # Agent UI components
├── ai-elements/    # AI SDK prompt-input, message rendering
├── artifact/       # Artifact/Coding Agent Run viewer
├── canvas/         # Canvas system (modes/, primitives/)
├── chat/           # Chat UI components
├── connectors/     # MCP connector config UI
├── crm/            # Twenty CRM integration UI
├── fusion/         # Multi-agent Fusion panels
├── generative/     # Generative cards (mission, handoff, connector)
│   └── field-renderers/
├── handoffs/       # V2 handoff UI
├── harness/        # Harness/Command Center components
├── library/        # Library browser (graph/tree)
├── model-picker/   # AI model selector
├── sidebar/        # App sidebar + archived version
├── ui/             # Shared UI primitives (shadcn/radix)
├── v2/             # V2 coding session components
├── wiki/           # Wiki viewer
└── workflow/       # Workflow graph (DAG) viewer
    ├── edges/
    └── nodes/
```

### Library Structure (`lib/`)

```
lib/
├── agent/          # Agent orchestration core
├── ai/             # AI SDK integration
│   ├── fusion/     # Multi-agent fusion engine
│   ├── routing/    # Intent routing + classification
│   ├── self-healing/  # Self-healing loop engine
│   └── tools/      # 25 declarative AI tools
├── artifacts/      # Coding agent artifact viewer
├── auth/           # Better Auth configuration
├── canvas/         # Canvas backend logic
├── connectors/     # MCP connector SDK (14 connectors)
│   ├── _legacy/
│   └── skills/
├── crm-actions/    # CRM action definitions
├── db/             # Drizzle ORM + schema + 17 migrations
│   ├── migrations/
│   └── seeds/
├── deploy/         # Vercel deploy pipeline
├── editor/         # Code editor libs (CodeMirror/ProseMirror)
├── harness/        # Command Center backend
├── knowledge/      # Knowledge graph extraction
├── marketplace/    # Connector marketplace
├── mcp/            # MCP protocol client
├── models/         # Model library + routing
├── motion/         # Framer Motion utilities
├── plan-mode/      # Plan/propose/approve mode
├── raw-logs/       # Raw LLM call logs
├── research/       # Research mission engine
├── sandbox/        # Vercel Sandbox execution
│   └── tools/
├── sentiment/      # Sentiment analysis
├── sync/           # Twenty CRM sync engine
├── twenty/         # Twenty CRM API client
├── utils/          # Shared utilities
├── v2/             # V2 Claude SDK runtime
└── workflow/       # Workflow engine
```

---

## 3. API Routes — 106 Total

```
app/api/admin/agent-sim/route.ts
app/api/admin/dashboard/route.ts
app/api/admin/function-inventory/route.ts
app/api/admin/vps-health/route.ts
app/api/annotations/digest/route.ts
app/api/annotations/route.ts
app/api/audit/route.ts
app/api/canvas/synthesize/[type]/[name]/route.ts
app/api/capabilities/route.ts
app/api/chat/abort/route.ts
app/api/connector-graph/route.ts
app/api/connectors/[name]/playbook/route.ts
app/api/connectors/route.ts
app/api/cron/refinement-loop/route.ts
app/api/diagnostics/route.ts
app/api/evals/leaderboard/route.ts
app/api/evals/route.ts
app/api/evals/run/route.ts
app/api/file-tree/route.ts
app/api/function-registry/route.ts
app/api/function-trace/route.ts
app/api/handoff-health/route.ts
app/api/health/route.ts
app/api/integrations/route.ts
app/api/knowledge/extract/route.ts
app/api/library/graph/route.ts
app/api/library/load/[type]/[name]/route.ts
app/api/library/log-usage/route.ts
app/api/library/model-usage/route.ts
app/api/library/models/[identifier]/route.ts
app/api/library/models/route.ts
app/api/library/reverse-refs/[type]/[name]/route.ts
app/api/library/skill/[name]/route.ts
app/api/library/tree/route.ts
app/api/marketplace/adopt/route.ts
app/api/marketplace/community-search/route.ts
app/api/marketplace/sandbox-test/route.ts
app/api/marketplace/vercel-search/route.ts
app/api/mcp/route.ts
app/api/mcp/tools/route.ts
app/api/missions/[id]/events/route.ts
app/api/missions/[id]/route.ts
app/api/missions/[id]/stream/route.ts
app/api/missions/route.ts
app/api/parallel-agents/route.ts
app/api/plan-mode/approve/route.ts
app/api/plan-mode/propose/route.ts
app/api/playbooks/approve-mod/route.ts
app/api/playbooks/list/route.ts
app/api/playbooks/load/route.ts
app/api/playbooks/propose-mod/route.ts
app/api/playbooks/revert-mod/route.ts
app/api/prds/route.ts
app/api/proxy/connector/route.ts
app/api/raw-logs/query/route.ts
app/api/raw-logs/stats/route.ts
app/api/research/execute/route.ts
app/api/research/status/route.ts
app/api/sandbox/stream/[id]/route.ts
app/api/secrets/audit/route.ts
app/api/self-healing/ingest/route.ts
app/api/shared-skills/route.ts
app/api/skill/[name]/[action]/route.ts
app/api/skill/[name]/route.ts
app/api/skills/[name]/route.ts
app/api/skills/route.ts
app/api/telemetry/route.ts
app/api/tools/route.ts
app/api/twenty-auth/route.ts
app/api/twenty-sync/route.ts
app/api/twenty-webhooks/route.ts
app/api/v2-bridge/cancel/route.ts
app/api/v2-bridge/route.ts
app/api/v2-bridge/stream/[sid]/route.ts
app/api/v2-handoffs/[id]/route.ts
app/api/v2-handoffs/[id]/stop/route.ts
app/api/v2-handoffs/[id]/stream/route.ts
app/api/v2-handoffs/route.ts
app/api/v2-sessions/test/route.ts
app/api/v2-webhooks/route.ts
app/api/v2/sessions/[sessionId]/control/route.ts
app/api/v2/sessions/[sessionId]/stream/route.ts
app/api/v2/sessions/route.ts
app/api/vault/route.ts
app/api/vault/test/[keyName]/route.ts
app/api/vercel/events/route.ts
app/api/vercel/webhook/route.ts
app/api/webhooks/deploy/route.ts
app/api/wiki/entity/[id]/route.ts
app/api/wiki/ingest/route.ts
app/api/wiki/route.ts
app/api/wiki/search/route.ts
app/api/wizard/adopt/route.ts
app/api/wizard/check-mcp/route.ts
app/api/wizard/discover-api/route.ts
app/api/wizard/generate-skill/route.ts
app/api/wizard/sandbox-test/route.ts
app/api/workflow/[id]/route.ts
app/api/workflow/generate/route.ts
app/api/workflow/run/route.ts
app/api/workflows/[id]/route.ts
app/api/workflows/[id]/run/route.ts
app/api/workflows/code-refactor/route.ts
app/api/workflows/data-audit/route.ts
app/api/workflows/research-swarm/route.ts
app/api/workflows/route.ts
```

---

## 4. AI Tools Inventory — 25 Declarative Tools

```
lib/ai/tools/create-document.ts        # Create wiki documents
lib/ai/tools/create-mission.ts         # Create research missions
lib/ai/tools/create-workflow.ts        # Create workflow definitions
lib/ai/tools/crm-action.ts             # Twenty CRM actions
lib/ai/tools/edit-document.ts          # Edit wiki documents
lib/ai/tools/get-customer-profile.ts   # Base44 customer lookup
lib/ai/tools/get-github-pr.ts          # GitHub PR info
lib/ai/tools/get-nmi-transaction.ts    # NMI payment transaction
lib/ai/tools/get-v2-session.ts         # V2 coding session status
lib/ai/tools/get-vapi-call.ts          # VAPI voice call data
lib/ai/tools/get-vercel-deploy.ts      # Vercel deployment info
lib/ai/tools/get-weather.ts            # Weather data
lib/ai/tools/graph-query.ts            # Knowledge graph queries
lib/ai/tools/list-v2-sessions.ts       # List V2 coding sessions
lib/ai/tools/load-skill.ts             # Dynamic skill loading
lib/ai/tools/plan-session.ts           # Plan/create V2 sessions
lib/ai/tools/progressive-disclosure.ts # Progressive UI disclosure
lib/ai/tools/pull-slack-thread.ts      # Slack thread data
lib/ai/tools/query-knowledge.ts        # Knowledge base queries
lib/ai/tools/request-suggestions.ts    # AI suggestion requests
lib/ai/tools/self-code.ts              # Self-modifying code
lib/ai/tools/spawn-coding-agent.ts     # Spawn Claude Code agent
lib/ai/tools/stream-v2-progress.ts     # Stream V2 session progress
lib/ai/tools/swarm-dispatch.ts         # Swarm dispatch
lib/ai/tools/update-document.ts        # Update wiki documents
lib/ai/tools/view-file.ts              # File system viewer
```

---

## 5. Generative Components

```
components/generative/
├── card-router.tsx              (2.9 KB)  # Card routing logic
├── handoff-card.tsx            (12.3 KB)  # V2 handoff session card
├── mission-card.tsx            (25.0 KB)  # Research mission card (largest)
├── universal-connector-card.tsx(13.7 KB)  # Universal connector card
└── field-renderers/             # Dynamic field renderers
```

---

## 6. Database Schema — 25 Tables across 17 Migrations

### Core Tables
- `User` — Better Auth v5: email, password, name, emailVerified, isAnonymous, createdAt
- `Chat` — Sessions: title, userId, visibility, parentChatId, checkpointId
- `Message_v2` — Messages: parts (JSON), attachments, tokenCount, artifactSpec, artifactModel, artifactDraft, streamPosition
- `Vote_v2` — Upvote/downvote per chat+message
- `Document` — Wiki: title, content, kind (text/code/image/sheet)
- `Suggestion` — Doc suggestions with original/suggested text
- `Stream` — Chat streaming session → chat link
- `SandboxRun` — Vercel Sandbox: sandboxId, userId, toolName, runtime, status, stdout, stderr

### Handoff & Resilience
- `handoff_sessions` — V2 coding: repo, goal, v2SessionId, v2SandboxId, status, prUrl, deployUrl
- `chat_checkpoints` — Auto-saved: reason, tokenCount, usagePercent, conversationSummary, messageIds

### Library Graph (Phases 12–19)
- `library_connectors` — Connector catalog: domain, mcpEnabled, tools, dependencies, version
- `library_skills` — Skills registry: type, connectorName, contextTokensEstimated, typicalLatencyMs, costPerInvocationUsd
- `library_functions` — Functions: signature, skillName, domain, constraint-aware columns
- `library_playbooks` — Playbooks: type, scopeConnectors, triggers, workflows
- `library_workflows` — Workflow definitions: playbookName, durable flag
- `library_edges` — Knowledge graph: fromNode/fromType → toNode/toType, edgeType, weight
- `library_usage_logs` — Skill usage: sessionId, skillLoaded, successMarker, tokensActual, latencyActualMs, costActualUsd

### Models & Evals
- `library_models` — Model catalog: provider, family, contextWindowTokens, maxOutputTokens, pricing per million, capabilities, reasoningScore, codingScore, visionScore, speedScore, costScore
- `library_model_usage_logs` — Per-model: tokensIn/Out, latencyMs, costUsd, successMarker, userRating
- `library_evals` — Eval definitions: query, expectedSkills, expectedConnectors, expectedModel, severity
- `library_eval_runs` — Eval execution: skillsLoaded, modelUsed, qualityGrade, qualityScore, subScores

### Planning & Fusion (Phases 19–23A)
- `library_plans` — Planning sessions: title, summary, phases, acceptanceCriteria, filesAffected
- `library_v2_sessions` — V2 coding: planId, sessionId, status, progress, parallelGroup, prUrl, deployUrl
- `library_panel_presets` — Fusion panels: agents, judge, capabilities, defaultMode, estCostMin/Max
- `library_panel_runs` — Panel execution: presetId, sessionId, executionMode, modeDecision

---

## 7. Connector Ecosystem

### 14 Connector Skills
```
base44/          forth-dpp/        freshcaller/      ghl/
github/          hostinger-vps/    hyperswitch/      nmi/
resend/          slack/            twenty-crm/       vapi/
vercel/          weather/
```

### 17 Playbook Domains
```
agent-orchestration/    billing/        customer-support/
disputes/               engineering/    hr/
marketing/              other/          planning/
reporting/              sales/          video-generation/
PLAYBOOK-AUDIT.md       manifest-index.yaml     manifest-newleaf.yaml
playbook-index.md       playbook-newleaf.md
```

---

## 8. Tech Stack

**Runtime:** Next.js 16.2.0 (Turbopack), React 19.0.1, Node.js, pnpm 10.32.1

**AI/LLM:** `ai` v6.0.116, `@ai-sdk/react` v3.0.118, `@ai-sdk/mcp` v1.0.46, `@ai-sdk/workflow`, 9 providers

**Data:** Drizzle ORM v0.34.0, `@vercel/postgres` v0.10.0, Redis v5.0.0, `@vercel/blob` v0.24.1

**Frontend:** Radix UI v1.4.3, Tailwind CSS v4.1.13, Framer Motion v11.3.19, Streamdown v2.3.0, Shiki v3.21.0, CodeMirror v6, ProseMirror v1.34.3, React Flow v12.11.0, react-force-graph v1.29.1, Zustand v5.0.14, SWR v2.2.5

**Auth:** Better Auth v5.0.0-beta.25, bcrypt-ts v5.0.2, Zod v3.25.76

**Testing/Linting:** Biome v2.3.11, Playwright v1.50.1, TypeScript v5.6.3

**Integrations:** `@slack/web-api` v7.16.0, `@base44/sdk` v0.8.31, `@neptune/core` v0.1.0 (vendored)

---

## 9. Vercel Environment — 94 Variables

| Category | Count | Keys (sanitized) |
|----------|-------|------------------|
| Auth | 6 | AUTH_SECRET, AUTH_TRUST_HOST, AUTH_URL, BETTER_AUTH_SECRET, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY |
| AI Providers | 9 | ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, XAI_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, KIMI_API_KEY, ZHIPU_API_KEY, OLLAMA_KEY |
| Infrastructure | 6 | POSTGRES_URL, REDIS_URL, BLOB_READ_WRITE_TOKEN, AI_GATEWAY_API_KEY, VPS_BRIDGE_URL, VPS_BRIDGE_TOKEN |
| Vercel | 6 | VERCEL_TOKEN, VERCEL_API_TOKEN, VERCEL_PARTNER_TEAM_ID, VERCEL_WEBHOOK_SECRET, VERCEL_OIDC_TOKEN, WEBHOOK_SIGNING_SECRET |
| Neptune V2 | 6 | NEPTUNE_V2_API_BASE, NEPTUNE_V2_POSTGRES_URL, NEPTUNE_V2_VERCEL_TEAM, NEPTUNE_V2_VERCEL_PROJECT_ID, NEPTUNE_V2_BETTER_AUTH_SECRET, NEPTUNE_V2_HANDOFF_SECRET |
| Twenty CRM | 5 | TWENTY_SERVER_URL, TWENTY_DATABASE_PASSWORD, TWENTY_ENCRYPTION_KEY, TWENTY_APP_SECRET, TWENTY_REDIS_URL |
| Payments | 9 | NMI_SECURITY_KEY, NMI_CONNECTOR_MCA_ID, HYPERSWITCH_* (7 vars) |
| Integrations | 17 | SLACK_BOT_TOKEN, GITHUB_TOKEN, LINEAR_API_KEY, GHL_API_KEY, GHL_LOCATION_ID, RESEND_API_KEY, VAPI_API_KEY, FORTH_DPP_API_KEY, N8N_* (5), E2B_* (3), SMITHERY_API_KEY, HOSTINGER_API_KEY, GODADDY_*, SWAMI_*, BASE44_* |
| Internal | 8 | NEPTUNE_INTERNAL_TOKEN, NEPTUNE_TEST_TOKEN, DIAGNOSTICS_API_KEY, OPEN_AGENTS_*, JDI_API_KEY, HERMES_KEY, APP_BASE_URL |
| Slack Channels | 2 | JARVIS_ADMIN_CHANNEL_ID, NEWLEAF_ADMIN_CHANNEL_ID |
| Other | 4 | AFFY_API_KEY, TWENTYFIRST_API_KEY |

**Security:** 88/94 vars encrypted at rest; 6 plaintext (non-secrets: URLs, IDs). No secrets exposed.

---

## 10. Key Architecture Observations

1. **Modular Connector System** — 14 connector skills with standardized SKILL.md + playbook indexing
2. **Two-Lane Agent Architecture** — V1 (Next.js API chat) + V2 (Claude SDK coding via `v2-bridge/`)
3. **Library Graph** — 25-table schema mapping connectors→skills→functions→workflows with constraint-aware routing
4. **Fusion Panels** — Multi-agent deliberation (council/debate/hierarchy), panel presets, cost estimation
5. **Self-Healing Loop** — Refinement cron (`/api/cron/refinement-loop`) ingests telemetry to improve routing
6. **Context Window Management** — Chat checkpoints auto-save at context limits
7. **Extensible AI Tools** — 25 declarative tools with progressive disclosure pattern
8. **Vercel-Native Stack** — Postgres Neon, Redis Upstash, Blob, Sandbox, Analytics, OTEL
9. **Testing Gap** — Playwright E2E only — no unit test framework (Jest/Vitest)
10. **Monorepo Scale** — 153K LOC in single Next.js app — cold starts a concern

---

## 11. Risks Identified

| Risk | Severity | Detail |
|------|----------|--------|
| Vercel cold starts | High | 153K LOC TS + 17 DB migrations at build time |
| Secret sprawl | Medium | 94 Vercel env vars + 88 in .env.local — dual rotation surface |
| No unit tests | Medium | Only Playwright E2E, no Vitest/Jest |
| Schema drift | Medium | 17 migrations over rapid development — seed scripts may lag |
| Monolithic app | Medium | Chat + Admin + Harness + Library in single Next.js app |
| Webhook security | Low | WEBHOOK_SIGNING_SECRET exists but enforcement coverage unknown |
| Build-time DB ops | Low | Prebuild runs seed-library + validate-playbooks scripts |

---

*Generated 2026-06-17 · Neptune Chat Codebase Audit · Stream 0 of 7 · Read-only*
