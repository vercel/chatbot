//! # rustra-ui
//!
//! Generative UI artifacts — the backend half of Mastra-style "the agent
//! builds you an interface" workflows. Agents produce small HTML/JS
//! documents (dashboards, forms, visualizations); this crate stores them as
//! versioned [`UiArtifactRecord`]s and prepares them for safe rendering.
//!
//! * [`UiService`] — CRUD + versioning over [`SharedStorage`]
//!   (`create`/`update`/`get`/`list`/`delete`/`set_visibility`). Every
//!   artifact is owner-scoped and defaults to `Visibility::Private`.
//! * [`render_document`] — wraps artifact HTML in a full document with a
//!   strict Content-Security-Policy `<meta>` tag and injects the artifact's
//!   structured data as `window.__RUSTRA_DATA__` before the body content.
//! * [`create_ui_tool`] — the agent-facing tool; artifacts are always
//!   created for the calling principal.
//!
//! ## Sandboxing model
//!
//! [`render_document`] provides defense in depth, **not** the sandbox
//! itself. The CSP meta tag blocks network egress (`default-src 'none'`)
//! while allowing the inline script/style an artifact is made of, but a
//! hostile document could omit-proof nothing at this layer alone. Actual
//! isolation is the serving layer's job (`rustra-server`): deliver artifacts
//! from a separate origin or inside a sandboxed `<iframe
//! sandbox="allow-scripts">`, and repeat the CSP as a response header (meta
//! CSP cannot be tightened by the document but can be bypassed by content
//! injected *before* it — headers cannot).
//!
//! [`UiArtifactRecord`]: rustra_storage::types::UiArtifactRecord
//! [`SharedStorage`]: rustra_storage::SharedStorage

mod render;
mod service;
mod tool;

pub use render::render_document;
pub use service::{UiArtifactUpdate, UiService, MAX_HTML_BYTES, MAX_TITLE_CHARS};
pub use tool::create_ui_tool;
