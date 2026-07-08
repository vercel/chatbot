//! Skills as a [`ContextSource`]: progressive disclosure of `SKILL.md`
//! instructions. Candidates are cheap (name + description + trigger score);
//! only selected skills get their full instruction body loaded.

use async_trait::async_trait;
use serde_json::json;
use std::sync::Arc;

use rustra_core::{
    ContextCandidate, ContextFragment, ContextKind, ContextRequest, ContextSource, Error, Result,
};

use crate::library::SkillLibrary;

/// Offers every skill visible to the requesting user whose trigger matches
/// the request query.
pub struct SkillContextSource {
    library: Arc<SkillLibrary>,
}

impl SkillContextSource {
    pub fn new(library: Arc<SkillLibrary>) -> Self {
        Self { library }
    }
}

#[async_trait]
impl ContextSource for SkillContextSource {
    fn id(&self) -> &str {
        "skills"
    }

    fn kind(&self) -> ContextKind {
        ContextKind::Skill
    }

    async fn candidates(&self, req: &ContextRequest) -> Result<Vec<ContextCandidate>> {
        let skills = self.library.discover(req.runtime.user_id())?;
        let mut candidates: Vec<ContextCandidate> = skills
            .into_iter()
            .filter_map(|skill| {
                let score = skill.trigger().score(&req.query);
                (score > 0.0).then(|| ContextCandidate {
                    id: skill.name.clone(),
                    kind: ContextKind::Skill,
                    title: skill.name.clone(),
                    description: skill.description.clone(),
                    score,
                    estimated_chars: skill.instructions.len(),
                })
            })
            .collect();
        candidates.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.id.cmp(&b.id))
        });
        Ok(candidates)
    }

    async fn load(&self, candidate_id: &str, req: &ContextRequest) -> Result<ContextFragment> {
        let skill = self
            .library
            .find(req.runtime.user_id(), candidate_id)?
            .ok_or_else(|| Error::not_found("skill", candidate_id))?;

        let mut content = skill.instructions.clone();
        if !skill.assets.is_empty() {
            content.push_str("\n\nAvailable skill assets (paths relative to the skill directory):");
            for asset in &skill.assets {
                content.push_str(&format!("\n- {}", asset.display()));
            }
        }

        Ok(ContextFragment {
            id: skill.name.clone(),
            kind: ContextKind::Skill,
            title: skill.name.clone(),
            content,
            metadata: json!({
                "dir": skill.dir.display().to_string(),
                "assets": skill.assets.len(),
                "allowed_tools": skill.allowed_tools,
            }),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_core::{Principal, RuntimeContext};
    use std::path::Path;

    fn request(user: &str, query: &str) -> ContextRequest {
        ContextRequest {
            query: query.into(),
            agent_id: "agent-1".into(),
            thread_id: None,
            runtime: RuntimeContext::new(Principal::user(user)),
            char_budget: 4096,
        }
    }

    fn source(tmp: &Path) -> SkillContextSource {
        let root = tmp.join("skills");
        let dir = root.join("deploy-helper");
        std::fs::create_dir_all(dir.join("scripts")).expect("mkdir");
        std::fs::write(
            dir.join("SKILL.md"),
            "---\nname: deploy-helper\ndescription: Deploys services\nkeywords: [deploy]\n---\n\nRun scripts/deploy.sh.\n",
        )
        .expect("write");
        std::fs::write(dir.join("scripts/deploy.sh"), "#!/bin/sh\n").expect("write asset");

        let other = root.join("unrelated-skill");
        std::fs::create_dir_all(&other).expect("mkdir");
        std::fs::write(
            other.join("SKILL.md"),
            "---\nname: unrelated-skill\ndescription: Something else\nkeywords: [quantum]\n---\n\nBody.\n",
        )
        .expect("write");

        let library =
            SkillLibrary::new(vec![crate::library::SkillRoot::shared(root)]);
        SkillContextSource::new(Arc::new(library))
    }

    #[tokio::test]
    async fn candidates_only_include_matches() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let source = source(tmp.path());

        let candidates =
            source.candidates(&request("u1", "please deploy the api")).await.expect("candidates");
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].id, "deploy-helper");
        assert_eq!(candidates[0].kind, ContextKind::Skill);
        assert!(candidates[0].score > 0.0);
        assert_eq!(candidates[0].estimated_chars, "Run scripts/deploy.sh.".len());

        let none = source.candidates(&request("u1", "nothing relevant here")).await.expect("candidates");
        assert!(none.is_empty());
    }

    #[tokio::test]
    async fn load_includes_instructions_and_assets() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let source = source(tmp.path());
        let req = request("u1", "deploy");

        let fragment = source.load("deploy-helper", &req).await.expect("load");
        assert!(fragment.content.contains("Run scripts/deploy.sh."));
        assert!(fragment.content.contains("Available skill assets"));
        assert!(fragment.content.contains("scripts/deploy.sh"));
        assert_eq!(fragment.metadata["assets"], 1);

        assert!(matches!(
            source.load("missing", &req).await,
            Err(Error::NotFound { .. })
        ));
    }
}
