//! Supervised task execution.

use async_trait::async_trait;
use chrono::Utc;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

use rustra_core::{new_id, Error, Principal, Result, RuntimeContext};
use rustra_storage::types::TaskRecord;
use rustra_storage::{Page, SharedStorage};

use crate::{task_status, trigger};

/// Executes a task spec. The facade implements this by dispatching
/// `{"target": "agent"|"workflow", "id": ..., "input": ...}` to its
/// registries; tests plug in fakes.
#[async_trait]
pub trait TaskExecutor: Send + Sync {
    async fn execute(&self, spec: &Value, runtime: RuntimeContext) -> Result<Value>;
}

/// Options for one submission.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TaskOptions {
    pub trigger: String,
    pub max_retries: u32,
    /// Base backoff between retries (exponential).
    pub backoff: Duration,
    /// Backlink for schedule-spawned tasks.
    pub schedule_id: Option<String>,
}

impl Default for TaskOptions {
    fn default() -> Self {
        Self {
            trigger: trigger::BACKGROUND.to_string(),
            max_retries: 0,
            backoff: Duration::from_millis(250),
            schedule_id: None,
        }
    }
}

struct RunningTask {
    cancel: CancellationToken,
    /// Fires when the supervisor exits (after the final persist), so any
    /// number of waiters can observe completion without consuming anything.
    done: CancellationToken,
}

/// Launches, supervises, cancels, and inspects tasks. Every state
/// transition is persisted, so status survives restarts (running tasks that
/// died with the process are visible as stale `running` records —
/// see TECH_DEBT.md for startup reconciliation).
pub struct TaskManager {
    storage: SharedStorage,
    executor: Arc<dyn TaskExecutor>,
    running: RwLock<HashMap<String, RunningTask>>,
}

impl TaskManager {
    pub fn new(storage: SharedStorage, executor: Arc<dyn TaskExecutor>) -> Arc<Self> {
        Arc::new(Self {
            storage,
            executor,
            running: RwLock::new(HashMap::new()),
        })
    }

    /// Submit a task and return immediately; it runs supervised in the
    /// background. Use [`TaskManager::wait`] to await completion.
    pub async fn submit(
        self: &Arc<Self>,
        principal: &Principal,
        spec: Value,
        options: TaskOptions,
    ) -> Result<TaskRecord> {
        let backoff_base = options.backoff;
        let record = TaskRecord {
            id: new_id("tsk"),
            user_id: principal.user_id.clone(),
            trigger: options.trigger,
            spec,
            status: task_status::PENDING.to_string(),
            attempts: 0,
            max_retries: options.max_retries,
            last_error: None,
            output: Value::Null,
            run_id: None,
            schedule_id: options.schedule_id,
            created_at: Utc::now(),
            started_at: None,
            ended_at: None,
        };
        self.storage.insert_task(record.clone()).await?;

        let cancel = CancellationToken::new();
        let done = CancellationToken::new();
        let manager = Arc::clone(self);
        let task_record = record.clone();
        let principal = principal.clone();
        let token = cancel.clone();
        self.running.write().await.insert(
            record.id.clone(),
            RunningTask {
                cancel,
                done: done.clone(),
            },
        );
        let id = record.id.clone();
        tokio::spawn(async move {
            // Fires `done` on every exit path — including a panicking
            // supervisor — strictly after the final persist on the normal
            // path.
            let _done_guard = done.drop_guard();
            manager
                .supervise(task_record, principal, backoff_base, token)
                .await;
            manager.running.write().await.remove(&id);
        });
        Ok(record)
    }

    /// Run a task inline (direct user requests): submits, waits, returns the
    /// final record.
    pub async fn run_now(
        self: &Arc<Self>,
        principal: &Principal,
        spec: Value,
        mut options: TaskOptions,
    ) -> Result<TaskRecord> {
        options.trigger = trigger::DIRECT.to_string();
        let record = self.submit(principal, spec, options).await?;
        self.wait(&record.id).await
    }

