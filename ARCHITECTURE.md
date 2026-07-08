# Rustra Architecture

Rustra is a backend-first, Rust-native reproduction of Mastra's core
concepts, extended to a multi-user agent platform. This document is the
design record: what each subsystem does, which Mastra concept it mirrors,
and the decisions taken where Rust or the platform requirements forced a
choice.

Guiding rules:

1. **Mastra is the conceptual source of truth.** Names, boundaries, and
   responsibilities follow the Mastra docs (`Agent`, `Workflow`/`Step`,
   `Memory` with `resource`/`thread` scoping, storage domains,
   `RequestContext`, MCP config shape, schedules API). We only invent where
   Mastra has no pattern (skills, per-user workspaces, RBAC details) — and
   there we adopt the nearest industry convention instead.
2. **Per-user isolation by default.** Every entry point resolves a
   `Principal`; memory, workspaces, skills, knowledge, tasks, runs, and
   definitions are scoped by user id. Sharing is always explicit (ACL
   grants or `shared`/`public` visibility).
3. **Boring, dependable Rust.** Trait objects + `Arc`, no macro magic,
   explicit error enum, `async_trait`. Extension points are traits:
   `LanguageModel`, `Tool`, `ContextSource`, `Step`, the storage domain
   traits, `ChannelAdapter`, `Embedder`, `VectorStore`, `TaskExecutor`,
   `ToolApprover`, `AuthProvider`, `BrowserSession`, `Mailer`.

## 1. Crate graph

```
                 rustra (facade/registry)  ← rustra-server (HTTP)
   ┌────────┬─────────┬────┴────┬──────────┬─────────┐
 agent   workflow   tasks    skills     knowledge  workspace ...
   │         │        │         └────┬─────┘          │
 memory  observability┘            core ←──────────── ┘
   │         │                      ↑
 storage ────┴──────────────────────┘
   ↑
 storage-sqlite / storage-postgres / storage-firebase
```

`rustra-core` is dependency-light and I/O-free; everything implements its
contracts. `rustra` is the only crate that knows about everything (the
Mastra-class analogue). `rustra-server` is a thin HTTP shell over `rustra`.

## 2. Core contracts (`rustra-core`)

- `Error`/`Result` — one framework error enum with a `is_retryable()`
  classification used by task retries and workflow retry policies.
- `Principal` / `Role` — resolved identity; roles are open strings with
  three defaults (`builder`, `developer`, `admin`).
- `ResourceKind` × `Action` — the vocabulary the permission model
  quantifies over (16 resource kinds, 7 actions).
