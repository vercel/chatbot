//! The `create_ui` agent tool.

use std::sync::Arc;

use serde_json::{json, Value};

use rustra_core::{Error, FunctionTool};

use crate::service::UiService;

/// Build the `create_ui` tool over a [`UiService`].
///
/// Artifacts are always created for the calling principal
/// (`ctx.runtime.user_id()`); the tool exposes no owner parameter.
pub fn create_ui_tool(service: Arc<UiService>) -> FunctionTool {
    FunctionTool::new(
        "create_ui",
        "Create a generative UI artifact (an HTML document, optionally with structured \
         data exposed to it as window.__RUSTRA_DATA__) for the current user. \
         Returns the artifact id and version.",
        json!({
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Short human-readable artifact title (max 200 chars)."
                },
                "html": {
                    "type": "string",
                    "description": "The artifact HTML body. Inline scripts/styles only; \
                                    no external resources (blocked by CSP). Max 2 MiB."
                },
                "data": {
                    "description": "Optional JSON exposed to the artifact as window.__RUSTRA_DATA__."
                }
            },
            "required": ["title", "html"]
        }),
        move |input, ctx| {
            let service = Arc::clone(&service);
            async move {
                let title = input
                    .get("title")
                    .and_then(Value::as_str)
                    .ok_or_else(|| Error::Validation("`title` must be a string".into()))?
                    .to_string();
                let html = input
                    .get("html")
                    .and_then(Value::as_str)
                    .ok_or_else(|| Error::Validation("`html` must be a string".into()))?
                    .to_string();
                let data = input.get("data").cloned().unwrap_or(Value::Null);

                let record = service.create(ctx.runtime.user_id(), &title, &html, data).await?;
                Ok(json!({ "id": record.id, "version": record.version }))
            }
        },
    )
    .with_output_schema(json!({
        "type": "object",
        "properties": {
            "id": { "type": "string" },
            "version": { "type": "integer" }
        },
        "required": ["id", "version"]
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_core::{Principal, RuntimeContext, Tool, ToolContext};
    use rustra_storage::{InMemoryStorage, Page};

    fn ctx(user: &str) -> ToolContext {
        ToolContext::new(RuntimeContext::new(Principal::user(user)))
    }

    #[tokio::test]
    async fn tool_creates_for_the_calling_user() {
        let service = Arc::new(UiService::new(Arc::new(InMemoryStorage::new())));
        let tool = create_ui_tool(service.clone());
        assert_eq!(tool.id(), "create_ui");

        let out = tool
            .execute(
                json!({ "title": "T", "html": "<p>hi</p>", "data": { "a": 1 } }),
                &ctx("u1"),
            )
            .await
            .unwrap();
        let id = out["id"].as_str().unwrap();
        assert!(id.starts_with("ui_"));
        assert_eq!(out["version"], 1);

        let record = service.get("u1", id).await.unwrap();
        assert_eq!(record.owner_id, "u1");
        assert_eq!(record.data, json!({ "a": 1 }));
        assert!(service.list("u2", Page::default()).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn tool_surfaces_validation_errors() {
        let service = Arc::new(UiService::new(Arc::new(InMemoryStorage::new())));
        let tool = create_ui_tool(service);

        let err = tool.execute(json!({ "title": "T" }), &ctx("u1")).await.unwrap_err();
        assert!(err.to_string().contains("html"));

        let err =
            tool.execute(json!({ "title": "T", "html": "" }), &ctx("u1")).await.unwrap_err();
        assert!(err.to_string().contains("empty"));
    }
}
