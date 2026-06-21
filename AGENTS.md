# AGENTS.md — Neptune Chat

> Schema document for the Neptune Chat codebase.
> Read before making changes. Updated on every major feature add.

Last updated: 2026-06-21
Repository: abhiswami2121/neptune-chat
Deployment: Vercel → https://neptune-chat-ashy.vercel.app
Latest commit: be260a2 — Connector Fortress (Phase 2-6 landing)

## ARCHITECTURE

```
neptune-chat/
├── app/                        # Next.js 16 App Router pages
│   ├── layout.tsx              # Root layout — SidebarProvider + TooltipProvider
│   ├── page.tsx                # Redirect to /chat
│   ├── chat/                   # /chat — main chat interface
│   ├── connectors/             # /connectors — connector grid + detail
│   ├── tools/                  # /tools — tool catalog (auto from registry)
│   ├── wiki/                   # /wiki — Karpathy second brain
│   ├── workflows/              # /workflows — sandbox workflow runs
│   ├── reports/                # /reports — reporting hub
│   ├── secrets/                # /secrets — env key management
│   ├── skills/                 # /skills — cortex skill viewer
│   ├── knowledge/              # /knowledge — cortex memory viewer
│   └── api/                    # API routes
│       ├── chat/               # POST /api/chat — streamText endpoint
│       ├── auth/               # Auth routes
│       ├── sandbox/            # Sandbox proxy
│       └── github/             # GitHub webhooks
├── components/
│   ├── ui/                     # shadcn UI primitives (27 components)
│   ├── sidebar/                # NeptuneSidebar
│   ├── connectors/             # ConnectorCard, ConnectorDetailSheet
│   ├── chat/                   # Chat layout components
│   └── wiki/                   # Wiki page components
├── lib/
│   ├── ai/                     # AI provider config, tools, prompts
│   │   ├── providers.ts        # LLM provider setup
│   │   ├── prompts.ts          # System prompts
│   │   ├── tools/              # Agent tools (spawnCodingAgent, etc)
│   │   └── models.ts          # Model definitions
│   ├── connectors/             # Connector registry + 9 connectors
│   │   ├── types.ts            # ConnectorManifest interface
│   │   ├── registry.ts         # Connector registry
│   │   ├── init.ts             # Auto-init on import
│   │   ├── slack/              # Slack connector
│   │   ├── nmi/                # NMI payments connector
│   │   ├── base44/             # Base44 entity connector
│   │   ├── hyperswitch/        # Hyperswitch payments connector
│   │   ├── github/             # GitHub connector
│   │   ├── linear/             # Linear connector
│   │   ├── forth/              # Forth DPP connector
│   │   ├── vapi/               # Vapi voice connector
│   │   └── mcp-hub/            # MCP aggregator connector
│   ├── sandbox/                # E2B Sandbox SDK
│   ├── v2/                     # neptune-v2 bridge
│   ├── mcp/                    # MCP client
│   ├── agent/                  # Agent loop + inline tools
│   ├── artifacts/              # Artifact renderers
│   └── db/                     # SQLite/Drizzle
└── public/                     # Static assets
```

## TECH STACK

- **Framework**: Next.js 16 (App Router) + Turbopack
- **UI**: shadcn/ui (Tailwind v3), framer-motion, Lucide icons
- **AI**: Vercel AI SDK 6 (`ai` package), streamText
- **State**: React Context, no external state lib
- **Sandbox**: E2B Sandbox SDK (self-hosted compatible)
- **DB**: libSQL (Turso) + Drizzle ORM
- **Auth**: Better Auth (Clerk fallback)
- **Deploy**: Vercel, `pnpm build`

## COMMANDS

