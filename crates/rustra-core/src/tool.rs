use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use crate::error::{Error, Result};
use crate::runtime_context::RuntimeContext;

/// The serializable description of a tool as presented to a language model
/// (name + description + JSON Schema). Mirrors the shape used by Mastra's
/// `createTool` and by MCP `tools/list`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolSpec {
    pub id: String,
    pub description: String,
    /// JSON Schema for the tool input.
    pub input_schema: Value,
    /// Optional JSON Schema for the tool output.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_schema: Option<Value>,
}

/// Everything a tool execution can reach besides its input: the runtime
/// context (principal, request variables) and correlation ids for tracing.
#[derive(Debug, Clone)]
pub struct ToolContext {
    pub runtime: RuntimeContext,
    /// Id of the agent invoking the tool, when invoked from an agent loop.
    pub agent_id: Option<String>,
    /// Observability run this execution belongs to.
    pub run_id: Option<String>,
}

impl ToolContext {
    /// A context with no agent/run attribution; agent loops fill those in
    /// before dispatch.
    pub fn new(runtime: RuntimeContext) -> Self {
        Self {
            runtime,
            agent_id: None,
            run_id: None,
        }
    }

    pub fn with_agent_id(mut self, agent_id: impl Into<String>) -> Self {
        self.agent_id = Some(agent_id.into());
        self
    }

    pub fn with_run_id(mut self, run_id: impl Into<String>) -> Self {
        self.run_id = Some(run_id.into());
        self
    }
}

/// A callable capability exposed to agents and workflows.
///
/// Equivalent to Mastra's tool concept: identified by `id`, described to the
/// model with `description` + `input_schema`, executed with a JSON payload.
/// Tools must be side-effect-scoped to the principal in `ctx.runtime` —
/// implementations must not reach across user boundaries.
#[async_trait]
pub trait Tool: Send + Sync {
    fn id(&self) -> &str;
    fn description(&self) -> &str;
    /// JSON Schema describing the expected input object.
    fn input_schema(&self) -> Value;
    fn output_schema(&self) -> Option<Value> {
        None
    }

    async fn execute(&self, input: Value, ctx: &ToolContext) -> Result<Value>;

    /// The serializable spec advertised to models and MCP clients.
    fn spec(&self) -> ToolSpec {
        ToolSpec {
            id: self.id().to_string(),
            description: self.description().to_string(),
            input_schema: self.input_schema(),
            output_schema: self.output_schema(),
        }
    }
}

/// Shared, thread-safe handle to a tool implementation.
pub type SharedTool = Arc<dyn Tool>;

type ToolFn =
    dyn Fn(Value, ToolContext) -> Pin<Box<dyn Future<Output = Result<Value>> + Send>> + Send + Sync;

/// A [`Tool`] built from a closure — the ergonomic path for library users,
/// analogous to Mastra's `createTool({ id, description, inputSchema,
/// execute })`.
///
/// ```
/// use rustra_core::{FunctionTool, RuntimeContext, Principal, ToolContext};
/// use serde_json::json;
///
/// let tool = FunctionTool::new(
///     "add",
///     "Add two numbers",
///     json!({
///         "type": "object",
///         "properties": {"a": {"type": "number"}, "b": {"type": "number"}},
///         "required": ["a", "b"]
///     }),
///     |input, _ctx| async move {
///         let a = input["a"].as_f64().unwrap_or(0.0);
///         let b = input["b"].as_f64().unwrap_or(0.0);
///         Ok(json!({ "sum": a + b }))
///     },
/// );
/// ```
pub struct FunctionTool {
    id: String,
    description: String,
    input_schema: Value,
    output_schema: Option<Value>,
    handler: Arc<ToolFn>,
}

impl FunctionTool {
    pub fn new<F, Fut>(
        id: impl Into<String>,
        description: impl Into<String>,
        input_schema: Value,
        handler: F,
    ) -> Self
    where
        F: Fn(Value, ToolContext) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<Value>> + Send + 'static,
    {
        Self {
            id: id.into(),
            description: description.into(),
            input_schema,
            output_schema: None,
            handler: Arc::new(move |input, ctx| Box::pin(handler(input, ctx))),
        }
    }

    pub fn with_output_schema(mut self, schema: Value) -> Self {
        self.output_schema = Some(schema);
        self
    }
}

impl std::fmt::Debug for FunctionTool {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FunctionTool")
            .field("id", &self.id)
            .finish_non_exhaustive()
    }
}

#[async_trait]
impl Tool for FunctionTool {
    fn id(&self) -> &str {
        &self.id
    }
    fn description(&self) -> &str {
        &self.description
    }
    fn input_schema(&self) -> Value {
        self.input_schema.clone()
    }
    fn output_schema(&self) -> Option<Value> {
        self.output_schema.clone()
    }

    async fn execute(&self, input: Value, ctx: &ToolContext) -> Result<Value> {
        (self.handler)(input, ctx.clone())
            .await
            .map_err(|e| match e {
                e @ Error::Tool { .. } => e,
                other => Error::tool(&self.id, other.to_string()),
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::principal::Principal;
    use serde_json::json;

    #[tokio::test]
    async fn function_tool_executes() {
        let tool = FunctionTool::new(
            "echo",
            "Echo the input",
            json!({"type": "object"}),
            |input, _ctx| async move { Ok(json!({ "echo": input })) },
        );
        let ctx = ToolContext::new(RuntimeContext::new(Principal::user("u1")));
        let out = tool.execute(json!({"hi": 1}), &ctx).await.unwrap();
        assert_eq!(out["echo"]["hi"], 1);
    }

    #[tokio::test]
    async fn function_tool_error_wrapping() {
        let ctx = ToolContext::new(RuntimeContext::new(Principal::user("u1")));

        // A non-Tool error is rewrapped as Error::Tool carrying this tool's
        // id — and thereby declassified from retryable to non-retryable.
        let failing = FunctionTool::new(
            "boom",
            "Always fails",
            json!({"type": "object"}),
            |_input, _ctx| async move { Err::<Value, Error>(Error::Unavailable("backend down".into())) },
        );
        let err = failing.execute(json!({}), &ctx).await.unwrap_err();
        assert!(matches!(&err, Error::Tool { tool, .. } if tool == "boom"));
        assert!(!err.is_retryable());

        // A pre-shaped Error::Tool passes through with its original tool id.
        let passthrough = FunctionTool::new(
            "outer",
            "Returns a pre-shaped tool error",
            json!({"type": "object"}),
            |_input, _ctx| async move { Err::<Value, Error>(Error::tool("inner", "inner failed")) },
        );
        let err = passthrough.execute(json!({}), &ctx).await.unwrap_err();
        assert!(matches!(&err, Error::Tool { tool, .. } if tool == "inner"));
    }
}
