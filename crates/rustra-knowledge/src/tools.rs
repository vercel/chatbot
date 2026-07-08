//! Agent-facing tools over a [`KnowledgeLibrary`], so a model can search for
//! and read knowledge collections mid-run. Both tools scope every lookup to
//! the invoking principal (`ctx.runtime.user_id()`).

use serde_json::json;
use std::path::Path;
use std::sync::Arc;

use rustra_core::{Error, FunctionTool, Result};

use crate::library::KnowledgeLibrary;

fn require_str(input: &serde_json::Value, field: &str) -> Result<String> {
    input
        .get(field)
        .and_then(|v| v.as_str())
        .map(str::to_owned)
        .ok_or_else(|| Error::Validation(format!("`{field}` (string) is required")))
}

/// Tool `search_knowledge`: rank available knowledge collections against a
/// free-text query.
pub fn search_knowledge_tool(library: Arc<KnowledgeLibrary>) -> FunctionTool {
    FunctionTool::new(
        "search_knowledge",
        "Search the knowledge collections available to you by name, description, and \
         keywords. Returns ranked matches; call read_knowledge to load a collection \
         or one of its documents.",
        json!({
            "type": "object",
            "properties": {
                "query": { "type": "string", "description": "Free-text description of the information needed" }
            },
            "required": ["query"]
        }),
        move |input, ctx| {
            let library = library.clone();
            async move {
                let query = require_str(&input, "query")?;
                let results = library.search(ctx.runtime.user_id(), &query)?;
                let collections: Vec<_> = results
                    .iter()
                    .map(|(collection, score)| {
                        json!({
                            "name": collection.name,
                            "description": collection.description,
                            "score": score,
                        })
                    })
                    .collect();
                Ok(json!({ "collections": collections }))
            }
        },
    )
    .with_output_schema(json!({
        "type": "object",
        "properties": {
            "collections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": { "type": "string" },
                        "description": { "type": "string" },
                        "score": { "type": "number" }
                    },
                    "required": ["name", "description", "score"]
                }
            }
        },
        "required": ["collections"]
    }))
}

/// Tool `read_knowledge`: load a whole collection (overview + all documents)
/// or, when `document` is given, a single document by relative path.
pub fn read_knowledge_tool(library: Arc<KnowledgeLibrary>) -> FunctionTool {
    FunctionTool::new(
        "read_knowledge",
        "Read a knowledge collection. Without `document`, returns the overview, the \
         list of document paths, and the full concatenated content. With `document` \
         (a relative path from the list), returns just that document.",
        json!({
            "type": "object",
            "properties": {
                "name": { "type": "string", "description": "Exact collection name, as returned by search_knowledge" },
                "document": { "type": "string", "description": "Optional relative path of a single document to read" }
            },
            "required": ["name"]
        }),
        move |input, ctx| {
            let library = library.clone();
            async move {
                let name = require_str(&input, "name")?;
                let collection = library
                    .find(ctx.runtime.user_id(), &name)?
                    .ok_or_else(|| Error::not_found("knowledge collection", &name))?;

                let document = match input.get("document") {
                    None | Some(serde_json::Value::Null) => None,
                    Some(serde_json::Value::String(s)) => Some(s.as_str()),
                    Some(_) => {
                        return Err(Error::Validation(
                            "`document` must be a string (relative document path)".into(),
                        ))
                    }
                };

                if let Some(document) = document {
                    let content = collection.read_document(Path::new(document))?;
                    return Ok(json!({
                        "name": collection.name,
                        "document": document,
                        "content": content,
                    }));
                }

                let documents: Vec<String> = collection
                    .documents
                    .iter()
                    .map(|d| d.display().to_string())
                    .collect();
                Ok(json!({
                    "name": collection.name,
                    "overview": collection.overview,
                    "documents": documents,
                    "content": collection.full_text(),
                }))
            }
        },
    )
    .with_output_schema(json!({
        "type": "object",
        "properties": {
            "name": { "type": "string" },
            "document": { "type": "string" },
            "overview": { "type": "string" },
            "documents": { "type": "array", "items": { "type": "string" } },
            "content": { "type": "string" }
        },
        "required": ["name", "content"]
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::KnowledgeRoot;
    use rustra_core::{Principal, RuntimeContext, Tool, ToolContext};

    fn setup(tmp: &std::path::Path) -> Arc<KnowledgeLibrary> {
        let alice_root = tmp.join("alice");
        let dir = alice_root.join("research-notes");
        std::fs::create_dir_all(&dir).expect("mkdir");
        std::fs::write(
            dir.join("KNOWLEDGE.md"),
            "---\nname: research-notes\ndescription: Research notes\nkeywords: [research]\n---\n\nOverview text.\n",
        )
        .expect("write");
        std::fs::write(dir.join("findings.md"), "Key finding: it works.\n").expect("write doc");
        Arc::new(KnowledgeLibrary::new(vec![KnowledgeRoot::user(
            alice_root, "alice",
        )]))
    }

    fn ctx(user: &str) -> ToolContext {
        ToolContext::new(RuntimeContext::new(Principal::user(user)))
    }

    #[tokio::test]
    async fn tools_execute_and_scope_by_user() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let library = setup(tmp.path());

        let search = search_knowledge_tool(library.clone());
        let out = search
            .execute(json!({ "query": "research" }), &ctx("alice"))
            .await
            .expect("search");
        assert_eq!(out["collections"][0]["name"], "research-notes");

        let out = search
            .execute(json!({ "query": "research" }), &ctx("bob"))
            .await
            .expect("search");
        assert_eq!(out["collections"].as_array().map(Vec::len), Some(0));

        let read = read_knowledge_tool(library);

        // Whole collection.
        let out = read
            .execute(json!({ "name": "research-notes" }), &ctx("alice"))
            .await
            .expect("read");
        assert_eq!(out["overview"], "Overview text.");
        assert_eq!(out["documents"][0], "findings.md");
        assert!(out["content"].as_str().unwrap().contains("Key finding"));

        // Single document.
        let out = read
            .execute(
                json!({ "name": "research-notes", "document": "findings.md" }),
                &ctx("alice"),
            )
            .await
            .expect("read doc");
        assert_eq!(out["content"], "Key finding: it works.\n");

        // Unknown document, wrong user, missing input all error.
        assert!(read
            .execute(
                json!({ "name": "research-notes", "document": "nope.md" }),
                &ctx("alice")
            )
            .await
            .is_err());
        assert!(read
            .execute(json!({ "name": "research-notes" }), &ctx("bob"))
            .await
            .is_err());
        assert!(search.execute(json!({}), &ctx("alice")).await.is_err());
    }
}
