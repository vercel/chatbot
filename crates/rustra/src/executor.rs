//! Bridges the task runtime to the registries: a task spec names its target
//! (`agent` or `workflow`) and the executor dispatches it.

use async_trait::async_trait;
use serde_json::{json, Value};
use std::sync::Arc;

use rustra_agent::AgentInput;
use rustra_core::{Error, Result, RuntimeContext};
use rustra_tasks::TaskExecutor;
use rustra_workflow::FlowOutcome;

use crate::hydrate::WeakRustra;
use crate::Rustra;

/// Task spec shape:
///
/// ```json
/// { "target": "agent",    "id": "main",     "input": { "message": "...", "thread_id": "..." } }
/// { "target": "workflow", "id": "deploy",   "input": { ... } }
/// ```
///
/// Agent target `"main"` (or omitted id) resolves to the caller's main
/// agent.
pub(crate) struct RustraExecutor {
    rustra: WeakRustra,
}

impl RustraExecutor {
    pub(crate) fn new(rustra: WeakRustra) -> Self {
        Self { rustra }
    }

    async fn run_agent(
        &self,
        rustra: &Arc<Rustra>,
        spec: TaskSpec,
        runtime: RuntimeContext,
    ) -> Result<Value> {
        let agent = if spec.id == "main" {
            rustra.main_agent_for(runtime.user_id()).await?
        } else {
            rustra.agent(&spec.id)?
        };
        let mut agent_input = AgentInput::new(spec.agent_message());
        if let Some(thread) = spec.input["thread_id"].as_str() {
            agent_input = agent_input.in_thread(thread);
        }
        let response = agent.generate(agent_input, runtime).await?;
        Ok(json!({
            "text": response.text,
            "run_id": response.run_id,
            "thread_id": response.thread_id,
        }))
    }

    async fn run_workflow(
        &self,
        rustra: &Arc<Rustra>,
        spec: TaskSpec,
        runtime: RuntimeContext,
    ) -> Result<Value> {
        let workflow = rustra.workflow(&spec.id)?;
        let result = workflow.start(spec.input, runtime).await?;
        match result.outcome {
            FlowOutcome::Success(output) => Ok(json!({
                "run_id": result.run_id,
                "status": "success",
                "output": output,
            })),
            FlowOutcome::Suspended { step_id, payload } => Ok(json!({
                "run_id": result.run_id,
                "status": "suspended",
                "step": step_id,
                "payload": payload,
            })),
        }
    }
}

/// What a task spec dispatches to.
enum TaskTarget {
    Agent,
    Workflow,
}

/// The parsed task spec (see the [`RustraExecutor`] docs for the wire
/// shape). Parsing is deliberately lenient: `target` defaults to `agent`,
/// `id` to `main`, and `input` to `null`.
struct TaskSpec {
    target: TaskTarget,
    id: String,
    input: Value,
    event: Option<Value>,
}

impl TaskSpec {
    fn parse(spec: &Value) -> Result<TaskSpec> {
        let target = match spec["target"].as_str().unwrap_or("agent") {
            "agent" => TaskTarget::Agent,
            "workflow" => TaskTarget::Workflow,
            other => {
                return Err(Error::Validation(format!(
                    "unknown task target `{other}` (expected `agent` or `workflow`)"
                )))
            }
        };
        Ok(TaskSpec {
            target,
            id: spec["id"].as_str().unwrap_or("main").to_string(),
            input: spec.get("input").cloned().unwrap_or(Value::Null),
            event: spec.get("event").cloned(),
        })
    }

    /// The message an agent task runs with: explicit `input.message`, or the
    /// event payload for signal-triggered tasks, or the raw input as JSON.
    fn agent_message(&self) -> String {
        self.input["message"]
            .as_str()
            .map(str::to_owned)
            .or_else(|| {
                self.event.as_ref().map(|event| {
                    format!(
                        "Handle this event:\n{}",
                        serde_json::to_string_pretty(event).unwrap_or_default()
                    )
                })
            })
            .unwrap_or_else(|| self.input.to_string())
    }
}

#[async_trait]
impl TaskExecutor for RustraExecutor {
    async fn execute(&self, spec: &Value, runtime: RuntimeContext) -> Result<Value> {
        let rustra = self.rustra.upgrade()?;
        let spec = TaskSpec::parse(spec)?;
        match spec.target {
            TaskTarget::Agent => self.run_agent(&rustra, spec, runtime).await,
            TaskTarget::Workflow => self.run_workflow(&rustra, spec, runtime).await,
        }
    }
}