- `RuntimeContext` (alias `RequestContext`, Mastra's current name) — the
  per-invocation DI container: principal + JSON variables + correlation
  ids. Flows through agents, tools, steps, and context sources.
- `Tool` / `FunctionTool` / `ToolSpec` — Mastra's `createTool`: id,
  description, JSON-Schema input, async execute.
- `ContextSource` — the dynamic-context contract (see §7).
- `Event` — the signal-bus currency (see §10).

## 3. Model layer (`rustra-llm`)

Mastra delegates models to the Vercel AI SDK; Rust has no equivalent, so
Rustra owns a minimal provider trait: `LanguageModel::generate(ModelRequest)
-> ModelResponse`. Message/content types mirror the Anthropic Messages API
(text / tool_use / tool_result blocks) — the least lossy normal form for
tool-calling loops, and what memory persists. `MockModel` provides scripted
turns so agent and workflow tests are hermetic; `AnthropicModel` is the HTTP
adapter. Streaming is deferred (TECH_DEBT #1).

## 4. Storage (`rustra-storage`, `-sqlite`, `-postgres`, `-firebase`)

Mirrors Mastra's composite store: one logical `Storage` split into domain
traits — `MemoryStore` (threads/messages/resources), `WorkflowStore`
(snapshots), `ObservabilityStore` (runs/spans/logs), plus Rustra's platform
domains: `TaskStore` (tasks/schedules/subscriptions/decisions),
`DefinitionStore` (versioned user artifacts), `AclStore` (users/grants),
`InfraStore` (workspaces/MCP configs/UI artifacts/channel messages).
`Storage` is a blanket supertrait, `SharedStorage = Arc<dyn Storage>`.

- **In-memory** — the executable specification; every backend must match
  its semantics (ordering, pagination, version bumps, cascades).
- **SQLite (default)** — rusqlite (bundled), WAL, `PRAGMA user_version`
  migrations, 19 `rustra_*` tables, `spawn_blocking` around a mutexed
  connection. Mirrors Mastra's LibSQL default.
- **Postgres** — tokio-postgres, JSONB/TIMESTAMPTZ, same schema shape.
  Compile-verified; integration tests gate on `RUSTRA_PG_URL`.
- **Firebase** — Firestore REST adapter (experimental; see its crate docs
  and TECH_DEBT).

Vector search is a separate trait (as in Mastra): `VectorStore`
(create_index/upsert/query) + `Embedder`. In-memory and SQLite brute-force
cosine implementations ship; `MockEmbedder` (hashing) keeps recall working
with zero config.

## 5. Memory (`rustra-memory`)

Faithful to Mastra's model: **resource** (user) × **thread** scoping.
- Short-term: `last_messages` thread history replayed into the model
  conversation.
- Long-term: **working memory** (persistent document per resource, updated
  by the agent through `update_working_memory` — a default tool) and
  **semantic recall** (vector search over past messages, thread- or
  resource-scoped, `top_k`).
- `MemoryProcessor` chain filters recalled history (char-budget processor
  included).
- Both long-term forms are enabled by default for the main agent, and every
  recall path filters by `resource_id` — cross-user recall is structurally
  impossible.
- Access control: thread fetch verifies resource ownership; the RBAC layer
  governs the HTTP surface.

## 6. Agent runtime (`rustra-agent`)

`Agent` mirrors Mastra's config: id/name/description/instructions/model/
tools/memory/sub-agents/options. `generate()` runs the loop: recall → 
context assembly → model call → tool execution → repeat until `end_turn`
or `max_steps`. Decisions:

- Tool failures become `tool_result` error blocks fed back to the model —
  the run continues; only infrastructure errors abort.
- **Delegation** is the Mastra supervisor pattern: sub-agents are exposed
  as `ask_<id>` tools; a depth guard (3) prevents delegation cycles.
- **HITL**: every tool call passes a `ToolApprover` (Mastra
  `requireToolApproval`). The default allows all; `HitlToolApprover`
  (rustra-tasks) parks configured tools on a pending decision.
- `AgentDefinition` is the serializable spec for user-created agents,
  hydrated against the registry.

## 7. Dynamic context attachment

One mental model for all context, borrowed from Agent Skills' progressive
disclosure and applied uniformly: a `ContextSource` cheaply advertises
`candidates()` (name/description/score/size) and materializes selected ones
via `load()`. The agent's `ContextAssembler` ranks candidates across
sources, packs greedily within a char budget, and records every attachment
as a `context_attach` span.

Sources implemented: skills, knowledge, memory (working memory + semantic
recall), workspace files, user profile, prior runs. Tool/MCP configuration
is surfaced through tool specs rather than prompt context.

## 8. Skills & knowledge (`rustra-skills`, `rustra-knowledge`)

Skills follow the **Agent Skills convention**: a directory with `SKILL.md`
(YAML frontmatter: `name`, `description`, optional `keywords`, `metadata`,
`allowed-tools`, `validate`; body = instructions; sibling files = assets).
They are filesystem-first — plain directories under each user's workspace
(`skills/`) plus deployment-shared roots — so they stay discoverable by
plain search tooling, as required. `SkillLibrary` discovers/searches with
user isolation; agents get `search_skills`/`read_skill` tools and the
`SkillContextSource` for automatic attachment.

Knowledge mirrors skills exactly, minus instructions: `KNOWLEDGE.md`
manifest + document files. Same discovery, same tools
(`search_knowledge`/`read_knowledge`), same context source. The distinction
is semantic and enforced by format: skills carry task instructions,
knowledge carries information.

## 9. Workspaces (`rustra-workspace`)

Per-user rooted directories (`<base>/<user>/{files,skills,knowledge,agents,
flows}`) with metadata in storage. File operations are path-jailed
(canonicalized containment checks defeat `..` and symlink escapes). Shell
execution runs under a `ShellPolicy` (timeout, output caps, denylist) with
cwd inside the jail — the policy is a guard rail; real isolation is the
deployment's container boundary. A minimal LSP client (stdio JSON-RPC,
Content-Length framing) launches `typescript-language-server` / `pyright`
for JS/Python diagnostics. All workspace tools verify the calling
principal owns the workspace.

## 10. Tasks, schedules, signals (`rustra-tasks`)

Every invocation path besides direct calls:

- `TaskManager` — supervised tokio tasks with persisted state transitions,
  cancellation tokens, retry with exponential backoff (only for
  `is_retryable()` errors), status inspection, user scoping. Execution is
  abstracted behind `TaskExecutor`; the facade dispatches
  `{"target": "agent"|"workflow", ...}` specs.
- `Scheduler` — Mastra's `mastra.schedules`: 5/6/7-field cron,
  create/pause/resume/run-now/delete, a tick loop computing
  `next_run_at`. Timezone stored, UTC-evaluated (debt).
- `SignalBus` — persisted subscriptions (`event_name` exact or `prefix.*`)
  matched against emitted `Event`s; matches launch tasks as the
  subscription's owner with the event attached. Webhooks are events
  (`webhook.<hook>`) scoped to the authenticated user. A broadcast feed
  serves live listeners (SSE).
- `InterruptController` — pending `DecisionRecord`s: request / list /
  resolve / await (in-process notify + storage polling). Workflow
  suspensions create decisions automatically; `HitlToolApprover` gates
  agent tools on them.

## 11. Harness layer (`rustra-workflow`)

Deterministic flows with Mastra's exact control-flow surface: `then`,
`parallel` (output keyed by step id), `branch` (first match), `foreach`
(bounded concurrency), `dowhile`/`dountil`, `map`, `sleep`,
`wait_for_event`, terminated by `commit()`. Run state checkpoints to the
workflow snapshot domain before every node; suspension persists the exact
cursor and `resume(run_id, data)` re-executes the suspended node with
resume data. Statuses match Mastra (`running`, `suspended`, `waiting`,
`success`, `failed`, `cancelled`). Per-step retry policies with backoff;
`watch()` broadcasts lifecycle events. `FlowDefinition` is the declarative
(user-authorable) subset: sequential agent/tool/approval/wait-for-event
steps, hydrated by the facade.

## 12. RBAC/ACL (`rustra-rbac`)

Evaluation order: system principal → admin role → ownership (gated by the
role matrix) → visibility (`shared` readable, `public` readable+executable)
→ explicit ACL grants (to users or `role:<name>`) → default deny. The
default matrix: **builder** creates/runs their own artifacts; **developer**
adds MCP/channel administration and log/trace read; **admin** has
everything. Roles are extensible at runtime (`define_role`).
`TokenAuthProvider` mirrors Mastra's `authenticateToken`: SHA-256-hashed
bearer tokens on user records.

## 13. MCP (`rustra-mcp`)

Config-only, matching Mastra's `MCPClient` server map: stdio
(`{command,args,env}`) or HTTP (`{url,headers}`) definitions with timeout,
allowed-tools filter, `require_tool_approval`, and `${SECRET}` env
resolution via a host-supplied lookup. *Static* servers come from host
config; *dynamic* servers are registered at runtime through `McpRegistry`
(per-user by default; `shared` scope requires developer/admin).
*Server-side* definitions are connected by the runtime (JSON-RPC client:
initialize → tools/list → tools/call); *client-side* definitions are
stored/forwarded for clients (extension) to execute locally. Discovered
tools are bridged into the agent tool system namespaced `<server>_<tool>`.

## 14. Chrome extension assumptions (backend contracts)

The extension is a first-class client of `rustra-server`:
- token auth (`Authorization: Bearer`) resolves the workspace identity;
- start/continue agent runs (`POST /api/agents/main/generate`);
- page context attaches as message content or workspace files;
- browser events post to `/api/signals` (`browser.*` events);
- in-app messages stream over SSE (`/api/messages/stream`);
- UI artifacts render via `/api/ui/:id/render` (CSP-wrapped documents);
- computer use: the extension long-polls `/api/browser/:session/commands`,
  executes `BrowserAction`s in-page, posts results back — the
  `RemoteBrowserSession` command queue with replayable `ActionLog`s.

## 15. Generative UI (`rustra-ui`)

Deliberately minimal until frontends exist: HTML+JS artifacts persisted
with ownership/visibility/versioning, a `create_ui` agent tool, and
`render_document()` which wraps artifacts in a strict-CSP document with a
data-injection point (`window.__RUSTRA_DATA__`). Serving with sandboxed
iframes/CSP headers is the server's job; richer component libraries hook in
via the artifact `kind` field later.

## 16. Observability (`rustra-observability`)

Mastra's span/trace model: every run (agent/workflow/task) owns a trace;
LLM calls, tool calls, memory ops, MCP calls, flow steps, context
attachment, interrupts, and retries are spans persisted through the
observability domain. Recording is best-effort (never fails the
instrumented operation) and mirrored to `tracing` for operators. OTel
export is a planned exporter behind the same call sites.

## 17. Server (`rustra-server`)

Axum HTTP shell over the facade: auth middleware (bearer → `Principal`),
REST routes per subsystem, SSE for in-app messages and workflow watch,
webhook ingestion, and the extension's browser command bridge. The server
holds no logic — every handler resolves the principal, calls the facade,
and maps `Error` variants to status codes (403 `PermissionDenied`,
404 `NotFound`, 400 `Validation`, 504 `Timeout`, 503 `Unavailable`).

## 18. Implementation order (as built)

core → llm → storage (+sqlite) → memory → observability → rbac → agent →
workflow → skills/knowledge → workspace → tasks → mcp →
messages/ui/browser → postgres/firebase → facade → server → docs/example.

## 19. Validation strategy

Hermetic tests at every layer (no network, no API keys): scripted-model
agent-loop tests, workflow suspend/resume/retry tests, memory isolation
tests, RBAC matrix tests, SQLite persistence round-trips, a fake MCP server
binary for stdio protocol tests, path-jail and shell-policy tests, and a
facade-level end-to-end test (main agent + skills + workspace + tasks +
schedules + signals over one storage). The in-memory backend doubles as the
storage conformance spec. Postgres/Firebase are compile-verified with
gated/unit tests respectively (see TECH_DEBT).
