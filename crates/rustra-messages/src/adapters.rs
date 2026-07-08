//! Built-in [`ChannelAdapter`] implementations.

use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use chrono::Utc;
use serde_json::{json, Value};
use tokio::sync::broadcast;

use rustra_core::{new_id, Error, Result};
use rustra_storage::types::ChannelMessageRecord;
use rustra_storage::SharedStorage;

use crate::types::{ChannelAdapter, DeliveryReceipt, OutboundMessage};

/// Buffer size of the in-app live-delivery broadcast channel.
const IN_APP_BUFFER: usize = 256;

/// Build the persisted metadata for a message: the caller-supplied metadata
/// object with the subject folded in (when present).
pub(crate) fn record_metadata(msg: &OutboundMessage) -> Value {
    let mut metadata = match &msg.metadata {
        Value::Object(map) => Value::Object(map.clone()),
        Value::Null => json!({}),
        other => json!({ "extra": other }),
    };
    if let (Some(subject), Some(map)) = (&msg.subject, metadata.as_object_mut()) {
        map.insert("subject".into(), json!(subject));
    }
    metadata
}

// ---------------------------------------------------------------------------
// In-app
// ---------------------------------------------------------------------------

/// The default channel: messages land in the user's in-app inbox
/// (persisted via [`rustra_storage::InfraStore::insert_channel_message`]) and
/// are simultaneously broadcast for live SSE fan-out by the server crate.
pub struct InAppChannel {
    storage: SharedStorage,
    sender: broadcast::Sender<ChannelMessageRecord>,
}

impl InAppChannel {
    pub fn new(storage: SharedStorage) -> Self {
        let (sender, _) = broadcast::channel(IN_APP_BUFFER);
        Self { storage, sender }
    }

    /// Subscribe to live message delivery (one receiver per SSE connection).
    /// Slow receivers may observe `Lagged` and should re-sync from storage.
    pub fn subscribe(&self) -> broadcast::Receiver<ChannelMessageRecord> {
        self.sender.subscribe()
    }
}

#[async_trait]
impl ChannelAdapter for InAppChannel {
    fn name(&self) -> &str {
        "in_app"
    }

    async fn send(&self, msg: &OutboundMessage) -> Result<DeliveryReceipt> {
        let record = ChannelMessageRecord {
            id: new_id("chm"),
            user_id: msg.user_id.clone(),
            channel: "in_app".into(),
            sender: msg.sender().to_string(),
            content: msg.body.clone(),
            metadata: record_metadata(msg),
            read: false,
            created_at: Utc::now(),
        };
        self.storage.insert_channel_message(record.clone()).await?;
        // A send error just means no live subscribers; the message is
        // already durable, so that is not a delivery failure.
        let live = self.sender.send(record).unwrap_or(0);
        Ok(DeliveryReceipt::delivered("in_app").with_detail(format!("{live} live subscriber(s)")))
    }
}

// ---------------------------------------------------------------------------
// Slack incoming webhook
// ---------------------------------------------------------------------------

/// Posts `{"text": ...}` to a Slack incoming-webhook URL. The subject, when
/// present, is folded into the text as a bold first line.
pub struct SlackWebhookChannel {
    webhook_url: String,
    client: reqwest::Client,
}

impl SlackWebhookChannel {
    pub fn new(webhook_url: impl Into<String>) -> Self {
        Self { webhook_url: webhook_url.into(), client: reqwest::Client::new() }
    }
}

#[async_trait]
impl ChannelAdapter for SlackWebhookChannel {
    fn name(&self) -> &str {
        "slack"
    }

    async fn send(&self, msg: &OutboundMessage) -> Result<DeliveryReceipt> {
        let text = match &msg.subject {
            Some(subject) => format!("*{subject}*\n{}", msg.body),
            None => msg.body.clone(),
        };
        let response = self
            .client
            .post(&self.webhook_url)
            .json(&json!({ "text": text }))
            .send()
            .await
            .map_err(|e| Error::Unavailable(format!("slack webhook: {e}")))?;
        let status = response.status();
        if status.is_success() {
            Ok(DeliveryReceipt::delivered("slack"))
        } else {
            let body = response.text().await.unwrap_or_default();
            Ok(DeliveryReceipt::failed("slack", format!("HTTP {status}: {body}")))
        }
    }
}

