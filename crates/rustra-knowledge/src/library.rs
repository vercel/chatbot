//! Filesystem discovery of knowledge collections across user-scoped and
//! shared roots — the mirror image of `rustra-skills`' `SkillLibrary`.
//!
//! A [`KnowledgeLibrary`] is configured with [`KnowledgeRoot`]s. Each root is
//! a directory whose *immediate subdirectories* are candidate collections (a
//! subdirectory qualifies when it contains a `KNOWLEDGE.md`). Roots are
//! either shared or owned by a single user; discovery never crosses a user
//! boundary.

use std::fs;
use std::path::{Path, PathBuf};

use rustra_core::Result;

use crate::collection::{parse_knowledge_md, KnowledgeCollection, KNOWLEDGE_FILE};

/// Who may see the collections under a root.
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

/// A directory whose immediate subdirectories are knowledge collections.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KnowledgeRoot {
    /// Directory whose immediate subdirectories are candidate collections.
    pub path: PathBuf,
    /// Who may see the collections under this root.
    pub scope: LibraryScope,
}

impl KnowledgeRoot {
    /// A root owned by, and visible only to, `user_id`.
    pub fn user(path: impl Into<PathBuf>, user_id: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            scope: LibraryScope::User(user_id.into()),
        }
    }

    /// A root visible to every user.
    pub fn shared(path: impl Into<PathBuf>) -> Self {
        Self {
            path: path.into(),
            scope: LibraryScope::Shared,
        }
    }
}

/// A set of knowledge roots with per-user scoping, discovery, lookup, and
/// lexical search. Purely filesystem-based: collections stay greppable and
/// editable with ordinary tools.
#[derive(Debug, Clone, Default)]
pub struct KnowledgeLibrary {
    roots: Vec<KnowledgeRoot>,
}

impl KnowledgeLibrary {
    /// Create a library over the given roots.
    pub fn new(roots: Vec<KnowledgeRoot>) -> Self {
        Self { roots }
    }

    /// Append a root (builder-style).
    pub fn with_root(mut self, root: KnowledgeRoot) -> Self {
        self.roots.push(root);
        self
    }

    /// The configured roots, in discovery order.
    pub fn roots(&self) -> &[KnowledgeRoot] {
        &self.roots
    }

    /// Discover every collection visible to `user_id`: user roots only when
    /// owned by that user, shared roots for everyone. Subdirectories that
    /// fail to parse or validate are skipped with a `tracing` warning.
    pub fn discover(&self, user_id: &str) -> Result<Vec<KnowledgeCollection>> {
        let mut collections = Vec::new();
        for root in self.roots.iter().filter(|r| r.scope.allows(user_id)) {
            if !root.path.is_dir() {
                tracing::warn!(root = %root.path.display(), "knowledge root does not exist; skipping");
                continue;
            }
            let mut subdirs: Vec<PathBuf> = match fs::read_dir(&root.path) {
                Ok(entries) => entries
                    .filter_map(|e| match e {
                        Ok(e) => Some(e),
                        Err(err) => {
                            tracing::warn!(root = %root.path.display(), error = %err, "skipping unreadable entry in knowledge root");
                            None
                        }
                    })
                    .map(|e| e.path())
                    .filter(|p| p.is_dir())
                    .collect(),
                Err(err) => {
                    tracing::warn!(root = %root.path.display(), error = %err, "cannot read knowledge root; skipping");
                    continue;
                }
            };
            subdirs.sort();
            collections.extend(subdirs.iter().filter_map(|dir| load_collection_dir(dir)));
        }
        Ok(collections)
    }

    /// Find the collection named `name` visible to `user_id` (first match in
    /// root order).
    pub fn find(&self, user_id: &str, name: &str) -> Result<Option<KnowledgeCollection>> {
        Ok(self.discover(user_id)?.into_iter().find(|c| c.name == name))
    }

    /// Rank visible collections against a free-text query. The score is the
    /// collection's [`TriggerCondition`](rustra_core::TriggerCondition) score
    /// plus substring bonuses on name and description, clamped to `[0, 1]`.
    /// Only collections with a positive score are returned, best first.
    pub fn search(&self, user_id: &str, query: &str) -> Result<Vec<(KnowledgeCollection, f32)>> {
        let needle = query.trim().to_lowercase();
        let mut results: Vec<(KnowledgeCollection, f32)> = self
            .discover(user_id)?
            .into_iter()
            .filter_map(|collection| {
                let mut score = collection.trigger().score(query);
                if !needle.is_empty() {
                    if collection.name.to_lowercase().contains(&needle) {
                        score += 0.5;
                    }
                    if collection.description.to_lowercase().contains(&needle) {
                        score += 0.25;
                    }
                }
                let score = score.min(1.0);
                (score > 0.0).then_some((collection, score))
            })
            .collect();
        results.sort_by(|a, b| b.1.total_cmp(&a.1).then_with(|| a.0.name.cmp(&b.0.name)));
        Ok(results)
    }
}

