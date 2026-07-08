//! Task submission and supervision.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use rustra::{Rustra, TaskOptions};
use rustra_storage::types::TaskRecord;

use crate::auth::AuthedUser;
use crate::error::ApiResult;
use crate::routes::PageQuery;

#[derive(Debug, Deserialize)]
pub(crate) struct CreateTaskRequest {
    /// `{ "target": "agent"|"workflow", "id": ..., "input": ... }`.
    spec: Value,
    /// `true` submits and returns immediately; `false` (default) runs the
    /// task inline and returns the final record.
    #[serde(default)]
    background: bool,
    #[serde(default)]
    max_retries: Option<u32>,
}

/// `POST /api/tasks`.
pub(crate) async fn create(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Json(body): Json<CreateTaskRequest>,
) -> ApiResult<Json<TaskRecord>> {
    let options = TaskOptions {
        max_retries: body.max_retries.unwrap_or(0),
        ..TaskOptions::default()
    };
    let record = if body.background {
        rustra.tasks().submit(&principal, body.spec, options).await?
    } else {
        rustra.tasks().run_now(&principal, body.spec, options).await?
    };
    Ok(Json(record))
}

#[derive(Debug, Deserialize)]
pub(crate) struct TasksQuery {
    status: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
}

/// `GET /api/tasks`.
pub(crate) async fn list(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Query(query): Query<TasksQuery>,
) -> ApiResult<Json<Vec<TaskRecord>>> {
    let page = PageQuery { limit: query.limit, offset: query.offset }.page();
    let tasks = rustra.tasks().list(&principal, query.status.as_deref(), page).await?;
    Ok(Json(tasks))
}

/// `GET /api/tasks/{id}`.
pub(crate) async fn get_one(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(task_id): Path<String>,
) -> ApiResult<Json<TaskRecord>> {
    Ok(Json(rustra.tasks().get(&principal, &task_id).await?))
}

/// `POST /api/tasks/{id}/cancel`.
pub(crate) async fn cancel(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(task_id): Path<String>,
) -> ApiResult<Json<Value>> {
    rustra.tasks().cancel(&principal, &task_id).await?;
    Ok(Json(json!({ "ok": true })))
}
