//! Human-in-the-loop interrupts.
//!
//! A pending [`DecisionRecord`] is the unit of HITL: a run pauses on it, a
//! human resolves it, execution continues. Workflow suspensions create
//! decisions automatically (see `rustra-workflow`); agent runs get HITL via
//! [`HitlToolApprover`], which parks selected tool calls on a decision and
//! awaits the human verdict.

use async_trait::async_trait;
use chrono::Utc;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::Notify;

use rustra_agent::{ApprovalDecision, ToolApprover};
use rustra_core::{new_id, Error, Principal, Result, RuntimeContext};
use rustra_storage::types::DecisionRecord;
use rustra_storage::{Page, SharedStorage};

/// Decision statuses.
pub mod decision_status {
    pub const PENDING: &str = "pending";
    pub const APPROVED: &str = "approved";
    pub const REJECTED: &str = "rejected";
    pub const ANSWERED: &str = "answered";
    pub const CANCELLED: &str = "cancelled";
}

/// Creates, lists, resolves, and awaits pending decisions.
pub struct InterruptController {
    storage: SharedStorage,
    /// In-process wakeups so waiters resolve immediately; storage remains
    /// the source of truth (waiters also poll, so cross-process resolution
    /// still works — see TECH_DEBT.md for the polling interval). Never held
    /// across an await, so a plain mutex suffices.
    notifiers: Mutex<HashMap<String, Arc<Notify>>>,
}

/// Removes a waiter's notifier entry when its wait ends for any reason —
/// resolution, timeout, error, or the future being dropped — unless other
/// waiters still share the entry.
struct WaiterGuard<'a> {
    notifiers: &'a Mutex<HashMap<String, Arc<Notify>>>,
    id: String,
    notify: Arc<Notify>,
}

impl Drop for WaiterGuard<'_> {
    fn drop(&mut self) {
        let mut map = self.notifiers.lock().unwrap();
        // strong_count == 2 means the map's clone plus this guard's clone:
        // no other concurrent waiter, so the entry can go. ptr_eq protects
        // against a re-inserted entry under the same id.
        if map
            .get(&self.id)
            .is_some_and(|n| Arc::ptr_eq(n, &self.notify) && Arc::strong_count(n) == 2)
        {
            map.remove(&self.id);
        }
    }
}

impl InterruptController {
    pub fn new(storage: SharedStorage) -> Arc<Self> {
        Arc::new(Self {
            storage,
            notifiers: Mutex::new(HashMap::new()),
        })
    }

    /// Create a pending decision (`kind`: `approval` | `input`).
    pub async fn request(
        &self,
        principal: &Principal,
        run_id: &str,
        kind: &str,
        prompt: impl Into<String>,
        payload: Value,
    ) -> Result<DecisionRecord> {
        let record = DecisionRecord {
            id: new_id("dec"),
            user_id: principal.user_id.clone(),
            run_id: run_id.to_string(),
            kind: kind.to_string(),
            prompt: prompt.into(),
            payload,
            status: decision_status::PENDING.to_string(),
            resolution: Value::Null,
            created_at: Utc::now(),
            resolved_at: None,
        };
        self.storage.insert_decision(record.clone()).await?;
        Ok(record)
    }

    /// Pending decisions awaiting this user.
    pub async fn pending(&self, principal: &Principal) -> Result<Vec<DecisionRecord>> {
        self.storage
            .list_decisions(&principal.user_id, true, Page::default())
            .await
    }

    /// Resolve a decision. `status` is one of the non-pending
    /// [`decision_status`] values; `resolution` carries the verdict/answer.
    pub async fn resolve(
        &self,
        principal: &Principal,
        decision_id: &str,
        status: &str,
        resolution: Value,
    ) -> Result<DecisionRecord> {
        let mut record = self
            .storage
            .get_decision(decision_id)
            .await?
            .ok_or_else(|| Error::not_found("decision", decision_id))?;
        crate::ensure_owner(principal, &record.user_id, "decision", decision_id)?;
        if record.status != decision_status::PENDING {
            return Err(Error::Validation(format!(
                "decision `{decision_id}` is already `{}`",
                record.status
            )));
        }
        record.status = status.to_string();
        record.resolution = resolution;
        record.resolved_at = Some(Utc::now());
        self.storage.update_decision(record.clone()).await?;

        let notify = self.notifiers.lock().unwrap().remove(decision_id);
        if let Some(notify) = notify {
            notify.notify_waiters();
        }
        Ok(record)
    }

    /// Await a decision's resolution (in-process wakeup + storage polling as
    /// the cross-process fallback). Times out with `Error::Timeout`.
    pub async fn wait(&self, decision_id: &str, timeout: Duration) -> Result<DecisionRecord> {
        let guard = {
            let mut notifiers = self.notifiers.lock().unwrap();
            let notify = Arc::clone(notifiers.entry(decision_id.to_string()).or_default());
            WaiterGuard {
                notifiers: &self.notifiers,
                id: decision_id.to_string(),
                notify,
            }
        };
        let deadline = tokio::time::Instant::now() + timeout;
        loop {
            let record = self
                .storage
                .get_decision(decision_id)
                .await?
                .ok_or_else(|| Error::not_found("decision", decision_id))?;
            if record.status != decision_status::PENDING {
                return Ok(record);
            }
            let poll = tokio::time::sleep(Duration::from_millis(500));
            tokio::select! {
                _ = guard.notify.notified() => {}
                _ = poll => {}
                _ = tokio::time::sleep_until(deadline) => {
                    return Err(Error::Timeout(format!(
                        "decision `{decision_id}` not resolved within {timeout:?}"
                    )));
                }
            }
        }
    }
}

