//! # rustra-workspace
//!
//! Per-user isolated workspaces: each user gets a rooted directory tree with
//! jailed file operations ([`Workspace`]), policy-guarded shell access
//! ([`ShellPolicy`] / [`Workspace::exec`]), LSP-backed diagnostics for
//! JS/TS and Python ([`LspClient`]), and standard authoring locations for
//! skills, knowledge, agents, and flows.
//!
//! The [`WorkspaceManager`] owns the base directory and hands out
//! [`Workspace`] handles, persisting a `WorkspaceRecord` in storage so other
//! parts of the system can locate and configure each workspace. Agent-facing
//! surfaces live in [`tools`] (function tools that enforce user ownership)
//! and [`context_source`] (workspace files as dynamically attachable
//! context).

pub mod context_source;
pub mod fs;
pub mod lsp;
pub mod shell;
pub mod tools;

pub use context_source::WorkspaceContextSource;
pub use fs::{
    DirEntryInfo, GrepMatch, Workspace, AGENTS_DIR, FILES_DIR, FLOWS_DIR, KNOWLEDGE_DIR,
    SKILLS_DIR, STANDARD_SUBDIRS,
};
pub use lsp::{encode_message, read_message, Diagnostic, LspClient, LspServerConfig};
pub use shell::{ShellOutput, ShellPolicy};
pub use tools::{
    grep_tool, list_files_tool, read_file_tool, search_files_tool, shell_tool, write_file_tool,
};

use chrono::Utc;
use serde_json::Value;
use std::path::PathBuf;

use rustra_core::{Error, Result};
use rustra_storage::{types::WorkspaceRecord, SharedStorage};

/// Creates and hands out per-user [`Workspace`]s under a base directory,
/// recording each one in storage (`InfraStore::upsert_workspace`).
pub struct WorkspaceManager {
    base_dir: PathBuf,
    storage: SharedStorage,
}

impl WorkspaceManager {
    pub fn new(base_dir: impl Into<PathBuf>, storage: SharedStorage) -> Self {
        Self { base_dir: base_dir.into(), storage }
    }

    /// The directory under which all user workspaces live.
    pub fn base_dir(&self) -> &std::path::Path {
        &self.base_dir
    }

    /// Get (creating on first use) the workspace for `user_id`.
    ///
    /// The user id is validated (no path separators, dots, or other
    /// filesystem-meaningful characters), the directory tree
    /// `<base>/<user_id>/{files,skills,knowledge,agents,flows}` is created,
    /// and a [`WorkspaceRecord`] with id `ws_<user_id>` is persisted if not
    /// already present.
    pub async fn workspace_for_user(&self, user_id: &str) -> Result<Workspace> {
        validate_user_id(user_id)?;
        let workspace = Workspace::open(user_id, self.base_dir.join(user_id)).await?;

        let record_id = format!("ws_{user_id}");
        if self.storage.get_workspace(&record_id).await?.is_none() {
            self.storage
                .upsert_workspace(WorkspaceRecord {
                    id: record_id,
                    user_id: user_id.to_string(),
                    name: format!("{user_id} workspace"),
                    root_path: workspace.root().to_string_lossy().into_owned(),
                    settings: Value::Null,
                    created_at: Utc::now(),
                })
                .await?;
        }
        Ok(workspace)
    }
}

/// A user id doubles as a directory name, so it must be a single safe path
/// segment: non-empty ASCII alphanumerics, `-`, or `_` only. This rejects
/// path separators, `.`/`..` tricks, and anything else with filesystem
/// meaning.
fn validate_user_id(user_id: &str) -> Result<()> {
    if user_id.is_empty() {
        return Err(Error::Validation("user id must not be empty".into()));
    }
    if !user_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(Error::Validation(format!(
            "invalid user id for a workspace: `{user_id}` \
             (only ASCII letters, digits, `-`, and `_` are allowed)"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_storage::InMemoryStorage;
    use std::sync::Arc;

    fn manager(dir: &std::path::Path) -> (WorkspaceManager, SharedStorage) {
        let storage: SharedStorage = Arc::new(InMemoryStorage::new());
        (WorkspaceManager::new(dir, Arc::clone(&storage)), storage)
    }

    #[tokio::test]
    async fn workspace_for_user_creates_subdirs_and_record() {
        let dir = tempfile::tempdir().unwrap();
        let (manager, storage) = manager(dir.path());

        let ws = manager.workspace_for_user("alice").await.unwrap();
        assert_eq!(ws.user_id(), "alice");
        for sub in STANDARD_SUBDIRS {
            assert!(ws.root().join(sub).is_dir(), "missing subdir `{sub}`");
        }
        assert_eq!(ws.files_dir(), ws.root().join("files"));
        assert_eq!(ws.skills_dir(), ws.root().join("skills"));
        assert_eq!(ws.knowledge_dir(), ws.root().join("knowledge"));
        assert_eq!(ws.agents_dir(), ws.root().join("agents"));
        assert_eq!(ws.flows_dir(), ws.root().join("flows"));

        let record = storage.get_workspace("ws_alice").await.unwrap().expect("record persisted");
        assert_eq!(record.user_id, "alice");
        assert_eq!(record.root_path, ws.root().to_string_lossy());
        let created_at = record.created_at;

        // Idempotent: a second call reuses the record.
        let again = manager.workspace_for_user("alice").await.unwrap();
        assert_eq!(again.root(), ws.root());
        let record = storage.get_workspace("ws_alice").await.unwrap().expect("record kept");
        assert_eq!(record.created_at, created_at);
    }

    #[tokio::test]
    async fn invalid_user_ids_are_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let (manager, _storage) = manager(dir.path());
        for bad in ["", "..", "a/b", "a\\b", "a.b", "../../etc", "a b"] {
            let err = manager.workspace_for_user(bad).await.unwrap_err();
            assert!(
                matches!(err, Error::Validation(_)),
                "`{bad}` should be rejected, got: {err}"
            );
        }
        assert!(manager.workspace_for_user("Ok_user-42").await.is_ok());
    }

    #[tokio::test]
    async fn workspaces_are_isolated_per_user() {
        let dir = tempfile::tempdir().unwrap();
        let (manager, _storage) = manager(dir.path());
        let alice = manager.workspace_for_user("alice").await.unwrap();
        let bob = manager.workspace_for_user("bob").await.unwrap();
        assert_ne!(alice.root(), bob.root());
        alice.write_file("files/a.txt", "alice's").await.unwrap();
        assert!(bob.read_file("files/a.txt").await.is_err());
    }
}
