//! The signal bus: named events in, tasks out.
//!
//! Signals, webhooks, browser/extension events, and internal lifecycle
//! notifications all arrive as [`Event`]s. Persisted subscriptions match on
//! event name (exact, or prefix wildcard `foo.*`) and launch their task spec
//! with the event attached. Live listeners (SSE, in-process supervisors) can
//! also subscribe to the broadcast feed.

use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::broadcast;

use rustra_core::{new_id, Error, Event, Principal, Result};
use rustra_storage::types::{SubscriptionRecord, TaskRecord};
use rustra_storage::{Page, SharedStorage};

use crate::manager::{TaskManager, TaskOptions};
use crate::trigger;

/// Does a subscription pattern match an event name? Exact match, or a
/// `prefix.*` wildcard that matches any suffix.
fn pattern_matches(pattern: &str, event_name: &str) -> bool {
    match pattern.strip_suffix(".*") {
        Some(prefix) => {
            event_name.starts_with(prefix)
                && event_name[prefix.len()..].starts_with('.')
        }
        None => pattern == "*" || pattern == event_name,
    }
}

/// See module docs.
pub struct SignalBus {
    storage: SharedStorage,
    tasks: Arc<TaskManager>,
    feed: broadcast::Sender<Event>,
}

impl SignalBus {
    pub fn new(storage: SharedStorage, tasks: Arc<TaskManager>) -> Arc<Self> {
        let (feed, _) = broadcast::channel(1024);
        Arc::new(Self { storage, tasks, feed })
    }

    /// Persist a subscription: when an event matching `pattern` fires within
    /// this user's scope, launch `spec` as a task.
    pub async fn subscribe(
        &self,
        principal: &Principal,
        pattern: impl Into<String>,
        spec: Value,
    ) -> Result<SubscriptionRecord> {
        let pattern = pattern.into();
        if pattern.trim().is_empty() {
            return Err(Error::Validation("subscription pattern must not be empty".into()));
        }
        let record = SubscriptionRecord {
            id: new_id("sub"),
            user_id: principal.user_id.clone(),
            event_name: pattern,
            spec,
            enabled: true,
            created_at: chrono::Utc::now(),
        };
        self.storage.upsert_subscription(record.clone()).await?;
        Ok(record)
    }

    pub async fn unsubscribe(&self, principal: &Principal, sub_id: &str) -> Result<()> {
        let subs = self
            .storage
            .list_subscriptions(Some(&principal.user_id), Page::default())
            .await?;
        if !subs.iter().any(|s| s.id == sub_id) && !principal.is_admin() {
            return Err(Error::not_found("subscription", sub_id));
        }
        self.storage.delete_subscription(sub_id).await
    }

    pub async fn list(&self, principal: &Principal, page: Page) -> Result<Vec<SubscriptionRecord>> {
        self.storage.list_subscriptions(Some(&principal.user_id), page).await
    }

    /// Live event feed for in-process listeners (SSE bridges, supervisors).
    pub fn listen(&self) -> broadcast::Receiver<Event> {
        self.feed.subscribe()
    }

    /// Publish an event: broadcast it and launch a task per matching
    /// subscription. Scoping: an event carrying `user_id` only triggers that
    /// user's subscriptions; an unscoped event triggers all (system events).
    pub async fn emit(&self, event: Event) -> Result<Vec<TaskRecord>> {
        tracing::debug!(event = %event.name, source = %event.source, "signal emitted");
        let _ = self.feed.send(event.clone());

        let subscriptions =
            self.storage.list_subscriptions(event.user_id.as_deref(), Page::first(1000)).await?;
        let mut launched = Vec::new();
        for sub in subscriptions {
            if !sub.enabled || !pattern_matches(&sub.event_name, &event.name) {
                continue;
            }
            // The subscription's task runs as its owner, with the event
            // attached to the spec input.
            let mut spec = sub.spec.clone();
            spec["event"] = json!({
                "name": event.name,
                "payload": event.payload,
                "source": event.source,
                "occurred_at": event.occurred_at,
            });
            let principal = Principal::user(&sub.user_id);
            let record = self
                .tasks
                .submit(
                    &principal,
                    spec,
                    TaskOptions { trigger: trigger::SIGNAL.to_string(), ..Default::default() },
                )
                .await?;
            launched.push(record);
        }
        Ok(launched)
    }

