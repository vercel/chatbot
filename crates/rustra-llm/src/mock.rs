use std::collections::VecDeque;
use std::sync::Mutex;

use async_trait::async_trait;
use serde_json::Value;

use rustra_core::Result;

use crate::types::{ContentBlock, ModelRequest, ModelResponse, StopReason, TokenUsage};
use crate::LanguageModel;

/// One scripted model turn for [`MockModel`].
#[derive(Debug, Clone, PartialEq)]
pub enum ScriptedTurn {
    /// Respond with plain text and stop.
    Text(String),
    /// Request a tool call (`name`, `input`); the loop will execute the tool
    /// and call the model again.
    ToolCall { name: String, input: Value },
    /// Respond with `echo: <text of the last message>`.
    EchoLast,
}

/// A deterministic, scriptable [`LanguageModel`] used by tests and examples.
///
/// Turns are consumed in order; once the script is exhausted the model
/// answers with a fixed fallback. This keeps agent-loop and workflow tests
/// hermetic — no network, no keys.
#[derive(Debug)]
pub struct MockModel {
    id: String,
    state: Mutex<MockState>,
}

#[derive(Debug)]
struct MockState {
    script: VecDeque<ScriptedTurn>,
    /// Every request the model has seen, for assertions.
    requests: Vec<ModelRequest>,
}

impl MockModel {
    /// Plays `turns` in order; once exhausted every further call returns the
    /// fixed `(mock script exhausted)` text reply.
    pub fn new(turns: Vec<ScriptedTurn>) -> Self {
        Self {
            id: "mock/mock-1".into(),
            state: Mutex::new(MockState {
                script: turns.into(),
                requests: Vec::new(),
            }),
        }
    }

    /// Single-turn script that replies `reply` once, then falls back to the
    /// exhausted-script reply.
    pub fn text(reply: impl Into<String>) -> Self {
        Self::new(vec![ScriptedTurn::Text(reply.into())])
    }

    /// Every request the model has seen, for assertions.
    pub fn requests(&self) -> Vec<ModelRequest> {
        self.state.lock().expect("mock poisoned").requests.clone()
    }
}

#[async_trait]
impl LanguageModel for MockModel {
    fn id(&self) -> &str {
        &self.id
    }

    async fn generate(&self, request: ModelRequest) -> Result<ModelResponse> {
        let last_text = request
            .messages
            .last()
            .map(|m| m.text())
            .unwrap_or_default();
        // Pop the turn and log the request under one lock so concurrent
        // callers cannot interleave the two; the guard drops before any
        // await point (there are none, but the scoping keeps that explicit).
        let turn = {
            let mut state = self.state.lock().expect("mock poisoned");
            let turn = state.script.pop_front();
            state.requests.push(request);
            turn
        };

        let usage = TokenUsage {
            input_tokens: 10,
            output_tokens: 10,
        };
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
