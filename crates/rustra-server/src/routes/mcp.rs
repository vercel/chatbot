//! MCP server configuration endpoints.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;
use serde_json::Value;

use rustra::Rustra;
use rustra_mcp::McpServerDefinition;
use rustra_storage::types::McpServerRecord;

use crate::auth::AuthedUser;
use crate::error::ApiResult;

/// `POST /api/mcp/servers`.
pub(crate) async fn register(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Json(definition): Json<McpServerDefinition>,
) -> ApiResult<Json<McpServerRecord>> {
    Ok(Json(rustra.mcp().register(&principal, definition).await?))
}

/// `GET /api/mcp/servers` — the caller's servers plus shared ones.
pub(crate) async fn list(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
) -> ApiResult<Json<Vec<McpServerRecord>>> {
    Ok(Json(
        rustra.mcp().list_for_user(&principal.user_id, true).await?,
    ))
}

/// `POST /api/mcp/servers/{id}/enable`.
pub(crate) async fn enable(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
) -> ApiResult<Json<McpServerRecord>> {
    Ok(Json(rustra.mcp().set_enabled(&principal, &id, true).await?))
}

/// `POST /api/mcp/servers/{id}/disable`.
pub(crate) async fn disable(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
) -> ApiResult<Json<McpServerRecord>> {
    Ok(Json(
        rustra.mcp().set_enabled(&principal, &id, false).await?,
    ))
}

/// `DELETE /api/mcp/servers/{id}`.
pub(crate) async fn remove(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    rustra.mcp().remove(&principal, &id).await?;
    Ok(super::ok())
}
