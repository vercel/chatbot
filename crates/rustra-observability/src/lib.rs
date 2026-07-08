//! # rustra-observability
//!
//! The instrumentation layer, mirroring Mastra's observability model:
//! every operation is a **span**, related spans share a **trace**, and each
//! top-level invocation is a **run**. Agent turns, LLM calls, tool calls,
//! memory operations, MCP calls, flow steps, context attachment, interrupts,
//! and retries all record here, persisted through the storage backend's
//! observability domain.
//!
//! Design notes:
//!
//! * Recording is *fire-and-forget with visibility*: persistence failures are
//!   logged (via `tracing`) and never fail the instrumented operation.
//! * Span lifecycle is explicit (`end_ok` / `end_err`) because async work
//!   cannot end spans from `Drop`. Every call site owns its guard.
//! * Mirrors to the `tracing` crate so operators get standard logs alongside
//!   stored traces. An OpenTelemetry exporter can be layered later without
//!   changing call sites (see TECH_DEBT.md).

use chrono::Utc;
use serde_json::Value;
use std::sync::Arc;

use rustra_core::new_id;
use rustra_storage::types::{LogRecord, RunRecord, TraceSpan};
use rustra_storage::SharedStorage;

/// Span kinds recorded by the framework.
pub mod span_kind {
    pub const AGENT_RUN: &str = "agent_run";
    pub const LLM_CALL: &str = "llm_call";
    pub const TOOL_CALL: &str = "tool_call";
    pub const MEMORY_OP: &str = "memory_op";
    pub const MCP_CALL: &str = "mcp_call";
    pub const FLOW_STEP: &str = "flow_step";
    pub const CONTEXT_ATTACH: &str = "context_attach";
    pub const INTERRUPT: &str = "interrupt";
    pub const RETRY: &str = "retry";
    pub const CHANNEL_SEND: &str = "channel_send";
    pub const OTHER: &str = "other";
}

/// Run status values shared with the storage schema.
pub mod run_status {
    pub const RUNNING: &str = "running";
    pub const SUSPENDED: &str = "suspended";
    pub const SUCCESS: &str = "success";
    pub const FAILED: &str = "failed";
    pub const CANCELLED: &str = "cancelled";
}

/// The hub every subsystem records through. Cheap to clone.
#[derive(Clone)]
pub struct ObservabilityHub {
    storage: Option<SharedStorage>,
}

impl ObservabilityHub {
    pub fn new(storage: SharedStorage) -> Self {
        Self { storage: Some(storage) }
    }

    /// A hub that records nothing (tests, ephemeral tooling).
    pub fn noop() -> Self {
        Self { storage: None }
    }

    /// Begin a top-level run (`kind`: `agent` | `workflow` | `task`).
    pub async fn start_run(
        &self,
        kind: &str,
        subject_id: &str,
        user_id: &str,
        input: Value,
    ) -> RunHandle {
        let run = RunRecord {
            id: new_id("run"),
            kind: kind.to_string(),
            subject_id: subject_id.to_string(),
            user_id: user_id.to_string(),
            status: run_status::RUNNING.to_string(),
            input,
            output: Value::Null,
            error: None,
            trace_id: new_id("trc"),
            started_at: Utc::now(),
            ended_at: None,
            metadata: Value::Null,
        };
        tracing::info!(run_id = %run.id, kind, subject_id, user_id, "run started");
        if let Some(storage) = &self.storage {
            if let Err(e) = storage.insert_run(run.clone()).await {
                tracing::warn!(error = %e, "failed to persist run start");
            }
        }
        RunHandle { hub: self.clone(), run: Arc::new(run) }
    }

    /// Attach to an existing run (e.g. resuming a suspended workflow).
    pub fn attach_run(&self, run: RunRecord) -> RunHandle {
        RunHandle { hub: self.clone(), run: Arc::new(run) }
    }

    async fn persist_span(&self, span: TraceSpan) {
        if let Some(storage) = &self.storage {
            if let Err(e) = storage.insert_spans(vec![span]).await {
                tracing::warn!(error = %e, "failed to persist span");
            }
        }
    }

    async fn persist_run(&self, run: RunRecord) {
        if let Some(storage) = &self.storage {
            if let Err(e) = storage.update_run(run).await {
                tracing::warn!(error = %e, "failed to persist run update");
            }
        }
    }

    async fn persist_log(&self, log: LogRecord) {
        if let Some(storage) = &self.storage {
            if let Err(e) = storage.insert_log(log).await {
                tracing::warn!(error = %e, "failed to persist log");
            }
        }
    }
}

/// Handle for one run: spawn spans, write logs, finish the run.
#[derive(Clone)]
pub struct RunHandle {
    hub: ObservabilityHub,
    run: Arc<RunRecord>,
}

