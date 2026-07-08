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
///
/// Numeric day-of-week values use crontab semantics: `0` and `7` are Sunday,
/// `1` is Monday. The `cron` crate numbers Sunday as `1`, so the field is
/// translated before parsing; day names (`MON`, `SUN-TUE`) are unambiguous
/// and pass through untouched. Known divergence from Vixie cron: when both
/// day-of-month and day-of-week are restricted the crate fires on their
/// intersection, not their union (tracked in ROADMAP 3c).
fn parse_cron(expr: &str) -> Result<cron::Schedule> {
    let mut fields: Vec<String> = expr.split_whitespace().map(str::to_string).collect();
    match fields.len() {
        5 => fields.insert(0, "0".to_string()),
        6 | 7 => {}
        _ => {
            return Err(Error::Validation(format!(
                "cron expression `{expr}` must have 5-7 fields"
            )))
        }
    }
    // After normalization the layout is: sec min hour dom month dow [year].
    fields[5] = translate_dow_field(&fields[5])
        .map_err(|e| Error::Validation(format!("invalid cron `{expr}`: {e}")))?;
    let normalized = fields.join(" ");
    cron::Schedule::from_str(&normalized)
        .map_err(|e| Error::Validation(format!("invalid cron `{expr}`: {e}")))
}

