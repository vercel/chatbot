//! Browser bridge: the endpoints the client-side executor (Chrome
//! extension) polls to receive commands and report results.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;
use serde::{Deserialize, Serialize};

use rustra::Rustra;
use rustra_browser::{BrowserActionResult, IssuedCommand};

use crate::auth::AuthedUser;
use crate::error::ApiResult;

#[derive(Debug, Serialize)]
pub(crate) struct CreateSessionResponse {
    id: String,
}

/// `POST /api/browser/sessions` — open a session owned by the caller.
pub(crate) async fn create_session(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
) -> ApiResult<Json<CreateSessionResponse>> {
    let session = rustra.browser().create_session(&principal.user_id);
    Ok(Json(CreateSessionResponse {
        id: session.id().to_string(),
    }))
}

#[derive(Debug, Serialize)]
pub(crate) struct NextCommandResponse {
    command: Option<IssuedCommand>,
}

/// `GET /api/browser/sessions/{id}/commands` — pop the next queued command;
/// `{"command": null}` when the queue is empty (the extension polls).
pub(crate) async fn next_command(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
) -> ApiResult<Json<NextCommandResponse>> {
    let session = rustra.browser().get(&principal.user_id, &id)?;
    Ok(Json(NextCommandResponse {
        command: session.next_command(),
    }))
}

#[derive(Debug, Deserialize)]
pub(crate) struct SubmitResultRequest {
    command_id: String,
    result: BrowserActionResult,
}

/// `POST /api/browser/sessions/{id}/results` — answer an in-flight command.
pub(crate) async fn submit_result(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
    Json(body): Json<SubmitResultRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    let session = rustra.browser().get(&principal.user_id, &id)?;
    session.submit_result(&body.command_id, body.result)?;
    Ok(super::ok())
}
