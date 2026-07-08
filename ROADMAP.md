# Rustra — The Dream Version

This is the version of Rustra a skeptical Rustacean would *evangelize*, not
just tolerate. It is written as a scoping document: five pillars, each broken
into concrete items with API sketches, effort sizes (S = hours, M = days,
L = a week+), and the decisions that need a human call before work starts.

The organizing principle: **v0.1 proved the concepts; the dream version lets
the type system do the work, streams everything, and earns trust with CI,
hardening, and one real application.**

Milestones at a glance:

| Milestone | Theme | Contents |
|---|---|---|
| v0.2 | Credibility | Pillar 1 (types) + Pillar 3a (CI/security) — kills every "first-hour review comment" |
| v0.3 | Liveness | Pillar 2 (streaming) + real providers |
| v0.4 | Reliability | Pillar 3c (durable dispatch) + OIDC/SSO (Google-first) — the enterprise floor |
| v0.5 | Scale-out | Pillar 3b (remaining: pooling, retention, OTel, pgvector) + Pillar 4 (DX/CLI) |
| v1.0 | Trust | Pillar 5 (flagship app, evals, fuzzing) + semver/stability promise |

---

## Pillar 1 — Let the type system work

The single biggest gap between v0.1 and idiomatic Rust. Everything here is
mechanical-to-moderate; none of it changes architecture.

### 1.1 Enums over strings (S–M)

Every stringly-typed state becomes a real enum with serde + storage codecs:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[non_exhaustive]
pub enum RunStatus { Running, Suspended, Waiting, Success, Failed, Cancelled }
```

Targets: `RunStatus`, `TaskStatus`, `FlowStatus`, `DecisionStatus`,
`SpanKind`, `TriggerKind`, `MessageRole`, `LogLevel`, channel names.
Storage keeps snake_case TEXT columns (no migration needed); the codecs move
into one place. Exhaustive `match` replaces string comparison everywhere.

### 1.2 Typed tools (M) — the flagship DX feature

Keep `dyn Tool` (object-safe, JSON at the wire) as the base layer; add a
typed layer where `schemars` derives the JSON Schema and serde does the
validation, so users never hand-write schemas:

```rust
#[derive(Deserialize, JsonSchema)]
struct AddInput { a: f64, b: f64 }

#[derive(Serialize, JsonSchema)]
struct AddOutput { sum: f64 }

// Option A: plain generics, zero macros
let add = typed_tool("add", "Add two numbers", |input: AddInput, ctx| async move {
    Ok(AddOutput { sum: input.a + input.b })
});

// Option B: attribute macro (axum/clap-style — judicious, not magic)
#[rustra::tool(description = "Add two numbers")]
async fn add(input: AddInput, ctx: ToolContext) -> Result<AddOutput> { … }
```

**DECISION NEEDED:** ship Option A only, or A + B? The macro is what makes
demos sing, but it is the one place we'd add a proc-macro dependency.

### 1.3 Type-checked workflows (L) — the feature Rustaceans would talk about

A typed builder where `.then()` only accepts a step whose input type matches
the previous step's output — data-flow bugs become compile errors:

```rust
let flow = typed_workflow("deploy")
    .then(build)            // Step<GitRef, Artifact>
    .then(approval::<Artifact>("Ship it?"))
    .then(ship)             // Step<Artifact, Deployment>  ← compiler-checked
    .commit();
```

Implemented as a thin type-state layer over the existing `Value`-based
engine (which remains, unchanged, for declarative user-authored flows).
Nothing about persistence/suspend/resume changes.

### 1.4 Structured agent output (S–M)

```rust
let report: WeeklyReport = agent.generate_structured("summarize the week", runtime).await?;
```

Schema-forced JSON via a synthetic tool call (the reliable pattern), parsed
into `T: DeserializeOwned + JsonSchema`.

### 1.5 Error model cleanup (M)

**DECISION NEEDED — two credible paths:**
- **Keep unified `Error`** but make it `#[non_exhaustive]`, add structured
  variants (e.g. `Storage { backend, source }`), and stop stringifying
  sources. Cheapest; framework-appropriate.
