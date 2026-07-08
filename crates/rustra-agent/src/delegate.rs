//! Sub-agent delegation: a wrapped agent exposed as an `ask_<id>` tool,
//! matching Mastra's supervisor pattern (and its MCP naming for
//! agent-as-tool). The supervisor decides when to delegate; the sub-agent
//! runs a full generate loop under the same principal and trace.

use async_trait::async_trait;
use serde_json::{json, Value};
use std::sync::Arc;

use rustra_core::{Error, Result, Tool, ToolContext};

use crate::Agent;

/// How deep delegation may nest before the runtime refuses (defends against
/// mutual-delegation loops).
const MAX_DELEGATION_DEPTH: u64 = 3;
const DEPTH_KEY: &str = "rustra.delegation_depth";

/// A sub-agent as a [`Tool`].
pub struct AgentTool {
    agent: Arc<Agent>,
    tool_id: String,
    description: String,
}

impl AgentTool {
    pub fn new(agent: Arc<Agent>) -> Self {
        let tool_id = format!("ask_{}", agent.id());
        let description = if agent.description().is_empty() {
            format!("Delegate a task to the `{}` agent.", agent.name())
        } else {
            format!("Delegate to the `{}` agent: {}", agent.name(), agent.description())
        };
        Self { agent, tool_id, description }
    }
}

#[async_trait]
impl Tool for AgentTool {
    fn id(&self) -> &str {
        &self.tool_id
    }

    fn description(&self) -> &str {
        &self.description
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "The task or question for the sub-agent, with all context it needs."
                }
            },
            "required": ["message"]
        })
    }

    async fn execute(&self, input: Value, ctx: &ToolContext) -> Result<Value> {
        let message = input["message"]
            .as_str()
            .ok_or_else(|| Error::Validation("`message` must be a string".into()))?;

        let depth = ctx.runtime.get(DEPTH_KEY).and_then(|v| v.as_u64()).unwrap_or(0);
        if depth >= MAX_DELEGATION_DEPTH {
            return Err(Error::tool(
                &self.tool_id,
                format!("delegation depth limit ({MAX_DELEGATION_DEPTH}) reached"),
            ));
        }
        ctx.runtime.set(DEPTH_KEY, json!(depth + 1));
        let result = self.agent.generate(message, ctx.runtime.clone()).await;
        ctx.runtime.set(DEPTH_KEY, json!(depth));

        let response = result?;
        Ok(json!({
            "text": response.text,
            "agent": self.agent.id(),
            "run_id": response.run_id,
        }))
    }
}
