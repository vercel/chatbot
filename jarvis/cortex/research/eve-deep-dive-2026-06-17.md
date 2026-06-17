# Eve Deep Dive — Vercel's Agent Framework (June 17, 2026)

**Version studied:** eve@0.11.4 (npm), monorepo root 0.0.0
**Repo cloned:** /home/neptune/eve-reference/
**Release date:** TODAY — June 17, 2026
**License:** Apache-2.0
**Research by:** Hermes V5.0, EVE ALIGNMENT MASTER mission

---

## 1. EXECUTIVE SUMMARY

Eve is a **filesystem-first framework for durable backend AI agents** built by Vercel. Its tagline: "Like Next.js for web apps, but for agents." The core philosophy: the filesystem IS the authoring interface — everything (instructions, tools, skills, channels, subagents, schedules, connections) is a file or directory at a conventional path. No config files, no YAML manifests, no code gen needed at author time.

**Key architecture patterns:**
- **Filesystem identity:** Tool names = file slugs, not authored strings
- **Compile-time extraction:** Eve's compiler reads the filesystem, derives types, generates the deployable bundle
- **Workflow SDK durability:** All agent sessions are durable (persisted, resumable)
- **TypeScript-first:** Tools, channels, schedules, connections all typed with Zod/Standard Schema
- **Vercel-native:** Sandbox (Firecracker microVMs), OAuth (Vercel Connect), Deploy (Vercel), Tracing (OpenTelemetry), AI Gateway (model routing)
- **Pre-1.0:** Breaking changes preferred over backward compat. Version 0.11.4.

---

## 2. COMPLETE API SURFACE

### 2.1 `defineAgent({})` — Agent Configuration
**Location:** `agent/agent.ts`
**Import:** `import { defineAgent } from "eve";`

The agent identity function. Takes an `AgentDefinition` with:
- `model` (required): Language model — AI Gateway ID or any AI SDK-compatible model. Default: `anthropic/claude-opus-4.8`
- `description` (optional): Human-readable purpose. Required for subagents.
- `modelOptions` (optional): Temperature, maxTokens, topP, etc.
- `compaction` (optional): Context window compaction strategy. Configures: `reserveTokensFloor`, `reserveTokensResponse`, `reserveTokensSafety`, `compactionMode`, `compactionTrigger`, `includes` (system messages to retain).
- `build` (optional): Build-time configuration.
- `experimental` (optional): Opt-in unstable capabilities.
- `outputSchema` (optional): Structured return type for task mode (subagent, schedule, remote job).
- `modelContextWindowTokens` (optional): Manual override if AI Gateway cannot resolve model metadata.

```ts
export default defineAgent({
  model: "anthropic/claude-sonnet-4.6",
  description: "Customer support assistant",
  modelOptions: { temperature: 0.3 },
});
```

### 2.2 `defineTool({})` — Typed Functions
**Location:** `agent/tools/<name>.ts`
**Import:** `import { defineTool } from "eve/tools";`

Overloaded function with 4 signatures supporting Standard Schema V1 (Zod-compatible) + loose JSON schema. Key fields:
- `description` (required): What the tool does — shown to the model
- `inputSchema` (required): JSON Schema v1 or Zod schema — type-inferred
- `outputSchema` (optional): What the model sees
- `execute(input, ctx)` (required): Implementation — receives typed input + ToolContext
- `auth` (optional): OAuth strategy via Vercel Connect or custom getToken
- `needsApproval` (optional): HITL gate — `once()`, `always()`, `never()`, custom function
- `toModelOutput` (optional): Projection from full output to model-facing result

Tool name = filename slug (e.g., `agent/tools/get_weather.ts` → tool named `get_weather`).

**ToolContext** extends SessionContext with:
- `getToken()`: Resolves bearer token for declared auth
- `requireAuth()`: Throws ConnectionAuthorizationRequiredError, triggering OAuth consent flow

### 2.3 Skills — Markdown Procedures (defineSkill)
**Location:** `agent/skills/<name>.md` (markdown) OR `agent/skills/<name>.ts` (TypeScript)
**Import:** `import { defineSkill } from "eve/skills";`

Skills are **procedures loaded on demand** — the model decides when to load them. Markdown files auto-discovered; TypeScript files use `defineSkill()`:
```ts
export default defineSkill({
  markdown: "## Revenue Definitions\n\n...",
  files: { "ref/pricing.md": "# Pricing..." }, // package-relative sibling files
});
```
Skills do NOT run code — they provide context to the model. Dynamic loading means they don't consume context tokens until the model invokes them.

### 2.4 Channels — Where the Agent Lives
**Location:** `agent/channels/<name>.ts`
**Import:** `import { defineChannel } from "eve/channels";`

