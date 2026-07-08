//! Core message types and the [`ChannelAdapter`] contract.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use rustra_core::Result;

fn default_json() -> Value {
    Value::Null
}

/// A message addressed to a user, independent of the channel that will carry
/// it. Adapters map this onto their wire format (Slack text, email body,
/// webhook payload, in-app record).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OutboundMessage {
    /// The recipient's user id — adapters resolve this to channel-native
    /// addressing (email address, in-app inbox, ...).
    pub user_id: String,
    /// Optional subject/title. Channels without a subject concept fold it
    /// into the body or drop it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    pub body: String,
    /// Free-form metadata. The well-known key `sender` names the sending
    /// agent (defaults to `system` when absent).
    #[serde(default = "default_json")]
    pub metadata: Value,
}

impl OutboundMessage {
    pub fn new(user_id: impl Into<String>, body: impl Into<String>) -> Self {
        Self { user_id: user_id.into(), subject: None, body: body.into(), metadata: Value::Null }
    }

    pub fn with_subject(mut self, subject: impl Into<String>) -> Self {
        self.subject = Some(subject.into());
        self
    }

    pub fn with_metadata(mut self, metadata: Value) -> Self {
        self.metadata = metadata;
        self
    }

    /// The sending agent named in `metadata.sender`, or `system`.
    pub fn sender(&self) -> &str {
        self.metadata.get("sender").and_then(Value::as_str).unwrap_or("system")
    }
}

/// The outcome of one delivery attempt on one channel.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DeliveryReceipt {
    /// Name of the adapter that handled the send.
    pub channel: String,
    /// Whether the channel accepted the message. `false` covers soft
    /// failures the adapter chose to report instead of erroring (e.g. a
    /// non-2xx webhook response).
    pub delivered: bool,
    /// Human-readable delivery detail (HTTP status, subscriber count, ...).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl DeliveryReceipt {
    pub fn delivered(channel: impl Into<String>) -> Self {
        Self { channel: channel.into(), delivered: true, detail: None }
    }

    pub fn failed(channel: impl Into<String>, detail: impl Into<String>) -> Self {
        Self { channel: channel.into(), delivered: false, detail: Some(detail.into()) }
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }
}

/// A delivery backend (adapter pattern). Implementations must be cheap to
/// share behind an `Arc` and must not reach across user boundaries: the only
/// recipient is `msg.user_id`.
#[async_trait]
pub trait ChannelAdapter: Send + Sync {
    /// Stable channel name used as the registry key (`in_app`, `slack`,
    /// `email`, `webhook`, or a custom name).
    fn name(&self) -> &str;

    /// Deliver `msg`. Return `Ok` with `delivered: false` for soft failures
    /// worth auditing, `Err` for hard failures (transport down, bad config).
    async fn send(&self, msg: &OutboundMessage) -> Result<DeliveryReceipt>;
}
