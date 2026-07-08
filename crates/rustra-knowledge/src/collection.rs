//! The [`KnowledgeCollection`] type and `KNOWLEDGE.md`
//! parsing/validation/authoring primitives.
//!
//! A `KNOWLEDGE.md` file looks like:
//!
//! ```markdown
//! ---
//! name: billing-faq
//! description: Answers to billing questions. Use for invoices and refunds.
//! keywords: [billing, invoice, refund]
//! metadata:
//!   owner: support-team
//! ---
//!
//! Short overview of what this collection covers.
//! ```
//!
//! Every other `.md` / `.txt` file in the directory is a document of the
//! collection.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use rustra_core::{Error, Result, TriggerCondition};

/// The canonical manifest filename inside a collection directory.
pub const KNOWLEDGE_FILE: &str = "KNOWLEDGE.md";

/// Maximum length of a collection name (mirrors the Agent Skills convention).
pub const MAX_NAME_LEN: usize = 64;

/// Maximum length of a collection description.
pub const MAX_DESCRIPTION_LEN: usize = 1024;

/// A parsed knowledge collection: manifest metadata, overview text, and the
/// document files found next to `KNOWLEDGE.md`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct KnowledgeCollection {
    /// Kebab-case identifier (`[a-z0-9-]{1,64}`).
    pub name: String,
    /// What the collection covers and when it is relevant.
    pub description: String,
    /// Keywords used for trigger matching.
    pub keywords: Vec<String>,
    /// Free-form author metadata from the frontmatter `metadata` map.
    pub metadata: serde_json::Map<String, serde_json::Value>,
    /// The markdown body of `KNOWLEDGE.md`: a short overview of the
    /// collection.
    pub overview: String,
    /// The collection directory on disk.
    pub dir: PathBuf,
    /// `.md` / `.txt` document files, relative to [`dir`], excluding
    /// `KNOWLEDGE.md` itself. The documents *are* the knowledge.
    ///
    /// [`dir`]: KnowledgeCollection::dir
    pub documents: Vec<PathBuf>,
}

impl KnowledgeCollection {
    /// The trigger condition used to match this collection against a
    /// request: frontmatter keywords plus the words of the collection name.
    pub fn trigger(&self) -> TriggerCondition {
        let mut keywords: Vec<String> = self.keywords.clone();
        for word in self.name.split('-').filter(|w| !w.is_empty()) {
            if !keywords.iter().any(|k| k.eq_ignore_ascii_case(word)) {
                keywords.push(word.to_string());
            }
        }
        TriggerCondition {
            keywords,
            ..Default::default()
        }
    }

    /// Read one document by its relative path. The path must be one of
    /// [`documents`](KnowledgeCollection::documents) — arbitrary paths are
    /// rejected so callers cannot escape the collection directory.
    pub fn read_document(&self, relative: &Path) -> Result<String> {
        if !self.documents.iter().any(|d| d == relative) {
            return Err(Error::not_found(
                "knowledge document",
                relative.display().to_string(),
            ));
        }
        Ok(fs::read_to_string(self.dir.join(relative))?)
    }

    /// The overview followed by every document, each introduced by a header
    /// naming its relative path. Documents that fail to read are skipped
    /// with a warning rather than failing the whole collection.
    pub fn full_text(&self) -> String {
        use std::fmt::Write as _;
        let mut content = self.overview.clone();
        for doc in &self.documents {
            match fs::read_to_string(self.dir.join(doc)) {
                Ok(text) => {
                    let _ = write!(
                        content,
                        "\n\n--- document: {} ---\n{}",
                        doc.display(),
                        text.trim_end()
                    );
                }
                Err(err) => {
                    tracing::warn!(
                        collection = %self.name,
                        document = %doc.display(),
                        error = %err,
                        "skipping unreadable knowledge document"
                    );
                }
            }
        }
        content
    }

    /// Cheap size estimate: overview length plus on-disk document sizes. The
    /// `fs::metadata`-based counterpart of [`full_text`](Self::full_text),
    /// used to size candidates without materializing them.
    pub fn estimated_chars(&self) -> usize {
        let docs: u64 = self
            .documents
            .iter()
            .filter_map(|doc| fs::metadata(self.dir.join(doc)).ok())
            .map(|m| m.len())
            .sum();
        self.overview
            .len()
            .saturating_add(usize::try_from(docs).unwrap_or(usize::MAX))
    }
}

/// The raw YAML frontmatter shape of a `KNOWLEDGE.md`.
#[derive(Debug, Deserialize)]
struct Frontmatter {
    name: String,
    description: String,
    #[serde(default)]
    keywords: Vec<String>,
    #[serde(default)]
    metadata: serde_json::Map<String, serde_json::Value>,
}

