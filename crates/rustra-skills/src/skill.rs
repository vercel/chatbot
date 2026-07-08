//! The [`Skill`] type and the `SKILL.md` parsing/validation/authoring
//! primitives.
//!
//! A `SKILL.md` file looks like:
//!
//! ```markdown
//! ---
//! name: deploy-helper
//! description: Helps deploy services. Use when the user asks about deploys.
//! keywords: [deploy, release]
//! allowed-tools: [bash]
//! metadata:
//!   author: platform-team
//! validate:
//!   - shellcheck scripts/deploy.sh
//! ---
//!
//! # Deploy helper
//!
//! Step-by-step instructions for the agent...
//! ```

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use rustra_core::{Error, Result, TriggerCondition};

/// The canonical manifest filename inside a skill directory.
pub const SKILL_FILE: &str = "SKILL.md";

/// Maximum length of a skill name (per the Agent Skills convention).
pub const MAX_NAME_LEN: usize = 64;

/// Maximum length of a skill description (per the Agent Skills convention).
pub const MAX_DESCRIPTION_LEN: usize = 1024;

/// A parsed skill: the frontmatter metadata, the markdown instruction body,
/// and the supporting files found next to `SKILL.md`.
#[derive(Debug, Clone, Serialize)]
pub struct Skill {
    /// Kebab-case identifier (`[a-z0-9-]{1,64}`).
    pub name: String,
    /// What the skill does and when to use it (trigger guidance included).
    pub description: String,
    /// Keywords used for trigger matching.
    pub keywords: Vec<String>,
    /// Free-form author metadata from the frontmatter `metadata` map.
    pub metadata: serde_json::Map<String, serde_json::Value>,
    /// Tools the skill declares it needs (`allowed-tools` frontmatter).
    pub allowed_tools: Vec<String>,
    /// Declared validation commands (`validate` frontmatter). Parsed and
    /// exposed only — never executed by this crate.
    pub validate: Vec<String>,
    /// The skill directory on disk.
    pub dir: PathBuf,
    /// Supporting files (scripts, assets, references), relative to [`dir`],
    /// excluding `SKILL.md` itself.
    ///
    /// [`dir`]: Skill::dir
    pub assets: Vec<PathBuf>,
    /// The markdown body of `SKILL.md`: the instructions given to the agent.
    pub instructions: String,
}

impl Skill {
    /// The trigger condition used to match this skill against a request:
    /// frontmatter keywords plus the words of the skill name.
    pub fn trigger(&self) -> TriggerCondition {
        let mut keywords: Vec<String> = self.keywords.clone();
        for word in self.name.split('-').filter(|w| !w.is_empty()) {
            if !keywords.iter().any(|k| k.eq_ignore_ascii_case(word)) {
                keywords.push(word.to_string());
            }
        }
        TriggerCondition { keywords, ..Default::default() }
    }
}

/// The raw YAML frontmatter shape of a `SKILL.md`.
#[derive(Debug, Deserialize)]
struct Frontmatter {
    name: String,
    description: String,
    #[serde(default)]
    keywords: Vec<String>,
    #[serde(default)]
    metadata: serde_json::Map<String, serde_json::Value>,
    #[serde(default, rename = "allowed-tools")]
    allowed_tools: Vec<String>,
    #[serde(default)]
    validate: Vec<String>,
}