    /// Convenience for webhook delivery: wraps the payload as
    /// `webhook.<hook>` scoped to the authenticated user.
    pub async fn emit_webhook(
        &self,
        principal: &Principal,
        hook: &str,
        payload: Value,
    ) -> Result<Vec<TaskRecord>> {
        let mut tasks = self
            .emit(
                Event::new(format!("webhook.{hook}"), payload, "webhook")
                    .for_user(&principal.user_id),
            )
            .await?;
        // Webhook-triggered tasks are labelled as such.
        for task in &mut tasks {
            task.trigger = trigger::WEBHOOK.to_string();
            self.storage.update_task(task.clone()).await?;
        }
        Ok(tasks)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manager::TaskExecutor;
    use async_trait::async_trait;
    use rustra_core::RuntimeContext;
    use rustra_storage::InMemoryStorage;

    struct Noop;
    #[async_trait]
    impl TaskExecutor for Noop {
        async fn execute(&self, _: &Value, _: RuntimeContext) -> Result<Value> {
            Ok(Value::Null)
        }
    }

    fn setup() -> Arc<SignalBus> {
        let storage: SharedStorage = Arc::new(InMemoryStorage::new());
        let tasks = TaskManager::new(storage.clone(), Arc::new(Noop));
        SignalBus::new(storage, tasks)
    }

    #[test]
    fn patterns() {
        assert!(pattern_matches("webhook.github.*", "webhook.github.push"));
        assert!(!pattern_matches("webhook.github.*", "webhook.githubby.push"));
        assert!(!pattern_matches("webhook.github.*", "webhook.github"));
        assert!(pattern_matches("browser.page_loaded", "browser.page_loaded"));
        assert!(pattern_matches("*", "anything.at.all"));
        assert!(!pattern_matches("a.b", "a.b.c"));
    }

    #[tokio::test]
    async fn matching_subscription_launches_task_with_event() {
        let bus = setup();
        let alice = Principal::user("alice");
        bus.subscribe(&alice, "webhook.github.*", json!({"target": "agent", "id": "main"}))
            .await
            .unwrap();

        let launched = bus
            .emit(
                Event::new("webhook.github.push", json!({"ref": "main"}), "webhook")
                    .for_user("alice"),
            )
            .await
            .unwrap();
        assert_eq!(launched.len(), 1);
        assert_eq!(launched[0].trigger, "signal");
        assert_eq!(launched[0].spec["event"]["payload"]["ref"], "main");
        assert_eq!(launched[0].user_id, "alice");
    }

    #[tokio::test]
    async fn events_are_user_scoped() {
        let bus = setup();
        bus.subscribe(&Principal::user("alice"), "deploy.done", json!({})).await.unwrap();
        bus.subscribe(&Principal::user("bob"), "deploy.done", json!({})).await.unwrap();

        // Alice's event only triggers alice's subscription.
        let launched = bus
            .emit(Event::new("deploy.done", json!({}), "system").for_user("alice"))
            .await
            .unwrap();
        assert_eq!(launched.len(), 1);
        assert_eq!(launched[0].user_id, "alice");

        // An unscoped system event triggers both.
        let launched =
            bus.emit(Event::new("deploy.done", json!({}), "system")).await.unwrap();
        assert_eq!(launched.len(), 2);
    }

    #[tokio::test]
    async fn live_feed_receives_events() {
        let bus = setup();
        let mut feed = bus.listen();
        bus.emit(Event::new("ping", json!({}), "test")).await.unwrap();
        let event = feed.recv().await.unwrap();
        assert_eq!(event.name, "ping");
    }
}