- **Per-crate errors** (`MemoryError`, `WorkflowError`, …) converting into a
  facade-level error. More idiomatic for library consumers who depend on a
  single crate; costs a day of churn and makes cross-crate helpers noisier.

### 1.6 Small idiomatic fixes (S)

`sha2` replaces the hand-rolled SHA-256 (keep the NIST tests as regression
tests against `sha2`). `parking_lot` for the registry locks (kills every
`expect("poisoned")`). `Cow<'static, str>` where we clone constants.
`#[must_use]` on builders. `impl IntoIterator` params where sensible.

---

## Pillar 2 — Streaming everywhere

Table stakes for an LLM framework; currently the biggest adoption blocker.

### 2.1 Model streaming (M)

```rust
pub enum ModelEvent {
    TextDelta(String),
    ToolUseStart { id: String, name: String },
    ToolUseDelta { id: String, partial_json: String },
    BlockStop, MessageStop { stop_reason: StopReason, usage: TokenUsage },
}

trait LanguageModel {
    async fn generate(&self, req: ModelRequest) -> Result<ModelResponse>;
    fn stream(&self, req: ModelRequest) -> BoxStream<'_, Result<ModelEvent>> { /* default: fake-stream generate() */ }
}
```

Anthropic SSE implementation; `MockModel` gets scripted streaming so tests
stay hermetic.

### 2.2 Agent streaming (M–L)

`agent.stream(input, runtime) -> AgentStream` yielding
`TextDelta / ToolCallStarted / ToolCallFinished / StepFinished / Done(AgentResponse)`.
The loop already has clean step boundaries; this threads a sink through
them. Cancellation via `CancellationToken` (drop = abort, memory still
persists completed turns).

### 2.3 Server streaming (S–M)

`POST /api/agents/{id}/stream` as SSE; workflow `watch` already broadcasts —
expose `GET /api/workflows/{id}/runs/{run_id}/events` as SSE.

### 2.4 Real providers (M)

OpenAI-compatible adapter (covers OpenAI, Together, Groq, vLLM, LM Studio)
and Ollama for local — with streaming. A real `Embedder` (OpenAI-compatible
`/embeddings` + Ollama). This is what makes the framework *usable* for the
whole community rather than Anthropic users only.

---

## Pillar 3 — Production hardening

### 3a. Credibility floor (goes in v0.2)

- **CI** (S–M): GitHub Actions — fmt, `clippy -D warnings`, test matrix
  (stable + MSRV), Postgres service container running the gated tests,
  `cargo-deny` (licenses/advisories), doc build with `-D rustdoc::broken_intra_doc_links`.
- **Security pass** (S–M): `sha2` (see 1.6); token comparison via constant-time
  eq; `ammonia` sanitization option for UI artifacts; `secrecy::SecretString`
  for API keys so they can't be Debug-printed.
- **Repo hygiene** (S): `rustfmt.toml`, `deny.toml`, `CONTRIBUTING.md`,
  MSRV policy in README, `#![warn(missing_docs)]` on public crates.

### 3b. Scale-out (v0.5)

- **Startup reconciliation** — *moved to 3c (P1)*.
- **Multi-replica coordination** — *moved to 3c (P0, the dispatch
  primitive)*.
- **Pooling** (M): `deadpool` for Postgres; SQLite reader pool + single
  writer.
- **Retention** (S–M): TTL config per domain (logs/spans/messages) + a
  built-in pruning schedule.
- **OpenTelemetry exporter** (M): OTLP bridge behind `ObservabilityHub`;
  storage persistence unchanged.
- **pgvector feature** (M): `features = ["pgvector"]` swaps brute-force for
  real ANN on Postgres.
- **Token budgets** (S–M): tokenizer trait + a default BPE estimate; memory
  processors and context assembler switch from chars to tokens.