/// Split a markdown document into its YAML frontmatter and body.
///
/// The document must start with a `---` line; the frontmatter runs until the
/// next `---` line.
fn split_frontmatter(content: &str) -> Result<(&str, &str)> {
    let first_line_end = content.find('\n').unwrap_or(content.len());
    if content[..first_line_end].trim_end_matches('\r').trim() != "---" {
        return Err(Error::Validation(format!(
            "{SKILL_FILE} must begin with a `---` YAML frontmatter block"
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
        "{SKILL_FILE} frontmatter is not terminated by a closing `---` line"
    )))
}

/// Recursively collect the relative paths of every file under `dir` except
/// the top-level `SKILL.md`. Unreadable entries are skipped with a warning.
pub(crate) fn collect_extra_files(dir: &Path, manifest_name: &str) -> Vec<PathBuf> {
    fn walk(base: &Path, current: &Path, manifest_name: &str, out: &mut Vec<PathBuf>) {
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
                walk(base, &path, manifest_name, out);
            } else if let Ok(rel) = path.strip_prefix(base) {
                if rel == Path::new(manifest_name) {
                    continue;
                }
                out.push(rel.to_path_buf());
            }
        }
    }

    let mut out = Vec::new();
    if dir.is_dir() {
        walk(dir, dir, manifest_name, &mut out);
    }
    out.sort();
    out
}

/// Parse the content of a `SKILL.md` file belonging to the skill directory
/// `dir`. Supporting files under `dir` are collected as relative
/// [`Skill::assets`]. The parsed skill is validated before being returned.
pub fn parse_skill_md(content: &str, dir: &Path) -> Result<Skill> {
    let (yaml, body) = split_frontmatter(content)?;
    let fm: Frontmatter = serde_yaml::from_str(yaml)
        .map_err(|e| Error::Validation(format!("invalid {SKILL_FILE} frontmatter: {e}")))?;

    let skill = Skill {
        name: fm.name,
        description: fm.description,
        keywords: fm.keywords,
        metadata: fm.metadata,
        allowed_tools: fm.allowed_tools,
        validate: fm.validate,
        dir: dir.to_path_buf(),
        assets: collect_extra_files(dir, SKILL_FILE),
        instructions: body.trim().to_string(),
    };
    validate_skill(&skill)?;
    Ok(skill)
}

/// Check that `name` is valid kebab-case per the convention:
/// `[a-z0-9-]{1,64}`.
pub(crate) fn is_valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_NAME_LEN
        && name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Validate a parsed skill against the Agent Skills convention: kebab-case
/// name, bounded description, non-empty instructions.
pub fn validate_skill(skill: &Skill) -> Result<()> {
    if !is_valid_name(&skill.name) {
        return Err(Error::Validation(format!(
            "skill name `{}` is invalid: must match [a-z0-9-]{{1,{MAX_NAME_LEN}}} (lowercase kebab-case)",
            skill.name
        )));
    }
    if skill.description.trim().is_empty() {
        return Err(Error::Validation(format!(
            "skill `{}` has an empty description; describe what it does and when to use it",
            skill.name
        )));
    }
    if skill.description.len() > MAX_DESCRIPTION_LEN {
        return Err(Error::Validation(format!(
            "skill `{}` description is {} chars; maximum is {MAX_DESCRIPTION_LEN}",
            skill.name,
            skill.description.len()
        )));
    }
    if skill.instructions.trim().is_empty() {
        return Err(Error::Validation(format!(
            "skill `{}` has no instructions: the {SKILL_FILE} body must not be empty",
            skill.name
        )));
    }
    Ok(())
}

