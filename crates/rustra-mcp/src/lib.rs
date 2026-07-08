//! # rustra-mcp
//!
//! Config-only MCP (Model Context Protocol) support, mirroring Mastra's
//! `@mastra/mcp` `MCPClient`: an MCP server is added with nothing but
//! configuration — `{ "command": ..., "args": [...], "env": {...} }` for a
//! local process or `{ "url": ..., "headers": {...} }` for a remote endpoint.
//! The framework connects, discovers the server's tools, and bridges them
//! into the agent tool system (namespaced `{server}_{tool}`) with permission
//! checks along the way. No code is ever required to integrate a server.
//!
//! ## Static vs dynamic servers
//!
//! Both are the same type, [`McpServerDefinition`]:
//!
//! * **Static** servers are declared in the host's configuration and
//!   registered at startup.
//! * **Dynamic** servers are registered at runtime by users through
//!   [`McpRegistry`], persisted as `McpServerRecord`s, and governed like any
//!   other resource (private by default; deployment-wide sharing requires
//!   the `developer` or `admin` role).
//!
//! ## Client-side vs server-side execution
//!
//! [`McpSide`] records *where* the server process runs:
//!
//! * **Server-side** — the Rustra server process spawns the command or dials
//!   the URL itself. [`McpRegistry::connect`] handles only these.
//! * **Client-side** (default) — a client of the Rustra server (e.g. a
//!   Chrome extension) executes the MCP server on the user's machine; Rustra
//!   only stores the configuration and forwards it to that client, so local
//!   processes and their secrets never leave the user's device.
//!
//! ## Secrets
//!
//! Stdio `env` values may reference secrets as `"${SECRET_NAME}"`. Secret
//! storage lives outside this crate: the host resolves placeholders with
//! [`McpServerDefinition::resolve_env`] and its own lookup right before
//! connecting, so plaintext secrets are never persisted in server configs.
//!
//! ## Module map
//!
//! * [`config`] — serde definition types, validation, record conversion.
//! * [`client`] — minimal JSON-RPC 2.0 MCP client (stdio + simplified
//!   Streamable HTTP; `initialize`, `tools/list`, `tools/call`).
//! * [`registry`] — persistence + permissioning over the storage layer.
//! * [`bridge`] — exposes a connected server's tools as
//!   [`rustra_core::Tool`]s.

pub mod bridge;
pub mod client;
pub mod config;
pub mod registry;

pub use bridge::{McpTool, McpToolset};
pub use client::{McpClient, McpToolInfo, MCP_PROTOCOL_VERSION};
pub use config::{McpScope, McpServerDefinition, McpSide, McpTransport, DEFAULT_TIMEOUT_MS};
pub use registry::{governed, McpRegistry};
