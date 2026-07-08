//! # rustra-workflow
//!
//! The **harness layer**: deterministic, resumable flows — the Rust
//! analogue of Mastra workflows (`createWorkflow` / `createStep`). Where
//! agents reason freely, flows execute a declared graph:
//!
//! * Control flow mirrors Mastra: [`WorkflowBuilder::then`],
//!   [`parallel`](WorkflowBuilder::parallel), [`branch`](WorkflowBuilder::branch),
//!   [`foreach`](WorkflowBuilder::foreach), [`dowhile`](WorkflowBuilder::dowhile),
//!   [`dountil`](WorkflowBuilder::dountil), [`map`](WorkflowBuilder::map),
//!   [`sleep`](WorkflowBuilder::sleep),
//!   [`wait_for_event`](WorkflowBuilder::wait_for_event), finished by
//!   [`commit`](WorkflowBuilder::commit).
//! * **Checkpoints**: run state is snapshotted to storage before every node,
//!   so runs survive restarts.
//! * **Suspend/resume**: any step can suspend (HITL approval, awaited
//!   input, external events); [`Workflow::resume`] continues from the exact
//!   node with the caller's resume data. Approval/input suspensions
//!   automatically create pending `DecisionRecord`s for inspection.
//! * **Retries**: per-step policies with exponential backoff, each retry
//!   traced.
//! * **Watch**: every lifecycle transition is broadcast to
//!   [`Workflow::watch`] subscribers and recorded in observability.

mod builder;
mod definition;
mod engine;
mod step;

pub use builder::{arc_step, cond, WorkflowBuilder};
pub use definition::{FlowDefinition, FlowStepDef};
pub use engine::Workflow;
pub use step::{approval_step, FunctionStep, RetryPolicy, Step, StepContext, StepOutcome};

use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

/// Predicate over a node's input (`branch`) or a loop step's output
/// (`dowhile`/`dountil`, which also receives the iteration count).
pub type Condition = Arc<dyn Fn(&Value, u32) -> bool + Send + Sync>;

/// Context handed to [`WorkflowBuilder::map`] transforms.
#[derive(Debug, Clone, Copy)]
pub struct MapContext<'a> {
    pub input: &'a Value,
    pub init: &'a Value,
    pub steps: &'a HashMap<String, Value>,
}

/// Lifecycle statuses persisted with snapshots (Mastra status values).
pub mod flow_status {
    pub const RUNNING: &str = "running";
    pub const WAITING: &str = "waiting";
    pub const SUSPENDED: &str = "suspended";
    pub const SUCCESS: &str = "success";
    pub const FAILED: &str = "failed";
    pub const CANCELLED: &str = "cancelled";
}

/// The kind of a [`WorkflowEvent`] — one lifecycle transition.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowEventKind {
    StepStarted,
    StepCompleted,
    Suspended,
    Waiting,
    Completed,
    Failed,
}

impl WorkflowEventKind {
    /// The snake_case name this kind serializes to.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::StepStarted => "step_started",
            Self::StepCompleted => "step_completed",
            Self::Suspended => "suspended",
            Self::Waiting => "waiting",
            Self::Completed => "completed",
            Self::Failed => "failed",
        }
    }
}

impl std::fmt::Display for WorkflowEventKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// A watch event emitted at every lifecycle transition.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct WorkflowEvent {
    pub run_id: String,
    pub workflow_id: String,
    pub kind: WorkflowEventKind,
    pub step: Option<String>,
    pub data: Value,
}

/// The terminal (or paused) state of one `start`/`resume` call.
#[derive(Debug, Clone, PartialEq)]
pub enum FlowOutcome {
    Success(Value),
    Suspended {
        step_id: String,
        /// What the suspender needs (approval prompt, awaited event, ...).
        payload: Value,
    },
}

