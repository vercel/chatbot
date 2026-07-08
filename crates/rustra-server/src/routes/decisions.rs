//! Human-in-the-loop decisions.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

use rustra::Rustra;
use rustra_core::Error;
use rustra_storage::types::DecisionRecord;
use rustra_tasks::decision_status;

use crate::auth::AuthedUser;
use crate::error::ApiResult;

/// `GET /api/decisions/pending`.
pub(crate) async fn pending(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
) -> ApiResult<Json<Vec<DecisionRecord>>> {
    Ok(Json(rustra.interrupts().pending(&principal).await?))
}

#[derive(Debug, Deserialize)]
pub(crate) struct ResolveRequest {
    status: String,
    #[serde(default)]
    resolution: Value,
}

const RESOLVED_STATUSES: [&str; 4] = [
    decision_status::APPROVED,
    decision_status::REJECTED,
    decision_status::ANSWERED,
    decision_status::CANCELLED,
];

/// `POST /api/decisions/{id}/resolve`.
pub(crate) async fn resolve(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
    Json(body): Json<ResolveRequest>,
) -> ApiResult<Json<DecisionRecord>> {
    if !RESOLVED_STATUSES.contains(&body.status.as_str()) {
        return Err(Error::Validation(format!(
            "decision status `{}` must be one of {RESOLVED_STATUSES:?}",
            body.status
        ))
        .into());
    }
    let record = rustra
        .interrupts()
        .resolve(&principal, &id, &body.status, body.resolution)
        .await?;
    Ok(Json(record))
}
