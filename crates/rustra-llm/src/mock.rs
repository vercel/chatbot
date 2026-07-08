use std::sync::Mutex;

use async_trait::async_trait;
use serde_json::Value;

use rustra_core::Result;

use crate::types::{ContentBlock, ModelRequest, ModelResponse, StopReason, TokenUsage};
use crate::LanguageModel;

/// One scripted model turn for [`MockModel`].
#[derive(Debug, Clone)]
pub enum ScriptedTurn {
    /// Respond with plain text and stop.
    Text(String),
    /// Request a tool call (`name`, `input`); the loop will execute the tool
    /// and call the model again.
    ToolCall { name: String, input: Value },
    /// Respond with text derived from the last message (`fn` of its text).
    EchoLast,
}

/// A deterministic, scriptable [`LanguageModel`] used by tests and examples.
///
/// Turns are consumed in order; once the script is exhausted the model
/// answers with a fixed fallback. This keeps agent-loop and workflow tests
/// hermetic — no network, no keys.
pub struct MockModel {
    id: String,
    script: Mutex<std::collections::VecDeque<ScriptedTurn>>,
    /// Every request the model has seen, for assertions.
    pub requests: Mutex<Vec<ModelRequest>>,
}

impl MockModel {
    pub fn new(turns: Vec<ScriptedTurn>) -> Self {
        Self {
            id: "mock/mock-1".into(),
            script: Mutex::new(turns.into()),
            requests: Mutex::new(Vec::new()),
        }
    }

    pub fn text(reply: impl Into<String>) -> Self {
        Self::new(vec![ScriptedTurn::Text(reply.into())])
    }
}

#[async_trait]
impl LanguageModel for MockModel {
    fn id(&self) -> &str {
        &self.id
    }

    async fn generate(&self, request: ModelRequest) -> Result<ModelResponse> {
        let turn = self.script.lock().expect("mock poisoned").pop_front();
        let last_text = request.messages.last().map(|m| m.text()).unwrap_or_default();
        self.requests.lock().expect("mock poisoned").push(request);

        let usage = TokenUsage { input_tokens: 10, output_tokens: 10 };
        let response = match turn {
            Some(ScriptedTurn::Text(text)) => ModelResponse {
                content: vec![ContentBlock::text(text)],
                stop_reason: StopReason::EndTurn,
                usage,
            },
            Some(ScriptedTurn::ToolCall { name, input }) => ModelResponse {
                content: vec![ContentBlock::ToolUse {
                    id: rustra_core::new_id("toolu"),
                    name,
                    input,
                }],
                stop_reason: StopReason::ToolUse,
                usage,
            },
            Some(ScriptedTurn::EchoLast) => ModelResponse {
                content: vec![ContentBlock::text(format!("echo: {last_text}"))],
                stop_reason: StopReason::EndTurn,
                usage,
            },
            None => ModelResponse {
                content: vec![ContentBlock::text("(mock script exhausted)")],
                stop_reason: StopReason::EndTurn,
                usage,
            },
        };
        Ok(response)
    }
}
