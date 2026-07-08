# Technical Debt Register

Explicit, honest debt. Each entry: what was traded, why, and the intended
fix. Nothing here is hidden in the code — load-bearing items also carry a
`TECH DEBT` comment at the site.

## Model layer

1. **No streaming.** `LanguageModel::generate` is request/response;
   Mastra's `stream()` has no analogue yet. Fix: add a
   `stream(ModelRequest) -> BoxStream<ModelEvent>` default method, plumb
   SSE through agent responses and the server. The message types already
   round-trip deltas (content blocks), so this is additive.
2. **Anthropic adapter is untested against the live API** (hermetic test
   policy). Contract risk is in JSON encode/decode, which is unit-shaped
   but not integration-verified. Fix: a gated integration test behind
   `ANTHROPIC_API_KEY`.
3. **Single provider.** OpenAI-compatible and local adapters are trait
   implementations away; none shipped.

## Storage

4. **Firebase backend is experimental.** Firestore document codec and
   structuredQuery construction are unit-tested; no live Firestore call has
   been made. `put_definition` uses read-modify-write instead of Firestore
   transactions (racy under concurrent writers). See crate docs for the
   precise list of stubbed methods (observability/infra domains). Fix:
   emulator-gated integration tests + transaction API.
5. **Postgres backend is compile-verified only** in this environment;
   integration tests gate on `RUSTRA_PG_URL` and have not run here. Fix:
   run the gated suite in CI with a Postgres service.
6. **Vector search is brute-force** (in-memory/SQLite/Postgres BYTEA scan).
   Fine to ~10⁵ vectors; beyond that adopt pgvector / a real ANN store
   behind the existing `VectorStore` trait.
7. **No connection pooling**: SQLite serializes on one mutexed connection
   (WAL mitigates); Postgres uses a single client. Fix: pool (deadpool) or
   per-domain connections when write volume demands it.
8. **No retention/pruning** for logs, spans, or messages (Mastra has
   retention config). Tables grow unbounded. Fix: retention policy +
   scheduled vacuum task.

## Memory

9. **Char-based budgeting, not tokens** (memory processors and the context
   assembler both). Fix: tokenizer behind a trait; budgets are already
   parameterized.
10. **`MockEmbedder` is the default embedder** — deterministic hashing,
    not semantic. Recall plumbing is real; recall *quality* requires
    wiring a real embeddings API via `RustraBuilder::embedder`.
11. **No observational memory / thread-title generation** (Mastra has
    both). Fix: background summarizer task compressing old messages into
    observations; title generation on first exchange.

## Agent runtime

12. **Instructions are static strings** — Mastra supports dynamic
    (function) instructions and model routing per request. Fix: accept
    `Fn(&RuntimeContext) -> String` and a model-resolver closure.
13. **No input/output processors or scorers/evals.** Mastra's processor
    and scorer pipelines have no analogue. Fix: `Processor` trait pair on
    the agent loop; a `Scorer` trait writing to a scores storage domain.
14. **Delegation passes only a message string** to sub-agents (no
    conversation/context handoff beyond memory).
15. **`max_steps` overrun is an error** rather than a graceful
    finish-with-summary.

## Workflow harness

16. **No suspension inside `parallel`/`foreach`/loops** — suspending there
    is an explicit error. Fix: per-branch checkpoint state (partial-join
    snapshots); the snapshot format has room (`suspended` is already
    structured).
17. **`sleep` holds an in-process timer** — long sleeps don't survive
    restarts even though state is checkpointed. Fix: reschedule via the
    task runtime (`run_at`), resume like an event.
18. **Declarative `FlowDefinition` is sequential-only** (agent / tool /
    approval / wait-for-event). Parallel/branch/loop are code-first only.
19. **Snapshots store closure-less state**: workflow *code* changes between
    checkpoint and resume are not versioned (Mastra has the same hazard).
    Fix: hash the node list into the snapshot and refuse mismatched resume.