// ---------------------------------------------------------------------------
// Generic webhook
// ---------------------------------------------------------------------------

/// Posts the full [`OutboundMessage`] as JSON to an arbitrary URL, with
/// optional static headers (e.g. an `Authorization` bearer token).
pub struct WebhookChannel {
    url: String,
    headers: Vec<(String, String)>,
    client: reqwest::Client,
}

impl WebhookChannel {
    pub fn new(url: impl Into<String>, headers: Vec<(String, String)>) -> Self {
        Self { url: url.into(), headers, client: reqwest::Client::new() }
    }
}

#[async_trait]
impl ChannelAdapter for WebhookChannel {
    fn name(&self) -> &str {
        "webhook"
    }

    async fn send(&self, msg: &OutboundMessage) -> Result<DeliveryReceipt> {
        let mut request = self.client.post(&self.url).json(msg);
        for (name, value) in &self.headers {
            request = request.header(name.as_str(), value.as_str());
        }
        let response =
            request.send().await.map_err(|e| Error::Unavailable(format!("webhook: {e}")))?;
        let status = response.status();
        if status.is_success() {
            Ok(DeliveryReceipt::delivered("webhook").with_detail(format!("HTTP {status}")))
        } else {
            let body = response.text().await.unwrap_or_default();
            Ok(DeliveryReceipt::failed("webhook", format!("HTTP {status}: {body}")))
        }
    }
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/// Low-level mail transport used by [`EmailChannel`].
///
/// Tech debt: only [`LogMailer`] ships today; a real SMTP or provider-API
/// implementation belongs behind this trait.
#[async_trait]
pub trait Mailer: Send + Sync {
    async fn send_mail(&self, to: &str, subject: &str, body: &str) -> Result<()>;
}

/// A captured mail (what [`LogMailer`] stores instead of sending).
#[derive(Debug, Clone, PartialEq)]
pub struct SentMail {
    pub to: String,
    pub subject: String,
    pub body: String,
}

/// Default [`Mailer`]: logs the mail via `tracing` and captures it in memory
/// so tests (and dev deployments) can inspect what would have been sent.
#[derive(Default)]
pub struct LogMailer {
    sent: Mutex<Vec<SentMail>>,
}

impl LogMailer {
    pub fn new() -> Self {
        Self::default()
    }

    /// Every mail "sent" so far, oldest first.
    pub fn sent(&self) -> Vec<SentMail> {
        self.sent.lock().map(|mails| mails.clone()).unwrap_or_default()
    }
}

#[async_trait]
impl Mailer for LogMailer {
    async fn send_mail(&self, to: &str, subject: &str, body: &str) -> Result<()> {
        tracing::info!(to, subject, body_len = body.len(), "LogMailer: capturing outbound email");
        if let Ok(mut mails) = self.sent.lock() {
            mails.push(SentMail {
                to: to.to_string(),
                subject: subject.to_string(),
                body: body.to_string(),
            });
        }
        Ok(())
    }
}

/// Fallback subject when the message carries none.
const DEFAULT_SUBJECT: &str = "Message from Rustra";

/// Maps a user id to the email address to deliver to.
pub type AddressResolver = dyn Fn(&str) -> Option<String> + Send + Sync;

/// Email delivery: resolves the recipient's user id to an address, then
/// hands off to the configured [`Mailer`].
pub struct EmailChannel {
    mailer: Arc<dyn Mailer>,
    resolve_address: Box<AddressResolver>,
}

impl EmailChannel {
    /// `resolve_address` maps a user id to an email address (typically a
    /// closure over the user store / profile JSON).
    pub fn new(
        mailer: Arc<dyn Mailer>,
        resolve_address: impl Fn(&str) -> Option<String> + Send + Sync + 'static,
    ) -> Self {
        Self { mailer, resolve_address: Box::new(resolve_address) }
    }
}

#[async_trait]
impl ChannelAdapter for EmailChannel {
    fn name(&self) -> &str {
        "email"
    }

