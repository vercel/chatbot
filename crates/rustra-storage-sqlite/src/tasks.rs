//! [`TaskStore`]: tasks, schedules, subscriptions, HITL decisions.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, Row};
use rustra_core::Result;
use rustra_storage::types::{DecisionRecord, ScheduleRecord, SubscriptionRecord, TaskRecord};
use rustra_storage::{Page, TaskStore};

use crate::util::*;
use crate::SqliteStorage;

const SELECT_TASK: &str = "SELECT id, user_id, \"trigger\", spec, status, attempts, max_retries, \
                           last_error, output, run_id, schedule_id, created_at, started_at, \
                           ended_at FROM rustra_tasks";

const SELECT_SCHEDULE: &str = "SELECT id, user_id, name, cron, timezone, spec, enabled, \
                               next_run_at, last_run_at, created_at FROM rustra_schedules";

const SELECT_SUBSCRIPTION: &str =
    "SELECT id, user_id, event_name, spec, enabled, created_at FROM rustra_subscriptions";

const SELECT_DECISION: &str = "SELECT id, user_id, run_id, kind, prompt, payload, status, \
                               resolution, created_at, resolved_at FROM rustra_decisions";

fn task_from_row(row: &Row<'_>) -> Result<TaskRecord> {
    Ok(TaskRecord {
        id: col(row, "id")?,
        user_id: col(row, "user_id")?,
        trigger: col(row, "trigger")?,
        spec: col_json(row, "spec")?,
        status: col(row, "status")?,
        attempts: col(row, "attempts")?,
        max_retries: col(row, "max_retries")?,
        last_error: col(row, "last_error")?,
        output: col_json(row, "output")?,
        run_id: col(row, "run_id")?,
        schedule_id: col(row, "schedule_id")?,
        created_at: col_ts(row, "created_at")?,
        started_at: col_ts_opt(row, "started_at")?,
        ended_at: col_ts_opt(row, "ended_at")?,
    })
}

fn schedule_from_row(row: &Row<'_>) -> Result<ScheduleRecord> {
    Ok(ScheduleRecord {
        id: col(row, "id")?,
        user_id: col(row, "user_id")?,
        name: col(row, "name")?,
        cron: col(row, "cron")?,
        timezone: col(row, "timezone")?,
        spec: col_json(row, "spec")?,
        enabled: col(row, "enabled")?,
        next_run_at: col_ts_opt(row, "next_run_at")?,
        last_run_at: col_ts_opt(row, "last_run_at")?,
        created_at: col_ts(row, "created_at")?,
    })
}

fn subscription_from_row(row: &Row<'_>) -> Result<SubscriptionRecord> {
    Ok(SubscriptionRecord {
        id: col(row, "id")?,
        user_id: col(row, "user_id")?,
        event_name: col(row, "event_name")?,
        spec: col_json(row, "spec")?,
        enabled: col(row, "enabled")?,
        created_at: col_ts(row, "created_at")?,
    })
}

fn decision_from_row(row: &Row<'_>) -> Result<DecisionRecord> {
    Ok(DecisionRecord {
        id: col(row, "id")?,
        user_id: col(row, "user_id")?,
        run_id: col(row, "run_id")?,
        kind: col(row, "kind")?,
        prompt: col(row, "prompt")?,
        payload: col_json(row, "payload")?,
        status: col(row, "status")?,
        resolution: col_json(row, "resolution")?,
        created_at: col_ts(row, "created_at")?,
        resolved_at: col_ts_opt(row, "resolved_at")?,
    })
}

fn upsert_task(conn: &Connection, task: &TaskRecord) -> Result<()> {
    exec(
        conn,
        "INSERT OR REPLACE INTO rustra_tasks \
         (id, user_id, \"trigger\", spec, status, attempts, max_retries, last_error, output, \
          run_id, schedule_id, created_at, started_at, ended_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            task.id,
            task.user_id,
            task.trigger,
            json_to_sql(&task.spec)?,
            task.status,
            task.attempts,
            task.max_retries,
            task.last_error,
            json_to_sql(&task.output)?,
            task.run_id,
            task.schedule_id,
            to_ts(task.created_at),
            to_ts_opt(task.started_at),
            to_ts_opt(task.ended_at),
        ],
    )?;
    Ok(())
}

fn upsert_decision(conn: &Connection, decision: &DecisionRecord) -> Result<()> {
    exec(
        conn,
        "INSERT OR REPLACE INTO rustra_decisions \
         (id, user_id, run_id, kind, prompt, payload, status, resolution, created_at, \
          resolved_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            decision.id,
            decision.user_id,
            decision.run_id,
            decision.kind,
            decision.prompt,
            json_to_sql(&decision.payload)?,
            decision.status,
            json_to_sql(&decision.resolution)?,
            to_ts(decision.created_at),
            to_ts_opt(decision.resolved_at),
        ],
    )?;
    Ok(())
}

#[async_trait]
impl TaskStore for SqliteStorage {
    async fn insert_task(&self, task: TaskRecord) -> Result<()> {
        self.db.call(move |conn| upsert_task(conn, &task)).await
    }

    async fn update_task(&self, task: TaskRecord) -> Result<()> {
        self.db.call(move |conn| upsert_task(conn, &task)).await
    }

    async fn get_task(&self, task_id: &str) -> Result<Option<TaskRecord>> {
        let task_id = task_id.to_owned();
        self.db
            .call(move |conn| {
                query_opt(
                    conn,
                    &format!("{SELECT_TASK} WHERE id = ?1"),
                    params![task_id],
                    task_from_row,
                )
            })
            .await
    }

