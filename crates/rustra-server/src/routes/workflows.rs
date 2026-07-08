//! Workflow start / resume / cancel.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use rustra::{RuntimeContext, Rustra};
use rustra_workflow::{FlowOutcome, FlowRunResult};

use crate::auth::AuthedUser;
use crate::error::ApiResult;

/// The three terminal shapes of a workflow start/resume/cancel, tagged by
/// `status`. Reproduces the previous hand-rolled `json!` bodies as one typed
/// wire contract.
#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub(crate) enum WorkflowOutcomeResponse {
    Success {
        run_id: String,
        output: Value,
    },
    Suspended {
        run_id: String,
        step_id: String,
        payload: Value,
    },
    Cancelled {
        run_id: String,
    },
}

impl From<FlowRunResult> for WorkflowOutcomeResponse {
    fn from(result: FlowRunResult) -> Self {
        match result.outcome {
            FlowOutcome::Success(output) => WorkflowOutcomeResponse::Success {
                run_id: result.run_id,
                output,
            },
            FlowOutcome::Suspended { step_id, payload } => WorkflowOutcomeResponse::Suspended {
                run_id: result.run_id,
                step_id,
                payload,
            },
        }
    }
}

#[derive(Debug, Deserialize)]
pub(crate) struct StartRequest {
    #[serde(default)]
    input: Value,
}

/// `POST /api/workflows/{id}/start`.
pub(crate) async fn start(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
    Json(body): Json<StartRequest>,
) -> ApiResult<Json<WorkflowOutcomeResponse>> {
    let workflow = rustra.resolve_workflow(&principal, &id).await?;
    let result = workflow
        .start(body.input, RuntimeContext::new(principal))
        .await?;
    Ok(Json(result.into()))
}

#[derive(Debug, Deserialize)]
pub(crate) struct ResumeRequest {
    #[serde(default)]
    data: Value,
}

/// `POST /api/workflows/{id}/runs/{run_id}/resume`.
pub(crate) async fn resume(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path((id, run_id)): Path<(String, String)>,
    Json(body): Json<ResumeRequest>,
) -> ApiResult<Json<WorkflowOutcomeResponse>> {
    let workflow = rustra.resolve_workflow(&principal, &id).await?;
    let result = workflow
        .resume(&run_id, body.data, RuntimeContext::new(principal))
        .await?;
    Ok(Json(result.into()))
}

/// `POST /api/workflows/{id}/runs/{run_id}/cancel`.
pub(crate) async fn cancel(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path((id, run_id)): Path<(String, String)>,
) -> ApiResult<Json<WorkflowOutcomeResponse>> {
    let workflow = rustra.resolve_workflow(&principal, &id).await?;
    workflow
        .cancel(&run_id, RuntimeContext::new(principal))
        .await?;
    Ok(Json(WorkflowOutcomeResponse::Cancelled { run_id }))
}
