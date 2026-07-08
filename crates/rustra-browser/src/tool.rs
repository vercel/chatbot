//! The `browser` agent tool.

use std::sync::Arc;

use serde_json::{json, Value};

use rustra_core::{Error, FunctionTool};

use crate::action::BrowserAction;
use crate::manager::BrowserSessionManager;
use crate::session::BrowserSession;

/// Build the `browser` tool over a [`BrowserSessionManager`].
///
/// Permission model: the manager only returns sessions owned by
/// `ctx.runtime.user_id()`, so an agent can never drive another user's
/// browser session.
pub fn browser_tool(manager: Arc<BrowserSessionManager>) -> FunctionTool {
    FunctionTool::new(
        "browser",
        "Perform one action in the user's remote-controlled browser session \
         (navigate, click, type, press, scroll, wait_for, read_dom, screenshot, evaluate). \
         The action executes client-side; the result is returned when the browser answers.",
        json!({
            "type": "object",
            "properties": {
                "session_id": {
                    "type": "string",
                    "description": "Id of an open browser session owned by the current user."
                },
                "action": {
                    "type": "object",
                    "description": "The browser action, tagged by `type`, e.g. \
                                    {\"type\": \"navigate\", \"url\": \"https://example.com\"} or \
                                    {\"type\": \"click\", \"selector\": \"#submit\"}.",
                    "properties": {
                        "type": {
                            "type": "string",
                            "enum": BrowserAction::KINDS
                        }
                    },
                    "required": ["type"]
                }
            },
            "required": ["session_id", "action"]
        }),
        move |input, ctx| {
            let manager = Arc::clone(&manager);
            async move {
                let session_id = input
                    .get("session_id")
                    .and_then(Value::as_str)
                    .ok_or_else(|| Error::Validation("`session_id` must be a string".into()))?;
                let action: BrowserAction = serde_json::from_value(
                    input
                        .get("action")
                        .cloned()
                        .ok_or_else(|| Error::Validation("`action` is required".into()))?,
                )
                .map_err(|e| Error::Validation(format!("invalid browser action: {e}")))?;

                let session = manager.get(ctx.runtime.user_id(), session_id)?;
                let result = session.perform(action).await?;
                Ok(serde_json::to_value(result)?)
            }
        },
    )
    .with_output_schema(json!({
        "type": "object",
        "properties": {
            "ok": { "type": "boolean" },
            "data": {},
            "error": { "type": "string" }
        },
        "required": ["ok"]
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::action::BrowserActionResult;
    use rustra_core::{Principal, RuntimeContext, Tool, ToolContext};

    fn ctx(user: &str) -> ToolContext {
        ToolContext::new(RuntimeContext::new(Principal::user(user)))
    }

    #[tokio::test]
    async fn tool_performs_for_the_owning_user() {
        let manager = Arc::new(BrowserSessionManager::new());
        let session = manager.create_session("u1");
        let tool = browser_tool(manager);
        assert_eq!(tool.id(), "browser");

        let server_side = tokio::spawn({
            let session = session.clone();
            async move {
                loop {
                    if let Some(command) = session.next_command() {
                        session
                            .submit_result(
                                &command.id,
                                BrowserActionResult::success(json!({ "url": "https://a.b" })),
                            )
                            .unwrap();
                        break;
                    }
                    tokio::task::yield_now().await;
                }
            }
        });

        let out = tool
            .execute(
                json!({
                    "session_id": session.id(),
                    "action": { "type": "navigate", "url": "https://a.b" }
                }),
                &ctx("u1"),
            )
            .await
            .unwrap();
        assert_eq!(out["ok"], true);
        assert_eq!(out["data"]["url"], "https://a.b");
        server_side.await.unwrap();
    }

    #[tokio::test]
    async fn tool_rejects_sessions_of_other_users() {
        let manager = Arc::new(BrowserSessionManager::new());
        let session = manager.create_session("u1");
        let tool = browser_tool(manager);

        let err = tool
            .execute(
                json!({ "session_id": session.id(), "action": { "type": "screenshot" } }),
                &ctx("u2"),
            )
            .await
            .unwrap_err();
        assert!(err.to_string().contains("does not belong to `u2`"));
        // The command never reached the session's queue.
        assert!(session.next_command().is_none());
    }

    #[tokio::test]
    async fn tool_validates_action_shape() {
        let manager = Arc::new(BrowserSessionManager::new());
        let session = manager.create_session("u1");
        let tool = browser_tool(manager);

        let err = tool
            .execute(
                json!({ "session_id": session.id(), "action": { "type": "warp_speed" } }),
                &ctx("u1"),
            )
            .await
            .unwrap_err();
        assert!(err.to_string().contains("invalid browser action"));

        let err = tool
            .execute(json!({ "action": { "type": "screenshot" } }), &ctx("u1"))
            .await;
        assert!(err.unwrap_err().to_string().contains("session_id"));
    }
}
