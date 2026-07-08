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
use std::fmt;
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

/// Run kinds recorded by the framework.
pub mod run_kind {
    pub const AGENT: &str = "agent";
    pub const WORKFLOW: &str = "workflow";
    pub const TASK: &str = "task";
}

/// Log levels recorded through [`RunHandle::log`], shared with the storage
/// schema.
pub mod log_level {
    pub const ERROR: &str = "error";
    pub const WARN: &str = "warn";
    pub const INFO: &str = "info";
    pub const DEBUG: &str = "debug";
    pub const TRACE: &str = "trace";
}

/// The hub every subsystem records through. Cheap to clone.
#[derive(Clone)]
pub struct ObservabilityHub {
    storage: Option<SharedStorage>,
}

impl ObservabilityHub {
    /// A hub that records through `storage`'s observability domain.
    pub fn new(storage: SharedStorage) -> Self {
        Self {
            storage: Some(storage),
        }
    }

    /// A hub that records nothing (tests, ephemeral tooling).
    pub fn noop() -> Self {
        Self { storage: None }
    }

    /// Begin a top-level run; `kind` is one of the [`run_kind`] constants.
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
        RunHandle {
            hub: self.clone(),
            run: Arc::new(run),
        }
    }

    /// Attach to an existing run (e.g. resuming a suspended workflow).
    pub fn attach_run(&self, run: RunRecord) -> RunHandle {
        tracing::info!(run_id = %run.id, kind = %run.kind, "run attached");
        RunHandle {
            hub: self.clone(),
            run: Arc::new(run),
        }
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

/// The default hub records nothing — equivalent to [`ObservabilityHub::noop`].
impl Default for ObservabilityHub {
    fn default() -> Self {
        Self::noop()
    }
}

impl fmt::Debug for ObservabilityHub {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ObservabilityHub")
            .field("recording", &self.storage.is_some())
            .finish()
    }
}

/// Handle for one run: spawn spans, write logs, finish the run.
#[derive(Clone)]
pub struct RunHandle {
    hub: ObservabilityHub,
    run: Arc<RunRecord>,
}

impl fmt::Debug for RunHandle {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("RunHandle")
            .field("run_id", &self.run.id)
            .field("trace_id", &self.run.trace_id)
            .field("status", &self.run.status)
            .finish_non_exhaustive()
    }
}

impl RunHandle {
    /// The persisted run id (`run_` prefix).
    pub fn run_id(&self) -> &str {
        &self.run.id
    }

    /// The trace id shared by every span opened from this handle.
    pub fn trace_id(&self) -> &str {
        &self.run.trace_id
    }

    /// The user this run executes on behalf of; propagated to spans and logs.
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
        parent_span_id: Option<&str>,
    ) -> SpanGuard {
        let span = TraceSpan {
            id: new_id("spn"),
            trace_id: self.run.trace_id.clone(),
            parent_id: parent_span_id.map(str::to_string),
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
        SpanGuard {
            hub: self.hub.clone(),
            span,
        }
    }

    /// Record a structured log line correlated to this run. `level` is one of
    /// the [`log_level`] constants; unknown levels are stored as-is.
    pub async fn log(&self, level: &str, message: &str, fields: Value) {
        match level {
            log_level::ERROR => tracing::error!(run_id = %self.run.id, message, "run log"),
            log_level::WARN => tracing::warn!(run_id = %self.run.id, message, "run log"),
            log_level::DEBUG => tracing::debug!(run_id = %self.run.id, message, "run log"),
            log_level::TRACE => tracing::trace!(run_id = %self.run.id, message, "run log"),
            _ => tracing::info!(run_id = %self.run.id, level, message, "run log"),
        }
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
        if status == run_status::FAILED {
            tracing::warn!(
                run_id = %run.id,
                status,
                error = run.error.as_deref().unwrap_or(""),
                "run finished"
            );
        } else {
            tracing::info!(run_id = %run.id, status, "run finished");
        }
        self.hub.persist_run(run).await;
    }

    /// Finish the run as succeeded, storing `output`.
    pub async fn finish_success(&self, output: Value) {
        self.finish(run_status::SUCCESS, output, None).await;
    }

    /// Finish the run as failed, storing `error`; output stays `Null`.
    pub async fn finish_failed(&self, error: &str) {
        self.finish(run_status::FAILED, Value::Null, Some(error.to_string()))
            .await;
    }

    /// Finish the run as cancelled.
    pub async fn finish_cancelled(&self) {
        self.finish(run_status::CANCELLED, Value::Null, None).await;
    }

    /// Record the run as suspended (e.g. awaiting an interrupt). Sets
    /// `ended_at` like a terminal finish; resuming re-attaches via
    /// [`ObservabilityHub::attach_run`] and a later `finish_*` overwrites the
    /// terminal fields.
    pub async fn mark_suspended(&self) {
        self.finish(run_status::SUSPENDED, Value::Null, None).await;
    }
}

/// An open span. Call [`SpanGuard::end_ok`] or [`SpanGuard::end_err`] to
/// record it; spans are persisted only at end, so a guard dropped without
/// ending leaves no partial row — an unended span is simply lost, the safe
/// failure mode for crash paths.
pub struct SpanGuard {
    hub: ObservabilityHub,
    span: TraceSpan,
}

