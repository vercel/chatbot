use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::id::new_id;

/// A named occurrence flowing through the system: signals, webhooks, browser
/// events from the extension, lifecycle notifications.
///
/// Events are the currency of the signal bus (`rustra-tasks`): subscriptions
/// match on `name`, and matched subscriptions launch tasks/agents/flows with
/// the event as input.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub id: String,
    /// Dotted event name, e.g. `webhook.github.push`, `browser.page_loaded`,
    /// `run.completed`, `user.signal.review_requested`.
    pub name: String,
    /// Arbitrary JSON payload.
    pub payload: Value,
    /// Where the event came from: `webhook`, `schedule`, `extension`,
    /// `agent`, `system`, `user`.
    pub source: String,
    /// User whose scope the event belongs to, when applicable.
    pub user_id: Option<String>,
    pub occurred_at: DateTime<Utc>,
}

impl Event {
    pub fn new(name: impl Into<String>, payload: Value, source: impl Into<String>) -> Self {
        Self {
            id: new_id("evt"),
            name: name.into(),
            payload,
            source: source.into(),
            user_id: None,
            occurred_at: Utc::now(),
        }
    }

    pub fn for_user(mut self, user_id: impl Into<String>) -> Self {
        self.user_id = Some(user_id.into());
        self
    }
}