/// Result of driving a run.
#[derive(Debug, Clone, PartialEq)]
pub struct FlowRunResult {
    pub run_id: String,
    pub outcome: FlowOutcome,
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_core::{Error, Principal, RuntimeContext};
    use rustra_storage::{InMemoryStorage, SharedStorage};
    use serde_json::json;
    use std::time::Duration;

    fn runtime() -> RuntimeContext {
        RuntimeContext::new(Principal::user("user-1"))
    }

    fn double_step(id: &str) -> FunctionStep {
        FunctionStep::new(id, |ctx| async move {
            let n = ctx.input["n"].as_i64().unwrap_or(0);
            Ok(StepOutcome::Done(json!({ "n": n * 2 })))
        })
    }

    #[tokio::test]
    async fn sequential_then_chain() {
        let wf = Workflow::builder("doubler")
            .then(double_step("a"))
            .then(double_step("b"))
            .commit();
        let result = wf.start(json!({"n": 3}), runtime()).await.unwrap();
        match result.outcome {
            FlowOutcome::Success(v) => assert_eq!(v["n"], 12),
            other => panic!("unexpected outcome: {other:?}"),
        }
    }

    #[tokio::test]
    async fn parallel_outputs_keyed_by_step_id() {
        let wf = Workflow::builder("par")
            .parallel(vec![
                arc_step(double_step("x")),
                arc_step(FunctionStep::new("y", |ctx| async move {
                    Ok(StepOutcome::Done(
                        json!({ "n": ctx.input["n"].as_i64().unwrap() + 1 }),
                    ))
                })),
            ])
            .commit();
        let result = wf.start(json!({"n": 5}), runtime()).await.unwrap();
        match result.outcome {
            FlowOutcome::Success(v) => {
                assert_eq!(v["x"]["n"], 10);
                assert_eq!(v["y"]["n"], 6);
            }
            other => panic!("unexpected outcome: {other:?}"),
        }
    }

    #[tokio::test]
    async fn branch_takes_first_matching_arm() {
        let wf = Workflow::builder("br")
            .branch(vec![
                (
                    cond(|v| v["n"].as_i64().unwrap_or(0) > 100),
                    arc_step(FunctionStep::new("big", |_| async {
                        Ok(StepOutcome::Done(json!("big")))
                    })),
                ),
                (
                    cond(|_| true),
                    arc_step(FunctionStep::new("small", |_| async {
                        Ok(StepOutcome::Done(json!("small")))
                    })),
                ),
            ])
            .commit();
        let result = wf.start(json!({"n": 5}), runtime()).await.unwrap();
        assert!(matches!(result.outcome, FlowOutcome::Success(v) if v == json!("small")));
    }

