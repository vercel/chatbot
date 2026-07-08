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

mod definition;
mod step;

pub use definition::{FlowDefinition, FlowStepDef};
pub use step::{approval_step, FunctionStep, RetryPolicy, Step, StepContext, StepOutcome};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;

use rustra_core::{new_id, Error, Result, RuntimeContext};
use rustra_observability::{span_kind, ObservabilityHub, RunHandle};
use rustra_storage::types::{DecisionRecord, RunRecord, WorkflowSnapshot};
use rustra_storage::SharedStorage;

/// Predicate over a node's input (`branch`) or a loop step's output
/// (`dowhile`/`dountil`, which also receives the iteration count).
pub type Condition = Arc<dyn Fn(&Value, u32) -> bool + Send + Sync>;

/// Context handed to [`WorkflowBuilder::map`] transforms.
pub struct MapContext<'a> {
    pub input: &'a Value,
    pub init: &'a Value,
    pub steps: &'a HashMap<String, Value>,
}

type MapFn = Arc<dyn for<'a> Fn(MapContext<'a>) -> Value + Send + Sync>;

enum Node {
    Step(Arc<dyn Step>),
    /// All steps receive the node input; output is keyed by step id.
    Parallel(Vec<Arc<dyn Step>>),
    /// First condition that matches wins; its step's output flows on.
    Branch(Vec<(Condition, Arc<dyn Step>)>),
    /// Input must be an array; the step runs per element (bounded
    /// concurrency); output is the array of results.
    ForEach { step: Arc<dyn Step>, concurrency: usize },
    /// Repeat while (`negate = false`) or until (`negate = true`) the
    /// condition holds over the step's output.
    Loop { step: Arc<dyn Step>, condition: Condition, negate: bool },
    Map(MapFn),
    Sleep(Duration),
    /// Suspends until [`Workflow::resume`] delivers the named event.
    WaitForEvent(String),
}

impl Node {
    fn label(&self) -> String {
        match self {
            Node::Step(s) => s.id().to_string(),
            Node::Parallel(steps) => {
                format!("parallel[{}]", steps.iter().map(|s| s.id()).collect::<Vec<_>>().join(","))
            }
            Node::Branch(arms) => format!("branch[{} arms]", arms.len()),
            Node::ForEach { step, .. } => format!("foreach[{}]", step.id()),
            Node::Loop { step, negate, .. } => {
                format!("{}[{}]", if *negate { "dountil" } else { "dowhile" }, step.id())
            }
            Node::Map(_) => "map".to_string(),
            Node::Sleep(d) => format!("sleep[{}ms]", d.as_millis()),
            Node::WaitForEvent(name) => format!("wait_for_event[{name}]"),
        }
    }
}

