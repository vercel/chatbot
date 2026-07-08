//! # rustra-storage
//!
//! Storage contracts for the whole framework, mirroring Mastra's composite
//! store: one logical `Storage` made of per-domain stores that concrete
//! backends (SQLite by default; Postgres and Firebase as alternatives)
//! implement.
//!
//! Domains:
//!
//! * [`MemoryStore`] — threads, messages, resources (working memory). The
//!   Mastra `memory` domain.
//! * [`WorkflowStore`] — workflow run snapshots for suspend/resume. The
//!   Mastra `workflows` domain.
//! * [`ObservabilityStore`] — runs, trace spans, logs. The Mastra
//!   `observability` domain.
//! * [`TaskStore`] — tasks, schedules, event subscriptions, pending HITL
//!   decisions (Rustra extension: Mastra keeps schedules inside the Mastra
//!   class; Rustra persists the full task runtime).
//! * [`DefinitionStore`] — versioned user-created artifacts (agents, skills,
//!   flows, knowledge collections).
//! * [`AclStore`] — users, role assignments, and explicit sharing grants.
//! * [`InfraStore`] — workspace metadata, MCP server configs, generative UI
//!   artifacts, channel messages.
//!
//! Vector search lives behind the separate [`VectorStore`] trait (Mastra
//! keeps vectors separate from storage too), with [`InMemoryVectorStore`] as
//! the reference implementation.
//!
//! [`InMemoryStorage`] implements everything and is the hermetic test/dev
//! backend.

pub mod in_memory;
pub mod types;
pub mod vector;

mod traits;

pub use in_memory::InMemoryStorage;
pub use traits::{
    AclStore, DefinitionStore, InfraStore, MemoryStore, ObservabilityStore, Storage, TaskStore,
    WorkflowStore,
};
pub use vector::{Embedder, InMemoryVectorStore, MockEmbedder, VectorHit, VectorStore};

use std::sync::Arc;

/// Shared handle to a storage backend.
pub type SharedStorage = Arc<dyn Storage>;

/// Shared handle to a vector store.
pub type SharedVectorStore = Arc<dyn VectorStore>;

/// Limit/offset pagination used by every list operation.
#[derive(Debug, Clone, Copy)]
pub struct Page {
    pub limit: usize,
    pub offset: usize,
}

impl Default for Page {
    fn default() -> Self {
        Self { limit: 100, offset: 0 }
    }
}

impl Page {
    pub fn new(limit: usize, offset: usize) -> Self {
        Self { limit, offset }
    }

    pub fn first(limit: usize) -> Self {
        Self { limit, offset: 0 }
    }
}
