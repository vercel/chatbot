//! Workspace file access (extension context attach).

use std::sync::Arc;

use axum::extract::{Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use rustra::Rustra;

use crate::auth::AuthedUser;
use crate::error::ApiResult;

#[derive(Debug, Deserialize)]
pub(crate) struct ReadFileQuery {
    path: String,
}

/// `GET /api/workspace/files?path=` — read a file from the caller's
/// workspace (paths are workspace-relative; traversal is rejected by the
/// workspace layer).
pub(crate) async fn read_file(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Query(query): Query<ReadFileQuery>,
) -> ApiResult<Json<Value>> {
    let workspace = rustra.workspaces().workspace_for_user(&principal.user_id).await?;
    let content = workspace.read_file(&query.path).await?;
    Ok(Json(json!({ "path": query.path, "content": content })))
}

#[derive(Debug, Deserialize)]
pub(crate) struct WriteFileRequest {
    path: String,
    content: String,
}

/// `PUT /api/workspace/files` — write (create or overwrite) a file in the
/// caller's workspace.
pub(crate) async fn write_file(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Json(body): Json<WriteFileRequest>,
) -> ApiResult<Json<Value>> {
    let workspace = rustra.workspaces().workspace_for_user(&principal.user_id).await?;
    workspace.write_file(&body.path, &body.content).await?;
    Ok(Json(json!({ "ok": true, "path": body.path })))
}
