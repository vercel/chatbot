//! Signals, webhooks, and persisted event subscriptions.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use rustra::{Event, Rustra};
use rustra_storage::types::{SubscriptionRecord, TaskRecord};

use crate::auth::AuthedUser;
use crate::error::ApiResult;
use crate::routes::PageQuery;

#[derive(Debug, Deserialize)]
pub(crate) struct EmitRequest {
    name: String,
    #[serde(default)]
    payload: Value,
}

/// `POST /api/signals` — emit a user-scoped event; returns the tasks
/// launched by matching subscriptions.
pub(crate) async fn emit(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Json(body): Json<EmitRequest>,
) -> ApiResult<Json<Vec<TaskRecord>>> {
    let event = Event::new(body.name, body.payload, "user").for_user(&principal.user_id);
    Ok(Json(rustra.signals().emit(event).await?))
}

/// `POST /api/webhooks/{hook}` — deliver a webhook payload as
/// `webhook.<hook>` scoped to the authenticated user.
pub(crate) async fn webhook(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(hook): Path<String>,
    Json(payload): Json<Value>,
) -> ApiResult<Json<Vec<TaskRecord>>> {
    Ok(Json(rustra.signals().emit_webhook(&principal, &hook, payload).await?))
}

#[derive(Debug, Deserialize)]
pub(crate) struct SubscribeRequest {
    pattern: String,
    #[serde(default)]
    spec: Value,
}

/// `POST /api/subscriptions`.
pub(crate) async fn subscribe(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Json(body): Json<SubscribeRequest>,
) -> ApiResult<Json<SubscriptionRecord>> {
    Ok(Json(rustra.signals().subscribe(&principal, body.pattern, body.spec).await?))
}

/// `GET /api/subscriptions`.
pub(crate) async fn list_subscriptions(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Query(page): Query<PageQuery>,
) -> ApiResult<Json<Vec<SubscriptionRecord>>> {
    Ok(Json(rustra.signals().list(&principal, page.page()).await?))
}

/// `DELETE /api/subscriptions/{id}`.
pub(crate) async fn unsubscribe(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    rustra.signals().unsubscribe(&principal, &id).await?;
    Ok(Json(json!({ "ok": true })))
}
