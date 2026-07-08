//! # rustra-knowledge
//!
//! Knowledge collections for Rustra: the information-only sibling of
//! [`rustra-skills`]. Where a skill carries *task instructions*, a knowledge
//! collection carries *reference information* — domain facts, policies, API
//! notes, product docs — that an agent may attach as context but is never
//! asked to "follow".
//!
//! The convention mirrors the Agent Skills directory layout (Anthropic-style,
//! as adopted by Mastra's context primitives): a **collection is a
//! directory** containing a `KNOWLEDGE.md` manifest whose YAML frontmatter
//! carries `name`, `description`, optional `keywords` and `metadata`, and
//! whose markdown body is a short overview. Any `.md` / `.txt` files in the
//! directory are the collection's documents — the knowledge itself — exposed
//! as relative [`KnowledgeCollection::documents`] paths. Plain files on disk
//! keep collections greppable, diffable, and editable with ordinary tools.
//!
//! The crate follows the same progressive-disclosure model as the rest of the
//! Rustra context system:
//!
//! 1. [`KnowledgeLibrary`] discovers collections from user-scoped and shared
//!    roots, enforcing per-user isolation.
//! 2. [`KnowledgeContextSource`] implements
//!    [`ContextSource`](rustra_core::ContextSource): candidates are cheap
//!    (name + description + trigger score); loading concatenates the overview
//!    and documents, truncated to the request's character budget.
//! 3. [`search_knowledge_tool`] / [`read_knowledge_tool`] let the model pull
//!    a whole collection or a single document on demand.
//!
//! Authoring support is provided by [`scaffold_collection`].

pub mod collection;
pub mod context_source;
pub mod library;
pub mod tools;

pub use collection::{
    parse_knowledge_md, scaffold_collection, validate_collection, KnowledgeCollection,
    KNOWLEDGE_FILE,
};
pub use context_source::KnowledgeContextSource;
pub use library::{KnowledgeLibrary, KnowledgeRoot, LibraryScope};
pub use tools::{read_knowledge_tool, search_knowledge_tool};
