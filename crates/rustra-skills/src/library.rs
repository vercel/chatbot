//! Filesystem discovery of skills across user-scoped and shared roots.
//!
//! A [`SkillLibrary`] is configured with a list of [`SkillRoot`]s. Each root
//! is a directory whose *immediate subdirectories* are candidate skills (a
//! subdirectory qualifies when it contains a `SKILL.md`). Roots are either
//! shared (visible to every user) or owned by a single user; discovery never
//! crosses a user boundary.

use std::fs;
use std::path::PathBuf;

use rustra_core::Result;

use crate::skill::{parse_skill_md, Skill, SKILL_FILE};

/// Who may see the skills under a root.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LibraryScope {
    /// Visible only to the named user.
    User(String),
    /// Visible to every user.
    Shared,
}

impl LibraryScope {
    /// Whether a request scoped to `user_id` may see resources in this scope.
    pub fn allows(&self, user_id: &str) -> bool {
        match self {
            LibraryScope::User(owner) => owner == user_id,
            LibraryScope::Shared => true,
        }
    }
}

/// A directory whose immediate subdirectories are skills.
#[derive(Debug, Clone)]
pub struct SkillRoot {
    pub path: PathBuf,
    pub scope: LibraryScope,
}

impl SkillRoot {
    pub fn user(path: impl Into<PathBuf>, user_id: impl Into<String>) -> Self {
        Self { path: path.into(), scope: LibraryScope::User(user_id.into()) }
    }

    pub fn shared(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into(), scope: LibraryScope::Shared }
    }
}

/// A set of skill roots with per-user scoping, discovery, lookup, and lexical
/// search. Purely filesystem-based: skills stay greppable and bash-editable.
#[derive(Debug, Clone, Default)]
pub struct SkillLibrary {
    roots: Vec<SkillRoot>,
}

impl SkillLibrary {
    pub fn new(roots: Vec<SkillRoot>) -> Self {
        Self { roots }
    }

    /// Append a root (builder-style).
    pub fn with_root(mut self, root: SkillRoot) -> Self {
        self.roots.push(root);
        self
    }

    pub fn roots(&self) -> &[SkillRoot] {
        &self.roots
    }

    /// Discover every skill visible to `user_id`: user roots only when owned
    /// by that user, shared roots for everyone. Subdirectories that fail to
    /// parse or validate are skipped with a `tracing` warning so one broken
    /// skill cannot hide the rest.
    pub fn discover(&self, user_id: &str) -> Result<Vec<Skill>> {
        let mut skills = Vec::new();
        for root in self.roots.iter().filter(|r| r.scope.allows(user_id)) {
            if !root.path.is_dir() {
                tracing::warn!(root = %root.path.display(), "skill root does not exist; skipping");
                continue;
            }
            let mut subdirs: Vec<PathBuf> = match fs::read_dir(&root.path) {
                Ok(entries) => entries
                    .filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .filter(|p| p.is_dir())
                    .collect(),
                Err(err) => {
                    tracing::warn!(root = %root.path.display(), error = %err, "cannot read skill root; skipping");
                    continue;
                }
            };
            subdirs.sort();
            for dir in subdirs {
                let manifest = dir.join(SKILL_FILE);
                if !manifest.is_file() {
                    continue;
                }
                let content = match fs::read_to_string(&manifest) {
                    Ok(content) => content,
                    Err(err) => {
                        tracing::warn!(skill_dir = %dir.display(), error = %err, "cannot read SKILL.md; skipping");
                        continue;
                    }
                };
                match parse_skill_md(&content, &dir) {
                    Ok(skill) => skills.push(skill),
                    Err(err) => {
                        tracing::warn!(skill_dir = %dir.display(), error = %err, "invalid skill; skipping");
                    }
                }
            }
        }
        Ok(skills)
    }

    /// Find the skill named `name` visible to `user_id` (first match in root
    /// order).
    pub fn find(&self, user_id: &str, name: &str) -> Result<Option<Skill>> {
        Ok(self.discover(user_id)?.into_iter().find(|s| s.name == name))
    }