- **Timezone-correct cron** — *moved to 3c (P1)*.
- **MCP via `rmcp`** (M–L): adopt the official SDK behind the existing
  `McpClient` surface → full spec (SSE, resources, prompts, elicitation,
  sampling, reconnect). **DECISION NEEDED:** rmcp now, or after v0.3?

### 3c. Reliable dispatch (v0.4) — the enterprise floor

Origin: the July 2026 reliability audit of Signals, Channels, and the
Scheduler. Verdict for all three: *needs a hardening milestone*. The shared
root cause is architectural, so one primitive fixes most of it: **dispatch
today is fire-and-forget from process memory — storage is a passive record,
never a queue.** No outbox, no lease/claim, no dead-letter, no idempotency
key. Everything works on one healthy process; a crash, restart, slow
consumer, or second replica silently breaks delivery in each subsystem.

(S-sized correctness bugs from the same audit — the running-map leak, the
cron day-of-week translation, the webhook relabel race, missing HTTP
timeouts, dead `backoff` option, fan-out truncation — are quick wins being
fixed in the current polish round and are deliberately not listed here.)

**P0 — the durable dispatch primitive** (M–L, one design, three consumers):
a claimed-outbox table with compare-and-swap semantics.
- *Scheduler leases*: `UPDATE … SET next_run_at = :next WHERE id = :id AND
  next_run_at = :old`, fire only on rows-affected = 1. Kills multi-replica
  double-fires and the crash-refire window; gives coherent once-semantics
  keyed on `(schedule_id, scheduled_at)`.
- *Event journal*: persist every signal on ingress with an idempotency key
  (webhook providers all redeliver); dispatch via claimed outbox rows with
  per-subscription completion; replay becomes possible, partial dispatch
  becomes visible.
- *Channel outbox*: pending/delivered/failed-permanent status, attempt
  count, `next_attempt_at`; background drainer with backoff honoring
  `Retry-After`; dead-letter instead of silent loss.

**P0 — delivery observability** (S–M): first-class delivery-status columns
(not JSON metadata blobs), a "list failed deliveries" API, and counter
metrics. An operator must be able to answer "which notifications failed
this week" without scanning JSON.

**P1 — scheduler correctness policies**:
- *Timezone-correct cron* (M, pulled from 3b): `chrono-tz`, evaluate in the
  stored IANA zone, with an **explicit DST gap/fold policy** (skip vs
  double-fire at 2:30am must be a documented choice, not an accident).
- *Catch-up policy* (S): per-schedule `catchup: all | one | none` for
  missed windows after downtime (today: implicit coalescing, unbounded
  staleness).
- *Fire-history journal* (S–M): a failed fire currently advances
  `next_run_at` and vanishes into a warn log; persist fire outcomes so a
  skipped occurrence is alertable.

**P1 — startup reconciliation** (S, pulled from 3b): sweep stale `running`
tasks on boot via a process-instance id column.

**P1 — a real mailer** (M): SMTP or provider-API `Mailer`. Until it ships,
`LogMailer` must stop returning a success receipt for mail that went to a
log line.

**P2 — multi-replica in-app fan-out** (M): SSE clients on replica A never
see messages sent through replica B; storage-backed poll/notify or external
pub/sub.

**P2 — bounded task concurrency** (S–M): a semaphore/queue in front of
`TaskManager::submit`; a hot signal or due-schedule burst currently fans
out unbounded.

**P2 — outbound idempotency** (S): idempotency key on `OutboundMessage`;
an audit-write failure must not invert a successful delivery into an `Err`
that provokes a double-send retry.

v0.4 also carries **OIDC/SSO, Google-first** (scoped separately: pluggable
`Arc<dyn AuthProvider>` in the facade, provider chain with `rsk_`/JWT
dispatch, JWKS-verified ID tokens, first-login provisioning, and the
auth-path low fruit — `sha2` swap, constant-time compares, no role
rewrites on token re-issue).

---

## Pillar 4 — DX that makes people evangelize