/// Load a single collection directory into a [`KnowledgeCollection`], or
/// `None` (with a warning) when the directory has no readable, valid
/// `KNOWLEDGE.md`. This is the seam a future mtime cache slots into.
fn load_collection_dir(dir: &Path) -> Option<KnowledgeCollection> {
    let manifest = dir.join(KNOWLEDGE_FILE);
    if !manifest.is_file() {
        return None;
    }
    let content = match fs::read_to_string(&manifest) {
        Ok(content) => content,
        Err(err) => {
            tracing::warn!(collection_dir = %dir.display(), error = %err, "cannot read KNOWLEDGE.md; skipping");
            return None;
        }
    };
    match parse_knowledge_md(&content, dir) {
        Ok(collection) => Some(collection),
        Err(err) => {
            tracing::warn!(collection_dir = %dir.display(), error = %err, "invalid knowledge collection; skipping");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    fn write_collection(
        root: &Path,
        name: &str,
        description: &str,
        keywords: &[&str],
        documents: &[(&str, &str)],
    ) {
        let dir = root.join(name);
        std::fs::create_dir_all(&dir).expect("mkdir");
        let keywords_yaml = if keywords.is_empty() {
            "[]".to_string()
        } else {
            format!("[{}]", keywords.join(", "))
        };
        let content = format!(
            "---\nname: {name}\ndescription: {description}\nkeywords: {keywords_yaml}\n---\n\nOverview of {name}.\n"
        );
        std::fs::write(dir.join(KNOWLEDGE_FILE), content).expect("write");
        for (file, text) in documents {
            std::fs::write(dir.join(file), text).expect("write doc");
        }
    }

    fn library(tmp: &Path) -> KnowledgeLibrary {
        let alice_root = tmp.join("alice-knowledge");
        let shared_root = tmp.join("shared-knowledge");
        write_collection(
            &alice_root,
            "alice-notes",
            "Alice's private research notes",
            &["research"],
            &[("notes.md", "Private notes.\n")],
        );
        write_collection(
            &shared_root,
            "billing-faq",
            "Billing answers. Use for invoices and refunds.",
            &["billing", "invoice"],
            &[("refunds.md", "Refunds within 30 days.\n")],
        );
        write_collection(
            &shared_root,
            "product-specs",
            "Product specifications",
            &["specs"],
            &[("api.txt", "API details.\n")],
        );
        KnowledgeLibrary::new(vec![
            KnowledgeRoot::user(alice_root, "alice"),
            KnowledgeRoot::shared(shared_root),
        ])
    }

    #[test]
    fn discovery_scopes_by_user() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let lib = library(tmp.path());

        let alice: Vec<String> = lib
            .discover("alice")
            .expect("discover")
            .into_iter()
            .map(|c| c.name)
            .collect();
        assert_eq!(alice, vec!["alice-notes", "billing-faq", "product-specs"]);

        let bob: Vec<String> = lib
            .discover("bob")
            .expect("discover")
            .into_iter()
            .map(|c| c.name)
            .collect();
        assert_eq!(bob, vec!["billing-faq", "product-specs"]);

        assert!(lib.find("alice", "alice-notes").expect("find").is_some());
        assert!(lib.find("bob", "alice-notes").expect("find").is_none());
    }

    #[test]
    fn broken_collections_are_skipped() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let root = tmp.path().join("shared");
        write_collection(&root, "good-one", "A good collection", &[], &[]);
        let broken = root.join("broken");
        std::fs::create_dir_all(&broken).expect("mkdir");
        std::fs::write(broken.join(KNOWLEDGE_FILE), "not valid frontmatter").expect("write");

        let lib = KnowledgeLibrary::new(vec![KnowledgeRoot::shared(root)]);
        let names: Vec<String> = lib
            .discover("anyone")
            .expect("discover")
            .into_iter()
            .map(|c| c.name)
            .collect();
        assert_eq!(names, vec!["good-one"]);
    }

    #[test]
    fn search_ranks_by_relevance() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let lib = library(tmp.path());

        let results = lib
            .search("bob", "where is my invoice for billing?")
            .expect("search");
        assert!(!results.is_empty());
        assert_eq!(results[0].0.name, "billing-faq");
        assert!(results[0].1 > 0.5);
        assert!(!results.iter().any(|(c, _)| c.name == "product-specs"));

        let by_name = lib.search("bob", "product-specs").expect("search");
        assert_eq!(by_name[0].0.name, "product-specs");

        assert!(lib.search("bob", "research").expect("search").is_empty());
        assert_eq!(
            lib.search("alice", "research").expect("search")[0].0.name,
            "alice-notes"
        );
    }
}
