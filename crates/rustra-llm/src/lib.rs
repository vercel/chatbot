//! # rustra-llm
//!
//! The language-model boundary. Mastra delegates this to the Vercel AI SDK;
//! Rustra defines its own small provider contract instead:
//!
//! * [`LanguageModel`] — one async method, [`LanguageModel::generate`].
//! * Message/content types that mirror the Anthropic Messages API shape
//!   (system + user/assistant turns, text, tool-use, and tool-result content
//!   blocks), which is the least lossy normal form for tool-calling loops.
//! * [`MockModel`] — a scriptable model for deterministic tests and examples.
//! * [`AnthropicModel`] — a thin HTTP adapter for the Anthropic API.
//!
//! Additional providers implement [`LanguageModel`] in their own crates.

mod anthropic;
mod mock;
mod types;

pub use anthropic::AnthropicModel;
pub use mock::{MockModel, ScriptedTurn};
pub use types::{ContentBlock, Message, ModelRequest, ModelResponse, Role, StopReason, TokenUsage};

use async_trait::async_trait;
use rustra_core::Result;
use std::sync::Arc;

/// A chat-completion capable model with tool-calling support.
#[async_trait]
pub trait LanguageModel: Send + Sync {
    /// Provider-qualified model id, e.g. `anthropic/claude-sonnet-5`.
    fn id(&self) -> &str;

    /// Run one model turn over the conversation so far.
    ///
    /// # Errors
    ///
    /// Implementations should map transient failures (network errors,
    /// HTTP 429, 5xx) to [`Error::Unavailable`] and permanent failures
    /// (invalid request, auth, unparseable response) to [`Error::Model`];
    /// [`Error::is_retryable`] — and therefore task retries and workflow
    /// retry policies — keys off this distinction.
    ///
    /// [`Error::Unavailable`]: rustra_core::Error::Unavailable
    /// [`Error::Model`]: rustra_core::Error::Model
    /// [`Error::is_retryable`]: rustra_core::Error::is_retryable
    async fn generate(&self, request: ModelRequest) -> Result<ModelResponse>;
}

/// Shared handle to a model; agents and workflows clone this freely.
pub type SharedModel = Arc<dyn LanguageModel>;
