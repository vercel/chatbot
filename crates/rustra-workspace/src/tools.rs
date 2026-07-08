//! [`FunctionTool`] factories exposing workspace operations to agents.
//!
//! Every tool is bound to one [`Workspace`] and, before doing anything,
//! verifies that the invoking principal (`ctx.runtime.user_id()`) is the
//! workspace owner — cross-user access is a hard [`Error::PermissionDenied`].

use serde_json::{json, Value};
use std::sync::Arc;

use rustra_core::{Error, FunctionTool, Result, ToolContext};

use crate::fs::Workspace;
use crate::shell::ShellPolicy;

/// Deny the call unless the invoking principal owns the workspace.
fn ensure_owner(workspace: &Workspace, ctx: &ToolContext, tool: &str) -> Result<()> {
    if ctx.runtime.user_id() == workspace.user_id() {
        Ok(())
    } else {
        Err(Error::PermissionDenied(format!(
            "tool `{tool}`: workspace belongs to `{}` but the caller is `{}`",
            workspace.user_id(),
            ctx.runtime.user_id()
        )))
    }
}

fn require_str(input: &Value, key: &str) -> Result<String> {
    input
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| Error::Validation(format!("missing required string field `{key}`")))
}

/// Read a UTF-8 text file from the workspace.
pub fn read_file_tool(workspace: Arc<Workspace>) -> FunctionTool {
    FunctionTool::new(
        "workspace_read_file",
        "Read a UTF-8 text file from the user's workspace. Paths are relative to the \
         workspace root, e.g. `files/notes.md` or `skills/my-skill/SKILL.md`.",
        json!({
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "Workspace-relative file path" }
            },
            "required": ["path"]
        }),
        move |input, ctx| {
            let workspace = Arc::clone(&workspace);
            async move {
                ensure_owner(&workspace, &ctx, "workspace_read_file")?;
                let path = require_str(&input, "path")?;
                let content = workspace.read_file(&path).await?;
                Ok(json!({ "path": path, "content": content }))
            }
        },
    )
}

/// Write (create or overwrite) a file in the workspace.
pub fn write_file_tool(workspace: Arc<Workspace>) -> FunctionTool {
    FunctionTool::new(
        "workspace_write_file",
        "Create or overwrite a UTF-8 text file in the user's workspace, creating parent \
         directories as needed. Paths are relative to the workspace root.",
        json!({
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "Workspace-relative file path" },
                "content": { "type": "string", "description": "Full new file content" }
            },
            "required": ["path", "content"]
        }),
        move |input, ctx| {
            let workspace = Arc::clone(&workspace);
            async move {
                ensure_owner(&workspace, &ctx, "workspace_write_file")?;
                let path = require_str(&input, "path")?;
                let content = require_str(&input, "content")?;
                workspace.write_file(&path, &content).await?;
                Ok(json!({ "path": path, "bytes_written": content.len() }))
            }
        },
    )
}

/// List a workspace directory.
pub fn list_files_tool(workspace: Arc<Workspace>) -> FunctionTool {
    FunctionTool::new(
        "workspace_list_files",
        "List the entries of a directory in the user's workspace. Omit `path` (or pass \
         an empty string) to list the workspace root.",
        json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Workspace-relative directory path; empty for the root"
                }
            }
        }),
        move |input, ctx| {
            let workspace = Arc::clone(&workspace);
            async move {
                ensure_owner(&workspace, &ctx, "workspace_list_files")?;
                let path =
                    input.get("path").and_then(Value::as_str).unwrap_or_default().to_string();
                let entries = workspace.list_dir(&path).await?;
                Ok(json!({ "path": path, "entries": entries }))
            }
        },
    )
}

/// Find files by name/path pattern.
pub fn search_files_tool(workspace: Arc<Workspace>) -> FunctionTool {
    FunctionTool::new(
        "workspace_search_files",
        "Find files in the user's workspace whose relative path matches a pattern — \
         either a case-insensitive substring (e.g. `report`) or a glob \
         (e.g. `files/**/*.md`).",
        json!({
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Substring or glob matched against workspace-relative paths"
                }
            },
            "required": ["pattern"]
        }),
        move |input, ctx| {
            let workspace = Arc::clone(&workspace);
            async move {
                ensure_owner(&workspace, &ctx, "workspace_search_files")?;
                let pattern = require_str(&input, "pattern")?;
                let paths = workspace.search_files(&pattern).await?;
                Ok(json!({ "pattern": pattern, "paths": paths }))
            }
        },
    )
}