    async fn send(&self, msg: &OutboundMessage) -> Result<DeliveryReceipt> {
        let address = (self.resolve_address)(&msg.user_id)
            .ok_or_else(|| Error::not_found("email_address", &msg.user_id))?;
        let subject = msg.subject.as_deref().unwrap_or(DEFAULT_SUBJECT);
        self.mailer.send_mail(&address, subject, &msg.body).await?;
        Ok(DeliveryReceipt::delivered("email").with_detail(format!("to {address}")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_storage::InMemoryStorage;
    use rustra_storage::Page;

    fn storage() -> SharedStorage {
        Arc::new(InMemoryStorage::new())
    }

    #[tokio::test]
    async fn in_app_persists_and_broadcasts() {
        let storage = storage();
        let channel = InAppChannel::new(storage.clone());
        let mut rx = channel.subscribe();

        let msg = OutboundMessage::new("u1", "hello there")
            .with_subject("greeting")
            .with_metadata(json!({ "sender": "agt_1" }));
        let receipt = channel.send(&msg).await.unwrap();
        assert_eq!(receipt.channel, "in_app");
        assert!(receipt.delivered);

        // Broadcast side.
        let live = rx.try_recv().unwrap();
        assert_eq!(live.user_id, "u1");
        assert_eq!(live.content, "hello there");
        assert_eq!(live.sender, "agt_1");
        assert_eq!(live.metadata["subject"], "greeting");

        // Persistence side.
        let stored =
            storage.list_channel_messages("u1", Some("in_app"), Page::default()).await.unwrap();
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0].id, live.id);
        assert!(!stored[0].read);
    }

    #[tokio::test]
    async fn in_app_delivers_without_subscribers() {
        let storage = storage();
        let channel = InAppChannel::new(storage.clone());
        let receipt = channel.send(&OutboundMessage::new("u1", "no one listening")).await.unwrap();
        assert!(receipt.delivered);
        let stored = storage.list_channel_messages("u1", None, Page::default()).await.unwrap();
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0].sender, "system");
    }

    #[tokio::test]
    async fn email_channel_resolves_and_mails() {
        let mailer = Arc::new(LogMailer::new());
        let channel = EmailChannel::new(mailer.clone(), |user_id| {
            (user_id == "u1").then(|| "u1@example.com".to_string())
        });

        let msg = OutboundMessage::new("u1", "email body").with_subject("email subject");
        let receipt = channel.send(&msg).await.unwrap();
        assert!(receipt.delivered);
        assert_eq!(receipt.channel, "email");

        let sent = mailer.sent();
        assert_eq!(sent.len(), 1);
        assert_eq!(sent[0].to, "u1@example.com");
        assert_eq!(sent[0].subject, "email subject");
        assert_eq!(sent[0].body, "email body");
    }

    #[tokio::test]
    async fn email_channel_defaults_subject_and_errors_on_unknown_user() {
        let mailer = Arc::new(LogMailer::new());
        let channel = EmailChannel::new(mailer.clone(), |user_id| {
            (user_id == "known").then(|| "known@example.com".to_string())
        });

        channel.send(&OutboundMessage::new("known", "hi")).await.unwrap();
        assert_eq!(mailer.sent()[0].subject, DEFAULT_SUBJECT);

        let err = channel.send(&OutboundMessage::new("stranger", "hi")).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { kind: "email_address", .. }));
    }

    #[test]
    fn slack_and_webhook_channels_construct() {
        let slack = SlackWebhookChannel::new("https://hooks.slack.com/services/T/B/x");
        assert_eq!(slack.name(), "slack");
        let webhook = WebhookChannel::new(
            "https://example.com/hook",
            vec![("authorization".into(), "Bearer t".into())],
        );
        assert_eq!(webhook.name(), "webhook");
    }
}
