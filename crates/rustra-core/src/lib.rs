//! # rustra-core
//!
//! Foundational types shared by every Rustra crate. This crate is the Rust
//! analogue of the type layer inside `@mastra/core`: identifiers, errors, the
//! per-request [`RuntimeContext`], the [`Tool`] abstraction,
//! principals/resources for access control, and the [`ContextSource`]
//! trait that powers dynamic context attachment (skills, knowledge, memory,
//! workspace files, user profile, prior runs).
//!
//! Nothing in this crate performs I/O; it defines the contracts everything
//! else implements.

pub mod context;
pub mod error;
pub mod event;
pub mod id;
pub mod principal;
pub mod resource;
pub mod runtime_context;
pub mod tool;

pub use context::{
    ContextCandidate, ContextFragment, ContextKind, ContextRequest, ContextSource,
    SharedContextSource, TriggerCondition,
};
pub use error::{Error, Result};
pub use event::Event;
pub use id::new_id;
pub use principal::{Principal, Role};
pub use resource::{Action, ResourceKind, ResourceRef, Visibility};
pub use runtime_context::{RequestContext, RuntimeContext};
pub use tool::{FunctionTool, SharedTool, Tool, ToolContext, ToolSpec};