    /// Await a task's completion and return its final record.
    pub async fn wait(&self, task_id: &str) -> Result<TaskRecord> {
        let done = self
            .running
            .read()
            .await
            .get(task_id)
            .map(|rt| rt.done.clone());
        if let Some(done) = done {
            done.cancelled().await;
            // Idempotent belt-and-braces: the supervisor removes its own
            // entry after the final persist; this also reaps entries a
            // panicked supervisor left behind.
            self.running.write().await.remove(task_id);
        }
        self.storage
            .get_task(task_id)
            .await?
            .ok_or_else(|| Error::not_found("task", task_id))
    }

    /// Request cancellation. Running work observes the token at its next
    /// await point; the record is marked `cancelled` by the supervisor.
    pub async fn cancel(&self, principal: &Principal, task_id: &str) -> Result<()> {
        let record = self.get(principal, task_id).await?;
        if record.status != task_status::PENDING && record.status != task_status::RUNNING {
            return Ok(()); // already terminal
        }
        if let Some(running) = self.running.read().await.get(task_id) {
            running.cancel.cancel();
        }
        Ok(())
    }

    /// Fetch a task, enforcing user scope.
    pub async fn get(&self, principal: &Principal, task_id: &str) -> Result<TaskRecord> {
        let record = self
            .storage
            .get_task(task_id)
            .await?
            .ok_or_else(|| Error::not_found("task", task_id))?;
        crate::ensure_owner(principal, &record.user_id, "task", task_id)?;
        Ok(record)
    }

