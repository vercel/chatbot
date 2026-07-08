//! [`ObservabilityStore`]: runs, trace spans, logs.

use async_trait::async_trait;
use rusqlite::{params, Row};
use rustra_core::Result;
use rustra_storage::types::{LogRecord, RunRecord, TraceSpan};
use rustra_storage::{ObservabilityStore, Page};

use crate::util::*;
use crate::SqliteStorage;

const SELECT_RUN: &str = "SELECT id, kind, subject_id, user_id, status, input, output, error, \
                          trace_id, started_at, ended_at, metadata FROM rustra_runs";

const SELECT_SPAN: &str = "SELECT id, trace_id, parent_id, name, kind, user_id, input, output, \
                           error, started_at, ended_at, metadata FROM rustra_spans";

const SELECT_LOG: &str =
    "SELECT id, level, message, fields, user_id, run_id, created_at FROM rustra_logs";

const UPSERT_RUN: &str = "INSERT OR REPLACE INTO rustra_runs \
     (id, kind, subject_id, user_id, status, input, output, error, trace_id, started_at, \
      ended_at, metadata) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)";

fn run_from_row(row: &Row<'_>) -> Result<RunRecord> {
    Ok(RunRecord {
        id: col(row, 0)?,
        kind: col(row, 1)?,
        subject_id: col(row, 2)?,
        user_id: col(row, 3)?,
        status: col(row, 4)?,
        input: col_json(row, 5)?,
        output: col_json(row, 6)?,
        error: col(row, 7)?,
        trace_id: col(row, 8)?,
        started_at: col_ts(row, 9)?,
        ended_at: col_ts_opt(row, 10)?,
        metadata: col_json(row, 11)?,
    })
}

fn span_from_row(row: &Row<'_>) -> Result<TraceSpan> {
    Ok(TraceSpan {
        id: col(row, 0)?,
        trace_id: col(row, 1)?,
        parent_id: col(row, 2)?,
        name: col(row, 3)?,
        kind: col(row, 4)?,
        user_id: col(row, 5)?,
        input: col_json(row, 6)?,
        output: col_json(row, 7)?,
        error: col(row, 8)?,
        started_at: col_ts(row, 9)?,
        ended_at: col_ts_opt(row, 10)?,
        metadata: col_json(row, 11)?,
    })
}

fn log_from_row(row: &Row<'_>) -> Result<LogRecord> {
    Ok(LogRecord {
        id: col(row, 0)?,
        level: col(row, 1)?,
        message: col(row, 2)?,
        fields: col_json(row, 3)?,
        user_id: col(row, 4)?,
        run_id: col(row, 5)?,
        created_at: col_ts(row, 6)?,
    })
}

fn upsert_run(conn: &rusqlite::Connection, run: &RunRecord) -> Result<()> {
    exec(
        conn,
        UPSERT_RUN,
        params![
            run.id,
            run.kind,
            run.subject_id,
            run.user_id,
            run.status,
            json_to_sql(&run.input)?,
            json_to_sql(&run.output)?,
            run.error,
            run.trace_id,
            to_ts(run.started_at),
            to_ts_opt(run.ended_at),
            json_to_sql(&run.metadata)?,
        ],
    )?;
    Ok(())
}

#[async_trait]
impl ObservabilityStore for SqliteStorage {
    async fn insert_run(&self, run: RunRecord) -> Result<()> {
        self.db.call(move |conn| upsert_run(conn, &run)).await
    }

    async fn update_run(&self, run: RunRecord) -> Result<()> {
        self.db.call(move |conn| upsert_run(conn, &run)).await
    }

    async fn get_run(&self, run_id: &str) -> Result<Option<RunRecord>> {
        let run_id = run_id.to_owned();
        self.db
            .call(move |conn| {
                query_opt(
                    conn,
                    &format!("{SELECT_RUN} WHERE id = ?1"),
                    params![run_id],
                    run_from_row,
                )
            })
            .await
    }

    async fn list_runs(
        &self,
        user_id: &str,
        kind: Option<&str>,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<RunRecord>> {
        let user_id = user_id.to_owned();
        let kind = kind.map(str::to_owned);
        let status = status.map(str::to_owned);
        let (limit, offset) = page_params(page);
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_RUN} WHERE user_id = ?1 \
                         AND (?2 IS NULL OR kind = ?2) \
                         AND (?3 IS NULL OR status = ?3) \
                         ORDER BY started_at DESC LIMIT ?4 OFFSET ?5"
                    ),
                    params![user_id, kind, status, limit, offset],
                    run_from_row,
                )
            })
            .await
    }

    async fn insert_spans(&self, spans: Vec<TraceSpan>) -> Result<()> {
        self.db
            .call(move |conn| {
                let tx = conn.transaction().map_err(storage_err)?;
                {
                    let mut stmt = tx
                        .prepare(
                            "INSERT OR REPLACE INTO rustra_spans \
                             (id, trace_id, parent_id, name, kind, user_id, input, output, \
                              error, started_at, ended_at, metadata) \
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                        )
                        .map_err(storage_err)?;
                    for span in &spans {
                        stmt.execute(params![
                            span.id,
                            span.trace_id,
                            span.parent_id,
                            span.name,
                            span.kind,
                            span.user_id,
                            json_to_sql(&span.input)?,
                            json_to_sql(&span.output)?,
                            span.error,
                            to_ts(span.started_at),
                            to_ts_opt(span.ended_at),
                            json_to_sql(&span.metadata)?,
                        ])
                        .map_err(storage_err)?;
                    }
                }
                tx.commit().map_err(storage_err)?;
                Ok(())
            })
            .await
    }

    async fn list_spans(&self, trace_id: &str) -> Result<Vec<TraceSpan>> {
        let trace_id = trace_id.to_owned();
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_SPAN} WHERE trace_id = ?1 ORDER BY started_at ASC, rowid ASC"
                    ),
                    params![trace_id],
                    span_from_row,
                )
            })
            .await
    }

    async fn insert_log(&self, log: LogRecord) -> Result<()> {
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "INSERT INTO rustra_logs \
                     (id, level, message, fields, user_id, run_id, created_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        log.id,
                        log.level,
                        log.message,
                        json_to_sql(&log.fields)?,
                        log.user_id,
                        log.run_id,
                        to_ts(log.created_at),
                    ],
                )?;
                Ok(())
            })
            .await
    }

    async fn list_logs(
        &self,
        user_id: Option<&str>,
        run_id: Option<&str>,
        page: Page,
    ) -> Result<Vec<LogRecord>> {
        let user_id = user_id.map(str::to_owned);
        let run_id = run_id.map(str::to_owned);
        let (limit, offset) = page_params(page);
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_LOG} WHERE (?1 IS NULL OR user_id = ?1) \
                         AND (?2 IS NULL OR run_id = ?2) \
                         ORDER BY created_at DESC LIMIT ?3 OFFSET ?4"
                    ),
                    params![user_id, run_id, limit, offset],
                    log_from_row,
                )
            })
            .await
    }
}
