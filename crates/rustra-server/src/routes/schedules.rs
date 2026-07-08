//! Cron schedules (Mastra's `mastra.schedules` API).

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

use rustra::Rustra;
use rustra_storage::types::ScheduleRecord;

use crate::auth::AuthedUser;
use crate::error::ApiResult;
use crate::routes::PageQuery;

#[derive(Debug, Deserialize)]
pub(crate) struct CreateScheduleRequest {
    name: String,
    cron: String,
    #[serde(default)]
    timezone: Option<String>,
    #[serde(default)]
    spec: Value,
}

/// `POST /api/schedules`.
pub(crate) async fn create(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Json(body): Json<CreateScheduleRequest>,
) -> ApiResult<Json<ScheduleRecord>> {
    let record = rustra
        .scheduler()
        .create(&principal, body.name, &body.cron, body.timezone, body.spec)
        .await?;
    Ok(Json(record))
}

/// `GET /api/schedules`.
pub(crate) async fn list(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Query(page): Query<PageQuery>,
) -> ApiResult<Json<Vec<ScheduleRecord>>> {
    Ok(Json(
        rustra.scheduler().list(&principal, page.page()).await?,
    ))
}

/// `POST /api/schedules/{id}/pause`.
pub(crate) async fn pause(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    rustra.scheduler().pause(&principal, &id).await?;
    Ok(super::ok())
}

/// `POST /api/schedules/{id}/resume`.
pub(crate) async fn resume(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    rustra.scheduler().resume(&principal, &id).await?;
    Ok(super::ok())
}

/// `POST /api/schedules/{id}/run` — fire immediately, outside the cadence.
pub(crate) async fn run_now(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    rustra.scheduler().run_now(&principal, &id).await?;
    Ok(super::ok())
}

/// `DELETE /api/schedules/{id}`.
pub(crate) async fn remove(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    rustra.scheduler().delete(&principal, &id).await?;
    Ok(super::ok())
}