impl RunHandle {
    pub fn run_id(&self) -> &str {
        &self.run.id
    }

    pub fn trace_id(&self) -> &str {
        &self.run.trace_id
    }

    pub fn user_id(&self) -> &str {
        &self.run.user_id
    }

    /// Open a root-level span within this run's trace.
    pub async fn span(&self, name: &str, kind: &str, input: Value) -> SpanGuard {
        self.span_with_parent(name, kind, input, None).await
    }

    /// Open a span nested under `parent_span_id`.
    pub async fn span_with_parent(
        &self,
        name: &str,
        kind: &str,
        input: Value,
        parent_span_id: Option<String>,
    ) -> SpanGuard {
        let span = TraceSpan {
            id: new_id("spn"),
            trace_id: self.run.trace_id.clone(),
            parent_id: parent_span_id,
            name: name.to_string(),
            kind: kind.to_string(),
            user_id: self.run.user_id.clone(),
            input,
            output: Value::Null,
            error: None,
            started_at: Utc::now(),
            ended_at: None,
            metadata: Value::Null,
        };
        tracing::debug!(trace_id = %span.trace_id, span = name, kind, "span started");
        SpanGuard { hub: self.hub.clone(), span }
    }

    pub async fn log(&self, level: &str, message: &str, fields: Value) {
        tracing::info!(run_id = %self.run.id, level, message, "run log");
        self.hub
            .persist_log(LogRecord {
                id: new_id("log"),
                level: level.to_string(),
                message: message.to_string(),
                fields,
                user_id: Some(self.run.user_id.clone()),
                run_id: Some(self.run.id.clone()),
                created_at: Utc::now(),
            })
            .await;
    }

    async fn finish(&self, status: &str, output: Value, error: Option<String>) {
        let mut run = (*self.run).clone();
        run.status = status.to_string();
        run.output = output;
        run.error = error;
        run.ended_at = Some(Utc::now());
        tracing::info!(run_id = %run.id, status, "run finished");
        self.hub.persist_run(run).await;
    }

    pub async fn finish_success(&self, output: Value) {
        self.finish(run_status::SUCCESS, output, None).await;
    }

    pub async fn finish_failed(&self, error: &str) {
        self.finish(run_status::FAILED, Value::Null, Some(error.to_string())).await;
    }

    pub async fn finish_cancelled(&self) {
        self.finish(run_status::CANCELLED, Value::Null, None).await;
    }

    pub async fn mark_suspended(&self) {
        self.finish(run_status::SUSPENDED, Value::Null, None).await;
    }
}

/// An open span. Call [`SpanGuard::end_ok`] or [`SpanGuard::end_err`]; a
/// guard dropped without ending records nothing further (the start was
/// already persisted at end time only — i.e. an unended span is lost, which
/// is the safe failure mode for crash paths).
pub struct SpanGuard {
    hub: ObservabilityHub,
    span: TraceSpan,
}

impl SpanGuard {
    pub fn span_id(&self) -> &str {
        &self.span.id
    }

    pub fn set_metadata(&mut self, metadata: Value) {
        self.span.metadata = metadata;
    }

    pub async fn end_ok(mut self, output: Value) {
        self.span.output = output;
        self.span.ended_at = Some(Utc::now());
        self.hub.persist_span(self.span).await;
    }

    pub async fn end_err(mut self, error: &str) {
        self.span.error = Some(error.to_string());
        self.span.ended_at = Some(Utc::now());
        tracing::warn!(span = %self.span.name, error, "span failed");
        self.hub.persist_span(self.span).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_storage::{InMemoryStorage, Page};
    use serde_json::json;

    #[tokio::test]
    async fn run_and_spans_are_recorded() {
        let storage: SharedStorage = Arc::new(InMemoryStorage::new());
        let hub = ObservabilityHub::new(storage.clone());

        let run = hub.start_run("agent", "main", "user-1", json!({"q": "hi"})).await;
        let span = run.span("llm turn", span_kind::LLM_CALL, json!({"messages": 1})).await;
        span.end_ok(json!({"stop": "end_turn"})).await;
        run.log("info", "step complete", json!({})).await;
        run.finish_success(json!({"text": "done"})).await;

        let stored_run = storage.get_run(run.run_id()).await.unwrap().unwrap();
        assert_eq!(stored_run.status, "success");
        let spans = storage.list_spans(run.trace_id()).await.unwrap();
        assert_eq!(spans.len(), 1);
        assert_eq!(spans[0].kind, "llm_call");
        let logs = storage.list_logs(None, Some(run.run_id()), Page::default()).await.unwrap();
        assert_eq!(logs.len(), 1);
    }
}
