//! Channel routing plus the always-on audit trail.

use std::collections::HashMap;
use std::sync::Arc;

use chrono::Utc;
use serde_json::json;

use rustra_core::{new_id, Error, Result};
use rustra_storage::types::ChannelMessageRecord;
use rustra_storage::SharedStorage;

use crate::adapters::record_metadata;
use crate::types::{ChannelAdapter, DeliveryReceipt, OutboundMessage};

/// Routes an [`OutboundMessage`] to the adapter registered under a channel
/// name, and persists an audit-trail [`ChannelMessageRecord`] for **every**
/// send — successful, soft-failed, or errored — regardless of adapter.
///
/// Audit records carry `metadata.audit = true` plus the delivery outcome, so
/// inbox views can filter them out while operators keep a complete history.
pub struct ChannelRegistry {
    storage: SharedStorage,
    adapters: HashMap<String, Arc<dyn ChannelAdapter>>,
}

impl ChannelRegistry {
    pub fn new(storage: SharedStorage) -> Self {
        Self { storage, adapters: HashMap::new() }
    }

    /// Register an adapter under its [`ChannelAdapter::name`]. Re-registering
    /// a name replaces the previous adapter.
    pub fn register(&mut self, adapter: Arc<dyn ChannelAdapter>) {
        self.adapters.insert(adapter.name().to_string(), adapter);
    }

    /// Chainable form of [`register`](Self::register) for construction time.
    pub fn with_adapter(mut self, adapter: Arc<dyn ChannelAdapter>) -> Self {
        self.register(adapter);
        self
    }

    pub fn get(&self, name: &str) -> Option<Arc<dyn ChannelAdapter>> {
        self.adapters.get(name).cloned()
    }

    /// Registered channel names, sorted for stable output.
    pub fn list(&self) -> Vec<String> {
        let mut names: Vec<String> = self.adapters.keys().cloned().collect();
        names.sort();
        names
    }

    /// Send `msg` over `channel`, then persist the audit record. Adapter
    /// errors are still audited (as `delivered: false`) before propagating.
    pub async fn send(&self, channel: &str, msg: &OutboundMessage) -> Result<DeliveryReceipt> {
        let adapter =
            self.get(channel).ok_or_else(|| Error::not_found("channel", channel.to_string()))?;
        let outcome = adapter.send(msg).await;
        let (delivered, detail) = match &outcome {
            Ok(receipt) => (receipt.delivered, receipt.detail.clone()),
            Err(err) => (false, Some(err.to_string())),
        };

        let audit = ChannelMessageRecord {
            id: new_id("chm"),
            user_id: msg.user_id.clone(),
            channel: channel.to_string(),
            sender: msg.sender().to_string(),
            content: msg.body.clone(),
            metadata: json!({
                "audit": true,
                "delivered": delivered,
                "detail": detail,
                "message_metadata": record_metadata(msg),
            }),
            read: false,
            created_at: Utc::now(),
        };
        self.storage.insert_channel_message(audit).await?;

        outcome
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use rustra_storage::{InMemoryStorage, Page};
    use std::sync::Mutex;

    struct FakeAdapter {
        calls: Mutex<Vec<OutboundMessage>>,
        fail: bool,
    }

    impl FakeAdapter {
        fn new(fail: bool) -> Self {
            Self { calls: Mutex::new(Vec::new()), fail }
        }
    }

    #[async_trait]
    impl ChannelAdapter for FakeAdapter {
        fn name(&self) -> &str {
            "fake"
        }

        async fn send(&self, msg: &OutboundMessage) -> Result<DeliveryReceipt> {
            self.calls.lock().unwrap().push(msg.clone());
            if self.fail {
                Err(Error::Unavailable("fake outage".into()))
            } else {
                Ok(DeliveryReceipt::delivered("fake"))
            }
        }
    }

    fn storage() -> SharedStorage {
        Arc::new(InMemoryStorage::new())
    }

    #[tokio::test]
    async fn send_routes_to_adapter_and_persists_audit_record() {
        let storage = storage();
        let adapter = Arc::new(FakeAdapter::new(false));
        let registry = ChannelRegistry::new(storage.clone()).with_adapter(adapter.clone());

        let msg = OutboundMessage::new("u1", "audited body")
            .with_subject("subj")
            .with_metadata(json!({ "sender": "agt_9" }));
        let receipt = registry.send("fake", &msg).await.unwrap();
        assert!(receipt.delivered);
        assert_eq!(adapter.calls.lock().unwrap().len(), 1);

        let records =
            storage.list_channel_messages("u1", Some("fake"), Page::default()).await.unwrap();
        assert_eq!(records.len(), 1);
        let audit = &records[0];
        assert_eq!(audit.content, "audited body");
        assert_eq!(audit.sender, "agt_9");
        assert_eq!(audit.metadata["audit"], true);
        assert_eq!(audit.metadata["delivered"], true);
        assert_eq!(audit.metadata["message_metadata"]["subject"], "subj");
    }

    #[tokio::test]
    async fn adapter_failure_is_audited_and_propagated() {
        let storage = storage();
        let registry =
            ChannelRegistry::new(storage.clone()).with_adapter(Arc::new(FakeAdapter::new(true)));

        let err = registry.send("fake", &OutboundMessage::new("u1", "boom")).await.unwrap_err();
        assert!(matches!(err, Error::Unavailable(_)));

        let records = storage.list_channel_messages("u1", None, Page::default()).await.unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].metadata["delivered"], false);
        assert!(records[0].metadata["detail"].as_str().unwrap().contains("fake outage"));
    }

    #[tokio::test]
    async fn unknown_channel_is_not_found() {
        let registry = ChannelRegistry::new(storage());
        let err = registry.send("nope", &OutboundMessage::new("u1", "x")).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { kind: "channel", .. }));
    }

    #[tokio::test]
    async fn register_get_list() {
        let mut registry = ChannelRegistry::new(storage());
        registry.register(Arc::new(FakeAdapter::new(false)));
        assert!(registry.get("fake").is_some());
        assert!(registry.get("missing").is_none());
        assert_eq!(registry.list(), vec!["fake".to_string()]);
    }
}
