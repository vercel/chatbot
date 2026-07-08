//! Observability: runs, trace spans, and logs.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;

use rustra::Rustra;
use rustra_core::{Error, Principal};
use rustra_storage::types::{LogRecord, RunRecord, TraceSpan};

use crate::auth::AuthedUser;
use crate::error::ApiResult;
use crate::routes::PageQuery;

#[derive(Debug, Deserialize)]
pub(crate) struct RunsQuery {
    kind: Option<String>,
    status: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
}

/// `GET /api/runs` — the caller's runs, optionally filtered by kind/status.
pub(crate) async fn list(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Query(query): Query<RunsQuery>,
) -> ApiResult<Json<Vec<RunRecord>>> {
    let page = PageQuery { limit: query.limit, offset: query.offset }.page();
    let runs = rustra
        .storage()
        .list_runs(&principal.user_id, query.kind.as_deref(), query.status.as_deref(), page)
        .await?;
    Ok(Json(runs))
}

/// Fetch a run, enforcing owner-or-admin scope.
async fn owned_run(rustra: &Rustra, principal: &Principal, run_id: &str) -> Result<RunRecord, Error> {
    let run = rustra
        .storage()
        .get_run(run_id)
        .await?
        .ok_or_else(|| Error::not_found("run", run_id))?;
    if run.user_id != principal.user_id && !principal.is_admin() {
        return Err(Error::PermissionDenied(format!("run `{run_id}` belongs to another user")));
    }
    Ok(run)
}

/// `GET /api/runs/{id}`.
pub(crate) async fn get_one(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(run_id): Path<String>,
) -> ApiResult<Json<RunRecord>> {
    Ok(Json(owned_run(&rustra, &principal, &run_id).await?))
}

/// `GET /api/runs/{id}/trace` — all spans of the run's trace.
pub(crate) async fn trace(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(run_id): Path<String>,
) -> ApiResult<Json<Vec<TraceSpan>>> {
    let run = owned_run(&rustra, &principal, &run_id).await?;
    Ok(Json(rustra.storage().list_spans(&run.trace_id).await?))
}

/// `GET /api/runs/{id}/logs`.
pub(crate) async fn logs(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(run_id): Path<String>,
    Query(page): Query<PageQuery>,
) -> ApiResult<Json<Vec<LogRecord>>> {
    let run = owned_run(&rustra, &principal, &run_id).await?;
    Ok(Json(rustra.storage().list_logs(None, Some(&run.id), page.page()).await?))
}