Channels define how an agent receives messages. Each channel file exports a route handler. Key concepts:
- `RouteContext.agent.run(input)` → Start a new session
- `RouteContext.agent.deliver(input)` → Resume a parked session
- `RouteContext.agent.getEventStream(sessionId)` → Read events
- `RouteContext.requestIp` → Trusted peer IP
- `RouteContext.waitUntil(promise)` → Extend serverless invocation lifetime
- Routes can be `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, or `WEBSOCKET`
- Built-in channel types: HTTP, Slack, Discord, Teams, Telegram, Twilio, GitHub, Linear
- `disableRoute()` removes framework defaults

### 2.5 Schedules — Cron Jobs
**Location:** `agent/schedules/<name>.ts` or `.md`
**Import:** `import { defineSchedule } from "eve/schedules";`

Two modes:
1. **Markdown mode:** `{ cron: "0 9 * * 1-5", markdown: "Prompt text" }` — fire-and-forget agent invocation
2. **Run handler mode:** `{ cron: "0 9 * * 1-5", run: async ({ receive, waitUntil, appAuth }) => {...} }` — full handler with cross-channel receive

### 2.6 Connections — MCP + OpenAPI
**Location:** `agent/connections/<name>.ts`
**Import:** `import { defineMcpClientConnection } from "eve/connections";`

Two types:
1. **MCP Client Connection:** `defineMcpClientConnection({ url, description, auth?, headers?, approval?, tools? })`
2. **OpenAPI Connection:** `defineOpenAPIConnection({ url, description, spec, auth? })`

**Auth strategies:**
- Non-interactive: `{ getToken: () => ({ accessToken, expiresAt? }) }` — static API keys
- Interactive: `{ startAuthorization, completeAuthorization }` plus `@vercel/connect/eve` (Vercel Connect OAuth)
- Per-connection approval: `once()`, `always()`, `never()`
- Tool-level filter: `{ allow: ["read:*"], block: ["admin:*"] }`

### 2.7 Subagents — Delegated Agents
**Location:** `agent/subagents/<name>/agent.ts`
**Import:** `import { defineAgent } from "eve";` (same API as root agent)

Subagents are full agents nested under the parent. They inherit channels/connections but get their own sandbox and instructions. The parent sees them as tools. `defineRemoteAgent()` creates an agent that proxies to a deployed URL.

### 2.8 `defineHook({})` — Stream Event Observers
**Location:** `agent/hooks/<name>.ts`
**Import:** `import { defineHook } from "eve/hooks";`

Observe-only subscribers for runtime stream events. Cannot inject model context. Events:
- `session.started`, `turn.started`, `step.started`, etc.
- Wildcard `*` handler for all events.

### 2.9 Instructions — System Prompts
**Location:** `agent/instructions.md` (primary) OR `agent/instructions/<name>.ts`
**Import:** `import { defineInstructions } from "eve/instructions";`

Markdown files are static, loaded once at build time. TypeScript files support:
```ts
export default defineInstructions({ markdown: "You are a helpful assistant..." });
```
Dynamic instructions via `defineDynamic()` in `agent/instructions/` can generate system prompts at runtime.

### 2.10 `defineSandbox({})` — Execution Environment
**Location:** `agent/sandbox.ts` or `agent/sandbox/sandbox.ts`
**Import:** `import { defineSandbox } from "eve/sandbox";`

Configures where the agent runs:
- `backend` (optional): Defaults to `defaultBackend()` — Vercel Sandbox (Firecracker)
- `bootstrap` (optional): Runs once before any session
- `onSession` (optional): Runs for each session
- `BO`/`SO` generics: Type the options for `use()` calls in bootstrap/session hooks

### 2.11 `defineDynamic({})` — Runtime-Resolved Definitions
**Import:** `import { defineDynamic, defineTool } from "eve/tools";`

A dynamic resolver evaluated at runtime on stream events. Works in 3 slots:
- `agent/tools/`: Return `defineTool(...)` or `Record<string, defineTool(...)>`
- `agent/skills/`: Return `defineSkill(...)` or `Record<string, defineSkill(...)>`
- `agent/instructions/`: Return `defineInstructions({ markdown })`

Events: `session.started`, `turn.started`, `step.started`

### 2.12 Approvals API
**Import:** `import { once, always, never } from "eve/tools/approval";`

Per-tool approval gates:
- `once()`: Approve first time, auto-allow subsequent
- `always()`: Require approval every time
- `never()`: Never require approval (default)
- Custom: `(ctx: NeedsApprovalContext) => boolean`

### 2.13 Evals
**Location:** `evals/` directory under fixture agents
**Command:** `eve eval --strict`
- Scored test suites with judges
- Deterministic, self-contained
- Run against real models (openai/gpt-5.5)
- Vercel e2e mode: `eve eval --strict --url <deployment-url>`

### 2.14 OpenTelemetry Tracing
Built into Eve runtime. Uses standard OTel span trees for:
- Session lifecycle
- Tool invocations
- Model turns (token count, latency)
- Sandbox operations
- Channel events

Export to Vercel Observability (included) or any OTel collector.

### 2.15 Remote Agents
**Import:** `import { defineRemoteAgent } from "eve";`

```ts
export default defineRemoteAgent({
  url: "https://my-agent.vercel.app",
  description: "Specialized data agent",
});
```
Parent sees the remote agent as a tool. Supports authentication via `auth`.

---

## 3. EXECUTION MODEL

### 3.1 Workflow SDK Integration
Eve's runtime is built on Vercel Workflow SDK:
- All agent sessions are durable (persisted to Vercel KV/Postgres)
- `step()` async wrapping for deterministic replay
- Cancellation support via `workflow.cancel()`
- Resumable streams: parked sessions can be resumed with `agent.deliver()`
- Serverless-safe: `waitUntil()` extends invocation lifetime

### 3.2 Sandbox Architecture
Default: Vercel Sandbox (Firecracker microVMs)
- **Template provisioning:** `eve build` creates immutable sandbox templates
- **Hibernate/resume:** Sandboxes persist between tool calls within a session
- **Adapter pattern:** `defineSandbox({ backend })` allows custom backends (Docker, microsandbox, bash)
- **Bootstrap:** `bootstrap()` runs once (e.g., install dependencies)
- **Session:** `onSession()` runs per session (e.g., clone repo)

### 3.3 Channel Architecture
- Each channel file = one route handler
- `RouteContext.agent` abstracts the runtime — routes don't know about workflows, harness, etc.
- Channels can send to other channels via `receive(channelRef, input)`
- WebSocket support for real-time streaming

### 3.4 OAuth via Vercel Connect
- `@vercel/connect/eve` provides `connect("okta")`, `connect("linear")`, etc.
- Interactive flow: agent suspends turn → shows "Sign in" → user completes OAuth → agent resumes
- Token refresh handled automatically
- Scoped per-tool or per-connection

### 3.5 Serverless-Native
- Eve runs on Vercel (Nitro serverless functions)
- `waitUntil()` for background work
- Session parking: agent parks when waiting for human input, resumes on `agent.deliver()`
- No long-running process requirement

---

## 4. FILESYSTEM CONVENTIONS

### 4.1 Path = Identity
Eve's key innovation: **file path IS the identifier.** No name fields in definitions.

| File Path | Derived Identity |
|---|---|
| `agent/tools/get_weather.ts` | tool: `get_weather` |
| `agent/skills/revenue-definitions.md` | skill: `revenue-definitions` |
| `agent/channels/slack.ts` | channel: `slack` |
| `agent/schedules/monday-summary.ts` | schedule: `monday-summary` |
| `agent/connections/linear.ts` | connection: `linear` |
| `agent/subagents/investigator/agent.ts` | subagent: `investigator` |
| `agent/instructions/` | merged into system prompt |

### 4.2 Directory Structure
```
agent/
  agent.ts              # defineAgent — model + config
  instructions.md       # System prompt (required)
  instructions/         # Multi-file system prompts (optional)
  sandbox.ts            # Sandbox configuration
  tools/
    get_weather.ts      # defineTool — one tool per file
  skills/
    revenue-defs.md     # Markdown skill — auto-loaded
    plan_a_trip.ts      # TypeScript skill
  channels/
    slack.ts            # defineChannel — one channel per file
    http.ts
  schedules/
    weekly_recap.ts     # defineSchedule — cron
  connections/
    linear.ts           # defineMcpClientConnection
    stripe.ts
  subagents/
    investigator/
      agent.ts          # defineAgent — subagent config
      sandbox.ts        # Subagent-specific sandbox
  hooks/
    logging.ts          # defineHook — stream event observer
