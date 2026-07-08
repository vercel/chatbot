//! Workspace file access (extension context attach).

use std::sync::Arc;

use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};

use rustra::Rustra;

use crate::auth::AuthedUser;
use crate::error::ApiResult;

#[derive(Debug, Deserialize)]
pub(crate) struct ReadFileQuery {
    path: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct ReadFileResponse {
    path: String,
    content: String,
}

/// `GET /api/workspace/files?path=` — read a file from the caller's
/// workspace (paths are workspace-relative; traversal is rejected by the
/// workspace layer).
pub(crate) async fn read_file(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Query(query): Query<ReadFileQuery>,
) -> ApiResult<Json<ReadFileResponse>> {
    let workspace = rustra
        .workspaces()
        .workspace_for_user(&principal.user_id)
        .await?;
    let content = workspace.read_file(&query.path).await?;
    Ok(Json(ReadFileResponse {
        path: query.path,
        content,
    }))
}

#[derive(Debug, Deserialize)]
pub(crate) struct WriteFileRequest {
    path: String,
    content: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct WriteFileResponse {
    ok: bool,
    path: String,
}

/// `PUT /api/workspace/files` — write (create or overwrite) a file in the
/// caller's workspace.
pub(crate) async fn write_file(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Json(body): Json<WriteFileRequest>,
) -> ApiResult<Json<WriteFileResponse>> {
    let workspace = rustra
        .workspaces()
        .workspace_for_user(&principal.user_id)
        .await?;
    workspace.write_file(&body.path, &body.content).await?;
    Ok(Json(WriteFileResponse {
        ok: true,
        path: body.path,
    }))
}