/// A [`ToolApprover`] that pauses configured tools on a pending decision and
/// waits for the human (Mastra's `requireToolApproval`).
pub struct HitlToolApprover {
    controller: Arc<InterruptController>,
    /// Tool ids requiring approval. Empty set = approve everything.
    tools_requiring_approval: HashSet<String>,
    /// How long to wait for the human before failing the tool call.
    pub timeout: Duration,
}

impl HitlToolApprover {
    pub fn new(
        controller: Arc<InterruptController>,
        tools_requiring_approval: impl IntoIterator<Item = String>,
    ) -> Self {
        Self {
            controller,
            tools_requiring_approval: tools_requiring_approval.into_iter().collect(),
            timeout: Duration::from_secs(600),
        }
    }

    /// Set how long to wait for the human before failing the tool call.
    #[must_use]
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }
}

#[async_trait]
impl ToolApprover for HitlToolApprover {
    async fn review(
        &self,
        tool_name: &str,
        input: &Value,
        runtime: &RuntimeContext,
    ) -> Result<ApprovalDecision> {
        if !self.tools_requiring_approval.contains(tool_name) {
            return Ok(ApprovalDecision::Approved);
        }
        let run_id = runtime
            .get_str(RuntimeContext::RUN_ID)
            .unwrap_or_else(|| "unknown".to_string());
        let decision = self
            .controller
            .request(
                runtime.principal(),
                &run_id,
                "approval",
                format!("Allow the agent to call `{tool_name}`?"),
                serde_json::json!({ "tool": tool_name, "input": input }),
            )
            .await?;
        let resolved = self.controller.wait(&decision.id, self.timeout).await?;
        if resolved.status == decision_status::APPROVED {
            Ok(ApprovalDecision::Approved)
        } else {
            Ok(ApprovalDecision::Denied {
                reason: resolved.resolution["reason"]
                    .as_str()
                    .unwrap_or("rejected by user")
                    .to_string(),
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_storage::InMemoryStorage;
    use serde_json::json;

    fn controller() -> Arc<InterruptController> {
        InterruptController::new(Arc::new(InMemoryStorage::new()))
    }

    #[tokio::test]
    async fn request_resolve_wait_roundtrip() {
        let ctl = controller();
        let alice = Principal::user("alice");
        let decision = ctl
            .request(&alice, "run_1", "approval", "Deploy?", json!({}))
            .await
            .unwrap();
        assert_eq!(ctl.pending(&alice).await.unwrap().len(), 1);

        let ctl2 = Arc::clone(&ctl);
        let id = decision.id.clone();
        let waiter = tokio::spawn(async move { ctl2.wait(&id, Duration::from_secs(5)).await });
        tokio::time::sleep(Duration::from_millis(20)).await;

        ctl.resolve(
            &alice,
            &decision.id,
            decision_status::APPROVED,
            json!({"ok": true}),
        )
        .await
        .unwrap();
        let resolved = waiter.await.unwrap().unwrap();
        assert_eq!(resolved.status, "approved");
        assert!(ctl.pending(&alice).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn resolution_is_user_scoped_and_single_shot() {
        let ctl = controller();
        let alice = Principal::user("alice");
        let decision = ctl
            .request(&alice, "r", "approval", "ok?", json!({}))
            .await
            .unwrap();

        let err = ctl
            .resolve(
                &Principal::user("mallory"),
                &decision.id,
                "approved",
                json!({}),
            )
            .await
            .unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));

        ctl.resolve(&alice, &decision.id, "rejected", json!({}))
            .await
            .unwrap();
        let err = ctl
            .resolve(&alice, &decision.id, "approved", json!({}))
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn hitl_approver_gates_configured_tools() {
        let ctl = controller();
        let approver = HitlToolApprover::new(Arc::clone(&ctl), vec!["dangerous_tool".to_string()]);
        let runtime = RuntimeContext::new(Principal::user("alice"));

        // Unlisted tools pass straight through.
        let decision = approver
            .review("safe_tool", &json!({}), &runtime)
            .await
            .unwrap();
        assert!(matches!(decision, ApprovalDecision::Approved));

        // Listed tools park on a decision; resolve it concurrently.
        let ctl2 = Arc::clone(&ctl);
        tokio::spawn(async move {
            let alice = Principal::user("alice");
            for _ in 0..50 {
                tokio::time::sleep(Duration::from_millis(10)).await;
                let pending = ctl2.pending(&alice).await.unwrap();
                if let Some(d) = pending.first() {
                    ctl2.resolve(&alice, &d.id, decision_status::APPROVED, json!({}))
                        .await
                        .unwrap();
                    return;
                }
            }
        });
        let decision = approver
            .review("dangerous_tool", &json!({"x": 1}), &runtime)
            .await
            .unwrap();
        assert!(matches!(decision, ApprovalDecision::Approved));
    }
}
