//! The durable-execution engine: node graph, run state, checkpointing,
//! suspend/resume, retries, and lifecycle events. The public surface is
//! [`Workflow`]; everything else here is crate-internal so the builder DSL
//! (and the upcoming typed-workflow layer) can evolve against a stable seam.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;

use rustra_core::{new_id, Error, Result, RuntimeContext};
use rustra_observability::{run_kind, span_kind, ObservabilityHub, RunHandle};
use rustra_storage::types::{DecisionRecord, RunRecord, WorkflowSnapshot};
use rustra_storage::SharedStorage;

use crate::builder::WorkflowBuilder;
use crate::step::{suspend_kind, Step, StepContext, StepOutcome};
use crate::{
    flow_status, Condition, FlowOutcome, FlowRunResult, MapContext, WorkflowEvent,
    WorkflowEventKind,
};

pub(crate) type MapFn = Arc<dyn for<'a> Fn(MapContext<'a>) -> Value + Send + Sync>;

/// Guardrail for `dowhile`/`dountil`: a condition that never settles fails
/// the run instead of spinning forever.
const MAX_LOOP_ITERATIONS: u32 = 10_000;

/// Capacity of the per-workflow lifecycle event channel; slow [`Workflow::watch`]
/// subscribers lag (dropping the oldest events) rather than block the engine.
const EVENT_CHANNEL_CAPACITY: usize = 256;

pub(crate) enum Node {
    Step(Arc<dyn Step>),
    /// All steps receive the node input; output is keyed by step id.
    Parallel(Vec<Arc<dyn Step>>),
    /// First condition that matches wins; its step's output flows on.
    Branch(Vec<(Condition, Arc<dyn Step>)>),
    /// Input must be an array; the step runs per element (bounded
    /// concurrency); output is the array of results.
    ForEach {
        step: Arc<dyn Step>,
        concurrency: usize,
    },
    /// Repeat while (`negate = false`) or until (`negate = true`) the
    /// condition holds over the step's output.
    Loop {
        step: Arc<dyn Step>,
        condition: Condition,
        negate: bool,
    },
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
                format!(
                    "parallel[{}]",
                    steps.iter().map(|s| s.id()).collect::<Vec<_>>().join(",")
                )
            }
            Node::Branch(arms) => format!("branch[{} arms]", arms.len()),
            Node::ForEach { step, .. } => format!("foreach[{}]", step.id()),
            Node::Loop { step, negate, .. } => {
                format!(
                    "{}[{}]",
                    if *negate { "dountil" } else { "dowhile" },
                    step.id()
                )
            }
            Node::Map(_) => "map".to_string(),
            Node::Sleep(d) => format!("sleep[{}ms]", d.as_millis()),
            Node::WaitForEvent(name) => format!("wait_for_event[{name}]"),
        }
    }
}

/// Serialized run state — the checkpoint written before every node.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct RunState {
    cursor: usize,
    /// Input for the node at `cursor`.
    node_input: Value,
    /// The original workflow input.
    init: Value,
    step_results: HashMap<String, Value>,
    /// Present while suspended.
    suspended: Option<SuspendedInfo>,
}

