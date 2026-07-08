//! Workspace files as a [`ContextSource`]: files under the workspace's
//! `files/` directory whose relative path or name is mentioned in the request
//! are offered as attachable context, following the same progressive
//! disclosure model as skills, knowledge, and memory.

use async_trait::async_trait;
use serde_json::json;
use std::path::Path;
use std::sync::Arc;

use rustra_core::{
    ContextCandidate, ContextFragment, ContextKind, ContextRequest, ContextSource, Result,
};

use crate::fs::{Workspace, FILES_DIR};

/// Maximum number of candidates advertised per request.
const MAX_CANDIDATES: usize = 10;
/// Fixed lexical score for a path/name mention in the query.
const MENTION_SCORE: f32 = 0.8;

/// Offers workspace files (under `files/`) whose path or file name appears in
/// the request text. Candidate ids are paths relative to `files/`.
#[derive(Debug)]
pub struct WorkspaceContextSource {
    workspace: Arc<Workspace>,
}

impl WorkspaceContextSource {
    /// Wrap `workspace` as a context source; only that workspace's owner will
    /// ever see candidates from it.
    pub fn new(workspace: Arc<Workspace>) -> Self {
        Self { workspace }
    }

    /// The source is bound to one user's workspace; requests from any other
    /// principal must not see it.
    fn ensure_owner(&self, req: &ContextRequest) -> Result<()> {
        self.workspace.check_owner(req.runtime.user_id())
    }
}

#[async_trait]
impl ContextSource for WorkspaceContextSource {
    fn id(&self) -> &str {
        "workspace"
    }

    fn kind(&self) -> ContextKind {
        ContextKind::WorkspaceFile
    }

    async fn candidates(&self, req: &ContextRequest) -> Result<Vec<ContextCandidate>> {
        if self.ensure_owner(req).is_err() {
            // Cross-user requests simply see nothing.
            return Ok(Vec::new());
        }
        let query = req.query.to_lowercase();
        Ok(self
            .workspace
            .walk_files(FILES_DIR)
            .await?
            .into_iter()
            .filter(|(rel, _)| {
                let rel_lower = rel.to_lowercase();
                let name_lower = Path::new(rel)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                query.contains(&rel_lower)
                    || (!name_lower.is_empty() && query.contains(&name_lower))
            })
            .map(|(rel, size)| ContextCandidate {
                id: rel.clone(),
                kind: ContextKind::WorkspaceFile,
                title: rel.clone(),
                description: format!("Workspace file `{FILES_DIR}/{rel}`"),
                score: MENTION_SCORE,
                estimated_chars: size as usize,
            })
            .take(MAX_CANDIDATES)
            .collect())
    }

    async fn load(&self, candidate_id: &str, req: &ContextRequest) -> Result<ContextFragment> {
        self.ensure_owner(req)?;
        let content = self
            .workspace
            .read_file(&format!("{FILES_DIR}/{candidate_id}"))
            .await?;
        let total_chars = content.chars().count();
        let truncated = total_chars > req.char_budget;
        let content = if truncated {
            content.chars().take(req.char_budget).collect()
        } else {
            content
        };
        Ok(ContextFragment {
            id: candidate_id.to_string(),
            kind: ContextKind::WorkspaceFile,
            title: candidate_id.to_string(),
            content,
            metadata: json!({
                "path": format!("{FILES_DIR}/{candidate_id}"),
                "truncated": truncated,
                "total_chars": total_chars,
            }),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_core::{Error, Principal, RuntimeContext};

    async fn source() -> (tempfile::TempDir, WorkspaceContextSource, Arc<Workspace>) {
        let dir = tempfile::tempdir().unwrap();
        let ws = Arc::new(Workspace::open("u1", dir.path().join("u1")).await.unwrap());
        (dir, WorkspaceContextSource::new(Arc::clone(&ws)), ws)
    }

    fn request(user: &str, query: &str, char_budget: usize) -> ContextRequest {
        ContextRequest {
            query: query.into(),
            agent_id: "agent".into(),
            thread_id: None,
            runtime: RuntimeContext::new(Principal::user(user)),
            char_budget,
        }
    }

    #[tokio::test]
    async fn candidates_match_mentioned_files() {
        let (_dir, source, ws) = source().await;
        ws.write_file("files/notes.txt", "some notes")
            .await
            .unwrap();
        ws.write_file("files/deep/plan.md", "the plan")
            .await
            .unwrap();
        ws.write_file("files/unrelated.log", "nope").await.unwrap();

        let req = request("u1", "Please summarize notes.txt and deep/plan.md", 1000);
        let candidates = source.candidates(&req).await.unwrap();
        assert_eq!(candidates.len(), 2);
        let ids: Vec<&str> = candidates.iter().map(|c| c.id.as_str()).collect();
        assert!(ids.contains(&"notes.txt"));
        assert!(ids.contains(&"deep/plan.md"));
        for candidate in &candidates {
            assert_eq!(candidate.score, 0.8);
            assert_eq!(candidate.kind, ContextKind::WorkspaceFile);
            assert!(candidate.estimated_chars > 0);
        }

        let none = source
            .candidates(&request("u1", "nothing relevant here", 1000))
            .await
            .unwrap();
        assert!(none.is_empty());
    }

    #[tokio::test]
    async fn candidates_are_capped_at_ten() {
        let (_dir, source, ws) = source().await;
        let mut query = String::from("look at ");
        for i in 0..15 {
            let name = format!("f{i}.txt");
            ws.write_file(&format!("files/{name}"), "x").await.unwrap();
            query.push_str(&name);
            query.push(' ');
        }
        let candidates = source
            .candidates(&request("u1", &query, 1000))
            .await
            .unwrap();
        assert_eq!(candidates.len(), 10);
    }

    #[tokio::test]
    async fn load_truncates_to_budget() {
        let (_dir, source, ws) = source().await;
        ws.write_file("files/big.txt", &"x".repeat(100))
            .await
            .unwrap();
        let fragment = source
            .load("big.txt", &request("u1", "big.txt", 10))
            .await
            .unwrap();
        assert_eq!(fragment.content.len(), 10);
        assert_eq!(fragment.metadata["truncated"], true);
        assert_eq!(fragment.metadata["total_chars"], 100);
    }

    #[tokio::test]
    async fn other_users_see_nothing_and_cannot_load() {
        let (_dir, source, ws) = source().await;
        ws.write_file("files/secret.txt", "secret").await.unwrap();
        let req = request("u2", "read secret.txt", 1000);
        assert!(source.candidates(&req).await.unwrap().is_empty());
        let err = source.load("secret.txt", &req).await.unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));
    }
}
