//! The `send_message` agent tool.

use std::sync::Arc;

use serde_json::{json, Value};

use rustra_core::{Error, FunctionTool, Result};

use crate::registry::ChannelRegistry;
use crate::types::OutboundMessage;

/// Build the `send_message` tool over a [`ChannelRegistry`].
///
/// The recipient is always the calling principal (`ctx.runtime.user_id()`):
/// an agent can notify its own user on any registered channel but can never
/// address someone else.
pub fn send_message_tool(registry: Arc<ChannelRegistry>) -> FunctionTool {
    FunctionTool::new(
        "send_message",
        "Send a message to the current user over a delivery channel \
         (e.g. in_app, slack, email, webhook). Returns a delivery receipt.",
        json!({
            "type": "object",
            "properties": {
                "channel": {
                    "type": "string",
                    "description": "Registered channel name to deliver on (e.g. \"in_app\")."
                },
                "body": {
                    "type": "string",
                    "description": "Message body text."
                },
                "subject": {
                    "type": "string",
                    "description": "Optional subject/title."
                }
            },
            "required": ["channel", "body"]
        }),
        move |input, ctx| {
            let registry = Arc::clone(&registry);
            async move {
                let channel = require_str(&input, "channel")?;
                let body = require_str(&input, "body")?;
                let subject = input.get("subject").and_then(Value::as_str).map(str::to_owned);
                let sender = ctx.agent_id.clone().unwrap_or_else(|| "system".to_string());

                let msg = OutboundMessage {
                    user_id: ctx.runtime.user_id().to_string(),
                    subject,
                    body,
                    metadata: json!({ "sender": sender }),
                };
                let receipt = registry.send(&channel, &msg).await?;
                Ok(serde_json::to_value(receipt)?)
            }
        },
    )
    .with_output_schema(json!({
        "type": "object",
        "properties": {
            "channel": { "type": "string" },
            "delivered": { "type": "boolean" },
            "detail": { "type": "string" }
        },
        "required": ["channel", "delivered"]
    }))
}

fn require_str(input: &Value, key: &str) -> Result<String> {
    input
        .get(key)
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| Error::Validation(format!("`{key}` must be a non-empty string")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapters::InAppChannel;
    use rustra_core::{Principal, RuntimeContext, Tool, ToolContext};
    use rustra_storage::{InMemoryStorage, Page, SharedStorage};

    fn setup() -> (SharedStorage, Arc<ChannelRegistry>) {
        let storage: SharedStorage = Arc::new(InMemoryStorage::new());
        let registry = ChannelRegistry::new(storage.clone())
            .with_adapter(Arc::new(InAppChannel::new(storage.clone())));
        (storage, Arc::new(registry))
    }

    fn ctx(user: &str) -> ToolContext {
        let mut ctx = ToolContext::new(RuntimeContext::new(Principal::user(user)));
        ctx.agent_id = Some("agt_test".to_string());
        ctx
    }

    #[tokio::test]
    async fn tool_sends_to_the_calling_user() {
        let (storage, registry) = setup();
        let tool = send_message_tool(registry);
        assert_eq!(tool.id(), "send_message");

        let out = tool
            .execute(json!({ "channel": "in_app", "body": "ping", "subject": "s" }), &ctx("u1"))
            .await
            .unwrap();
        assert_eq!(out["channel"], "in_app");
        assert_eq!(out["delivered"], true);

        // One delivered in-app record + one registry audit record, all for u1.
        let records = storage.list_channel_messages("u1", None, Page::default()).await.unwrap();
        assert_eq!(records.len(), 2);
        assert!(records.iter().all(|r| r.user_id == "u1" && r.content == "ping"));
        assert!(records.iter().any(|r| r.metadata["audit"] == true));
        assert!(records.iter().all(|r| r.sender == "agt_test"));

        // Nothing leaked to another user's inbox.
        let other = storage.list_channel_messages("u2", None, Page::default()).await.unwrap();
        assert!(other.is_empty());
    }

    #[tokio::test]
    async fn tool_validates_input() {
        let (_storage, registry) = setup();
        let tool = send_message_tool(registry);

        let err = tool.execute(json!({ "body": "no channel" }), &ctx("u1")).await.unwrap_err();
        assert!(err.to_string().contains("channel"));

        let err = tool.execute(json!({ "channel": "in_app" }), &ctx("u1")).await.unwrap_err();
        assert!(err.to_string().contains("body"));
    }
}