impl RunState {
    /// Assemble the context a step executes with. `steps` is taken
    /// pre-shared so composite nodes (parallel/foreach/loop) can snapshot
    /// prior results once and reuse the `Arc` across every invocation;
    /// only top-level nodes ever receive `resume` data.
    fn step_context(
        &self,
        input: Value,
        resume: Option<Value>,
        steps: Arc<HashMap<String, Value>>,
        runtime: &RuntimeContext,
    ) -> StepContext {
        StepContext {
            input,
            init: self.init.clone(),
            resume,
            steps,
            runtime: runtime.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct SuspendedInfo {
    step_id: String,
    payload: Value,
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
    /// Start building a workflow with the given stable id.
    pub fn builder(id: impl Into<String>) -> WorkflowBuilder {
        WorkflowBuilder::new(id.into())
    }

    pub(crate) fn from_parts(
        id: String,
        nodes: Vec<Node>,
        storage: Option<SharedStorage>,
        hub: ObservabilityHub,
    ) -> Workflow {
        let (events, _) = broadcast::channel(EVENT_CHANNEL_CAPACITY);
        Workflow {
            id,
            nodes,
            storage,
            hub,
            events,
        }
    }

    /// The workflow's stable id.
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
            .start_run(
                run_kind::WORKFLOW,
                &self.id,
                runtime.user_id(),
                input.clone(),
            )
            .await;
        let state = RunState {
            cursor: 0,
            node_input: input.clone(),
            init: input,
            step_results: HashMap::new(),
            suspended: None,
        };
        self.drive(run, state, None, runtime, Utc::now()).await
    }

    /// Resume a suspended run with resume data (approval verdicts, awaited
    /// events, requested input).
    pub async fn resume(
        &self,
        run_id: &str,
        resume_data: Value,
        runtime: RuntimeContext,
    ) -> Result<FlowRunResult> {
        let (storage, snapshot) = self.load_owned_snapshot(run_id, &runtime, "resume").await?;
        if snapshot.status != flow_status::SUSPENDED && snapshot.status != flow_status::WAITING {
            return Err(Error::Workflow(format!(
                "run `{run_id}` is `{}`, not suspended",
                snapshot.status
            )));
        }
        let created_at = snapshot.created_at;
        let state: RunState = serde_json::from_value(snapshot.snapshot)?;

        // Reattach to the original observability run.
        let run_record = storage.get_run(run_id).await?.unwrap_or_else(|| RunRecord {
            id: run_id.to_string(),
            kind: run_kind::WORKFLOW.into(),
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
        self.drive(run, state, Some(resume_data), runtime, created_at)
            .await
    }

    /// Mark a run's snapshot as `cancelled`. The current status is not
    /// checked yet — see TECH_DEBT.md.
    pub async fn cancel(&self, run_id: &str, runtime: RuntimeContext) -> Result<()> {
        let (storage, mut snapshot) = self.load_owned_snapshot(run_id, &runtime, "cancel").await?;
        snapshot.status = flow_status::CANCELLED.to_string();
        snapshot.updated_at = Utc::now();
        storage.save_snapshot(snapshot).await?;
        Ok(())
    }

    /// Shared preamble of per-run operations: storage must be configured,
    /// the run must exist, and it must belong to the caller (or the caller
    /// is an admin).
    async fn load_owned_snapshot(
        &self,
        run_id: &str,
        runtime: &RuntimeContext,
        op: &str,
    ) -> Result<(&SharedStorage, WorkflowSnapshot)> {
        let storage = self.storage.as_ref().ok_or_else(|| {
            Error::Workflow(format!(
                "{op} requires the workflow to be built with storage"
            ))
        })?;
        let snapshot = storage
            .load_snapshot(run_id)
            .await?
            .ok_or_else(|| Error::not_found("workflow_run", run_id))?;
        if snapshot.resource_id != runtime.user_id() && !runtime.principal().is_admin() {
            return Err(Error::PermissionDenied(format!(
                "run `{run_id}` belongs to another user"
            )));
        }
        Ok((storage, snapshot))
    }

    // -- Engine ---------------------------------------------------------------

    async fn drive(
        &self,
        run: RunHandle,
        mut state: RunState,
        mut resume: Option<Value>,
        runtime: RuntimeContext,
        created_at: DateTime<Utc>,
    ) -> Result<FlowRunResult> {
        let run_id = run.run_id().to_string();
        // A snapshot loaded by `resume` still carries its suspension marker;
        // clear it so the RUNNING checkpoints below reflect a live run.
        state.suspended = None;

        while state.cursor < self.nodes.len() {
            let node = &self.nodes[state.cursor];
            let label = node.label();
            self.checkpoint(&run_id, &state, flow_status::RUNNING, &runtime, created_at)
                .await?;
            self.emit(
                &run_id,
                WorkflowEventKind::StepStarted,
                Some(label.clone()),
                Value::Null,
            );

            let span = run
                .span(&label, span_kind::FLOW_STEP, state.node_input.clone())
                .await;
            let outcome = self
                .execute_node(node, &state, resume.take(), &runtime, &run)
                .await;

            match outcome {
                Ok(StepOutcome::Done(output)) => {
                    span.end_ok(output.clone()).await;
                    self.emit(
                        &run_id,
                        WorkflowEventKind::StepCompleted,
                        Some(label),
                        output.clone(),
                    );
                    if let Node::Step(step) = node {
                        state
                            .step_results
                            .insert(step.id().to_string(), output.clone());
                    }
                    state.node_input = output;
                    state.cursor += 1;
                }
                Ok(StepOutcome::Suspended(payload)) => {
                    span.end_ok(json!({ "suspended": payload })).await;
                    let step_id = label;
                    state.suspended = Some(SuspendedInfo {
                        step_id: step_id.clone(),
                        payload: payload.clone(),
                    });
                    self.checkpoint(
                        &run_id,
                        &state,
                        flow_status::SUSPENDED,
                        &runtime,
                        created_at,
                    )
                    .await?;
                    self.create_decision_if_requested(&run_id, &payload, &runtime)
                        .await;
                    run.mark_suspended().await;
                    let interrupt = run
                        .span(
                            &format!("suspended at {step_id}"),
                            span_kind::INTERRUPT,
                            payload.clone(),
                        )
                        .await;
                    interrupt.end_ok(Value::Null).await;
                    self.emit(
                        &run_id,
                        WorkflowEventKind::Suspended,
                        Some(step_id.clone()),
                        payload.clone(),
                    );
                    return Ok(FlowRunResult {
                        run_id,
                        outcome: FlowOutcome::Suspended { step_id, payload },
                    });
                }
                Err(e) => {
                    let message = e.to_string();
                    span.end_err(&message).await;
                    // The step error is the ground truth of the run; a
                    // failing checkpoint write must not mask it or skip
                    // the failure bookkeeping below.
                    if let Err(checkpoint_err) = self
                        .checkpoint(&run_id, &state, flow_status::FAILED, &runtime, created_at)
                        .await
                    {
                        tracing::warn!(
                            error = %checkpoint_err,
                            run_id = %run_id,
                            "failed to checkpoint failed workflow state"
                        );
                    }
                    run.finish_failed(&message).await;
                    self.emit(
                        &run_id,
                        WorkflowEventKind::Failed,
                        Some(label),
                        json!({ "error": message }),
                    );
                    return Err(e);
                }
            }
        }

        self.checkpoint(&run_id, &state, flow_status::SUCCESS, &runtime, created_at)
            .await?;
        let output = state.node_input;
        run.finish_success(output.clone()).await;
        self.emit(&run_id, WorkflowEventKind::Completed, None, output.clone());
        Ok(FlowRunResult {
            run_id,
            outcome: FlowOutcome::Success(output),
        })
    }

    async fn execute_node(
        &self,
        node: &Node,
        state: &RunState,
        resume: Option<Value>,
        runtime: &RuntimeContext,
        run: &RunHandle,
    ) -> Result<StepOutcome> {
        match node {
            Node::Step(step) => {
                let ctx = state.step_context(
                    state.node_input.clone(),
                    resume,
                    Arc::new(state.step_results.clone()),
                    runtime,
                );
                self.run_with_retries(step.as_ref(), ctx, run).await
            }
            Node::Parallel(steps) => self.exec_parallel(steps, state, runtime, run).await,
            Node::Branch(arms) => {
                for (condition, step) in arms {
                    if condition(&state.node_input, 0) {
                        let ctx = state.step_context(
                            state.node_input.clone(),
                            resume,
                            Arc::new(state.step_results.clone()),
                            runtime,
                        );
                        return self.run_with_retries(step.as_ref(), ctx, run).await;
                    }
                }
                // No arm matched: input passes through unchanged.
                Ok(StepOutcome::Done(state.node_input.clone()))
            }
            Node::ForEach { step, concurrency } => {
                self.exec_foreach(step, *concurrency, state, runtime, run)
                    .await
            }
            Node::Loop {
                step,
                condition,
                negate,
            } => {
                self.exec_loop(step, condition, *negate, state, runtime, run)
                    .await
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
                    "kind": suspend_kind::EVENT,
                    "event": event_name,
                }))),
            },
        }
    }

