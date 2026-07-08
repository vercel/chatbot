//! User-created agent and flow definitions.

use std::sync::Arc;

use axum::extract::{Query, State};
use axum::Json;

use rustra::{AgentDefinition, FlowDefinition, Rustra};
use rustra_core::ResourceKind;
use rustra_storage::types::DefinitionRecord;

use crate::auth::AuthedUser;
use crate::error::ApiResult;
use crate::routes::PageQuery;

/// `PUT /api/definitions/agents`.
pub(crate) async fn put_agent(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Json(definition): Json<AgentDefinition>,
) -> ApiResult<Json<DefinitionRecord>> {
    Ok(Json(
        rustra.save_agent_definition(&principal, definition).await?,
    ))
}

/// `PUT /api/definitions/flows`.
pub(crate) async fn put_flow(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Json(definition): Json<FlowDefinition>,
) -> ApiResult<Json<DefinitionRecord>> {
    Ok(Json(
        rustra.save_flow_definition(&principal, definition).await?,
    ))
}

async fn list(
    rustra: &Rustra,
    user_id: &str,
    kind: ResourceKind,
    page: PageQuery,
) -> ApiResult<Json<Vec<DefinitionRecord>>> {
    let records = rustra
        .storage()
        .list_definitions(kind, user_id, true, page.page())
        .await?;
    Ok(Json(records))
}

/// `GET /api/definitions/agents` — the caller's (plus shared) definitions.
pub(crate) async fn list_agents(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Query(page): Query<PageQuery>,
) -> ApiResult<Json<Vec<DefinitionRecord>>> {
    list(&rustra, &principal.user_id, ResourceKind::Agent, page).await
}

/// `GET /api/definitions/flows`.
pub(crate) async fn list_flows(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Query(page): Query<PageQuery>,
) -> ApiResult<Json<Vec<DefinitionRecord>>> {
    list(&rustra, &principal.user_id, ResourceKind::Flow, page).await
}