```bash
# Development
pnpm dev              # Start dev server (Turbopack)

# Quality
pnpm format           # Prettier format
pnpm type-check       # TypeScript check (0 errors required)
pnpm lint             # ESLint

# Build
pnpm build            # Production build (MUST pass before deploy)
pnpm start            # Start production server

# Testing
pnpm test             # Vitest unit tests
npx playwright test   # Playwright visual tests

# UI
npx shadcn@latest add <component>  # Add shadcn component
```

## CODING CONVENTIONS

### Components
- ALL UI components are function components (no classes)
- Client components: `"use client"` directive at top
- NEVER pass server components as children to client components
- Props interface: `interface NameComponentProps { ... }`

### Styling
- Tailwind classes ONLY. NO inline styles.
- Use shadcn design tokens: `bg-muted`, `text-foreground`, `border-border`
- connector brandColor → CSS `style={{ backgroundColor: brandColor + '15' }}`
- Mobile-first: default styles for mobile, `md:` for desktop
- NO horizontal scroll. EVER. `overflow-x-hidden` on body.

### Connectors
- Every connector has: `manifest.ts` + `tools/` + `result-renderers/` + `playbook.mdx`
- Tools use Vercel AI SDK `tool()` with Zod schemas
- Tools are lazy-loaded via `toolModule: () => import("./tools")`
- `getStatus()` checks env vars via `checkConnectorEnv()`
- Connector capabilities are auto-derived from manifest

### TypeScript
- Strict mode ON
- No `any` types (use `unknown` or generics)
- Export types from `types.ts` at each module level
- Lucide icon types: `ComponentType<Record<string, unknown>>`

### Git
- One commit per phase
- Commit messages: `<type>: <description>` (feat, fix, refactor, chore)
- NEVER commit `.env` or secrets
- Branch: `main`, push to `origin`

## ENVIRONMENT VARIABLES

Required for Vercel:
```
SLACK_BOT_TOKEN          # Slack bot auth
NEWLEAF_ADMIN_CHANNEL_ID  #C096PSS45Q9
JARVIS_ADMIN_CHANNEL_ID   #C0AQDDC3HAB
BASE44_API_KEY            # Base44 service token
GITHUB_TOKEN              # GitHub PAT for repo operations
OPEN_AGENTS_API_KEY       # neptune-v2 API key
```

Optional connectors:
```
LINEAR_API_KEY            # Linear
NMI_SECURITY_KEY          # NMI
HYPERSWITCH_API_KEY       # Hyperswitch
```

## V2 BRIDGE

`lib/v2/bridge.ts` handles bidirectional communication with neptune-v2:
- Chat → V2: `spawnCodingAgent` tool spawns sandbox runs
- V2 → Chat: progress streaming via SSE on `/api/sandbox/status`
- V2 → Chat: PR card rendering when V2 opens PRs

## PLAYBOOK SKILLS & WORKFLOWS

### NameResolver (`playbook-skills/connectors/name-resolver/`)
Resolves Slack customer names → Base44 profiles → NMI vault IDs. Essential for any workflow that connects Slack mentions to billing data.

```typescript
import { nameResolver } from "@/playbook-skills/connectors/name-resolver";
const result = await nameResolver.resolve("Mary Nazworth");
const bulk = await nameResolver.resolveMany(["Mary Nazworth", "Zachary Taylor"]);
```

See: `playbook-skills/connectors/name-resolver/SKILL.md`

### Billing Alignment (`app/api/workflows/billing-alignment/route.ts`)
Cross-references Slack billing requests against NMI subscription state. 5-step pipeline: Slack pull → name extraction → identity resolution → NMI query → alignment categorization.

Endpoint: `POST /api/workflows/billing-alignment`
```json
{ "lookbackDays": 7, "channelId": "C0AQDDC3HAB" }
```

### Multi-Source Puller (`lib/discovery/multi-source-puller.ts`)
Parallel pull of Base44 + NMI + Warehouse data for customer lists. Uses caching layer to avoid redundant API calls.

### Playbook Router (`playbooks/billing/routines.json`)
Routines trigger discovery workflows from chat keywords. Add new routines with `trigger_keywords`, `steps`, and `domain` fields.