    async fn exec_parallel(
        &self,
        parallel_steps: &[Arc<dyn Step>],
        state: &RunState,
        runtime: &RuntimeContext,
        run: &RunHandle,
    ) -> Result<StepOutcome> {
        let steps = Arc::new(state.step_results.clone());
        let make_ctx = |input: Value| state.step_context(input, None, Arc::clone(&steps), runtime);
        let futures: Vec<_> = parallel_steps
            .iter()
            .map(|step| {
                self.run_with_retries(step.as_ref(), make_ctx(state.node_input.clone()), run)
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
                    return Err(suspend_unsupported("parallel"));
                }
            }
        }
        Ok(StepOutcome::Done(Value::Object(output)))
    }

    async fn exec_foreach(
        &self,
        step: &Arc<dyn Step>,
        concurrency: usize,
        state: &RunState,
        runtime: &RuntimeContext,
        run: &RunHandle,
    ) -> Result<StepOutcome> {
        let steps = Arc::new(state.step_results.clone());
        let make_ctx = |input: Value| state.step_context(input, None, Arc::clone(&steps), runtime);
        let items = state.node_input.as_array().ok_or_else(|| {
            Error::Workflow(format!("foreach[{}] requires an array input", step.id()))
        })?;
        let mut results = Vec::with_capacity(items.len());
        for chunk in items.chunks(concurrency.max(1)) {
            let futures: Vec<_> = chunk
                .iter()
                .map(|item| self.run_with_retries(step.as_ref(), make_ctx(item.clone()), run))
                .collect();
            for result in futures::future::join_all(futures).await {
                match result? {
                    StepOutcome::Done(v) => results.push(v),
                    StepOutcome::Suspended(_) => {
                        // TECH DEBT: see parallel above.
                        return Err(suspend_unsupported("foreach"));
                    }
                }
            }
        }
        Ok(StepOutcome::Done(Value::Array(results)))
    }

    async fn exec_loop(
        &self,
        step: &Arc<dyn Step>,
        condition: &Condition,
        negate: bool,
        state: &RunState,
        runtime: &RuntimeContext,
        run: &RunHandle,
    ) -> Result<StepOutcome> {
        let steps = Arc::new(state.step_results.clone());
        let make_ctx = |input: Value| state.step_context(input, None, Arc::clone(&steps), runtime);
        let mut current = state.node_input.clone();
        let mut iteration: u32 = 0;
        loop {
            match self
                .run_with_retries(step.as_ref(), make_ctx(current.clone()), run)
                .await?
            {
                StepOutcome::Done(v) => current = v,
                StepOutcome::Suspended(_) => {
                    // TECH DEBT: mid-loop suspension needs loop-state
                    // checkpointing.
                    return Err(suspend_unsupported("a loop"));
                }
            }
            iteration += 1;
            let keep_going = condition(&current, iteration) != negate;
            if !keep_going {
                return Ok(StepOutcome::Done(current));
            }
            if iteration >= MAX_LOOP_ITERATIONS {
                return Err(Error::Workflow(format!(
                    "loop[{}] exceeded {MAX_LOOP_ITERATIONS} iterations",
                    step.id()
                )));
            }
        }
    }

    async fn run_with_retries(
        &self,
        step: &dyn Step,
        ctx: StepContext,
        run: &RunHandle,
    ) -> Result<StepOutcome> {
        let policy = step.retry_policy();
        for attempt in 1..=policy.max_retries {
            match step.execute(ctx.clone()).await {
                Ok(outcome) => return Ok(outcome),
                Err(e) => {
                    let backoff = policy
                        .backoff
                        .saturating_mul(2u32.saturating_pow(attempt - 1));
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
            }
        }
        // Retry budget exhausted (or zero): the final attempt consumes `ctx`
        // without cloning, and its error is the step's error.
        step.execute(ctx).await
    }

    /// Persist the run state under `status`. Storage-less workflows skip
    /// this silently — their runs are in-memory only and not durable.
    async fn checkpoint(
        &self,
        run_id: &str,
        state: &RunState,
        status: &str,
        runtime: &RuntimeContext,
        created_at: DateTime<Utc>,
    ) -> Result<()> {
        let Some(storage) = &self.storage else {
            return Ok(());
        };
        storage
            .save_snapshot(WorkflowSnapshot {
                run_id: run_id.to_string(),
                workflow_id: self.id.clone(),
                resource_id: runtime.user_id().to_string(),
                status: status.to_string(),
                snapshot: serde_json::to_value(state)?,
                created_at,
                updated_at: Utc::now(),
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
        if kind != suspend_kind::APPROVAL && kind != suspend_kind::INPUT {
            return;
        }
        let decision = DecisionRecord {
            id: new_id("dec"),
            user_id: runtime.user_id().to_string(),
            run_id: run_id.to_string(),
            kind: kind.to_string(),
            prompt: payload["prompt"]
                .as_str()
                .unwrap_or("Decision required")
                .to_string(),
            payload: payload.clone(),
            status: "pending".to_string(),
            resolution: Value::Null,
            created_at: Utc::now(),
            resolved_at: None,
        };
        if let Err(e) = storage.insert_decision(decision).await {
            tracing::warn!(error = %e, run_id = %run_id, "failed to create pending decision");
        }
    }

    fn emit(&self, run_id: &str, kind: WorkflowEventKind, step: Option<String>, data: Value) {
        let _ = self.events.send(WorkflowEvent {
            run_id: run_id.to_string(),
            workflow_id: self.id.clone(),
            kind,
            step,
            data,
        });
    }
}

/// The shared error for suspension inside composite nodes — see TECH_DEBT.md
/// (partial-join checkpointing).
fn suspend_unsupported(location: &str) -> Error {
    Error::Workflow(format!("suspend inside {location} is not supported yet"))
}