## Tasks / scheduler / signals

20. **Stale `running` tasks after a crash** are not reconciled at startup.
    Fix: startup sweep marking orphaned running tasks failed
    (needs a process-instance id column).
21. **Scheduler evaluates cron in UTC**; the IANA `timezone` field is
    stored but ignored (needs `chrono-tz`).
22. **Single-process assumption**: scheduler ticks and signal dispatch are
    not coordinated across replicas (no leases/leader election). Fix:
    schedule leases via storage compare-and-set.
23. **Interrupt waiting polls storage at 500ms** as the cross-process
    fallback (in-process wakeups are immediate).

## RBAC / auth

24. **Hand-rolled SHA-256** for token hashing (NIST-vector tested) to
    avoid a crypto dependency; swap for `sha2` when the dependency budget
    allows. Tokens are unsalted hashes — acceptable for high-entropy
    generated tokens only; never hash passwords this way.
25. **No OIDC/SSO providers** (Mastra ships Auth0/Clerk/etc.). The
    `AuthProvider` trait is the seam.
26. **Role matrix is in-memory** (custom roles don't persist). Fix:
    persist role definitions in storage.

## MCP

27. **Hand-rolled JSON-RPC client** (initialize / tools/list / tools/call
    over stdio + plain HTTP POST). Not covered: SSE/streamable HTTP
    responses, resources, prompts, sampling, elicitation, progress,
    server-initiated requests. Fix: adopt the official `rmcp` SDK behind
    the same `McpClient` surface.
28. **No connection pooling/reconnect** for MCP clients; a dropped stdio
    child requires re-connect by the caller.

## Messages / UI / browser

29. **No SMTP mailer** — `Mailer` trait with a logging impl only.
30. **Slack/webhook adapters lack retry** and are construction-tested only
    (no network in tests).
31. **In-app messages are double-recorded** (registry audit + adapter
    delivery record); inbox reads must filter `metadata.audit == true`.
32. **UI sanitization is CSP-only** at this layer; real isolation is the
    serving context's sandboxed iframe/headers (documented in
    `rustra-ui`). No HTML sanitizer pass yet.
33. **Browser sessions are in-memory** — a server restart drops pending
    command queues (action logs persist only in-session). Fix: persist
    queues in storage if extension reliability demands it.

## Workspace

34. **Shell denylist is substring-based** — a guard rail, not a sandbox.
    Real isolation must come from the deployment (containers/jails).
35. **LSP client is minimal**: ignores server→client requests, no
    incremental sync, exact-URI diagnostics matching, no percent-encoding
    of paths.
36. **Workspace context source matches by filename mention** only — no
    content relevance scoring.

## Facade / server

37. **Main agents are cached per user and only invalidated by
    `register_agent`** — changes to shared skill roots or shell policy
    require a process restart to affect cached agents.
38. **MCP toolsets attach at main-agent build time only** — the facade
    connects to each enabled server-side MCP server once when
    `main_agent_for` first builds a user's agent, and the connection lives
    as long as the cached agent. Servers registered *after* the agent is
    cached require a cache invalidation (process restart today); no
    reconnect on dropped connections (see #28).
39. **Definitions store only latest-version hydration paths**; no
    rollback-to-version API surface yet (storage supports it).
40. **Server rate limiting, CORS tightening, request size limits** — not
    configured beyond defaults.

## Cross-cutting

41. **No OpenTelemetry exporter** — spans persist to storage and mirror to
    `tracing`; an OTel bridge is additive behind `ObservabilityHub`.
42. **Skills/knowledge discovery re-parses the filesystem per call** — fine
    at human scale; add an mtime cache for large libraries.
43. **Structural duplication between rustra-skills and rustra-knowledge**
    (mirror-image APIs by design); a shared private helper crate could DRY
    the frontmatter/discovery logic.
44. **Doc-comment coverage is uneven in subagent-authored crates** — public
    APIs are documented, but examples are sparse outside the core crates.