/// Split a markdown document into its YAML frontmatter and body.
fn split_frontmatter(content: &str) -> Result<(&str, &str)> {
    let first_line_end = content.find('\n').unwrap_or(content.len());
    if content[..first_line_end].trim_end_matches('\r').trim() != "---" {
        return Err(Error::Validation(format!(
            "{KNOWLEDGE_FILE} must begin with a `---` YAML frontmatter block"
        )));
    }
    let after_open = &content[first_line_end..];
    let after_open = after_open.strip_prefix('\n').unwrap_or(after_open);

    let mut offset = 0usize;
    for line in after_open.split_inclusive('\n') {
        if line.trim_end_matches(['\n', '\r']).trim() == "---" {
            let yaml = &after_open[..offset];
            let body = &after_open[offset + line.len()..];
            return Ok((yaml, body));
        }
        offset += line.len();
    }
    Err(Error::Validation(format!(
        "{KNOWLEDGE_FILE} frontmatter is not terminated by a closing `---` line"
    )))
}

fn is_document_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("md") || e.eq_ignore_ascii_case("txt"))
}

/// Recursively collect the relative paths of every `.md` / `.txt` file under
/// `dir` except the top-level `KNOWLEDGE.md`. Unreadable entries are skipped
/// with a warning.
fn collect_documents(dir: &Path) -> Vec<PathBuf> {
    fn walk(base: &Path, current: &Path, out: &mut Vec<PathBuf>) {
        let entries = match fs::read_dir(current) {
            Ok(entries) => entries,
            Err(err) => {
                tracing::warn!(dir = %current.display(), error = %err, "skipping unreadable directory");
                return;
            }
        };
        for entry in entries {
            let entry = match entry {
                Ok(entry) => entry,
                Err(err) => {
                    tracing::warn!(dir = %current.display(), error = %err, "skipping unreadable entry");
                    continue;
                }
            };
            let path = entry.path();
            if path.is_dir() {
                walk(base, &path, out);
            } else if is_document_file(&path) {
                if let Ok(rel) = path.strip_prefix(base) {
                    if rel == Path::new(KNOWLEDGE_FILE) {
                        continue;
                    }
                    out.push(rel.to_path_buf());
                }
            }
        }
    }

    let mut out = Vec::new();
    if dir.is_dir() {
        walk(dir, dir, &mut out);
    }
    out.sort();
    out
}

/// Parse the content of a `KNOWLEDGE.md` file belonging to the collection
/// directory `dir`. Document files under `dir` are collected as relative
/// [`KnowledgeCollection::documents`]. The parsed collection is validated
/// before being returned.
pub fn parse_knowledge_md(content: &str, dir: &Path) -> Result<KnowledgeCollection> {
    let (yaml, body) = split_frontmatter(content)?;
    let fm: Frontmatter = serde_yaml::from_str(yaml)
        .map_err(|e| Error::Validation(format!("invalid {KNOWLEDGE_FILE} frontmatter: {e}")))?;

    let collection = KnowledgeCollection {
        name: fm.name,
        description: fm.description,
        keywords: fm.keywords,
        metadata: fm.metadata,
        overview: body.trim().to_string(),
        dir: dir.to_path_buf(),
        documents: collect_documents(dir),
    };
    validate_collection(&collection)?;
    Ok(collection)
}

/// Check that `name` is valid kebab-case: `[a-z0-9-]{1,64}`.
fn is_valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_NAME_LEN
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Validate a collection name against the kebab-case convention. Single
/// source of truth shared by [`validate_collection`] and
/// [`scaffold_collection`].
fn validate_name(name: &str) -> Result<()> {
    if !is_valid_name(name) {
        return Err(Error::Validation(format!(
            "collection name `{name}` is invalid: must match [a-z0-9-]{{1,{MAX_NAME_LEN}}} (lowercase kebab-case)"
        )));
    }
    Ok(())
}

/// Validate a collection description (non-empty, bounded length). Single
/// source of truth shared by [`validate_collection`] and
/// [`scaffold_collection`].
fn validate_description(name: &str, description: &str) -> Result<()> {
    if description.trim().is_empty() {
        return Err(Error::Validation(format!(
            "collection `{name}` has an empty description; describe what it covers and when it is relevant"
        )));
    }
    if description.len() > MAX_DESCRIPTION_LEN {
        return Err(Error::Validation(format!(
            "collection `{name}` description is {} chars; maximum is {MAX_DESCRIPTION_LEN}",
            description.len()
        )));
    }
    Ok(())
}

/// Validate a parsed collection: kebab-case name, bounded description, and
/// some actual knowledge (a non-empty overview or at least one document).
pub fn validate_collection(collection: &KnowledgeCollection) -> Result<()> {
    validate_name(&collection.name)?;
    validate_description(&collection.name, &collection.description)?;
    if collection.overview.trim().is_empty() && collection.documents.is_empty() {
        return Err(Error::Validation(format!(
            "collection `{}` is empty: provide an overview in {KNOWLEDGE_FILE} or at least one .md/.txt document",
            collection.name
        )));
    }
    Ok(())
}