```

### 4.3 Convention Strengths
- **No config files** (no YAML, JSON, TOML manifests)
- **Flat is better than nested** for core types
- **Self-documenting** — directory listing = agent capabilities
- **Git-friendly** — small files, clean diffs
- **Extensible** — add a file to add a capability

### 4.4 Convention Limitations
- No knowledge graph (Neptune's edge)
- No cross-session memory (Neptune's edge)
- No playbook layer (Neptune's edge)
- No twin view (Neptune's edge)
- No self-modifying code capability (Neptune's edge)
- No mission tracking (Neptune's edge)
- No generative UI (Neptune's edge)

---

## 5. DEPENDENCIES & BUILD SYSTEM

### 5.1 Core Dependencies
- **Nitro** (only runtime dependency): UnJS serverless framework
- **AI SDK** (via `catalog:`): Vercel AI SDK 6+
- **Workflow SDK:** Durable execution
- **Vercel Sandbox:** Firecracker microVMs
- **OpenTelemetry:** Tracing
- **Zod / Standard Schema V1:** Type-safe schemas
- **pnpm@11.5.2** monorepo

### 5.2 Build System
- Turbo (turborepo) for monorepo orchestration
- `pnpm build` → TypeScript compilation across workspace
- `eve build` (CLI) → Compiles agent directory into deployable bundle
- `eve dev` (CLI) → Watch mode + local dev server
- `changeset` for versioning
- `oxfmt` + `oxlint` for formatting/linting

### 5.3 Deployment
- `eve deploy` → Deploy to Vercel
- `vc deploy --prebuilt` for CI/CD
- `VERCEL=1 eve build` for production builds

---

## 6. NEPTUNE RELEVANCE ANALYSIS

### What Eve Validates About Our Approach
1. **Filesystem-first is correct:** Eve proves this pattern works at scale
2. **Markdown skills are the right abstraction:** Eve uses them identically
3. **TypeScript tools with type inference:** Eve validates our approach
4. **Connectors/channels pattern:** Different implementation, same concept
5. **Durable execution:** Both use Workflow SDK

### What Eve Does Better (Should Adopt)
1. **File path = identity convention:** Cleaner than our manual naming
2. **defineAgent pattern:** Formalized, typed, extensible
3. **Vercel Connect OAuth:** Superior to manual token management
4. **OpenTelemetry tracing:** Industry standard vs our custom Slack logging
5. **Evals framework:** Scored test suites vs our drift detection
6. **defineDynamic:** Runtime-resolved tools/skills/instructions

### What Neptune Does Better (Keep)
1. **Knowledge Graph (Graphify+Graphiti):** Eve has NO KG — our biggest edge
2. **Cross-session Memory:** Eve has NO memory system
3. **Playbook Layer:** Eve has NO playbook/manifest.yaml system
4. **Twin View (library+playbook):** Eve has NO twin view
5. **Skill-Author:** Eve has NO auto-skill generation
6. **Self-Code:** Eve agents cannot modify their own files
7. **Mission Tracking (JarvisTask):** Eve has NO mission system
8. **Generative UI (MissionCard):** Eve has NO generative UI
9. **Twenty CRM Integration:** Eve has NO CRM
10. **Connector-Skills:** Our connector abstraction is richer than Eve's channels

---

## 7. EXAMPLE AGENT (Weather Agent)

Located at `/home/neptune/eve-reference/examples/weather-agent/`:
```
weather-agent/
  agent/
    agent.ts           → defineAgent({ model: "openai/gpt-5.5" })
    instructions.md    → "You are a weather assistant..."
    tools/
      get_weather.ts   → defineTool({ inputSchema: z.object({...}) })
    channels/
      http.ts          → HTTP channel on port from env
