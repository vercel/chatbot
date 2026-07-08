use thiserror::Error;

/// Convenience alias used across all Rustra crates.
pub type Result<T, E = Error> = std::result::Result<T, E>;

/// The unified error type for the Rustra framework.
///
/// Domain crates map their internal failures into these variants so that
/// callers at the runtime boundary (server handlers, task supervisors, the
/// agent loop) can react uniformly: retry on `Unavailable`, surface
/// `PermissionDenied` as HTTP 403, and so on. (Workflow suspension is
/// deliberately *not* an error: it is `StepOutcome::Suspended` in
/// `rustra-workflow`.)
#[derive(Debug, Error)]
pub enum Error {
    /// The requested entity does not exist.
    #[error("not found: {kind} `{id}`")]
    NotFound { kind: &'static str, id: String },

    /// The caller is not allowed to perform the action.
    #[error("permission denied: {0}")]
    PermissionDenied(String),

    /// Input failed validation (schemas, definitions, config).
    #[error("validation failed: {0}")]
    Validation(String),

    /// A storage backend failed.
    #[error("storage error: {0}")]
    Storage(String),

    /// A language-model provider failed.
    #[error("model error: {0}")]
    Model(String),

    /// A tool invocation failed. The agent loop feeds this back to the model
    /// rather than aborting the run.
    #[error("tool `{tool}` failed: {message}")]
    Tool { tool: String, message: String },

    /// An MCP server or transport failed.
    #[error("mcp error: {0}")]
    Mcp(String),

    /// A workflow/flow engine failure (bad graph, missing step, resume
    /// mismatch).
    #[error("workflow error: {0}")]
    Workflow(String),

    /// The operation was cancelled (by a user, a supervisor, or shutdown).
    #[error("cancelled: {0}")]
    Cancelled(String),

    /// The operation timed out.
    #[error("timed out: {0}")]
    Timeout(String),

    /// A transient dependency failure worth retrying.
    #[error("unavailable: {0}")]
    Unavailable(String),

    /// Misconfiguration detected at startup or registration time.
    #[error("configuration error: {0}")]
    Config(String),

    /// JSON (de)serialization failure.
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    /// Filesystem or process I/O failure (workspaces, skills on disk, LSP).
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    /// Anything that does not fit the variants above.
    #[error("{0}")]
    Other(String),
}

/// Constructors below are the preferred construction path: when the variants
/// gain structured payloads (ROADMAP 1.5), only this file has to change.
impl Error {
    pub fn not_found(kind: &'static str, id: impl Into<String>) -> Self {
        Self::NotFound {
            kind,
            id: id.into(),
        }
    }

    pub fn tool(tool: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Tool {
            tool: tool.into(),
            message: message.into(),
        }
    }

    pub fn permission_denied(msg: impl Into<String>) -> Self {
        Self::PermissionDenied(msg.into())
    }

    pub fn validation(msg: impl Into<String>) -> Self {
        Self::Validation(msg.into())
    }

    pub fn storage(msg: impl Into<String>) -> Self {
        Self::Storage(msg.into())
    }

    pub fn model(msg: impl Into<String>) -> Self {
        Self::Model(msg.into())
    }

    pub fn mcp(msg: impl Into<String>) -> Self {
        Self::Mcp(msg.into())
    }

    pub fn workflow(msg: impl Into<String>) -> Self {
        Self::Workflow(msg.into())
    }

    pub fn cancelled(msg: impl Into<String>) -> Self {
        Self::Cancelled(msg.into())
    }

    pub fn timeout(msg: impl Into<String>) -> Self {
        Self::Timeout(msg.into())
    }

    pub fn unavailable(msg: impl Into<String>) -> Self {
        Self::Unavailable(msg.into())
    }

    pub fn config(msg: impl Into<String>) -> Self {
        Self::Config(msg.into())
    }

    pub fn other(msg: impl Into<String>) -> Self {
        Self::Other(msg.into())
    }

    /// Whether a retry policy should consider this failure transient.
    ///
    /// Exhaustive by design: adding a variant is a compile error here until
    /// its retryability is decided explicitly.
    pub fn is_retryable(&self) -> bool {
        match self {
            Self::Unavailable(_) | Self::Timeout(_) | Self::Storage(_) => true,
            Self::NotFound { .. }
            | Self::PermissionDenied(_)
            | Self::Validation(_)
            | Self::Model(_)
            | Self::Tool { .. }
            | Self::Mcp(_)
            | Self::Workflow(_)
            | Self::Cancelled(_)
            | Self::Config(_)
            | Self::Serde(_)
            | Self::Io(_)
            | Self::Other(_) => false,
        }
    }
}
