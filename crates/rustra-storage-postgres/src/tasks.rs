//! [`TaskStore`]: tasks, schedules, subscriptions, HITL decisions.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use rustra_core::Result;
use rustra_storage::types::{DecisionRecord, ScheduleRecord, SubscriptionRecord, TaskRecord};
use rustra_storage::{Page, TaskStore};
use tokio_postgres::Row;

use crate::util::*;
use crate::PostgresStorage;

const SELECT_TASK: &str = "SELECT id, user_id, \"trigger\", spec, status, attempts, max_retries, \
                           last_error, output, run_id, schedule_id, created_at, started_at, \
                           ended_at FROM rustra_tasks";

const SELECT_SCHEDULE: &str = "SELECT id, user_id, name, cron, timezone, spec, enabled, \
                               next_run_at, last_run_at, created_at FROM rustra_schedules";

const SELECT_SUBSCRIPTION: &str =
    "SELECT id, user_id, event_name, spec, enabled, created_at FROM rustra_subscriptions";

const SELECT_DECISION: &str = "SELECT id, user_id, run_id, kind, prompt, payload, status, \
                               resolution, created_at, resolved_at FROM rustra_decisions";

const UPSERT_TASK: &str = "INSERT INTO rustra_tasks \
     (id, user_id, \"trigger\", spec, status, attempts, max_retries, last_error, output, \
      run_id, schedule_id, created_at, started_at, ended_at) \
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) \
     ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, \
     \"trigger\" = EXCLUDED.\"trigger\", spec = EXCLUDED.spec, status = EXCLUDED.status, \
     attempts = EXCLUDED.attempts, max_retries = EXCLUDED.max_retries, \
     last_error = EXCLUDED.last_error, output = EXCLUDED.output, run_id = EXCLUDED.run_id, \
     schedule_id = EXCLUDED.schedule_id, created_at = EXCLUDED.created_at, \
     started_at = EXCLUDED.started_at, ended_at = EXCLUDED.ended_at";

const UPSERT_DECISION: &str = "INSERT INTO rustra_decisions \
     (id, user_id, run_id, kind, prompt, payload, status, resolution, created_at, resolved_at) \
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
     ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, run_id = EXCLUDED.run_id, \
     kind = EXCLUDED.kind, prompt = EXCLUDED.prompt, payload = EXCLUDED.payload, \
     status = EXCLUDED.status, resolution = EXCLUDED.resolution, \
     created_at = EXCLUDED.created_at, resolved_at = EXCLUDED.resolved_at";

impl FromRow for TaskRecord {
    fn from_row(row: &Row) -> Result<TaskRecord> {
        Ok(TaskRecord {
            id: col(row, 0)?,
            user_id: col(row, 1)?,
            trigger: col(row, 2)?,
            spec: col(row, 3)?,
            status: col(row, 4)?,
            attempts: col_u32(row, 5)?,
            max_retries: col_u32(row, 6)?,
            last_error: col(row, 7)?,
            output: col(row, 8)?,
            run_id: col(row, 9)?,
            schedule_id: col(row, 10)?,
            created_at: col(row, 11)?,
            started_at: col(row, 12)?,
            ended_at: col(row, 13)?,
        })
    }
}

impl FromRow for ScheduleRecord {
    fn from_row(row: &Row) -> Result<ScheduleRecord> {
        Ok(ScheduleRecord {
            id: col(row, 0)?,
            user_id: col(row, 1)?,
            name: col(row, 2)?,
            cron: col(row, 3)?,
            timezone: col(row, 4)?,
            spec: col(row, 5)?,
            enabled: col(row, 6)?,
            next_run_at: col(row, 7)?,
            last_run_at: col(row, 8)?,
            created_at: col(row, 9)?,
        })
    }
}

impl FromRow for SubscriptionRecord {
    fn from_row(row: &Row) -> Result<SubscriptionRecord> {
        Ok(SubscriptionRecord {
            id: col(row, 0)?,
            user_id: col(row, 1)?,
            event_name: col(row, 2)?,
            spec: col(row, 3)?,
            enabled: col(row, 4)?,
            created_at: col(row, 5)?,
        })
    }
}