impl fmt::Debug for SpanGuard {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SpanGuard")
            .field("span_id", &self.span.id)
            .field("name", &self.span.name)
            .field("kind", &self.span.kind)
            .finish_non_exhaustive()
    }
}

impl SpanGuard {
    /// The span's id, usable as `parent_span_id` for
    /// [`RunHandle::span_with_parent`].
    pub fn span_id(&self) -> &str {
        &self.span.id
    }

    /// Attach metadata, persisted when the span ends.
    pub fn set_metadata(&mut self, metadata: Value) {
        self.span.metadata = metadata;
    }

    /// End the span successfully with `output` and persist it.
    pub async fn end_ok(mut self, output: Value) {
        self.span.output = output;
        self.span.ended_at = Some(Utc::now());
        tracing::debug!(span = %self.span.name, "span ended");
        self.hub.persist_span(self.span).await;
    }

    /// End the span as failed with `error` and persist it.
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

        let run = hub
            .start_run("agent", "main", "user-1", json!({"q": "hi"}))
            .await;
        let span = run
            .span("llm turn", span_kind::LLM_CALL, json!({"messages": 1}))
            .await;
        span.end_ok(json!({"stop": "end_turn"})).await;
        run.log(log_level::INFO, "step complete", json!({})).await;
        run.finish_success(json!({"text": "done"})).await;

        let stored_run = storage.get_run(run.run_id()).await.unwrap().unwrap();
        assert_eq!(stored_run.status, run_status::SUCCESS);
        let spans = storage.list_spans(run.trace_id()).await.unwrap();
        assert_eq!(spans.len(), 1);
        assert_eq!(spans[0].kind, span_kind::LLM_CALL);
        let logs = storage
            .list_logs(None, Some(run.run_id()), Page::default())
            .await
            .unwrap();
        assert_eq!(logs.len(), 1);
    }

    #[tokio::test]
    async fn noop_hub_records_nothing_and_never_panics() {
        let hub = ObservabilityHub::noop();
        let run = hub
            .start_run(run_kind::AGENT, "main", "user-1", json!({}))
            .await;
        let ok_span = run.span("ok", span_kind::TOOL_CALL, json!({})).await;
        ok_span.end_ok(json!({"fine": true})).await;
        let err_span = run.span("err", span_kind::LLM_CALL, json!({})).await;
        err_span.end_err("boom").await;
        run.log(log_level::ERROR, "something", json!({})).await;
        run.finish_failed("kaput").await;
        // Completing the full lifecycle without storage is the assertion.
    }

    #[tokio::test]
    async fn error_paths_persist_status_and_error() {
        let storage: SharedStorage = Arc::new(InMemoryStorage::new());
        let hub = ObservabilityHub::new(storage.clone());

        let run = hub
            .start_run(run_kind::AGENT, "main", "user-1", json!({}))
            .await;
        let span = run.span("failing", span_kind::TOOL_CALL, json!({})).await;
        span.end_err("boom").await;
        run.finish_failed("kaput").await;

        let stored_run = storage.get_run(run.run_id()).await.unwrap().unwrap();
        assert_eq!(stored_run.status, run_status::FAILED);
        assert_eq!(stored_run.error.as_deref(), Some("kaput"));
        assert!(stored_run.ended_at.is_some());

        let spans = storage.list_spans(run.trace_id()).await.unwrap();
        assert_eq!(spans.len(), 1);
        assert_eq!(spans[0].error.as_deref(), Some("boom"));
        assert!(spans[0].ended_at.is_some());
    }

    #[tokio::test]
    async fn unended_span_persists_nothing() {
        let storage: SharedStorage = Arc::new(InMemoryStorage::new());
        let hub = ObservabilityHub::new(storage.clone());

        let run = hub
            .start_run(run_kind::WORKFLOW, "main", "user-1", json!({}))
            .await;
        let span = run.span("orphan", span_kind::OTHER, Value::Null).await;
        drop(span);

        assert!(storage.list_spans(run.trace_id()).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn attach_run_preserves_identity_and_finish_overwrites_terminal_fields() {
        let storage: SharedStorage = Arc::new(InMemoryStorage::new());
        let hub = ObservabilityHub::new(storage.clone());

        let run = hub
            .start_run(run_kind::WORKFLOW, "main", "user-1", json!({}))
            .await;
        run.mark_suspended().await;

        let stored = storage.get_run(run.run_id()).await.unwrap().unwrap();
        assert_eq!(stored.status, run_status::SUSPENDED);
        let original_started_at = stored.started_at;

        let attached = hub.attach_run(stored);
        assert_eq!(attached.run_id(), run.run_id());
        assert_eq!(attached.trace_id(), run.trace_id());

        attached.finish_success(json!({"ok": true})).await;

        let finished = storage.get_run(run.run_id()).await.unwrap().unwrap();
        assert_eq!(finished.status, run_status::SUCCESS);
        assert!(finished.error.is_none());
        assert!(finished.ended_at.is_some());
        assert_eq!(finished.started_at, original_started_at);
    }
}
