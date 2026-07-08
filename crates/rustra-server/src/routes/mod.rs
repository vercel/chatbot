//! The `/api` route table. Each module holds the thin handlers for one
//! domain; all of them share the `Arc<Rustra>` state and the
//! [`AuthedUser`](crate::AuthedUser) extractor.

mod agents;
mod browser;
mod decisions;
mod definitions;
mod mcp;
mod messages;
mod runs;
mod schedules;
mod signals;
mod tasks;
mod threads;
mod ui;
mod workflows;
mod workspace;

use std::sync::Arc;

use axum::routing::{delete, get, post, put};
use axum::Router;
use serde::Deserialize;

use rustra::Rustra;
use rustra_storage::Page;

/// `?limit=&offset=` pagination query, defaulting to [`Page::default`].
#[derive(Debug, Default, Clone, Copy, Deserialize)]
pub(crate) struct PageQuery {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

impl PageQuery {
    pub(crate) fn page(&self) -> Page {
        let default = Page::default();
        Page::new(self.limit.unwrap_or(default.limit), self.offset.unwrap_or(default.offset))
    }
}

/// Everything mounted under `/api` (auth is layered on by the caller).
pub fn api_router() -> Router<Arc<Rustra>> {
    Router::new()
        // Agents.
        .route("/agents/main/generate", post(agents::generate_main))
        .route("/agents/{id}/generate", post(agents::generate_by_id))
        // Threads / messages (memory).
        .route("/threads", get(threads::list))
        .route("/threads/{id}/messages", get(threads::messages))
        // Runs / traces / logs (observability).
        .route("/runs", get(runs::list))
        .route("/runs/{id}", get(runs::get_one))
        .route("/runs/{id}/trace", get(runs::trace))
        .route("/runs/{id}/logs", get(runs::logs))
        // Workflows.
        .route("/workflows/{id}/start", post(workflows::start))
        .route("/workflows/{id}/runs/{run_id}/resume", post(workflows::resume))
        .route("/workflows/{id}/runs/{run_id}/cancel", post(workflows::cancel))
        // Tasks.
        .route("/tasks", post(tasks::create).get(tasks::list))
        .route("/tasks/{id}", get(tasks::get_one))
        .route("/tasks/{id}/cancel", post(tasks::cancel))
        // Schedules.
        .route("/schedules", post(schedules::create).get(schedules::list))
        .route("/schedules/{id}", delete(schedules::remove))
        .route("/schedules/{id}/pause", post(schedules::pause))
        .route("/schedules/{id}/resume", post(schedules::resume))
        .route("/schedules/{id}/run", post(schedules::run_now))
        // Signals / webhooks / subscriptions.
        .route("/signals", post(signals::emit))
        .route("/webhooks/{hook}", post(signals::webhook))
        .route("/subscriptions", post(signals::subscribe).get(signals::list_subscriptions))
        .route("/subscriptions/{id}", delete(signals::unsubscribe))
        // HITL decisions.
        .route("/decisions/pending", get(decisions::pending))
        .route("/decisions/{id}/resolve", post(decisions::resolve))
        // User-created definitions.
        .route("/definitions/agents", put(definitions::put_agent).get(definitions::list_agents))
        .route("/definitions/flows", put(definitions::put_flow).get(definitions::list_flows))
        // MCP servers.
        .route("/mcp/servers", post(mcp::register).get(mcp::list))
        .route("/mcp/servers/{id}", delete(mcp::remove))
        .route("/mcp/servers/{id}/enable", post(mcp::enable))
        .route("/mcp/servers/{id}/disable", post(mcp::disable))
        // Generative UI.
        .route("/ui", get(ui::list).post(ui::create))
        .route("/ui/{id}", get(ui::get_one))
        .route("/ui/{id}/render", get(ui::render))
        // In-app messages (inbox + live SSE stream).
        .route("/messages", get(messages::list))
        .route("/messages/stream", get(messages::stream))
        // Browser bridge (extension polling).
        .route("/browser/sessions", post(browser::create_session))
        .route("/browser/sessions/{id}/commands", get(browser::next_command))
        .route("/browser/sessions/{id}/results", post(browser::submit_result))
        // Workspace files (extension context attach).
        .route("/workspace/files", get(workspace::read_file).put(workspace::write_file))
}