impl FromRow for DecisionRecord {
    fn from_row(row: &Row) -> Result<DecisionRecord> {
        Ok(DecisionRecord {
            id: col(row, 0)?,
            user_id: col(row, 1)?,
            run_id: col(row, 2)?,
            kind: col(row, 3)?,
            prompt: col(row, 4)?,
            payload: col(row, 5)?,
            status: col(row, 6)?,
            resolution: col(row, 7)?,
            created_at: col(row, 8)?,
            resolved_at: col(row, 9)?,
        })
    }
}

impl PostgresStorage {
    async fn upsert_task_row(&self, task: &TaskRecord) -> Result<()> {
        let attempts = u32_to_db(task.attempts);
        let max_retries = u32_to_db(task.max_retries);
        self.db
            .execute(
                UPSERT_TASK,
                &[
                    &task.id,
                    &task.user_id,
                    &task.trigger,
                    &task.spec,
                    &task.status,
                    &attempts,
                    &max_retries,
                    &task.last_error,
                    &task.output,
                    &task.run_id,
                    &task.schedule_id,
                    &task.created_at,
                    &task.started_at,
                    &task.ended_at,
                ],
            )
            .await?;
        Ok(())
    }

    async fn upsert_decision_row(&self, decision: &DecisionRecord) -> Result<()> {
        self.db
            .execute(
                UPSERT_DECISION,
                &[
                    &decision.id,
                    &decision.user_id,
                    &decision.run_id,
                    &decision.kind,
                    &decision.prompt,
                    &decision.payload,
                    &decision.status,
                    &decision.resolution,
                    &decision.created_at,
                    &decision.resolved_at,
                ],
            )
            .await?;
        Ok(())
    }
}

#[async_trait]
impl TaskStore for PostgresStorage {
    async fn insert_task(&self, task: TaskRecord) -> Result<()> {
        self.upsert_task_row(&task).await
    }

    async fn update_task(&self, task: TaskRecord) -> Result<()> {
        self.upsert_task_row(&task).await
    }

    async fn get_task(&self, task_id: &str) -> Result<Option<TaskRecord>> {
        self.db
            .query_opt_as::<TaskRecord>(&format!("{SELECT_TASK} WHERE id = $1"), &[&task_id])
            .await
    }