/// Substring search inside workspace text files.
pub fn grep_tool(workspace: Arc<Workspace>) -> FunctionTool {
    FunctionTool::new(
        "workspace_grep",
        "Search inside the text files of the user's workspace for a literal substring. \
         Returns matching lines with their file path and 1-based line number. Binary \
         files and files larger than 1 MiB are skipped.",
        json!({
            "type": "object",
            "properties": {
                "query": { "type": "string", "description": "Literal substring to search for" },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of matches to return (default 50)",
                    "minimum": 1
                }
            },
            "required": ["query"]
        }),
        move |input, ctx| {
            let workspace = Arc::clone(&workspace);
            async move {
                ensure_owner(&workspace, &ctx, "workspace_grep")?;
                let query = require_str(&input, "query")?;
                let max_results =
                    input.get("max_results").and_then(Value::as_u64).unwrap_or(50) as usize;
                let matches = workspace.grep(&query, max_results).await?;
                Ok(json!({ "query": query, "matches": matches }))
            }
        },
    )
}

/// Run a shell command inside the workspace, guarded by `policy`.
pub fn shell_tool(workspace: Arc<Workspace>, policy: ShellPolicy) -> FunctionTool {
    FunctionTool::new(
        "workspace_shell",
        "Run a shell command (`sh -c`) inside the user's workspace. The working \
         directory is the workspace `files/` directory. Output is truncated and the \
         command is killed if it exceeds the configured timeout.",
        json!({
            "type": "object",
            "properties": {
                "command": { "type": "string", "description": "The shell command to run" }
            },
            "required": ["command"]
        }),
        move |input, ctx| {
            let workspace = Arc::clone(&workspace);
            let policy = policy.clone();
            async move {
                ensure_owner(&workspace, &ctx, "workspace_shell")?;
                let command = require_str(&input, "command")?;
                let output = workspace.exec(&command, &policy).await?;
                Ok(json!({
                    "stdout": output.stdout,
                    "stderr": output.stderr,
                    "exit_code": output.exit_code,
                    "truncated": output.truncated,
                }))
            }
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_core::{Principal, RuntimeContext, Tool};

    async fn workspace() -> (tempfile::TempDir, Arc<Workspace>) {
        let dir = tempfile::tempdir().unwrap();
        let ws = Workspace::open("u1", dir.path().join("u1")).await.unwrap();
        (dir, Arc::new(ws))
    }

    fn ctx_for(user: &str) -> ToolContext {
        ToolContext::new(RuntimeContext::new(Principal::user(user)))
    }

    #[tokio::test]
    async fn tools_work_for_the_owner() {
        let (_dir, ws) = workspace().await;
        let ctx = ctx_for("u1");

        let write = write_file_tool(Arc::clone(&ws));
        write
            .execute(json!({"path": "files/hello.txt", "content": "hi needle"}), &ctx)
            .await
            .unwrap();

        let read = read_file_tool(Arc::clone(&ws));
        let out = read.execute(json!({"path": "files/hello.txt"}), &ctx).await.unwrap();
        assert_eq!(out["content"], "hi needle");

        let list = list_files_tool(Arc::clone(&ws));
        let out = list.execute(json!({"path": "files"}), &ctx).await.unwrap();
        assert_eq!(out["entries"][0]["name"], "hello.txt");

        let search = search_files_tool(Arc::clone(&ws));
        let out = search.execute(json!({"pattern": "hello"}), &ctx).await.unwrap();
        assert_eq!(out["paths"][0], "files/hello.txt");

        let grep = grep_tool(Arc::clone(&ws));
        let out = grep.execute(json!({"query": "needle"}), &ctx).await.unwrap();
        assert_eq!(out["matches"][0]["path"], "files/hello.txt");

        let shell = shell_tool(Arc::clone(&ws), ShellPolicy::default());
        let out = shell.execute(json!({"command": "echo ok"}), &ctx).await.unwrap();
        assert_eq!(out["stdout"], "ok\n");
        assert_eq!(out["exit_code"], 0);
    }

    #[tokio::test]
    async fn tools_deny_other_users() {
        let (_dir, ws) = workspace().await;
        let intruder = ctx_for("u2");
        let tools = [
            read_file_tool(Arc::clone(&ws)),
            write_file_tool(Arc::clone(&ws)),
            list_files_tool(Arc::clone(&ws)),
            search_files_tool(Arc::clone(&ws)),
            grep_tool(Arc::clone(&ws)),
            shell_tool(Arc::clone(&ws), ShellPolicy::default()),
        ];
        let input = json!({
            "path": "files/x.txt", "content": "x", "pattern": "x",
            "query": "x", "command": "echo x"
        });
        for tool in tools {
            let err = tool.execute(input.clone(), &intruder).await.unwrap_err();
            let message = err.to_string();
            assert!(
                message.contains("permission denied"),
                "tool `{}` should deny user mismatch, got: {message}",
                tool.id()
            );
        }
    }
}