- **Feature-gated facade** (M): `rustra = { features = ["sqlite"] }` minimal
  build; `postgres`, `firebase`, `mcp`, `server`, `browser`, `pgvector`,
  `otel` opt-in. Compile time is a first impression in Rust.
- **`rustra` CLI** (L): `rustra new my-agent` (project template),
  `rustra dev` (server + hot-reloaded skills/knowledge from the workspace
  dirs), `rustra skill new`, `rustra token issue`. Mirrors the Mastra CLI
  experience that made Mastra approachable.
  **DECISION NEEDED:** CLI in v0.5 or defer? It's the largest single DX item.
- **Docs** (M, ongoing): examples on every public item (doctests), an
  mdBook guide (Concepts → Agents → Memory → Flows → Skills → Deploy),
  a gallery: chat server, GitHub-webhook bot, cron digest agent, extension
  backend.
- **Ergonomic re-exports & prelude** (S): `use rustra::prelude::*;` gets a
  working agent in ~10 lines (it's ~15 today; keep pushing).

---

## Pillar 5 — Proof

What converts "nice codebase" into "I'd bet my product on it".

- **Flagship application** (L): one real app built *only* on the public API,
  living in `examples/` or its own repo, exercised in CI.
  **DECISION NEEDED — pick one:**
  (a) a support/chat agent server with the browser extension,
  (b) a GitHub repo-babysitter (webhooks → signals → flows → PR comments),
  (c) a personal cron-digest agent (schedules + memory + channels).
- **Evals/scorers** (M–L): Mastra-parity `Scorer` trait + scores storage
  domain + sampling config on agents — closes the last big conceptual gap
  with Mastra.
- **Adversarial testing** (M): `proptest` on the parsers (frontmatter,
  cron, JSON-RPC framing, Firestore codec), `loom` or stress tests on the
  task supervisor and interrupt controller, fuzz the path jail.
- **Benchmarks** (S–M): criterion micro-benches for context assembly and
  storage hot paths, published in CI.
- **Stability promise** (v1.0): semver discipline, `#[non_exhaustive]`
  audit, MSRV window, CHANGELOG, release automation (`release-plz`).

---

## Pillar 6 — Experience & RL (design pinned, see RL_DESIGN.md)

The main agent gets an RL system. The July 2026 research verdict
(RL_DESIGN.md): **collection-first** — trajectory schema + experience
pipeline now, training loop deferred while the credit-assignment frontier
churns quarterly.

- **E1 — `ExperienceStore` domain + serve-time capture** (M): per-turn
  trajectories (exact ModelRequest snapshots, full tool calls incl.
  failures, canonical observation hashes, optional token logprobs),
  HITL decisions joined as reward events, sampling/retention config.
  Separate from observability: spans are best-effort, training data is
  complete-or-absent.
- **E2 — labels + export** (S–M): success/expert marking, human-label
  API, JSONL export as the training-side contract; TokenStats via the
  OpenAI-compatible adapter (2.4).
- **E3 — training pilot** (L, deferred): open-weights + then-current
  method (GiGPO/ARPO/G2PO-class); InversePRM from approved trajectories
  first. **DECISION DEFERRED on purpose** — method table rewrites
  quarterly.

---

## Open decisions (need a human call before scoping)

1. **Typed tools:** generics only, or also the `#[rustra::tool]` macro? (§1.2)
2. **Errors:** unified-but-structured, or per-crate splits? (§1.5)
3. **MCP:** adopt `rmcp` in v0.3 or v0.5? (§3b)
4. **CLI:** in scope for v0.5, or after v1.0? (§4)
5. **Flagship app:** which of the three? (§5)
6. **Publishing:** aim for crates.io + open-source governance (name is
   currently unclaimed), or keep private to the product? Affects license
   headers, README tone, and how aggressive the semver promise must be.

## Suggested v0.2 cut (the "kill every first-hour review comment" release)

Enums over strings (1.1) · typed tools, at least Option A (1.2) ·
structured output (1.4) · `sha2` + small idioms (1.6) · CI + security +
hygiene (3a). Rough size: one focused week. Everything else scopes after.
