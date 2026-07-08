//! Observability: runs, trace spans, and logs.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;

use rustra::Rustra;
use rustra_storage::types::{LogRecord, RunRecord, TraceSpan};

use crate::auth::AuthedUser;
use crate::error::ApiResult;
use crate::routes::PageQuery;

#[derive(Debug, Deserialize)]
pub(crate) struct RunsQuery {
    kind: Option<String>,
    status: Option<String>,
}

/// `GET /api/runs` — the caller's runs, optionally filtered by kind/status.
pub(crate) async fn list(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Query(query): Query<RunsQuery>,
    Query(page): Query<PageQuery>,
) -> ApiResult<Json<Vec<RunRecord>>> {
    let runs = rustra
        .storage()
        .list_runs(
            &principal.user_id,
            query.kind.as_deref(),
            query.status.as_deref(),
            page.page(),
        )
        .await?;
    Ok(Json(runs))
}

/// `GET /api/runs/{id}`.
pub(crate) async fn get_one(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(run_id): Path<String>,
) -> ApiResult<Json<RunRecord>> {
    Ok(Json(rustra.run_scoped(&principal, &run_id).await?))
}

/// `GET /api/runs/{id}/trace` — all spans of the run's trace.
pub(crate) async fn trace(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(run_id): Path<String>,
) -> ApiResult<Json<Vec<TraceSpan>>> {
    let run = rustra.run_scoped(&principal, &run_id).await?;
    Ok(Json(rustra.storage().list_spans(&run.trace_id).await?))
}

/// `GET /api/runs/{id}/logs`.
pub(crate) async fn logs(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(run_id): Path<String>,
    Query(page): Query<PageQuery>,
) -> ApiResult<Json<Vec<LogRecord>>> {
    let run = rustra.run_scoped(&principal, &run_id).await?;
    Ok(Json(
        rustra
            .storage()
            .list_logs(None, Some(&run.id), page.page())
            .await?,
    ))
}