    async fn list_tasks(
        &self,
        user_id: &str,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<TaskRecord>> {
        let (limit, offset) = page_params(page);
        self.db
            .query_as::<TaskRecord>(
                &format!(
                    "{SELECT_TASK} WHERE user_id = $1 AND ($2::TEXT IS NULL OR status = $2) \
                     ORDER BY created_at DESC LIMIT $3 OFFSET $4"
                ),
                &[&user_id, &status, &limit, &offset],
            )
            .await
    }

    async fn upsert_schedule(&self, schedule: ScheduleRecord) -> Result<()> {
        self.db
            .execute(
                "INSERT INTO rustra_schedules \
                 (id, user_id, name, cron, timezone, spec, enabled, next_run_at, last_run_at, \
                  created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
                 ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, \
                 name = EXCLUDED.name, cron = EXCLUDED.cron, timezone = EXCLUDED.timezone, \
                 spec = EXCLUDED.spec, enabled = EXCLUDED.enabled, \
                 next_run_at = EXCLUDED.next_run_at, last_run_at = EXCLUDED.last_run_at, \
                 created_at = EXCLUDED.created_at",
                &[
                    &schedule.id,
                    &schedule.user_id,
                    &schedule.name,
                    &schedule.cron,
                    &schedule.timezone,
                    &schedule.spec,
                    &schedule.enabled,
                    &schedule.next_run_at,
                    &schedule.last_run_at,
                    &schedule.created_at,
                ],
            )
            .await?;
        Ok(())
    }

    async fn get_schedule(&self, schedule_id: &str) -> Result<Option<ScheduleRecord>> {
        self.db
            .query_opt_as::<ScheduleRecord>(
                &format!("{SELECT_SCHEDULE} WHERE id = $1"),
                &[&schedule_id],
            )
            .await
    }

    async fn delete_schedule(&self, schedule_id: &str) -> Result<()> {
        self.db
            .execute(
                "DELETE FROM rustra_schedules WHERE id = $1",
                &[&schedule_id],
            )
            .await?;
        Ok(())
    }

    async fn list_schedules(
        &self,
        user_id: Option<&str>,
        page: Page,
    ) -> Result<Vec<ScheduleRecord>> {
        let (limit, offset) = page_params(page);
        self.db
            .query_as::<ScheduleRecord>(
                &format!(
                    "{SELECT_SCHEDULE} WHERE ($1::TEXT IS NULL OR user_id = $1) \
                     ORDER BY created_at DESC LIMIT $2 OFFSET $3"
                ),
                &[&user_id, &limit, &offset],
            )
            .await
    }

    async fn due_schedules(&self, now: DateTime<Utc>) -> Result<Vec<ScheduleRecord>> {
        self.db
            .query_as::<ScheduleRecord>(
                &format!(
                    "{SELECT_SCHEDULE} WHERE enabled AND next_run_at IS NOT NULL \
                     AND next_run_at <= $1 ORDER BY next_run_at ASC"
                ),
                &[&now],
            )
            .await
    }

    async fn upsert_subscription(&self, sub: SubscriptionRecord) -> Result<()> {
        self.db
            .execute(
                "INSERT INTO rustra_subscriptions \
                 (id, user_id, event_name, spec, enabled, created_at) \
                 VALUES ($1, $2, $3, $4, $5, $6) \
                 ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, \
                 event_name = EXCLUDED.event_name, spec = EXCLUDED.spec, \
                 enabled = EXCLUDED.enabled, created_at = EXCLUDED.created_at",
                &[
                    &sub.id,
                    &sub.user_id,
                    &sub.event_name,
                    &sub.spec,
                    &sub.enabled,
                    &sub.created_at,
                ],
            )
            .await?;
        Ok(())
    }

    async fn delete_subscription(&self, sub_id: &str) -> Result<()> {
        self.db
            .execute("DELETE FROM rustra_subscriptions WHERE id = $1", &[&sub_id])
            .await?;
        Ok(())
    }

    async fn list_subscriptions(
        &self,
        user_id: Option<&str>,
        page: Page,
    ) -> Result<Vec<SubscriptionRecord>> {
        let (limit, offset) = page_params(page);
        self.db
            .query_as::<SubscriptionRecord>(
                &format!(
                    "{SELECT_SUBSCRIPTION} WHERE ($1::TEXT IS NULL OR user_id = $1) \
                     ORDER BY created_at DESC LIMIT $2 OFFSET $3"
                ),
                &[&user_id, &limit, &offset],
            )
            .await
    }

    async fn insert_decision(&self, decision: DecisionRecord) -> Result<()> {
        self.upsert_decision_row(&decision).await
    }

    async fn update_decision(&self, decision: DecisionRecord) -> Result<()> {
        self.upsert_decision_row(&decision).await
    }

    async fn get_decision(&self, decision_id: &str) -> Result<Option<DecisionRecord>> {
        self.db
            .query_opt_as::<DecisionRecord>(
                &format!("{SELECT_DECISION} WHERE id = $1"),
                &[&decision_id],
            )
            .await
    }

    async fn list_decisions(
        &self,
        user_id: &str,
        pending_only: bool,
        page: Page,
    ) -> Result<Vec<DecisionRecord>> {
        let (limit, offset) = page_params(page);
        self.db
            .query_as::<DecisionRecord>(
                &format!(
                    "{SELECT_DECISION} WHERE user_id = $1 \
                     AND (NOT $2 OR status = 'pending') \
                     ORDER BY created_at DESC LIMIT $3 OFFSET $4"
                ),
                &[&user_id, &pending_only, &limit, &offset],
            )
            .await
    }
}
