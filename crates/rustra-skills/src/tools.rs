//! Agent-facing tools over a [`SkillLibrary`], so a model can search for and
//! read skills mid-run instead of relying solely on assembler-attached
//! context. Both tools scope every lookup to the invoking principal
//! (`ctx.runtime.user_id()`).

use serde_json::json;
use std::sync::Arc;

use rustra_core::{Error, FunctionTool, Result};

use crate::library::SkillLibrary;

fn require_str(input: &serde_json::Value, field: &str) -> Result<String> {
    input
        .get(field)
        .and_then(|v| v.as_str())
        .map(str::to_owned)
        .ok_or_else(|| Error::Validation(format!("`{field}` (string) is required")))
}

/// Tool `search_skills`: rank available skills against a free-text query.
pub fn search_skills_tool(library: Arc<SkillLibrary>) -> FunctionTool {
    FunctionTool::new(
        "search_skills",
        "Search the skills available to you by name, description, and trigger keywords. \
         Returns ranked matches; call read_skill to load a skill's full instructions.",
        json!({
            "type": "object",
            "properties": {
                "query": { "type": "string", "description": "Free-text description of the task at hand" }
            },
            "required": ["query"]
        }),
        move |input, ctx| {
            let library = library.clone();
            async move {
                let query = require_str(&input, "query")?;
                let results = library.search(ctx.runtime.user_id(), &query)?;
                let skills: Vec<_> = results
                    .iter()
                    .map(|(skill, score)| {
                        json!({
                            "name": skill.name,
                            "description": skill.description,
                            "score": score,
                        })
                    })
                    .collect();
                Ok(json!({ "skills": skills }))
            }
        },
    )
    .with_output_schema(json!({
        "type": "object",
        "properties": {
            "skills": {
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
        "required": ["skills"]
    }))
}

/// Tool `read_skill`: load a skill's full instructions and asset listing.
pub fn read_skill_tool(library: Arc<SkillLibrary>) -> FunctionTool {
    FunctionTool::new(
        "read_skill",
        "Read a skill's full markdown instructions and the relative paths of its \
         supporting files (scripts, templates, references).",
        json!({
            "type": "object",
            "properties": {
                "name": { "type": "string", "description": "Exact skill name, as returned by search_skills" }
            },
            "required": ["name"]
        }),
        move |input, ctx| {
            let library = library.clone();
            async move {
                let name = require_str(&input, "name")?;
                let skill = library
                    .find(ctx.runtime.user_id(), &name)?
                    .ok_or_else(|| Error::not_found("skill", &name))?;
                let assets: Vec<String> =
                    skill.assets.iter().map(|a| a.display().to_string()).collect();
                Ok(json!({
                    "name": skill.name,
                    "instructions": skill.instructions,
                    "assets": assets,
                }))
            }
        },
    )
    .with_output_schema(json!({
        "type": "object",
        "properties": {
            "name": { "type": "string" },
            "instructions": { "type": "string" },
            "assets": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["instructions", "assets"]
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::SkillRoot;
    use rustra_core::{Principal, RuntimeContext, Tool, ToolContext};

    fn setup(tmp: &std::path::Path) -> Arc<SkillLibrary> {
        let alice_root = tmp.join("alice");
        let dir = alice_root.join("tax-helper");
        std::fs::create_dir_all(&dir).expect("mkdir");
        std::fs::write(
            dir.join("SKILL.md"),
            "---\nname: tax-helper\ndescription: Helps with taxes\nkeywords: [taxes]\n---\n\nDo the taxes.\n",
        )
        .expect("write");
        Arc::new(SkillLibrary::new(vec![SkillRoot::user(
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

        let search = search_skills_tool(library.clone());
        let out = search
            .execute(json!({ "query": "taxes" }), &ctx("alice"))
            .await
            .expect("search");
        assert_eq!(out["skills"][0]["name"], "tax-helper");

        // Invisible to another user.
        let out = search
            .execute(json!({ "query": "taxes" }), &ctx("bob"))
            .await
            .expect("search");
        assert_eq!(out["skills"].as_array().map(Vec::len), Some(0));

        let read = read_skill_tool(library);
        let out = read
            .execute(json!({ "name": "tax-helper" }), &ctx("alice"))
            .await
            .expect("read");
        assert_eq!(out["instructions"], "Do the taxes.");
        assert_eq!(out["assets"].as_array().map(Vec::len), Some(0));

        // Missing input and missing skill both surface as tool errors.
        assert!(search.execute(json!({}), &ctx("alice")).await.is_err());
        assert!(read
            .execute(json!({ "name": "tax-helper" }), &ctx("bob"))
            .await
            .is_err());
    }
}