    /// List the principal's tasks, optionally filtered by status.
    pub async fn list(
        &self,
        principal: &Principal,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<TaskRecord>> {
        self.storage
            .list_tasks(&principal.user_id, status, page)
            .await
    }

    /// The supervision loop for one task: retries with exponential backoff
    /// on retryable errors, observes cancellation, persists every
    /// transition.
    async fn supervise(
        &self,
        mut record: TaskRecord,
        principal: Principal,
        backoff_base: Duration,
        cancel: CancellationToken,
    ) {
        record.status = task_status::RUNNING.to_string();
        record.started_at = Some(Utc::now());
        self.persist(&record).await;

        loop {
            record.attempts += 1;
            let runtime = RuntimeContext::new(principal.clone());
            let outcome = tokio::select! {
                result = self.executor.execute(&record.spec, runtime) => Some(result),
                _ = cancel.cancelled() => None,
            };

            match outcome {
                None => {
                    self.finish(&mut record, task_status::CANCELLED).await;
                    tracing::info!(task = %record.id, "task cancelled");
                    return;
                }
                Some(Ok(output)) => {
                    record.output = output;
                    self.finish(&mut record, task_status::COMPLETED).await;
                    return;
                }
                Some(Err(e)) => {
                    record.last_error = Some(e.to_string());
                    let attempts_left = record.attempts <= record.max_retries;
                    if attempts_left && e.is_retryable() {
                        let backoff =
                            backoff_base.saturating_mul(2u32.saturating_pow(record.attempts - 1));
                        tracing::warn!(
                            task = %record.id,
                            error = %e,
                            attempt = record.attempts,
                            "task attempt failed; retrying"
                        );
                        self.persist(&record).await;
                        tokio::select! {
                            _ = tokio::time::sleep(backoff) => {}
                            _ = cancel.cancelled() => {
                                self.finish(&mut record, task_status::CANCELLED).await;
                                return;
                            }
                        }
                    } else {
                        self.finish(&mut record, task_status::FAILED).await;
                        tracing::warn!(task = %record.id, error = %e, "task failed");
                        return;
                    }
                }
            }
        }
    }

    /// Terminal transition: final status, `ended_at`, and the persist always
    /// travel together.
    async fn finish(&self, record: &mut TaskRecord, status: &str) {
        record.status = status.to_string();
        record.ended_at = Some(Utc::now());
        self.persist(record).await;
    }

    async fn persist(&self, record: &TaskRecord) {
        if let Err(e) = self.storage.update_task(record.clone()).await {
            tracing::error!(task = %record.id, error = %e, "failed to persist task state");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_storage::InMemoryStorage;
    use serde_json::json;
    use std::sync::atomic::{AtomicU32, Ordering};

    struct EchoExecutor;
    #[async_trait]
    impl TaskExecutor for EchoExecutor {
        async fn execute(&self, spec: &Value, _runtime: RuntimeContext) -> Result<Value> {
            Ok(json!({ "echo": spec }))
        }
    }

    fn alice() -> Principal {
        Principal::user("alice")
    }

    #[tokio::test]
    async fn task_completes_and_persists_output() {
        let manager = TaskManager::new(Arc::new(InMemoryStorage::new()), Arc::new(EchoExecutor));
        let record = manager
            .run_now(&alice(), json!({"target": "agent"}), TaskOptions::default())
            .await
            .unwrap();
        assert_eq!(record.status, "completed");
        assert_eq!(record.output["echo"]["target"], "agent");
        assert_eq!(record.attempts, 1);
    }

    #[tokio::test]
    async fn retries_transient_failures() {
        struct Flaky(AtomicU32);
        #[async_trait]
        impl TaskExecutor for Flaky {
            async fn execute(&self, _: &Value, _: RuntimeContext) -> Result<Value> {
                if self.0.fetch_add(1, Ordering::SeqCst) < 2 {
                    Err(Error::Unavailable("transient".into()))
                } else {
                    Ok(json!("finally"))
                }
            }
        }
        let manager = TaskManager::new(
            Arc::new(InMemoryStorage::new()),
            Arc::new(Flaky(AtomicU32::new(0))),
        );
        let record = manager
            .run_now(
                &alice(),
                json!({}),
                TaskOptions {
                    max_retries: 3,
                    backoff: Duration::from_millis(1),
                    ..Default::default()
                },
            )
            .await
            .unwrap();
        assert_eq!(record.status, "completed");
        assert_eq!(record.attempts, 3);
        assert!(record.last_error.unwrap().contains("transient"));
    }

    #[tokio::test]
    async fn non_retryable_failure_fails_fast() {
        struct AlwaysBad;
        #[async_trait]
        impl TaskExecutor for AlwaysBad {
            async fn execute(&self, _: &Value, _: RuntimeContext) -> Result<Value> {
                Err(Error::Validation("bad spec".into()))
            }
        }
        let manager = TaskManager::new(Arc::new(InMemoryStorage::new()), Arc::new(AlwaysBad));
        let record = manager
            .run_now(
                &alice(),
                json!({}),
                TaskOptions {
                    max_retries: 5,
                    ..Default::default()
                },
            )
            .await
            .unwrap();
        assert_eq!(record.status, "failed");
        assert_eq!(record.attempts, 1, "validation errors must not retry");
    }

    #[tokio::test]
    async fn cancellation_stops_running_task() {
        struct Slow;
        #[async_trait]
        impl TaskExecutor for Slow {
            async fn execute(&self, _: &Value, _: RuntimeContext) -> Result<Value> {
                tokio::time::sleep(Duration::from_secs(60)).await;
                Ok(Value::Null)
            }
        }
        let manager = TaskManager::new(Arc::new(InMemoryStorage::new()), Arc::new(Slow));
        let record = manager
            .submit(&alice(), json!({}), TaskOptions::default())
            .await
            .unwrap();
        tokio::time::sleep(Duration::from_millis(20)).await; // let it start
        manager.cancel(&alice(), &record.id).await.unwrap();
        let finished = manager.wait(&record.id).await.unwrap();
        assert_eq!(finished.status, "cancelled");
    }

    #[tokio::test]
    async fn tasks_are_user_scoped() {
        let manager = TaskManager::new(Arc::new(InMemoryStorage::new()), Arc::new(EchoExecutor));
        let record = manager
            .run_now(&alice(), json!({}), TaskOptions::default())
            .await
            .unwrap();
        let err = manager
            .get(&Principal::user("mallory"), &record.id)
            .await
            .unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));
    }
}