/// Rewrites numeric day-of-week tokens from crontab numbering (0/7 = Sunday)
/// to the `cron` crate's numbering (1 = Sunday). Name tokens and wildcards
/// pass through; numeric ranges are expanded (with their step applied in
/// crontab space) so wrapping ranges like `5-7` stay correct.
fn translate_dow_field(field: &str) -> std::result::Result<String, String> {
    let to_crate = |n: u8| (n % 7) + 1;
    let parse_day = |s: &str| -> std::result::Result<u8, String> {
        let n: u8 = s
            .parse()
            .map_err(|_| format!("day-of-week `{s}` is not a number"))?;
        if n > 7 {
            return Err(format!("day-of-week `{n}` out of range 0-7"));
        }
        Ok(n)
    };
    let tokens: std::result::Result<Vec<String>, String> = field
        .split(',')
        .map(|token| {
            // Names, wildcards, and `?` are handled natively by the crate;
            // `*/step` is numbering-agnostic (the mapping is a rotation).
            if token
                .chars()
                .any(|c| c.is_ascii_alphabetic() || c == '*' || c == '?')
            {
                return Ok(token.to_string());
            }
            let (range, step) = match token.split_once('/') {
                Some((r, s)) => {
                    let step: usize = s
                        .parse()
                        .map_err(|_| format!("step `{s}` is not a number"))?;
                    if step == 0 {
                        return Err("step must be non-zero".to_string());
                    }
                    (r, step)
                }
                None => (token, 1),
            };
            match range.split_once('-') {
                Some((a, b)) => {
                    let (a, b) = (parse_day(a)?, parse_day(b)?);
                    if a > b {
                        return Err(format!("day-of-week range `{range}` is inverted"));
                    }
                    let days: Vec<String> = (a..=b)
                        .step_by(step)
                        .map(|d| to_crate(d).to_string())
                        .collect();
                    Ok(days.join(","))
                }
                None => {
                    let a = parse_day(range)?;
                    if step == 1 {
                        return Ok(to_crate(a).to_string());
                    }
                    // Vixie `n/step`: from n to the field max, stepping.
                    let days: Vec<String> = (a..=7)
                        .step_by(step)
                        .map(|d| to_crate(d).to_string())
                        .collect();
                    Ok(days.join(","))
                }
            }
        })
        .collect();
    Ok(tokens?.join(","))
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
        Self::with_tick(storage, tasks, Duration::from_secs(5))
    }

    /// Like [`Scheduler::new`] with a custom tick interval (tests, facade
    /// builder).
    pub fn with_tick(storage: SharedStorage, tasks: Arc<TaskManager>, tick: Duration) -> Arc<Self> {
        Arc::new(Self {
            storage,
            tasks,
            tick,
        })
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

    /// Fetch a schedule, enforcing user scope.
    pub async fn get(&self, principal: &Principal, id: &str) -> Result<ScheduleRecord> {
        let record = self
            .storage
            .get_schedule(id)
            .await?
            .ok_or_else(|| Error::not_found("schedule", id))?;
        crate::ensure_owner(principal, &record.user_id, "schedule", id)?;
        Ok(record)
    }

    /// List the principal's schedules.
    pub async fn list(&self, principal: &Principal, page: Page) -> Result<Vec<ScheduleRecord>> {
        self.storage
            .list_schedules(Some(&principal.user_id), page)
            .await
    }

    /// Delete a schedule, enforcing user scope.
    pub async fn delete(&self, principal: &Principal, id: &str) -> Result<()> {
        self.get(principal, id).await?; // scope check
        self.storage.delete_schedule(id).await
    }

    /// Disable a schedule; it stays stored but stops firing.
    pub async fn pause(&self, principal: &Principal, id: &str) -> Result<()> {
        self.set_enabled(principal, id, false).await
    }

    /// Re-enable a paused schedule and recompute its next fire time.
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
            record.next_run_at = match parse_cron(&record.cron) {
                Ok(schedule) => next_fire(&schedule, now),
                Err(e) => {
                    tracing::error!(
                        schedule = %record.id,
                        cron = %record.cron,
                        error = %e,
                        "stored cron expression no longer parses; schedule will not fire again"
                    );
                    None
                }
            };
            let schedule_id = record.id.clone();
            if let Err(e) = self.storage.upsert_schedule(record).await {
                tracing::error!(schedule = %schedule_id, error = %e, "failed to persist schedule");
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

    /// Numeric day-of-week must follow crontab semantics (0/7 = Sunday,
    /// 1 = Monday), not the `cron` crate's Sunday=1 numbering. Regression
    /// tests for the silent wrong-day fires found in the reliability audit.
    #[test]
    fn numeric_dow_uses_crontab_semantics() {
        use chrono::{Datelike, TimeZone, Weekday};
        // Wed 2026-07-08 00:00 UTC as the reference point.
        let after = Utc.with_ymd_and_hms(2026, 7, 8, 0, 0, 0).unwrap();
        let next = |expr: &str| next_fire(&parse_cron(expr).unwrap(), after).unwrap();

        // `1` is Monday everywhere else on earth.
        let monday = next("0 9 * * 1");
        assert_eq!(monday.weekday(), Weekday::Mon);
        assert_eq!(monday, Utc.with_ymd_and_hms(2026, 7, 13, 9, 0, 0).unwrap());
        // Names must agree with numbers.
        assert_eq!(next("0 9 * * MON"), monday);
        // Both Sunday spellings are accepted (`0` was previously rejected).
        assert_eq!(next("0 9 * * 0").weekday(), Weekday::Sun);
        assert_eq!(next("0 9 * * 7").weekday(), Weekday::Sun);
        // Ranges translate: Mon-Fri includes Wednesday 09:00 same-day.
        assert_eq!(next("0 9 * * 1-5").weekday(), Weekday::Wed);
        // Ranges reaching Sunday-as-7 stay correct (Fri,Sat,Sun).
        assert_eq!(next("0 9 * * 5-7").weekday(), Weekday::Fri);
        // Steps: every second day from Sunday = {Sun,Tue,Thu,Sat} -> Thu.
        assert_eq!(next("0 9 * * 0/2").weekday(), Weekday::Thu);
        // Lists translate member-wise: {Wed,Sat} fires Wednesday same-day
        // (untranslated crate numbering would read 3,6 as Tue,Fri).
        assert_eq!(next("0 9 * * 3,6").weekday(), Weekday::Wed);

        assert!(parse_cron("0 9 * * 8").is_err());
        assert!(parse_cron("0 9 * * 5-1").is_err());
    }

    #[tokio::test]
    async fn five_field_cron_is_accepted_and_next_run_computed() {
        let (_, scheduler, _) = setup();
        let record = scheduler
            .create(
                &Principal::user("alice"),
                "daily",
                "0 9 * * *",
                None,
                json!({}),
            )
            .await
            .unwrap();
        assert!(record.next_run_at.is_some());
        assert!(record.enabled);

        let err = scheduler
            .create(
                &Principal::user("alice"),
                "bad",
                "not a cron",
                None,
                json!({}),
            )
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
        let mut record = scheduler
            .create(&alice, "paused", "* * * * *", None, json!({}))
            .await
            .unwrap();
        scheduler.pause(&alice, &record.id).await.unwrap();
        record = storage.get_schedule(&record.id).await.unwrap().unwrap();
        assert!(!record.enabled);

        // Even if due, disabled schedules are filtered by due_schedules.
        let fired = scheduler.tick_once().await.unwrap();
        assert_eq!(fired, 0);
        assert!(tasks
            .list(&alice, None, Page::default())
            .await
            .unwrap()
            .is_empty());
    }

    #[tokio::test]
    async fn schedules_are_user_scoped() {
        let (_, scheduler, _) = setup();
        let record = scheduler
            .create(
                &Principal::user("alice"),
                "mine",
                "0 * * * *",
                None,
                json!({}),
            )
            .await
            .unwrap();
        let err = scheduler
            .delete(&Principal::user("mallory"), &record.id)
            .await
            .unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));
    }
}