## CONNECTOR WIRING RULES

### VPS Bridge
- URL: `VPS_BRIDGE_URL=http://187.127.250.171:8400` (NOT :8101 or :8102)
- Auth: `NEPTUNE_INTERNAL_TOKEN`
- Never use `BASE44_BRIDGE_URL` or `BASE44_DIAG_KEY` — these don't exist

### NMI MCP Bridge Actions (CORRECT names)
| Action | Purpose |
|--------|---------|
| `query_vault` | Customer vault + subscription state |
| `query_subscription` | Single subscription details |
| `query_transactions` | Transaction history |

### Base44 Client
- Graceful degradation via Proxy stub when `BASE44_API_KEY` is missing
- Never `throw new Error()` at module load — use conditional checks
- Valid key: `BASE44_API_KEY=336ada860f0648a98e62113cd62c8055`

## KNOWN ANTI-PATTERNS

1. **hostingerBridge**: Never call from VPS. Use native Bash/Read/Write.
2. **source_transaction_id**: Never pass in NMI MIT charges.
3. **BASE44_BRIDGE_URL / BASE44_DIAG_KEY**: Don't exist. Use VPS_BRIDGE_URL + NEPTUNE_INTERNAL_TOKEN.
4. **customer_vault_query / transaction_query / subscription_query**: Wrong NMI action names. Use query_vault / query_transactions / query_subscription.
5. **force-dynamic**: Incompatible with cacheComponents experiment.
6. **Horizontal scroll**: Never. Test at 375px width.
7. **Nested Sheets/Drawers**: Never. Use Tabs for sub-navigation.
8. **Inline styles**: Never. Use Tailwind + shadcn tokens.

## AGENTIC ENGINEERING SKILLS (Pocock-Inspired)

This repo includes engineering skills based on Matt Pocock's 7-phase agentic engineering framework (aihero.dev). The KEY INNOVATION is **Automated Grill** — the agent self-answers design tree questions by exploring the codebase, checking git history, reading docs, and inspecting connected services. Only truly unanswerable questions reach a human.

Run `/grill` before ANY feature work. Use `/handoff` to pass structured context to V2 coding sessions.

### Skills: `lib/connectors/skills/pocock-engineering/`

| Skill | Phase | Trigger |
|-------|-------|---------|
| `automated-grill` | 1 — GRILL | `/grill`, `/grill-me` |
| `grill-with-docs` | 2 — RESEARCH | `/grill-with-docs`, `/domain-grill` |
| `prototype` | 3 — PROTOTYPE | `/prototype` |
| `to-prd` | 4 — PRD | `/to-prd`, `/prd` |
| `to-issues` | 5 — PLAN | `/to-issues`, `/plan` |
| `tdd` | 6 — BUILD | `/tdd`, `red-green-refactor` |
| `improve-codebase-architecture` | 6+ — REFACTOR | `/improve-architecture`, `/deepen` |
| `handoff` | 6-7 — HANDOFF | `/handoff` |

### Engines
- `lib/connectors/skills/pocock-engineering/automated-grill.ts` — Self-answering design tree engine (3 modes: Self-Grill, Multi-Agent, Human-in-the-Loop)
- `lib/connectors/skills/pocock-engineering/handoff.ts` — V2 context compression and prompt generation

### Master Playbook
- `playbooks/agentic-engineering/PLAYBOOK.md` — Full 7-phase pipeline with quality gates

### Quick Reference
```
/grill → /to-prd → /to-issues → /handoff (to V2) → /tdd (on V2) → /qa
```

## DESIGN SYSTEM

Design mastery skill: `/home/hermes/cortex/skills/nextjs-shadcn-ai-elements-design-mastery.md`
Master PRD: `jarvis/prd/neptune-chat-mobile-ia-wiki-master-v1.md`

END OF AGENTS.md
