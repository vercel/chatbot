//! [`ObservabilityStore`]: runs, trace spans, logs.

use async_trait::async_trait;
use rustra_core::Result;
use rustra_storage::types::{LogRecord, RunRecord, TraceSpan};
use rustra_storage::{ObservabilityStore, Page};
use tokio_postgres::Row;

use crate::util::*;
use crate::PostgresStorage;

const SELECT_RUN: &str = "SELECT id, kind, subject_id, user_id, status, input, output, error, \
                          trace_id, started_at, ended_at, metadata FROM rustra_runs";

const SELECT_SPAN: &str = "SELECT id, trace_id, parent_id, name, kind, user_id, input, output, \
                           error, started_at, ended_at, metadata FROM rustra_spans";

const SELECT_LOG: &str =
    "SELECT id, level, message, fields, user_id, run_id, created_at FROM rustra_logs";

const UPSERT_RUN: &str = "INSERT INTO rustra_runs \
     (id, kind, subject_id, user_id, status, input, output, error, trace_id, started_at, \
      ended_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
     ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, subject_id = EXCLUDED.subject_id, \
     user_id = EXCLUDED.user_id, status = EXCLUDED.status, input = EXCLUDED.input, \
     output = EXCLUDED.output, error = EXCLUDED.error, trace_id = EXCLUDED.trace_id, \
     started_at = EXCLUDED.started_at, ended_at = EXCLUDED.ended_at, \
     metadata = EXCLUDED.metadata";

const UPSERT_SPAN: &str = "INSERT INTO rustra_spans \
     (id, trace_id, parent_id, name, kind, user_id, input, output, error, started_at, \
      ended_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
     ON CONFLICT (id) DO UPDATE SET trace_id = EXCLUDED.trace_id, \
     parent_id = EXCLUDED.parent_id, name = EXCLUDED.name, kind = EXCLUDED.kind, \
     user_id = EXCLUDED.user_id, input = EXCLUDED.input, output = EXCLUDED.output, \
     error = EXCLUDED.error, started_at = EXCLUDED.started_at, \
     ended_at = EXCLUDED.ended_at, metadata = EXCLUDED.metadata";

fn run_from_row(row: &Row) -> Result<RunRecord> {
    Ok(RunRecord {
        id: col(row, 0)?,
        kind: col(row, 1)?,
        subject_id: col(row, 2)?,
        user_id: col(row, 3)?,
        status: col(row, 4)?,
        input: col(row, 5)?,
        output: col(row, 6)?,
        error: col(row, 7)?,
        trace_id: col(row, 8)?,
        started_at: col(row, 9)?,
        ended_at: col(row, 10)?,
        metadata: col(row, 11)?,
    })
}

fn span_from_row(row: &Row) -> Result<TraceSpan> {
    Ok(TraceSpan {
        id: col(row, 0)?,
        trace_id: col(row, 1)?,
        parent_id: col(row, 2)?,
        name: col(row, 3)?,
        kind: col(row, 4)?,
        user_id: col(row, 5)?,
        input: col(row, 6)?,
        output: col(row, 7)?,
        error: col(row, 8)?,
        started_at: col(row, 9)?,
        ended_at: col(row, 10)?,
        metadata: col(row, 11)?,
    })
}

fn log_from_row(row: &Row) -> Result<LogRecord> {
    Ok(LogRecord {
        id: col(row, 0)?,
        level: col(row, 1)?,
        message: col(row, 2)?,
        fields: col(row, 3)?,
        user_id: col(row, 4)?,
        run_id: col(row, 5)?,
        created_at: col(row, 6)?,
    })
}

impl PostgresStorage {
    async fn upsert_run_row(&self, run: &RunRecord) -> Result<()> {
        self.db
            .execute(
                UPSERT_RUN,
                &[
                    &run.id,
                    &run.kind,
                    &run.subject_id,
                    &run.user_id,
                    &run.status,
                    &run.input,
                    &run.output,
                    &run.error,
                    &run.trace_id,
                    &run.started_at,
                    &run.ended_at,
                    &run.metadata,
                ],
            )
            .await?;
        Ok(())
    }
}

#[async_trait]
impl ObservabilityStore for PostgresStorage {
    async fn insert_run(&self, run: RunRecord) -> Result<()> {
        self.upsert_run_row(&run).await
    }

    async fn update_run(&self, run: RunRecord) -> Result<()> {
        self.upsert_run_row(&run).await
    }

    async fn get_run(&self, run_id: &str) -> Result<Option<RunRecord>> {
        let row = self
            .db
            .query_opt(&format!("{SELECT_RUN} WHERE id = $1"), &[&run_id])
            .await?;
        row_opt(row, run_from_row)
    }

    async fn list_runs(
        &self,
        user_id: &str,
        kind: Option<&str>,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<RunRecord>> {
        let (limit, offset) = page_params(page);
        let rows = self
            .db
            .query(
                &format!(
                    "{SELECT_RUN} WHERE user_id = $1 \
                     AND ($2::TEXT IS NULL OR kind = $2) \
                     AND ($3::TEXT IS NULL OR status = $3) \
                     ORDER BY started_at DESC LIMIT $4 OFFSET $5"
                ),
                &[&user_id, &kind, &status, &limit, &offset],
            )
            .await?;
        rows_map(rows, run_from_row)
    }

    async fn insert_spans(&self, spans: Vec<TraceSpan>) -> Result<()> {
        // Sequential pipelined upserts; unlike the SQLite backend this batch
        // is not atomic (partial writes possible on failure) — acceptable for
        // observability data, noted as debt.
        for span in &spans {
            self.db
                .execute(
                    UPSERT_SPAN,
                    &[
                        &span.id,
                        &span.trace_id,
                        &span.parent_id,
                        &span.name,
                        &span.kind,
                        &span.user_id,
                        &span.input,
                        &span.output,
                        &span.error,
                        &span.started_at,
                        &span.ended_at,
                        &span.metadata,
                    ],
                )
                .await?;
        }
        Ok(())
    }

    async fn list_spans(&self, trace_id: &str) -> Result<Vec<TraceSpan>> {
        let rows = self
            .db
            .query(
                &format!("{SELECT_SPAN} WHERE trace_id = $1 ORDER BY started_at ASC, seq ASC"),
                &[&trace_id],
            )
            .await?;
        rows_map(rows, span_from_row)
    }

    async fn insert_log(&self, log: LogRecord) -> Result<()> {
        self.db
            .execute(
                "INSERT INTO rustra_logs \
                 (id, level, message, fields, user_id, run_id, created_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7)",
                &[
                    &log.id,
                    &log.level,
                    &log.message,
                    &log.fields,
                    &log.user_id,
                    &log.run_id,
                    &log.created_at,
                ],
            )
            .await?;
        Ok(())
    }

    async fn list_logs(
        &self,
        user_id: Option<&str>,
        run_id: Option<&str>,
        page: Page,
    ) -> Result<Vec<LogRecord>> {
        let (limit, offset) = page_params(page);
        let rows = self
            .db
            .query(
                &format!(
                    "{SELECT_LOG} WHERE ($1::TEXT IS NULL OR user_id = $1) \
                     AND ($2::TEXT IS NULL OR run_id = $2) \
                     ORDER BY created_at DESC LIMIT $3 OFFSET $4"
                ),
                &[&user_id, &run_id, &limit, &offset],
            )
            .await?;
        rows_map(rows, log_from_row)
    }
}
