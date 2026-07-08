//! Context sources owned by the facade: user profile and prior runs.

use async_trait::async_trait;
use serde_json::json;

use rustra_core::{
    ContextCandidate, ContextFragment, ContextKind, ContextRequest, ContextSource, Result,
};
use rustra_storage::{Page, SharedStorage};

/// User profile/settings as attachable context (always relevant, small).
pub(crate) struct UserProfileContextSource {
    storage: SharedStorage,
}

impl UserProfileContextSource {
    pub(crate) fn new(storage: SharedStorage) -> Self {
        Self { storage }
    }
}

#[async_trait]
impl ContextSource for UserProfileContextSource {
    fn id(&self) -> &str {
        "user_profile"
    }

    fn kind(&self) -> ContextKind {
        ContextKind::UserProfile
    }

    async fn candidates(&self, _req: &ContextRequest) -> Result<Vec<ContextCandidate>> {
        Ok(vec![ContextCandidate {
            id: "profile".into(),
            kind: ContextKind::UserProfile,
            title: "User profile".into(),
            description: "The user's profile and settings".into(),
            score: 0.8,
            estimated_chars: 512,
        }])
    }

    async fn load(&self, _candidate_id: &str, req: &ContextRequest) -> Result<ContextFragment> {
        let user = self.storage.get_user(req.runtime.user_id()).await?;
        let content = match user {
            Some(u) => format!(
                "Name: {}\nRoles: {}\nProfile: {}",
                u.display_name,
                u.roles.join(", "),
                serde_json::to_string_pretty(&u.profile).unwrap_or_default()
            ),
            None => "(no profile on record)".to_string(),
        };
        Ok(ContextFragment {
            id: "profile".into(),
            kind: ContextKind::UserProfile,
            title: "User profile".into(),
            content,
            metadata: json!({}),
        })
    }
}

/// Recent runs as attachable context — lets the agent see what it recently
/// did for this user (and whether it failed).
pub(crate) struct PriorRunsContextSource {
    storage: SharedStorage,
}

impl PriorRunsContextSource {
    pub(crate) fn new(storage: SharedStorage) -> Self {
        Self { storage }
    }
}

#[async_trait]
impl ContextSource for PriorRunsContextSource {
    fn id(&self) -> &str {
        "prior_runs"
    }

    fn kind(&self) -> ContextKind {
        ContextKind::PriorRun
    }

    async fn candidates(&self, req: &ContextRequest) -> Result<Vec<ContextCandidate>> {
        // Only relevant when the user refers to previous work.
        let lowered = req.query.to_lowercase();
        let referring = [
            "last time",
            "again",
            "previous",
            "earlier",
            "retry",
            "before",
        ]
        .iter()
        .any(|kw| lowered.contains(kw));
        if !referring {
            return Ok(Vec::new());
        }
        Ok(vec![ContextCandidate {
            id: "recent".into(),
            kind: ContextKind::PriorRun,
            title: "Recent runs".into(),
            description: "Summaries of this user's recent agent/workflow runs".into(),
            score: 0.7,
            estimated_chars: 1024,
        }])
    }

    async fn load(&self, _candidate_id: &str, req: &ContextRequest) -> Result<ContextFragment> {
        let runs = self
            .storage
            .list_runs(req.runtime.user_id(), None, None, Page::first(5))
            .await?;
        let content = if runs.is_empty() {
            "(no prior runs)".to_string()
        } else {
            runs.iter()
                .map(|r| {
                    format!(
                        "- [{}] {} `{}` at {}: {}",
                        r.status,
                        r.kind,
                        r.subject_id,
                        r.started_at,
                        r.error.clone().unwrap_or_else(|| "ok".into())
                    )
                })
                .collect::<Vec<_>>()
                .join("\n")
        };
        Ok(ContextFragment {
            id: "recent".into(),
            kind: ContextKind::PriorRun,
            title: "Recent runs".into(),
            content,
            metadata: json!({ "count": runs.len() }),
        })
    }
}
