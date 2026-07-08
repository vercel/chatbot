//! Agent invocation endpoints.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;
use serde::{Deserialize, Serialize};

use rustra::{Agent, AgentInput, Principal, RuntimeContext, Rustra};

use crate::auth::AuthedUser;
use crate::error::ApiResult;

#[derive(Debug, Deserialize)]
pub(crate) struct GenerateRequest {
    message: String,
    #[serde(default)]
    thread_id: Option<String>,
}

/// The `POST /api/agents/.../generate` response body. Mirrors the reported
/// fields of [`rustra::AgentResponse`] as a typed wire contract.
#[derive(Debug, Serialize)]
pub(crate) struct GenerateResponse {
    text: String,
    run_id: String,
    trace_id: String,
    thread_id: Option<String>,
    steps: usize,
}

/// `POST /api/agents/main/generate` — the caller's main agent.
pub(crate) async fn generate_main(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Json(body): Json<GenerateRequest>,
) -> ApiResult<Json<GenerateResponse>> {
    let agent = rustra.main_agent_for(&principal.user_id).await?;
    generate(agent, principal, body).await
}

/// `POST /api/agents/{id}/generate` — a registered agent, falling back to a
/// stored agent definition when the id is not in the registry.
pub(crate) async fn generate_by_id(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
    Json(body): Json<GenerateRequest>,
) -> ApiResult<Json<GenerateResponse>> {
    let agent = rustra.resolve_agent(&principal, &id).await?;
    generate(agent, principal, body).await
}

async fn generate(
    agent: Arc<Agent>,
    principal: Principal,
    body: GenerateRequest,
) -> ApiResult<Json<GenerateResponse>> {
    let mut input = AgentInput::new(body.message);
    if let Some(thread_id) = body.thread_id {
        input = input.in_thread(thread_id);
    }
    let response = agent
        .generate(input, RuntimeContext::new(principal))
        .await?;
    Ok(Json(GenerateResponse {
        text: response.text,
        run_id: response.run_id,
        trace_id: response.trace_id,
        thread_id: response.thread_id,
        steps: response.steps,
    }))
}