    /// Rank visible skills against a free-text query. The score is the
    /// skill's [`TriggerCondition`](rustra_core::TriggerCondition) score plus
    /// substring bonuses on name and description, clamped to `[0, 1]`. Only
    /// skills with a positive score are returned, best first.
    pub fn search(&self, user_id: &str, query: &str) -> Result<Vec<(Skill, f32)>> {
        let needle = query.trim().to_lowercase();
        let mut results: Vec<(Skill, f32)> = self
            .discover(user_id)?
            .into_iter()
            .filter_map(|skill| {
                let mut score = skill.trigger().score(query);
                if !needle.is_empty() {
                    if skill.name.to_lowercase().contains(&needle) {
                        score += 0.5;
                    }
                    if skill.description.to_lowercase().contains(&needle) {
                        score += 0.25;
                    }
                }
                let score = score.min(1.0);
                (score > 0.0).then_some((skill, score))
            })
            .collect();
        results.sort_by(|a, b| {
            b.1.partial_cmp(&a.1)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.0.name.cmp(&b.0.name))
        });
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    pub(crate) fn write_skill(root: &Path, name: &str, description: &str, keywords: &[&str]) {
        let dir = root.join(name);
        std::fs::create_dir_all(&dir).expect("mkdir");
        let keywords_yaml = if keywords.is_empty() {
            "[]".to_string()
        } else {
            format!("[{}]", keywords.join(", "))
        };
        let content = format!(
            "---\nname: {name}\ndescription: {description}\nkeywords: {keywords_yaml}\n---\n\nInstructions for {name}.\n"
        );
        std::fs::write(dir.join(SKILL_FILE), content).expect("write");
    }

    fn library(tmp: &Path) -> SkillLibrary {
        let alice_root = tmp.join("alice-skills");
        let shared_root = tmp.join("shared-skills");
        write_skill(&alice_root, "alice-private", "Alice's private helper for taxes", &["taxes"]);
        write_skill(&shared_root, "deploy-helper", "Deploys services. Use for deploy questions.", &["deploy", "release"]);
        write_skill(&shared_root, "code-review", "Reviews code changes carefully", &["review"]);
        SkillLibrary::new(vec![
            SkillRoot::user(alice_root, "alice"),
            SkillRoot::shared(shared_root),
        ])
    }

    #[test]
    fn discovery_scopes_by_user() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let lib = library(tmp.path());

        let alice: Vec<String> =
            lib.discover("alice").expect("discover").into_iter().map(|s| s.name).collect();
        assert_eq!(alice, vec!["alice-private", "code-review", "deploy-helper"]);

        let bob: Vec<String> =
            lib.discover("bob").expect("discover").into_iter().map(|s| s.name).collect();
        assert_eq!(bob, vec!["code-review", "deploy-helper"]);

        assert!(lib.find("alice", "alice-private").expect("find").is_some());
        assert!(lib.find("bob", "alice-private").expect("find").is_none());
    }

    #[test]
    fn broken_skills_are_skipped() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let root = tmp.path().join("shared");
        write_skill(&root, "good-skill", "A good skill", &[]);
        let broken = root.join("broken");
        std::fs::create_dir_all(&broken).expect("mkdir");
        std::fs::write(broken.join(SKILL_FILE), "not valid frontmatter").expect("write");

        let lib = SkillLibrary::new(vec![SkillRoot::shared(root)]);
        let names: Vec<String> =
            lib.discover("anyone").expect("discover").into_iter().map(|s| s.name).collect();
        assert_eq!(names, vec!["good-skill"]);
    }

    #[test]
    fn search_ranks_by_relevance() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let lib = library(tmp.path());

        let results = lib.search("bob", "how do I deploy this release?").expect("search");
        assert!(!results.is_empty());
        assert_eq!(results[0].0.name, "deploy-helper");
        assert!(results[0].1 > 0.5);
        assert!(results.iter().all(|(_, score)| *score > 0.0));
        assert!(!results.iter().any(|(s, _)| s.name == "code-review"));

        // Substring match on name works even without keyword hits.
        let by_name = lib.search("bob", "code-review").expect("search");
        assert_eq!(by_name[0].0.name, "code-review");

        // User-scoped results.
        assert!(lib.search("bob", "taxes").expect("search").is_empty());
        assert_eq!(lib.search("alice", "taxes").expect("search")[0].0.name, "alice-private");
    }
}
