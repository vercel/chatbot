//! Bridges the task runtime to the registries: a task spec names its target
//! (`agent` or `workflow`) and the executor dispatches it.

use async_trait::async_trait;
use serde_json::{json, Value};
use std::sync::Weak;

use rustra_agent::AgentInput;
use rustra_core::{Error, Result, RuntimeContext};
use rustra_tasks::TaskExecutor;
use rustra_workflow::FlowOutcome;

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
pub struct RustraExecutor {
    rustra: Weak<Rustra>,
}

impl RustraExecutor {
    pub fn new(rustra: Weak<Rustra>) -> Self {
        Self { rustra }
    }

    fn rustra(&self) -> Result<std::sync::Arc<Rustra>> {
        self.rustra.upgrade().ok_or_else(|| Error::Cancelled("runtime is shutting down".into()))
    }
}

#[async_trait]
impl TaskExecutor for RustraExecutor {
    async fn execute(&self, spec: &Value, runtime: RuntimeContext) -> Result<Value> {
        let rustra = self.rustra()?;
        let target = spec["target"].as_str().unwrap_or("agent");
        let id = spec["id"].as_str().unwrap_or("main");
        let input = spec.get("input").cloned().unwrap_or(Value::Null);

        match target {
            "agent" => {
                let agent = if id == "main" {
                    rustra.main_agent_for(runtime.user_id()).await?
                } else {
                    rustra.agent(id)?
                };
                // The message: explicit input.message, or the event payload
                // for signal-triggered tasks, or the raw input as JSON.
                let message = input["message"]
                    .as_str()
                    .map(str::to_owned)
                    .or_else(|| {
                        spec.get("event").map(|event| {
                            format!(
                                "Handle this event:\n{}",
                                serde_json::to_string_pretty(event).unwrap_or_default()
                            )
                        })
                    })
                    .unwrap_or_else(|| input.to_string());
                let mut agent_input = AgentInput::new(message);
                if let Some(thread) = input["thread_id"].as_str() {
                    agent_input = agent_input.in_thread(thread);
                }
                let response = agent.generate(agent_input, runtime).await?;
                Ok(json!({
                    "text": response.text,
                    "run_id": response.run_id,
                    "thread_id": response.thread_id,
                }))
            }
            "workflow" => {
                let workflow = rustra.workflow(id)?;
                let result = workflow.start(input, runtime).await?;
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
            other => Err(Error::Validation(format!(
                "unknown task target `{other}` (expected `agent` or `workflow`)"
            ))),
        }
    }
}