```

---

## 8. KEY QUOTES FROM EVE SOURCE

> "Derive names from file paths. Connection names, tool names, and similar identifiers come from the filesystem path. Do not add redundant name fields to definitions."

> "Name definitions for the protocol they target. Use defineMcpClientConnection, not defineConnection."

> "Wrap third-party dependencies. Do not expose third-party APIs as eve public APIs."

> "Pre-1.0: prefer breaking changes. Favor correctness and simplicity over backwards compatibility."

> "Small modules over big helpers. Favor composable primitives with narrow responsibilities."

---

## 9. VERSION COMPATIBILITY

| Component | Eve Version | Our Version | Compatible? |
|---|---|---|---|
| AI SDK | 6+ (via catalog) | 6.x in Chat, 5.x in V2 | Chat ✅, V2 needs upgrade |
| Workflow SDK | Current (durable) | V2 post-master-fix | ✅ |
| Sandbox SDK | Vercel Sandbox V2 | V2 uses Vercel Sandbox | ✅ |
| Node.js | Via Nitro 3+ | 22.x on VPS | ✅ |
| TypeScript | 5.x+ strict | 5.x strict | ✅ |
| pnpm | 11.5.2 | Any | ✅ |

---

*Research dossier part of EVE ALIGNMENT + VALIDATION RECOVERY MASTER mission*
*Repository: /home/neptune/eve-reference/*
*npm: eve@0.11.4*
*Author: abhiswami2121@gmail.com*