    async fn list_tasks(
        &self,
        user_id: &str,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<TaskRecord>> {
        let user_id = user_id.to_owned();
        let status = status.map(str::to_owned);
        let (limit, offset) = page_params(page);
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_TASK} WHERE user_id = ?1 AND (?2 IS NULL OR status = ?2) \
                         ORDER BY created_at DESC, rowid DESC LIMIT ?3 OFFSET ?4"
                    ),
                    params![user_id, status, limit, offset],
                    task_from_row,
                )
            })
            .await
    }

    async fn upsert_schedule(&self, schedule: ScheduleRecord) -> Result<()> {
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "INSERT OR REPLACE INTO rustra_schedules \
                     (id, user_id, name, cron, timezone, spec, enabled, next_run_at, \
                      last_run_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        schedule.id,
                        schedule.user_id,
                        schedule.name,
                        schedule.cron,
                        schedule.timezone,
                        json_to_sql(&schedule.spec)?,
                        schedule.enabled,
                        to_ts_opt(schedule.next_run_at),
                        to_ts_opt(schedule.last_run_at),
                        to_ts(schedule.created_at),
                    ],
                )?;
                Ok(())
            })
            .await
    }

    async fn get_schedule(&self, schedule_id: &str) -> Result<Option<ScheduleRecord>> {
        let schedule_id = schedule_id.to_owned();
        self.db
            .call(move |conn| {
                query_opt(
                    conn,
                    &format!("{SELECT_SCHEDULE} WHERE id = ?1"),
                    params![schedule_id],
                    schedule_from_row,
                )
            })
            .await
    }

    async fn delete_schedule(&self, schedule_id: &str) -> Result<()> {
        let schedule_id = schedule_id.to_owned();
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "DELETE FROM rustra_schedules WHERE id = ?1",
                    params![schedule_id],
                )?;
                Ok(())
            })
            .await
    }

    async fn list_schedules(
        &self,
        user_id: Option<&str>,
        page: Page,
    ) -> Result<Vec<ScheduleRecord>> {
        let user_id = user_id.map(str::to_owned);
        let (limit, offset) = page_params(page);
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_SCHEDULE} WHERE (?1 IS NULL OR user_id = ?1) \
                         ORDER BY created_at DESC, rowid DESC LIMIT ?2 OFFSET ?3"
                    ),
                    params![user_id, limit, offset],
                    schedule_from_row,
                )
            })
            .await
    }

    async fn due_schedules(&self, now: DateTime<Utc>) -> Result<Vec<ScheduleRecord>> {
        let now = to_ts(now);
        self.db
            .call(move |conn| {
                // Fixed-width RFC3339 makes the TEXT comparison chronological.
                query_all(
                    conn,
                    &format!(
                        "{SELECT_SCHEDULE} WHERE enabled = 1 AND next_run_at IS NOT NULL \
                         AND next_run_at <= ?1 ORDER BY next_run_at ASC"
                    ),
                    params![now],
                    schedule_from_row,
                )
            })
            .await
    }

    async fn upsert_subscription(&self, sub: SubscriptionRecord) -> Result<()> {
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "INSERT OR REPLACE INTO rustra_subscriptions \
                     (id, user_id, event_name, spec, enabled, created_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        sub.id,
                        sub.user_id,
                        sub.event_name,
                        json_to_sql(&sub.spec)?,
                        sub.enabled,
                        to_ts(sub.created_at),
                    ],
                )?;
                Ok(())
            })
            .await
    }

    async fn delete_subscription(&self, sub_id: &str) -> Result<()> {
        let sub_id = sub_id.to_owned();
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "DELETE FROM rustra_subscriptions WHERE id = ?1",
                    params![sub_id],
                )?;
                Ok(())
            })
            .await
    }

    async fn list_subscriptions(
        &self,
        user_id: Option<&str>,
        page: Page,
    ) -> Result<Vec<SubscriptionRecord>> {
        let user_id = user_id.map(str::to_owned);
        let (limit, offset) = page_params(page);
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_SUBSCRIPTION} WHERE (?1 IS NULL OR user_id = ?1) \
                         ORDER BY created_at DESC, rowid DESC LIMIT ?2 OFFSET ?3"
                    ),
                    params![user_id, limit, offset],
                    subscription_from_row,
                )
            })
            .await
    }

    async fn insert_decision(&self, decision: DecisionRecord) -> Result<()> {
        self.db
            .call(move |conn| upsert_decision(conn, &decision))
            .await
    }

    async fn update_decision(&self, decision: DecisionRecord) -> Result<()> {
        self.db
            .call(move |conn| upsert_decision(conn, &decision))
            .await
    }

    async fn get_decision(&self, decision_id: &str) -> Result<Option<DecisionRecord>> {
        let decision_id = decision_id.to_owned();
        self.db
            .call(move |conn| {
                query_opt(
                    conn,
                    &format!("{SELECT_DECISION} WHERE id = ?1"),
                    params![decision_id],
                    decision_from_row,
                )
            })
            .await
    }

    async fn list_decisions(
        &self,
        user_id: &str,
        pending_only: bool,
        page: Page,
    ) -> Result<Vec<DecisionRecord>> {
        let user_id = user_id.to_owned();
        let (limit, offset) = page_params(page);
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_DECISION} WHERE user_id = ?1 \
                         AND (?2 = 0 OR status = 'pending') \
                         ORDER BY created_at DESC, rowid DESC LIMIT ?3 OFFSET ?4"
                    ),
                    params![user_id, pending_only, limit, offset],
                    decision_from_row,
                )
            })
            .await
    }
}
