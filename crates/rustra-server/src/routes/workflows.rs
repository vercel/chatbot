//! Workflow start / resume / cancel.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use rustra::{Rustra, RuntimeContext, Workflow};
use rustra_core::{Error, Principal};
use rustra_workflow::{FlowOutcome, FlowRunResult};

use crate::auth::AuthedUser;
use crate::error::ApiResult;

/// Resolve a workflow: the in-process registry first, then a stored flow
/// definition instantiated on the caller's behalf.
async fn resolve(
    rustra: &Rustra,
    principal: &Principal,
    id: &str,
) -> Result<Arc<Workflow>, Error> {
    match rustra.workflow(id) {
        Ok(workflow) => Ok(workflow),
        Err(Error::NotFound { .. }) => rustra.instantiate_flow(principal, id).await,
        Err(error) => Err(error),
    }
}

fn outcome_json(result: FlowRunResult) -> Value {
    match result.outcome {
        FlowOutcome::Success(output) => json!({
            "run_id": result.run_id,
            "status": "success",
            "output": output,
        }),
        FlowOutcome::Suspended { step_id, payload } => json!({
            "run_id": result.run_id,
            "status": "suspended",
            "step_id": step_id,
            "payload": payload,
        }),
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
) -> ApiResult<Json<Value>> {
    let workflow = resolve(&rustra, &principal, &id).await?;
    let result = workflow.start(body.input, RuntimeContext::new(principal)).await?;
    Ok(Json(outcome_json(result)))
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
) -> ApiResult<Json<Value>> {
    let workflow = resolve(&rustra, &principal, &id).await?;
    let result = workflow.resume(&run_id, body.data, RuntimeContext::new(principal)).await?;
    Ok(Json(outcome_json(result)))
}

/// `POST /api/workflows/{id}/runs/{run_id}/cancel`.
pub(crate) async fn cancel(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path((id, run_id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    let workflow = resolve(&rustra, &principal, &id).await?;
    workflow.cancel(&run_id, RuntimeContext::new(principal)).await?;
    Ok(Json(json!({ "run_id": run_id, "status": "cancelled" })))
}
