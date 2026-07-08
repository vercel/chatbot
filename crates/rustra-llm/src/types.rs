use serde::{Deserialize, Serialize};
use serde_json::Value;

use rustra_core::ToolSpec;

/// Speaker of a [`Message`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    User,
    Assistant,
}

/// One unit of message content. Mirrors Anthropic content blocks so tool
/// calls and results round-trip losslessly through storage and memory.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    /// Plain text.
    Text { text: String },
    /// The model requests a tool invocation.
    ToolUse {
        id: String,
        name: String,
        input: Value,
    },
    /// The result of a tool invocation, echoed back to the model.
    ToolResult {
        tool_use_id: String,
        content: String,
        #[serde(default)]
        is_error: bool,
    },
}

impl ContentBlock {
    /// Build a [`ContentBlock::Text`] block.
    pub fn text(text: impl Into<String>) -> Self {
        Self::Text { text: text.into() }
    }

    /// The text of a [`ContentBlock::Text`] block, `None` for tool blocks.
    pub fn as_text(&self) -> Option<&str> {
        match self {
            Self::Text { text } => Some(text),
            _ => None,
        }
    }
}

/// A single conversation turn.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Message {
    pub role: Role,
    pub content: Vec<ContentBlock>,
}

impl Message {
    /// Single text-block user message.
    pub fn user(text: impl Into<String>) -> Self {
        Self {
            role: Role::User,
            content: vec![ContentBlock::text(text)],
        }
    }

    /// Single text-block assistant message.
    pub fn assistant(text: impl Into<String>) -> Self {
        Self {
            role: Role::Assistant,
            content: vec![ContentBlock::text(text)],
        }
    }

    /// Text blocks joined with newlines (tool blocks are skipped).
    pub fn text(&self) -> String {
        self.content
            .iter()
            .filter_map(ContentBlock::as_text)
            .collect::<Vec<_>>()
            .join("\n")
    }
}

/// Why the model stopped generating.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StopReason {
    EndTurn,
    ToolUse,
    MaxTokens,
    StopSequence,
    /// Any stop reason this crate does not model — unknown or future
    /// provider values.
    #[serde(other)]
    Other,
}

/// Token accounting for one model call.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct TokenUsage {
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
}

impl TokenUsage {
    /// Accumulate another call's usage into this one.
    pub fn add(&mut self, other: TokenUsage) {
        *self += other;
    }
}

impl std::ops::AddAssign for TokenUsage {
    fn add_assign(&mut self, other: TokenUsage) {
        self.input_tokens += other.input_tokens;
        self.output_tokens += other.output_tokens;
    }
}

/// Everything a provider needs for one turn.
#[derive(Debug, Clone, Default)]
pub struct ModelRequest {
    /// System prompt (instructions + dynamically attached context).
    pub system: Option<String>,
    pub messages: Vec<Message>,
    /// Tools the model may call this turn.
    pub tools: Vec<ToolSpec>,
    /// `None` uses the provider default.
    pub max_tokens: Option<u32>,
    /// `None` uses the provider default.
    pub temperature: Option<f32>,
    /// Custom sequences that end generation early.
    pub stop_sequences: Vec<String>,
}

/// One model turn's output.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ModelResponse {
    pub content: Vec<ContentBlock>,
    pub stop_reason: StopReason,
    #[serde(default)]
    pub usage: TokenUsage,
}

impl ModelResponse {
    /// Text blocks joined with newlines (tool blocks are skipped).
    pub fn text(&self) -> String {
        self.content
            .iter()
            .filter_map(ContentBlock::as_text)
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Tool calls requested by the model this turn.
    pub fn tool_uses(&self) -> Vec<(&str, &str, &Value)> {
        self.content
            .iter()
            .filter_map(|b| match b {
                ContentBlock::ToolUse { id, name, input } => {
                    Some((id.as_str(), name.as_str(), input))
                }
                _ => None,
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn content_block_wire_shape() {
        assert_eq!(
            serde_json::to_value(ContentBlock::text("hi")).unwrap(),
            json!({"type": "text", "text": "hi"})
        );
        assert_eq!(
            serde_json::to_value(ContentBlock::ToolUse {
                id: "tu_1".into(),
                name: "add".into(),
                input: json!({"a": 1}),
            })
            .unwrap(),
            json!({"type": "tool_use", "id": "tu_1", "name": "add", "input": {"a": 1}})
        );
        assert_eq!(
            serde_json::to_value(ContentBlock::ToolResult {
                tool_use_id: "tu_1".into(),
                content: "ok".into(),
                is_error: false,
            })
            .unwrap(),
            json!({
                "type": "tool_result",
                "tool_use_id": "tu_1",
                "content": "ok",
                "is_error": false,
            })
        );
    }

    #[test]
    fn lenient_decode_invariants() {
        // Stored rows may omit `is_error`; it must default to false.
        let block: ContentBlock = serde_json::from_value(json!({
            "type": "tool_result",
            "tool_use_id": "x",
            "content": "ok",
        }))
        .unwrap();
        assert_eq!(
            block,
            ContentBlock::ToolResult {
                tool_use_id: "x".into(),
                content: "ok".into(),
                is_error: false,
            }
        );

        // A usage object may omit fields; each defaults to 0.
        let usage: TokenUsage = serde_json::from_value(json!({"input_tokens": 3})).unwrap();
        assert_eq!(
            usage,
            TokenUsage {
                input_tokens: 3,
                output_tokens: 0,
            }
        );

        // A full message round-trips through JSON values.
        let message = Message {
            role: Role::Assistant,
            content: vec![
                ContentBlock::text("thinking done"),
                ContentBlock::ToolUse {
                    id: "tu_2".into(),
                    name: "search".into(),
                    input: json!({"q": "rust"}),
                },
                ContentBlock::ToolResult {
                    tool_use_id: "tu_2".into(),
                    content: "found".into(),
                    is_error: true,
                },
            ],
        };
        let value = serde_json::to_value(&message).unwrap();
        let back: Message = serde_json::from_value(value).unwrap();
        assert_eq!(back, message);
    }

    #[test]
    fn enum_string_forms() {
        for (role, s) in [(Role::User, "user"), (Role::Assistant, "assistant")] {
            assert_eq!(serde_json::to_value(role).unwrap(), json!(s));
            assert_eq!(serde_json::from_value::<Role>(json!(s)).unwrap(), role);
        }
        for (reason, s) in [
            (StopReason::EndTurn, "end_turn"),
            (StopReason::ToolUse, "tool_use"),
            (StopReason::MaxTokens, "max_tokens"),
            (StopReason::StopSequence, "stop_sequence"),
            (StopReason::Other, "other"),
        ] {
            assert_eq!(serde_json::to_value(reason).unwrap(), json!(s));
            assert_eq!(
                serde_json::from_value::<StopReason>(json!(s)).unwrap(),
                reason
            );
        }
        // Unknown provider values fold into Other.
        assert_eq!(
            serde_json::from_value::<StopReason>(json!("pause_turn")).unwrap(),
            StopReason::Other
        );
    }
}
