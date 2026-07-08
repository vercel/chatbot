//! # rustra-skills
//!
//! Agent Skills for Rustra, following the industry convention popularized by
//! Anthropic's Agent Skills (and mirrored by Mastra's skills packages): a
//! **skill is a directory** containing a `SKILL.md` file whose YAML
//! frontmatter carries metadata (`name`, `description`, optional `keywords`,
//! `metadata`, `allowed-tools`, `validate`) and whose markdown body carries
//! the actual instructions for the agent. The directory may hold any number
//! of supporting files — scripts, templates, reference documents — which are
//! surfaced as relative [`Skill::assets`] paths.
//!
//! Keeping skills as plain files on disk is deliberate: it is what makes them
//! discoverable and editable by ordinary tooling (`grep`, `cat`, a bash
//! session, an agent's own file tools) rather than trapped in a database.
//!
//! The crate follows the *progressive disclosure* model shared by the whole
//! Rustra context system:
//!
//! 1. [`SkillLibrary`] discovers skills from user-scoped and shared roots on
//!    the filesystem, enforcing per-user isolation.
//! 2. [`SkillContextSource`] implements
//!    [`ContextSource`](rustra_core::ContextSource): it cheaply advertises
//!    matching skills (name + description + trigger score) and only loads
//!    full instructions for candidates the assembler selects.
//! 3. [`search_skills_tool`] / [`read_skill_tool`] expose the same library to
//!    the agent as callable tools, so a model can also pull skills on demand.
//!
//! Authoring support is provided by [`scaffold_skill`], which writes a
//! starter `SKILL.md`.

pub mod context_source;
pub mod library;
pub mod skill;
pub mod tools;

pub use context_source::SkillContextSource;
pub use library::{LibraryScope, SkillLibrary, SkillRoot};
pub use skill::{parse_skill_md, scaffold_skill, validate_skill, Skill, SKILL_FILE};
pub use tools::{read_skill_tool, search_skills_tool};