/// Serialized run state — the checkpoint written before every node.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct RunState {
    cursor: usize,
    /// Input for the node at `cursor`.
    node_input: Value,
    /// The original workflow input.
    init: Value,
    step_results: HashMap<String, Value>,
    /// Present while suspended.
    suspended: Option<SuspendedInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SuspendedInfo {
    step_id: String,
    payload: Value,
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

/// A watch event emitted at every lifecycle transition.
#[derive(Debug, Clone, Serialize)]
pub struct WorkflowEvent {
    pub run_id: String,
    pub workflow_id: String,
    /// `step_started` | `step_completed` | `suspended` | `waiting` |
    /// `completed` | `failed`.
    pub kind: String,
    pub step: Option<String>,
    pub data: Value,
}

/// The terminal (or paused) state of one `start`/`resume` call.
#[derive(Debug, Clone)]
pub enum FlowOutcome {
    Success(Value),
    Suspended {
        step_id: String,
        /// What the suspender needs (approval prompt, awaited event, ...).
        payload: Value,
    },
}

/// Result of driving a run.
#[derive(Debug, Clone)]
pub struct FlowRunResult {
    pub run_id: String,
    pub outcome: FlowOutcome,
}

/// A committed, executable workflow. Cheap to share.
pub struct Workflow {
    id: String,
    nodes: Vec<Node>,
    storage: Option<SharedStorage>,
    hub: ObservabilityHub,
    events: broadcast::Sender<WorkflowEvent>,
}

impl Workflow {
    pub fn builder(id: impl Into<String>) -> WorkflowBuilder {
        WorkflowBuilder {
            id: id.into(),
            nodes: Vec::new(),
            storage: None,
            hub: ObservabilityHub::noop(),
        }
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    /// Subscribe to lifecycle events for all runs of this workflow.
    pub fn watch(&self) -> broadcast::Receiver<WorkflowEvent> {
        self.events.subscribe()
    }

    /// Start a new run.
    pub async fn start(&self, input: Value, runtime: RuntimeContext) -> Result<FlowRunResult> {
        let run = self
            .hub
            .start_run("workflow", &self.id, runtime.user_id(), input.clone())
            .await;
        let state = RunState {
            cursor: 0,
            node_input: input.clone(),
            init: input,
            step_results: HashMap::new(),
            suspended: None,
        };
        self.drive(run, state, None, runtime).await
    }

    /// Resume a suspended run with resume data (approval verdicts, awaited
    /// events, requested input).
    pub async fn resume(
        &self,
        run_id: &str,
        resume_data: Value,
        runtime: RuntimeContext,
    ) -> Result<FlowRunResult> {
        let storage = self.storage.as_ref().ok_or_else(|| {
            Error::Workflow("resume requires the workflow to be built with storage".into())
        })?;
        let snapshot = storage
            .load_snapshot(run_id)
            .await?
            .ok_or_else(|| Error::not_found("workflow_run", run_id))?;
        if snapshot.status != flow_status::SUSPENDED && snapshot.status != flow_status::WAITING {
            return Err(Error::Workflow(format!(
                "run `{run_id}` is `{}`, not suspended",
                snapshot.status
            )));
        }
        if snapshot.resource_id != runtime.user_id() && !runtime.principal().is_admin() {
            return Err(Error::PermissionDenied(format!(
                "run `{run_id}` belongs to another user"
            )));
        }
        let state: RunState = serde_json::from_value(snapshot.snapshot.clone())?;

        // Reattach to the original observability run.
        let run_record = storage.get_run(run_id).await?.unwrap_or_else(|| RunRecord {
            id: run_id.to_string(),
            kind: "workflow".into(),
            subject_id: self.id.clone(),
            user_id: snapshot.resource_id.clone(),
            status: flow_status::RUNNING.into(),
            input: state.init.clone(),
            output: Value::Null,
            error: None,
            trace_id: new_id("trc"),
            started_at: Utc::now(),
            ended_at: None,
            metadata: Value::Null,
        });
        let run = self.hub.attach_run(run_record);
        self.drive(run, state, Some(resume_data), runtime).await
    }

    /// Cancel a suspended/waiting run.
    pub async fn cancel(&self, run_id: &str, runtime: RuntimeContext) -> Result<()> {
        let storage = self.storage.as_ref().ok_or_else(|| {
            Error::Workflow("cancel requires the workflow to be built with storage".into())
        })?;
        let mut snapshot = storage
            .load_snapshot(run_id)
            .await?
            .ok_or_else(|| Error::not_found("workflow_run", run_id))?;
        if snapshot.resource_id != runtime.user_id() && !runtime.principal().is_admin() {
            return Err(Error::PermissionDenied(format!(
                "run `{run_id}` belongs to another user"
            )));
        }
        snapshot.status = flow_status::CANCELLED.to_string();
        snapshot.updated_at = Utc::now();
        storage.save_snapshot(snapshot).await?;
        Ok(())
    }

    // -- Engine ---------------------------------------------------------------

    async fn drive(
        &self,
        run: RunHandle,
        mut state: RunState,
        mut resume: Option<Value>,
        runtime: RuntimeContext,
    ) -> Result<FlowRunResult> {
        let run_id = run.run_id().to_string();
        state.suspended = None;

        while state.cursor < self.nodes.len() {
            let node = &self.nodes[state.cursor];
            self.checkpoint(&run_id, &state, flow_status::RUNNING, &runtime).await?;
            self.emit(&run_id, "step_started", Some(node.label()), Value::Null);

            let span = run
                .span(&node.label(), span_kind::FLOW_STEP, state.node_input.clone())
                .await;
            let outcome = self.execute_node(node, &state, resume.take(), &runtime, &run).await;

            match outcome {
                Ok(StepOutcome::Done(output)) => {
                    span.end_ok(output.clone()).await;
                    self.emit(&run_id, "step_completed", Some(node.label()), output.clone());
                    if let Node::Step(step) = node {
                        state.step_results.insert(step.id().to_string(), output.clone());
                    }
                    state.node_input = output;
                    state.cursor += 1;
                }
                Ok(StepOutcome::Suspended(payload)) => {
                    span.end_ok(json!({ "suspended": payload })).await;
                    let step_id = node.label();
                    state.suspended =
                        Some(SuspendedInfo { step_id: step_id.clone(), payload: payload.clone() });
                    self.checkpoint(&run_id, &state, flow_status::SUSPENDED, &runtime).await?;
                    self.create_decision_if_requested(&run_id, &payload, &runtime).await;
                    run.mark_suspended().await;
                    let interrupt = run
                        .span(
                            &format!("suspended at {step_id}"),
                            span_kind::INTERRUPT,
                            payload.clone(),
                        )
                        .await;
                    interrupt.end_ok(Value::Null).await;
                    self.emit(&run_id, "suspended", Some(step_id.clone()), payload.clone());
                    return Ok(FlowRunResult {
                        run_id,
                        outcome: FlowOutcome::Suspended { step_id, payload },
                    });
                }
                Err(e) => {
                    let message = e.to_string();
                    span.end_err(&message).await;
                    self.checkpoint(&run_id, &state, flow_status::FAILED, &runtime).await?;
                    run.finish_failed(&message).await;
                    self.emit(&run_id, "failed", Some(node.label()), json!({ "error": message }));
                    return Err(e);
                }
            }
        }

        let output = state.node_input.clone();
        self.checkpoint(&run_id, &state, flow_status::SUCCESS, &runtime).await?;
        run.finish_success(output.clone()).await;
        self.emit(&run_id, "completed", None, output.clone());
        Ok(FlowRunResult { run_id, outcome: FlowOutcome::Success(output) })
    }

    async fn execute_node(
        &self,
        node: &Node,
        state: &RunState,
        resume: Option<Value>,
        runtime: &RuntimeContext,
        run: &RunHandle,
    ) -> Result<StepOutcome> {
        let steps = Arc::new(state.step_results.clone());
        let make_ctx = |input: Value, resume: Option<Value>| StepContext {
            input,
            init: state.init.clone(),
            resume,
            steps: Arc::clone(&steps),
            runtime: runtime.clone(),
        };

        match node {
            Node::Step(step) => {
                self.run_with_retries(
                    step.as_ref(),
                    make_ctx(state.node_input.clone(), resume),
                    run,
                )
                .await
            }
            Node::Parallel(parallel_steps) => {
                let futures: Vec<_> = parallel_steps
                    .iter()
                    .map(|step| {
                        self.run_with_retries(
                            step.as_ref(),
                            make_ctx(state.node_input.clone(), None),
                            run,
                        )
                    })
                    .collect();
                let results = futures::future::join_all(futures).await;
                let mut output = serde_json::Map::new();
                for (step, result) in parallel_steps.iter().zip(results) {
                    match result? {
                        StepOutcome::Done(v) => {
                            output.insert(step.id().to_string(), v);
                        }
                        StepOutcome::Suspended(_) => {
                            // TECH DEBT: suspension inside parallel needs
                            // partial-join checkpointing. See TECH_DEBT.md.
                            return Err(Error::Workflow(
                                "suspend inside parallel is not supported yet".into(),
                            ));
                        }
                    }
                }
                Ok(StepOutcome::Done(Value::Object(output)))
            }
            Node::Branch(arms) => {
                for (condition, step) in arms {
                    if condition(&state.node_input, 0) {
                        return self
                            .run_with_retries(
                                step.as_ref(),
                                make_ctx(state.node_input.clone(), resume),
                                run,
                            )
                            .await;
                    }
                }
                // No arm matched: input passes through unchanged.
                Ok(StepOutcome::Done(state.node_input.clone()))
            }
            Node::ForEach { step, concurrency } => {
                let items = state
                    .node_input
                    .as_array()
                    .ok_or_else(|| {
                        Error::Workflow(format!("foreach[{}] requires an array input", step.id()))
                    })?
                    .clone();
                let mut results = Vec::with_capacity(items.len());
                for chunk in items.chunks((*concurrency).max(1)) {
                    let futures: Vec<_> = chunk
                        .iter()
                        .map(|item| {
                            self.run_with_retries(step.as_ref(), make_ctx(item.clone(), None), run)
                        })
                        .collect();
                    for result in futures::future::join_all(futures).await {
                        match result? {
                            StepOutcome::Done(v) => results.push(v),
                            StepOutcome::Suspended(_) => {
                                // TECH DEBT: see parallel above.
                                return Err(Error::Workflow(
                                    "suspend inside foreach is not supported yet".into(),
                                ));
                            }
                        }
                    }
                }
                Ok(StepOutcome::Done(Value::Array(results)))
            }
            Node::Loop { step, condition, negate } => {
                let mut current = state.node_input.clone();
                let mut iteration: u32 = 0;
                loop {
                    match self
                        .run_with_retries(step.as_ref(), make_ctx(current.clone(), None), run)
                        .await?
                    {
                        StepOutcome::Done(v) => current = v,
                        StepOutcome::Suspended(_) => {
                            // TECH DEBT: mid-loop suspension needs loop-state
                            // checkpointing.
                            return Err(Error::Workflow(
                                "suspend inside a loop is not supported yet".into(),
                            ));
                        }
                    }
                    iteration += 1;
                    let keep_going = condition(&current, iteration) != *negate;
                    if !keep_going {
                        return Ok(StepOutcome::Done(current));
                    }
                    if iteration >= 10_000 {
                        return Err(Error::Workflow(format!(
                            "loop[{}] exceeded 10000 iterations",
                            step.id()
                        )));
                    }
                }
            }
            Node::Map(map) => Ok(StepOutcome::Done(map(MapContext {
                input: &state.node_input,
                init: &state.init,
                steps: &state.step_results,
            }))),
            Node::Sleep(duration) => {
                // The checkpoint before this node already persisted state; an
                // in-process sleep is acceptable for v1 durations.
                // TECH DEBT: long sleeps should reschedule via the task
                // runtime instead of holding a tokio timer.
                tokio::time::sleep(*duration).await;
                Ok(StepOutcome::Done(state.node_input.clone()))
            }
            Node::WaitForEvent(event_name) => match resume {
                Some(event_payload) => Ok(StepOutcome::Done(event_payload)),
                None => Ok(StepOutcome::Suspended(json!({
                    "kind": "event",
                    "event": event_name,
                }))),
            },
        }
    }

    async fn run_with_retries(
        &self,
        step: &dyn Step,
        ctx: StepContext,
        run: &RunHandle,
    ) -> Result<StepOutcome> {
        let policy = step.retry_policy();
        let mut attempt: u32 = 0;
        loop {
            match step.execute(ctx.clone()).await {
                Ok(outcome) => return Ok(outcome),
                Err(e) if attempt < policy.max_retries => {
                    attempt += 1;
                    let backoff = policy.backoff * 2u32.saturating_pow(attempt - 1);
                    let span = run
                        .span(
                            &format!("retry {} of {}", attempt, step.id()),
                            span_kind::RETRY,
                            json!({ "error": e.to_string(), "backoff_ms": backoff.as_millis() }),
                        )
                        .await;
                    span.end_ok(Value::Null).await;
                    tokio::time::sleep(backoff).await;
                }
                Err(e) => return Err(e),
            }
        }
    }

    async fn checkpoint(
        &self,
        run_id: &str,
        state: &RunState,
        status: &str,
        runtime: &RuntimeContext,
    ) -> Result<()> {
        let Some(storage) = &self.storage else { return Ok(()) };
        let now = Utc::now();
        storage
            .save_snapshot(WorkflowSnapshot {
                run_id: run_id.to_string(),
                workflow_id: self.id.clone(),
                resource_id: runtime.user_id().to_string(),
                status: status.to_string(),
                snapshot: serde_json::to_value(state)?,
                created_at: now,
                updated_at: now,
            })
            .await
    }

    /// Approval/input suspensions surface as pending decisions so HITL UIs
    /// can list and resolve them.
    async fn create_decision_if_requested(
        &self,
        run_id: &str,
        payload: &Value,
        runtime: &RuntimeContext,
    ) {
        let Some(storage) = &self.storage else { return };
        let kind = payload["kind"].as_str().unwrap_or_default();
        if kind != "approval" && kind != "input" {
            return;
        }
        let decision = DecisionRecord {
            id: new_id("dec"),
            user_id: runtime.user_id().to_string(),
            run_id: run_id.to_string(),
            kind: kind.to_string(),
            prompt: payload["prompt"].as_str().unwrap_or("Decision required").to_string(),
            payload: payload.clone(),
            status: "pending".to_string(),
            resolution: Value::Null,
            created_at: Utc::now(),
            resolved_at: None,
        };
        if let Err(e) = storage.insert_decision(decision).await {
            tracing::warn!(error = %e, "failed to create pending decision");
        }
    }

    fn emit(&self, run_id: &str, kind: &str, step: Option<String>, data: Value) {
        let _ = self.events.send(WorkflowEvent {
            run_id: run_id.to_string(),
            workflow_id: self.id.clone(),
            kind: kind.to_string(),
            step,
            data,
        });
    }
}

/// Fluent workflow construction; finish with
/// [`commit`](WorkflowBuilder::commit) (Mastra's `.commit()`).
pub struct WorkflowBuilder {
    id: String,
    nodes: Vec<Node>,
    storage: Option<SharedStorage>,
    hub: ObservabilityHub,
}

impl WorkflowBuilder {
    pub fn storage(mut self, storage: SharedStorage) -> Self {
        self.storage = Some(storage);
        self
    }

    pub fn observability(mut self, hub: ObservabilityHub) -> Self {
        self.hub = hub;
        self
    }

    pub fn then(mut self, step: impl Step + 'static) -> Self {
        self.nodes.push(Node::Step(Arc::new(step)));
        self
    }

    pub fn then_arc(mut self, step: Arc<dyn Step>) -> Self {
        self.nodes.push(Node::Step(step));
        self
    }

    pub fn parallel(mut self, steps: Vec<Arc<dyn Step>>) -> Self {
        self.nodes.push(Node::Parallel(steps));
        self
    }

    /// `branch(vec![(cond, step), ...])` — first matching arm runs. The
    /// condition receives the node input.
    pub fn branch(mut self, arms: Vec<(Condition, Arc<dyn Step>)>) -> Self {
        self.nodes.push(Node::Branch(arms));
        self
    }

    pub fn foreach(mut self, step: impl Step + 'static, concurrency: usize) -> Self {
        self.nodes.push(Node::ForEach { step: Arc::new(step), concurrency });
        self
    }

    /// Repeat the step while the condition (over its output and the
    /// iteration count) is true.
    pub fn dowhile(mut self, step: impl Step + 'static, condition: Condition) -> Self {
        self.nodes.push(Node::Loop { step: Arc::new(step), condition, negate: false });
        self
    }

    /// Repeat the step until the condition becomes true.
    pub fn dountil(mut self, step: impl Step + 'static, condition: Condition) -> Self {
        self.nodes.push(Node::Loop { step: Arc::new(step), condition, negate: true });
        self
    }

    /// Pure data transform between steps.
    pub fn map(
        mut self,
        f: impl for<'a> Fn(MapContext<'a>) -> Value + Send + Sync + 'static,
    ) -> Self {
        self.nodes.push(Node::Map(Arc::new(f)));
        self
    }

    pub fn sleep(mut self, duration: Duration) -> Self {
        self.nodes.push(Node::Sleep(duration));
        self
    }

    /// Pause until the named event is delivered via [`Workflow::resume`].
    pub fn wait_for_event(mut self, event: impl Into<String>) -> Self {
        self.nodes.push(Node::WaitForEvent(event.into()));
        self
    }

    pub fn commit(self) -> Workflow {
        let (events, _) = broadcast::channel(256);
        Workflow { id: self.id, nodes: self.nodes, storage: self.storage, hub: self.hub, events }
    }
}

/// Helper to build a [`Condition`] from a plain closure over the value.
pub fn cond(f: impl Fn(&Value) -> bool + Send + Sync + 'static) -> Condition {
    Arc::new(move |v, _| f(v))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_core::Principal;
    use rustra_storage::InMemoryStorage;

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
                Arc::new(double_step("x")) as Arc<dyn Step>,
                Arc::new(FunctionStep::new("y", |ctx| async move {
                    Ok(StepOutcome::Done(json!({ "n": ctx.input["n"].as_i64().unwrap() + 1 })))
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
                    Arc::new(FunctionStep::new("big", |_| async {
                        Ok(StepOutcome::Done(json!("big")))
                    })) as Arc<dyn Step>,
                ),
                (
                    cond(|_| true),
                    Arc::new(FunctionStep::new("small", |_| async {
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
                let total: i64 =
                    ctx.input.as_array().unwrap().iter().map(|v| v["n"].as_i64().unwrap()).sum();
                json!({ "n": total })
            })
            .dountil(
                FunctionStep::new("inc", |ctx| async move {
                    Ok(StepOutcome::Done(json!({ "n": ctx.input["n"].as_i64().unwrap() + 1 })))
                }),
                Arc::new(|v, _| v["n"].as_i64().unwrap_or(0) >= 30),
            )
            .commit();
        let result = wf.start(json!([{"n": 1}, {"n": 2}, {"n": 3}]), runtime()).await.unwrap();
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
        let resumed = wf.resume(&run_id, json!({"approved": true}), runtime()).await.unwrap();
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

        let resumed = wf.resume(&result.run_id, json!({"amount": 42}), runtime()).await.unwrap();
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
        let wf = Workflow::builder("watched").then(double_step("only")).commit();
        let mut rx = wf.watch();
        wf.start(json!({"n": 1}), runtime()).await.unwrap();
        let mut kinds = Vec::new();
        while let Ok(event) = rx.try_recv() {
            kinds.push(event.kind);
        }
        assert_eq!(kinds, vec!["step_started", "step_completed", "completed"]);
    }
}
