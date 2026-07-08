//! Cron schedules — the analogue of Mastra's `mastra.schedules` API
//! (create/read/update/delete + pause/resume/run-now), firing tasks through
//! the [`TaskManager`].

use chrono::{DateTime, Utc};
use serde_json::Value;
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

use rustra_core::{new_id, Error, Principal, Result};
use rustra_storage::types::ScheduleRecord;
use rustra_storage::{Page, SharedStorage};

use crate::manager::{TaskManager, TaskOptions};
use crate::trigger;

/// Parses a cron expression, accepting standard 5-field crontab syntax
/// (minute hour dom month dow) as well as the 6/7-field variants the `cron`
/// crate uses (with seconds / year).
fn parse_cron(expr: &str) -> Result<cron::Schedule> {
    let fields = expr.split_whitespace().count();
    let normalized = match fields {
        5 => format!("0 {expr}"),
        6 | 7 => expr.to_string(),
        _ => {
            return Err(Error::Validation(format!(
                "cron expression `{expr}` must have 5-7 fields"
            )))
        }
    };
    cron::Schedule::from_str(&normalized)
        .map_err(|e| Error::Validation(format!("invalid cron `{expr}`: {e}")))
}

fn next_fire(schedule: &cron::Schedule, after: DateTime<Utc>) -> Option<DateTime<Utc>> {
    schedule.after(&after).next()
}

/// Creates, manages, and drives schedules. Run [`Scheduler::start`] once per
/// deployment to launch the tick loop.
pub struct Scheduler {
    storage: SharedStorage,
    tasks: Arc<TaskManager>,
    tick: Duration,
}

impl Scheduler {
    pub fn new(storage: SharedStorage, tasks: Arc<TaskManager>) -> Arc<Self> {
        Arc::new(Self { storage, tasks, tick: Duration::from_secs(5) })
    }

    pub fn with_tick(storage: SharedStorage, tasks: Arc<TaskManager>, tick: Duration) -> Arc<Self> {
        Arc::new(Self { storage, tasks, tick })
    }

    /// Create a schedule. `cron` is standard 5-field crontab (or 6/7-field
    /// with seconds/year). `spec` is the task spec fired on each tick.
    ///
    /// TECH DEBT: `timezone` is stored but evaluation is UTC-only for now.
    pub async fn create(
        &self,
        principal: &Principal,
        name: impl Into<String>,
        cron_expr: &str,
        timezone: Option<String>,
        spec: Value,
    ) -> Result<ScheduleRecord> {
        let schedule = parse_cron(cron_expr)?;
        let record = ScheduleRecord {
            id: new_id("sch"),
            user_id: principal.user_id.clone(),
            name: name.into(),
            cron: cron_expr.to_string(),
            timezone,
            spec,
            enabled: true,
            next_run_at: next_fire(&schedule, Utc::now()),
            last_run_at: None,
            created_at: Utc::now(),
        };
        self.storage.upsert_schedule(record.clone()).await?;
        Ok(record)
    }

    pub async fn get(&self, principal: &Principal, id: &str) -> Result<ScheduleRecord> {
        let record = self
            .storage
            .get_schedule(id)
            .await?
            .ok_or_else(|| Error::not_found("schedule", id))?;
        if record.user_id != principal.user_id && !principal.is_admin() {
            return Err(Error::PermissionDenied(format!("schedule `{id}` belongs to another user")));
        }
        Ok(record)
    }

    pub async fn list(&self, principal: &Principal, page: Page) -> Result<Vec<ScheduleRecord>> {
        self.storage.list_schedules(Some(&principal.user_id), page).await
    }

    pub async fn delete(&self, principal: &Principal, id: &str) -> Result<()> {
        self.get(principal, id).await?; // scope check
        self.storage.delete_schedule(id).await
    }

    pub async fn pause(&self, principal: &Principal, id: &str) -> Result<()> {
        self.set_enabled(principal, id, false).await
    }

    pub async fn resume(&self, principal: &Principal, id: &str) -> Result<()> {
        self.set_enabled(principal, id, true).await
    }

    async fn set_enabled(&self, principal: &Principal, id: &str, enabled: bool) -> Result<()> {
        let mut record = self.get(principal, id).await?;
        record.enabled = enabled;
        if enabled {
            record.next_run_at = next_fire(&parse_cron(&record.cron)?, Utc::now());
        }
        self.storage.upsert_schedule(record).await
    }

    /// Fire a schedule immediately, outside its cadence (Mastra `run()`).
    pub async fn run_now(&self, principal: &Principal, id: &str) -> Result<()> {
        let record = self.get(principal, id).await?;
        self.fire(&record).await
    }