/// Write a starter `SKILL.md` into `dir` (creating the directory if needed).
/// Fails if the directory already contains a `SKILL.md`, or if `name` /
/// `description` would not validate.
pub fn scaffold_skill(dir: &Path, name: &str, description: &str) -> Result<()> {
    if !is_valid_name(name) {
        return Err(Error::Validation(format!(
            "skill name `{name}` is invalid: must match [a-z0-9-]{{1,{MAX_NAME_LEN}}} (lowercase kebab-case)"
        )));
    }
    if description.trim().is_empty() || description.len() > MAX_DESCRIPTION_LEN {
        return Err(Error::Validation(format!(
            "skill description must be non-empty and at most {MAX_DESCRIPTION_LEN} chars"
        )));
    }
    let manifest = dir.join(SKILL_FILE);
    if manifest.exists() {
        return Err(Error::Validation(format!(
            "refusing to scaffold: {} already exists",
            manifest.display()
        )));
    }
    fs::create_dir_all(dir)?;

    // Serialize the description through serde_yaml so special characters
    // (colons, quotes) stay valid YAML.
    let description_yaml = serde_yaml::to_string(description)
        .map_err(|e| Error::Validation(format!("description is not YAML-serializable: {e}")))?;
    let content = format!(
        "---\n\
         name: {name}\n\
         description: {}\n\
         keywords: []\n\
         ---\n\
         \n\
         # {name}\n\
         \n\
         Replace this body with step-by-step instructions for the agent.\n\
         \n\
         - Explain when this skill applies.\n\
         - Reference supporting files in this directory by relative path.\n",
        description_yaml.trim_end(),
    );
    fs::write(&manifest, content)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "---\n\
name: deploy-helper\n\
description: Helps deploy services safely. Use when the user asks about deployments or releases.\n\
keywords:\n  - deploy\n  - release\n\
allowed-tools:\n  - bash\n\
metadata:\n  author: platform\n\
validate:\n  - shellcheck scripts/deploy.sh\n\
---\n\
\n# Deploy helper\n\nRun the deploy script and watch the logs.\n";

    #[test]
    fn parse_and_validate_roundtrip() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let dir = tmp.path().join("deploy-helper");
        std::fs::create_dir_all(dir.join("scripts")).expect("mkdir");
        std::fs::write(dir.join(SKILL_FILE), SAMPLE).expect("write manifest");
        std::fs::write(dir.join("scripts/deploy.sh"), "#!/bin/sh\n").expect("write asset");

        let skill = parse_skill_md(SAMPLE, &dir).expect("parse");
        assert_eq!(skill.name, "deploy-helper");
        assert!(skill.description.contains("deployments"));
        assert_eq!(skill.keywords, vec!["deploy", "release"]);
        assert_eq!(skill.allowed_tools, vec!["bash"]);
        assert_eq!(skill.validate, vec!["shellcheck scripts/deploy.sh"]);
        assert_eq!(skill.metadata.get("author").and_then(|v| v.as_str()), Some("platform"));
        assert_eq!(skill.assets, vec![PathBuf::from("scripts/deploy.sh")]);
        assert!(skill.instructions.starts_with("# Deploy helper"));
        validate_skill(&skill).expect("valid");

        // Trigger merges keywords with name words.
        let trigger = skill.trigger();
        assert!(trigger.keywords.iter().any(|k| k == "helper"));
        assert!(trigger.score("how do I deploy this?") > 0.0);
        assert_eq!(trigger.score("unrelated question"), 0.0);
    }

    #[test]
    fn rejects_bad_frontmatter_and_names() {
        let dir = Path::new("/nonexistent");
        assert!(matches!(
            parse_skill_md("no frontmatter at all", dir),
            Err(Error::Validation(_))
        ));
        assert!(matches!(
            parse_skill_md("---\nname: x\n", dir),
            Err(Error::Validation(_))
        ));
        let bad_name = SAMPLE.replace("name: deploy-helper", "name: Deploy Helper");
        assert!(matches!(parse_skill_md(&bad_name, dir), Err(Error::Validation(_))));
        let empty_body = "---\nname: a\ndescription: b\n---\n\n";
        assert!(matches!(parse_skill_md(empty_body, dir), Err(Error::Validation(_))));
    }

    #[test]
    fn scaffold_produces_parseable_skill() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let dir = tmp.path().join("my-skill");
        scaffold_skill(&dir, "my-skill", "Does things: use for testing").expect("scaffold");
        let content = std::fs::read_to_string(dir.join(SKILL_FILE)).expect("read");
        let skill = parse_skill_md(&content, &dir).expect("parse scaffolded");
        assert_eq!(skill.name, "my-skill");
        // Refuses to overwrite.
        assert!(scaffold_skill(&dir, "my-skill", "again").is_err());
        // Rejects invalid names.
        assert!(scaffold_skill(&tmp.path().join("x"), "Bad Name", "desc").is_err());
    }
}
