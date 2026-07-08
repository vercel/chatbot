# Rustra

**A Mastra-inspired agent framework in Rust.** Rustra reproduces the core
concepts of [Mastra](https://mastra.ai) — agents, tools, workflows, memory,
storage, RAG-style knowledge, MCP, observability — as a clean Rust library
and runtime, and extends them with the platform features this deployment
needs: per-user workspaces, discoverable skills & knowledge, RBAC/ACL,
background tasks/schedules/signals/webhooks, HITL interrupts, messaging
channels, generative UI artifacts, and a browser computer-use protocol for a
Chrome extension surface.

## Quick start

```rust
use std::sync::Arc;
use rustra::{Principal, Rustra, RuntimeContext};
use rustra_llm::AnthropicModel;

#[tokio::main]
async fn main() -> rustra::Result<()> {
    let rustra = Rustra::builder()
        .sqlite("rustra.db")?                       // default persistence
        .model(
            "anthropic/claude-sonnet-5",
            Arc::new(AnthropicModel::new("claude-sonnet-5", std::env::var("ANTHROPIC_API_KEY").unwrap())),
        )
        .default_model("anthropic/claude-sonnet-5")
        .workspace_dir("./workspaces")
        .build()
        .await?;

    // The main coding agent "runs the show": memory on by default,
    // skills/knowledge discovery, workspace tools, delegation.
    let runtime = RuntimeContext::new(Principal::user("ada"));
    let agent = rustra.main_agent_for("ada").await?;
    let reply = agent.generate("Set up a Python project in my workspace", runtime).await?;
    println!("{}", reply.text);
    Ok(())
}
```

Run the working end-to-end example (uses a scripted mock model — no API key
needed):

```sh
cargo run -p quickstart
```

## Concept map (Mastra → Rustra)

| Mastra                                | Rustra                                             |
| ------------------------------------- | -------------------------------------------------- |
| `Mastra` class                        | `rustra::Rustra` registry                           |
| `Agent` (`@mastra/core/agent`)        | `rustra-agent::Agent`                               |
| `createTool`                          | `rustra_core::FunctionTool` / `Tool` trait          |
| `createWorkflow` / `createStep`       | `rustra-workflow::Workflow` / `Step`                |
| `Memory` (`@mastra/memory`)           | `rustra-memory::Memory` (threads, working memory, semantic recall) |
| Storage adapters (`@mastra/libsql`, `@mastra/pg`) | `rustra-storage-sqlite` (default), `-postgres`, `-firebase` |
| Vector stores                         | `rustra_storage::VectorStore`                       |
| `MCPClient` config (`@mastra/mcp`)    | `rustra-mcp` (config-only, per-user + shared)       |
| `RequestContext` (née RuntimeContext) | `rustra_core::RuntimeContext` (alias `RequestContext`) |
| Observability (traces/spans)          | `rustra-observability` (runs, spans, logs)          |
| `mastra.schedules`                    | `rustra-tasks::Scheduler`                           |
| Auth provider + FGA                   | `rustra-rbac` (roles, ownership, ACL grants)        |
| Server (Hono)                         | `rustra-server` (axum)                              |

Beyond Mastra, following established conventions where they exist:

- **Skills** follow the Agent Skills convention: a directory with `SKILL.md`
  (YAML frontmatter + instructions), discoverable by search and dynamically
  attachable.
- **Knowledge** mirrors skills but carries information, not instructions
  (`KNOWLEDGE.md` + documents).
- **Dynamic context attachment** generalizes the same progressive-disclosure
  model to memory, workspace files, user profile, and prior runs via the
  `ContextSource` trait.

## Workspace layout

```
crates/
  rustra                  # central registry + re-exports (start here)
  rustra-core             # shared types: errors, RuntimeContext, Tool, ContextSource
  rustra-llm              # LanguageModel trait, Anthropic adapter, mock
  rustra-storage          # domain store traits + in-memory backend + vector store
  rustra-storage-sqlite   # default persistence (rusqlite, WAL)
  rustra-storage-postgres # Postgres backend (tokio-postgres)
  rustra-storage-firebase # Firestore REST backend (experimental)
  rustra-memory           # threads, working memory, semantic recall
  rustra-agent            # agent runtime: tool loop, context assembly, delegation
  rustra-workflow         # harness layer: steps, checkpoints, suspend/resume
  rustra-skills           # Agent Skills convention + discovery + tools
  rustra-knowledge        # knowledge collections + discovery + tools
  rustra-workspace        # per-user workspaces: files, shell, LSP
  rustra-rbac             # roles, ACL grants, ownership, token auth
  rustra-tasks            # tasks, scheduler, signal bus, HITL interrupts
  rustra-mcp              # config-only MCP: registry, client, tool bridge
  rustra-messages         # channel adapters: in-app, Slack, email, webhook
  rustra-observability    # runs, traces, spans, logs
  rustra-ui               # generative UI artifacts (backend)
  rustra-browser          # computer-use protocol for the extension
  rustra-server           # HTTP API (axum): agents, runs, webhooks, SSE, extension bridge
examples/quickstart       # end-to-end example with a mock model
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — the full design: every subsystem, its
  Mastra lineage, and the decisions taken.
- [TECH_DEBT.md](TECH_DEBT.md) — explicit debt register. Read before
  building on a subsystem.

## Development

```sh
cargo test --workspace      # ~200 hermetic tests; no network or API keys
cargo clippy --workspace
```

Frontend surfaces (web UI, Chrome extension) are intentionally not built
yet — the backend contracts they need (SSE messaging, browser command queue,
UI artifact rendering, token auth) are in place. See ARCHITECTURE.md §14.