    /// One scheduler pass: fire everything due and compute next fire times.
    /// Public so hosts (and tests) can drive ticks explicitly.
    pub async fn tick_once(&self) -> Result<usize> {
        let now = Utc::now();
        let due = self.storage.due_schedules(now).await?;
        let mut fired = 0usize;
        for mut record in due {
            if let Err(e) = self.fire(&record).await {
                tracing::warn!(schedule = %record.id, error = %e, "schedule fire failed");
            } else {
                fired += 1;
            }
            record.last_run_at = Some(now);
            record.next_run_at = parse_cron(&record.cron)
                .ok()
                .and_then(|s| next_fire(&s, now));
            if let Err(e) = self.storage.upsert_schedule(record.clone()).await {
                tracing::error!(schedule = %record.id, error = %e, "failed to persist schedule");
            }
        }
        Ok(fired)
    }

    async fn fire(&self, record: &ScheduleRecord) -> Result<()> {
        let principal = Principal::user(&record.user_id);
        self.tasks
            .submit(
                &principal,
                record.spec.clone(),
                TaskOptions {
                    trigger: trigger::SCHEDULE.to_string(),
                    schedule_id: Some(record.id.clone()),
                    ..Default::default()
                },
            )
            .await?;
        Ok(())
    }

    /// Launch the background tick loop; cancel the returned token to stop.
    pub fn start(self: &Arc<Self>) -> CancellationToken {
        let token = CancellationToken::new();
        let scheduler = Arc::clone(self);
        let loop_token = token.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(scheduler.tick);
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        if let Err(e) = scheduler.tick_once().await {
                            tracing::error!(error = %e, "scheduler tick failed");
                        }
                    }
                    _ = loop_token.cancelled() => return,
                }
            }
        });
        token
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manager::TaskExecutor;
    use async_trait::async_trait;
    use rustra_core::RuntimeContext;
    use rustra_storage::InMemoryStorage;
    use serde_json::json;

    struct Noop;
    #[async_trait]
    impl TaskExecutor for Noop {
        async fn execute(&self, _: &Value, _: RuntimeContext) -> Result<Value> {
            Ok(Value::Null)
        }
    }

    fn setup() -> (SharedStorage, Arc<Scheduler>, Arc<TaskManager>) {
        let storage: SharedStorage = Arc::new(InMemoryStorage::new());
        let tasks = TaskManager::new(storage.clone(), Arc::new(Noop));
        let scheduler = Scheduler::new(storage.clone(), Arc::clone(&tasks));
        (storage, scheduler, tasks)
    }

    #[tokio::test]
    async fn five_field_cron_is_accepted_and_next_run_computed() {
        let (_, scheduler, _) = setup();
        let record = scheduler
            .create(&Principal::user("alice"), "daily", "0 9 * * *", None, json!({}))
            .await
            .unwrap();
        assert!(record.next_run_at.is_some());
        assert!(record.enabled);

        let err = scheduler
            .create(&Principal::user("alice"), "bad", "not a cron", None, json!({}))
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn due_schedule_fires_task_and_advances() {
        let (storage, scheduler, tasks) = setup();
        let alice = Principal::user("alice");
        let mut record = scheduler
            .create(&alice, "often", "* * * * *", None, json!({"job": 1}))
            .await
            .unwrap();
        // Force it due now.
        record.next_run_at = Some(Utc::now() - chrono::Duration::seconds(1));
        storage.upsert_schedule(record.clone()).await.unwrap();

        let fired = scheduler.tick_once().await.unwrap();
        assert_eq!(fired, 1);

        // A schedule-triggered task exists for alice.
        let listed = tasks.list(&alice, None, Page::default()).await.unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].trigger, "schedule");
        assert_eq!(listed[0].schedule_id.as_deref(), Some(record.id.as_str()));

        // next_run_at advanced into the future.
        let updated = storage.get_schedule(&record.id).await.unwrap().unwrap();
        assert!(updated.next_run_at.unwrap() > Utc::now());
        assert!(updated.last_run_at.is_some());
    }

    #[tokio::test]
    async fn paused_schedules_do_not_fire() {
        let (storage, scheduler, tasks) = setup();
        let alice = Principal::user("alice");
        let mut record =
            scheduler.create(&alice, "paused", "* * * * *", None, json!({})).await.unwrap();
        scheduler.pause(&alice, &record.id).await.unwrap();
        record = storage.get_schedule(&record.id).await.unwrap().unwrap();
        assert!(!record.enabled);

        // Even if due, disabled schedules are filtered by due_schedules.
        let fired = scheduler.tick_once().await.unwrap();
        assert_eq!(fired, 0);
        assert!(tasks.list(&alice, None, Page::default()).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn schedules_are_user_scoped() {
        let (_, scheduler, _) = setup();
        let record = scheduler
            .create(&Principal::user("alice"), "mine", "0 * * * *", None, json!({}))
            .await
            .unwrap();
        let err = scheduler.delete(&Principal::user("mallory"), &record.id).await.unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));
    }
}
