//! Steps — the unit of work in a flow, mirroring Mastra's `createStep`.

use async_trait::async_trait;
use serde_json::Value;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use rustra_core::{Result, RuntimeContext};

/// What a step produced.
#[derive(Debug, Clone)]
pub enum StepOutcome {
    /// The step finished; `Value` flows to the next node.
    Done(Value),
    /// The step suspended the run (HITL, waiting on external input). The
    /// payload is surfaced to whoever must act (Mastra: `suspend(payload)`).
    ///
    /// Conventions understood by the framework:
    /// * `{ "kind": "approval", "prompt": ... }` — creates a pending
    ///   approval decision.
    /// * `{ "kind": "input", "prompt": ..., "schema": ... }` — requests
    ///   structured user input.
    Suspended(Value),
}

/// Everything a step execution can see (Mastra's `execute` context).
#[derive(Clone)]
pub struct StepContext {
    /// Output of the previous node (or the workflow input for the first).
    pub input: Value,
    /// The original workflow input (`getInitData`).
    pub init: Value,
    /// Data supplied by `resume` when re-entering a suspended step
    /// (`resumeData`); `None` on first execution.
    pub resume: Option<Value>,
    /// Results of previously completed steps (`getStepResult`).
    pub steps: Arc<std::collections::HashMap<String, Value>>,
    pub runtime: RuntimeContext,
}

impl StepContext {
    /// Result of an earlier step by id.
    pub fn step_result(&self, step_id: &str) -> Option<&Value> {
        self.steps.get(step_id)
    }
}

/// Per-step retry policy.
#[derive(Debug, Clone)]
pub struct RetryPolicy {
    pub max_retries: u32,
    /// Base backoff; attempt `n` waits `base * 2^(n-1)`.
    pub backoff: Duration,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self { max_retries: 0, backoff: Duration::from_millis(200) }
    }
}

/// A unit of flow work.
#[async_trait]
pub trait Step: Send + Sync {
    fn id(&self) -> &str;
    async fn execute(&self, ctx: StepContext) -> Result<StepOutcome>;
    fn retry_policy(&self) -> RetryPolicy {
        RetryPolicy::default()
    }
}

type StepFn = dyn Fn(StepContext) -> Pin<Box<dyn Future<Output = Result<StepOutcome>> + Send>>
    + Send
    + Sync;

/// A [`Step`] from a closure — the ergonomic path, like Mastra's
/// `createStep({ id, execute })`.
///
/// ```
/// use rustra_workflow::{FunctionStep, StepOutcome};
/// use serde_json::json;
///
/// let step = FunctionStep::new("double", |ctx| async move {
///     let n = ctx.input["n"].as_i64().unwrap_or(0);
///     Ok(StepOutcome::Done(json!({ "n": n * 2 })))
/// });
/// ```
pub struct FunctionStep {
    id: String,
    handler: Arc<StepFn>,
    retry: RetryPolicy,
}

impl FunctionStep {
    pub fn new<F, Fut>(id: impl Into<String>, handler: F) -> Self
    where
        F: Fn(StepContext) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<StepOutcome>> + Send + 'static,
    {
        Self {
            id: id.into(),
            handler: Arc::new(move |ctx| Box::pin(handler(ctx))),
            retry: RetryPolicy::default(),
        }
    }

    pub fn with_retries(mut self, max_retries: u32, backoff: Duration) -> Self {
        self.retry = RetryPolicy { max_retries, backoff };
        self
    }
}

#[async_trait]
impl Step for FunctionStep {
    fn id(&self) -> &str {
        &self.id
    }

    async fn execute(&self, ctx: StepContext) -> Result<StepOutcome> {
        (self.handler)(ctx).await
    }

    fn retry_policy(&self) -> RetryPolicy {
        self.retry.clone()
    }
}

/// A human-approval step: suspends with an approval payload; resuming with
/// `{ "approved": true }` lets the flow continue, anything else fails it.
pub fn approval_step(id: impl Into<String>, prompt: impl Into<String>) -> FunctionStep {
    let prompt = prompt.into();
    FunctionStep::new(id, move |ctx| {
        let prompt = prompt.clone();
        async move {
            match &ctx.resume {
                None => Ok(StepOutcome::Suspended(serde_json::json!({
                    "kind": "approval",
                    "prompt": prompt,
                }))),
                Some(resume) => {
                    if resume["approved"].as_bool() == Some(true) {
                        Ok(StepOutcome::Done(ctx.input.clone()))
                    } else {
                        Err(rustra_core::Error::Cancelled(format!(
                            "approval rejected: {}",
                            resume["reason"].as_str().unwrap_or("no reason given")
                        )))
                    }
                }
            }
        }
    })
}