    #[tokio::test]
    async fn foreach_maps_arrays_and_dountil_loops() {
        let wf = Workflow::builder("combo")
            .foreach(double_step("dbl"), 2)
            .map(|ctx| {
                let total: i64 = ctx
                    .input
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|v| v["n"].as_i64().unwrap())
                    .sum();
                json!({ "n": total })
            })
            .dountil(
                FunctionStep::new("inc", |ctx| async move {
                    Ok(StepOutcome::Done(
                        json!({ "n": ctx.input["n"].as_i64().unwrap() + 1 }),
                    ))
                }),
                Arc::new(|v, _| v["n"].as_i64().unwrap_or(0) >= 30),
            )
            .commit();
        let result = wf
            .start(json!([{"n": 1}, {"n": 2}, {"n": 3}]), runtime())
            .await
            .unwrap();
        // foreach: [2,4,6] → map: 12 → dountil increments to 30.
        assert!(matches!(result.outcome, FlowOutcome::Success(v) if v["n"] == 30));
    }

    #[tokio::test]
    async fn suspend_resume_with_approval_creates_decision() {
        let storage: SharedStorage = Arc::new(InMemoryStorage::new());
        let wf = Workflow::builder("deploy")
            .then(double_step("prep"))
            .then(approval_step("gate", "Deploy to production?"))
            .then(double_step("ship"))
            .storage(storage.clone())
            .commit();

        let result = wf.start(json!({"n": 1}), runtime()).await.unwrap();
        let run_id = result.run_id.clone();
        let FlowOutcome::Suspended { step_id, payload } = result.outcome else {
            panic!("expected suspension");
        };
        assert_eq!(step_id, "gate");
        assert_eq!(payload["kind"], "approval");

        // A pending decision was created for HITL inspection.
        let decisions = storage
            .list_decisions("user-1", true, rustra_storage::Page::default())
            .await
            .unwrap();
        assert_eq!(decisions.len(), 1);
        assert_eq!(decisions[0].prompt, "Deploy to production?");

        // Snapshot persisted as suspended.
        let snap = storage.load_snapshot(&run_id).await.unwrap().unwrap();
        assert_eq!(snap.status, "suspended");

        // Resume approved → flow completes: 1*2=2 (gate passthrough) *2=4.
        let resumed = wf
            .resume(&run_id, json!({"approved": true}), runtime())
            .await
            .unwrap();
        assert!(matches!(resumed.outcome, FlowOutcome::Success(v) if v["n"] == 4));
        let snap = storage.load_snapshot(&run_id).await.unwrap().unwrap();
        assert_eq!(snap.status, "success");
    }

    #[tokio::test]
    async fn resume_is_user_scoped() {
        let storage: SharedStorage = Arc::new(InMemoryStorage::new());
        let wf = Workflow::builder("guarded")
            .then(approval_step("gate", "ok?"))
            .storage(storage)
            .commit();
        let result = wf.start(json!({}), runtime()).await.unwrap();
        let err = wf
            .resume(
                &result.run_id,
                json!({"approved": true}),
                RuntimeContext::new(Principal::user("mallory")),
            )
            .await
            .unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));
    }

    #[tokio::test]
    async fn wait_for_event_suspends_until_resumed() {
        let storage: SharedStorage = Arc::new(InMemoryStorage::new());
        let wf = Workflow::builder("evented")
            .wait_for_event("payment.confirmed")
            .then(FunctionStep::new("after", |ctx| async move {
                Ok(StepOutcome::Done(json!({ "got": ctx.input })))
            }))
            .storage(storage)
            .commit();

        let result = wf.start(json!({}), runtime()).await.unwrap();
        let FlowOutcome::Suspended { payload, .. } = result.outcome else {
            panic!("expected suspension");
        };
        assert_eq!(payload["event"], "payment.confirmed");

        let resumed = wf
            .resume(&result.run_id, json!({"amount": 42}), runtime())
            .await
            .unwrap();
        assert!(matches!(resumed.outcome, FlowOutcome::Success(v) if v["got"]["amount"] == 42));
    }

    #[tokio::test]
    async fn retries_with_backoff_then_succeeds() {
        use std::sync::atomic::{AtomicU32, Ordering};
        static ATTEMPTS: AtomicU32 = AtomicU32::new(0);

        let flaky = FunctionStep::new("flaky", |_| async {
            if ATTEMPTS.fetch_add(1, Ordering::SeqCst) < 2 {
                Err(Error::Unavailable("transient".into()))
            } else {
                Ok(StepOutcome::Done(json!("ok")))
            }
        })
        .with_retries(3, Duration::from_millis(1));

        let wf = Workflow::builder("retry").then(flaky).commit();
        let result = wf.start(json!({}), runtime()).await.unwrap();
        assert!(matches!(result.outcome, FlowOutcome::Success(v) if v == json!("ok")));
        assert_eq!(ATTEMPTS.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn watch_receives_lifecycle_events() {
        let wf = Workflow::builder("watched")
            .then(double_step("only"))
            .commit();
        let mut rx = wf.watch();
        wf.start(json!({"n": 1}), runtime()).await.unwrap();
        let mut kinds = Vec::new();
        while let Ok(event) = rx.try_recv() {
            kinds.push(event.kind.as_str());
        }
        assert_eq!(kinds, vec!["step_started", "step_completed", "completed"]);
    }
}