/// Write a starter `KNOWLEDGE.md` into `dir` (creating the directory if
/// needed). Fails if the directory already contains a `KNOWLEDGE.md`, or if
/// `name` / `description` would not validate.
pub fn scaffold_collection(dir: &Path, name: &str, description: &str) -> Result<()> {
    validate_name(name)?;
    validate_description(name, description)?;
    fs::create_dir_all(dir)?;
    let manifest = dir.join(KNOWLEDGE_FILE);

    let description_yaml = serde_yaml::to_string(description)
        .map_err(|e| Error::Validation(format!("description is not YAML-serializable: {e}")))?;
    let content = format!(
        "---\n\
         name: {name}\n\
         description: {}\n\
         keywords: []\n\
         ---\n\
         \n\
         Replace this overview with a short summary of what this collection covers.\n\
         \n\
         Add `.md` or `.txt` document files next to this manifest; they are the knowledge.\n",
        description_yaml.trim_end(),
    );
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&manifest)
        .map_err(|err| {
            if err.kind() == std::io::ErrorKind::AlreadyExists {
                Error::Validation(format!(
                    "refusing to scaffold: {} already exists",
                    manifest.display()
                ))
            } else {
                Error::from(err)
            }
        })?;
    std::io::Write::write_all(&mut file, content.as_bytes())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "---\n\
name: billing-faq\n\
description: Answers to billing questions. Use for invoices and refunds.\n\
keywords:\n  - billing\n  - invoice\n\
metadata:\n  owner: support\n\
---\n\
\nCovers billing, invoices, and refunds.\n";

    #[test]
    fn parse_and_validate_roundtrip() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let dir = tmp.path().join("billing-faq");
        std::fs::create_dir_all(dir.join("sub")).expect("mkdir");
        std::fs::write(dir.join(KNOWLEDGE_FILE), SAMPLE).expect("write manifest");
        std::fs::write(dir.join("refunds.md"), "# Refunds\nWithin 30 days.\n").expect("write doc");
        std::fs::write(dir.join("sub/plans.txt"), "Pro plan: $10/mo\n").expect("write doc");
        std::fs::write(dir.join("script.sh"), "echo not-a-document\n").expect("write non-doc");

        let collection = parse_knowledge_md(SAMPLE, &dir).expect("parse");
        assert_eq!(collection.name, "billing-faq");
        assert_eq!(collection.keywords, vec!["billing", "invoice"]);
        assert_eq!(
            collection.metadata.get("owner").and_then(|v| v.as_str()),
            Some("support")
        );
        assert_eq!(
            collection.overview,
            "Covers billing, invoices, and refunds."
        );
        assert_eq!(
            collection.documents,
            vec![PathBuf::from("refunds.md"), PathBuf::from("sub/plans.txt")]
        );
        validate_collection(&collection).expect("valid");

        let trigger = collection.trigger();
        assert!(trigger.keywords.iter().any(|k| k == "faq"));
        assert!(trigger.score("where is my invoice?") > 0.0);

        // Document access is confined to listed documents.
        assert!(collection
            .read_document(Path::new("refunds.md"))
            .expect("read")
            .contains("30 days"));
        assert!(collection
            .read_document(Path::new("../outside.md"))
            .is_err());

        let full = collection.full_text();
        assert!(full.starts_with("Covers billing"));
        assert!(full.contains("--- document: refunds.md ---"));
        assert!(full.contains("Pro plan"));
    }

    #[test]
    fn rejects_invalid_collections() {
        let dir = Path::new("/nonexistent");
        assert!(matches!(
            parse_knowledge_md("no frontmatter", dir),
            Err(Error::Validation(_))
        ));
        let bad_name = SAMPLE.replace("name: billing-faq", "name: Billing FAQ");
        assert!(matches!(
            parse_knowledge_md(&bad_name, dir),
            Err(Error::Validation(_))
        ));
        // Empty overview with no documents is rejected.
        let empty = "---\nname: empty-one\ndescription: d\n---\n\n";
        assert!(matches!(
            parse_knowledge_md(empty, dir),
            Err(Error::Validation(_))
        ));
    }

    #[test]
    fn scaffold_produces_parseable_collection() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let dir = tmp.path().join("my-notes");
        scaffold_collection(&dir, "my-notes", "Reference notes: for testing").expect("scaffold");
        let content = std::fs::read_to_string(dir.join(KNOWLEDGE_FILE)).expect("read");
        let collection = parse_knowledge_md(&content, &dir).expect("parse scaffolded");
        assert_eq!(collection.name, "my-notes");
        assert!(scaffold_collection(&dir, "my-notes", "again").is_err());
        assert!(scaffold_collection(&tmp.path().join("x"), "Bad Name", "desc").is_err());
    }
}
