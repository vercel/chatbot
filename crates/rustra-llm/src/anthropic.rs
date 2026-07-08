use async_trait::async_trait;
use serde_json::{json, Value};

use rustra_core::{Error, Result};

use crate::types::{
    ContentBlock, Message, ModelRequest, ModelResponse, Role, StopReason, TokenUsage,
};
use crate::LanguageModel;

const DEFAULT_BASE_URL: &str = "https://api.anthropic.com";
const API_VERSION: &str = "2023-06-01";
const DEFAULT_MAX_TOKENS: u32 = 4096;

/// [`LanguageModel`] backed by the Anthropic Messages API.
///
/// Configuration is explicit (no ambient env reads) so hosts can manage
/// secrets however they like:
///
/// ```no_run
/// # use rustra_llm::AnthropicModel;
/// let model = AnthropicModel::new("claude-sonnet-5", std::env::var("ANTHROPIC_API_KEY").unwrap());
/// ```
pub struct AnthropicModel {
    id: String,
    model: String,
    api_key: String,
    base_url: String,
    client: reqwest::Client,
}

impl AnthropicModel {
    pub fn new(model: impl Into<String>, api_key: impl Into<String>) -> Self {
        let model = model.into();
        Self {
            id: format!("anthropic/{model}"),
            model,
            api_key: api_key.into(),
            base_url: DEFAULT_BASE_URL.into(),
            client: reqwest::Client::new(),
        }
    }

    /// Point at a proxy or compatible gateway.
    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        self.base_url = base_url.into();
        self
    }

    fn encode_message(message: &Message) -> Value {
        let content: Vec<Value> = message
            .content
            .iter()
            .map(|block| match block {
                ContentBlock::Text { text } => json!({"type": "text", "text": text}),
                ContentBlock::ToolUse { id, name, input } => {
                    json!({"type": "tool_use", "id": id, "name": name, "input": input})
                }
                ContentBlock::ToolResult { tool_use_id, content, is_error } => json!({
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": content,
                    "is_error": is_error,
                }),
            })
            .collect();
        let role = match message.role {
            Role::User => "user",
            Role::Assistant => "assistant",
        };
        json!({"role": role, "content": content})
    }

    fn decode_block(block: &Value) -> Option<ContentBlock> {
        match block["type"].as_str()? {
            "text" => Some(ContentBlock::Text { text: block["text"].as_str()?.to_string() }),
            "tool_use" => Some(ContentBlock::ToolUse {
                id: block["id"].as_str()?.to_string(),
                name: block["name"].as_str()?.to_string(),
                input: block["input"].clone(),
            }),
            _ => None,
        }
    }
}

#[async_trait]
impl LanguageModel for AnthropicModel {
    fn id(&self) -> &str {
        &self.id
    }

    async fn generate(&self, request: ModelRequest) -> Result<ModelResponse> {
        let mut body = json!({
            "model": self.model,
            "max_tokens": request.max_tokens.unwrap_or(DEFAULT_MAX_TOKENS),
            "messages": request.messages.iter().map(Self::encode_message).collect::<Vec<_>>(),
        });
        if let Some(system) = &request.system {
            body["system"] = json!(system);
        }
        if let Some(t) = request.temperature {
            body["temperature"] = json!(t);
        }
        if !request.stop_sequences.is_empty() {
            body["stop_sequences"] = json!(request.stop_sequences);
        }
        if !request.tools.is_empty() {
            body["tools"] = Value::Array(
                request
                    .tools
                    .iter()
                    .map(|t| {
                        json!({
                            "name": t.id,
                            "description": t.description,
                            "input_schema": t.input_schema,
                        })
                    })
                    .collect(),
            );
        }

        let response = self
            .client
            .post(format!("{}/v1/messages", self.base_url))
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", API_VERSION)
            .json(&body)
            .send()
            .await
            .map_err(|e| Error::Unavailable(format!("anthropic request failed: {e}")))?;

        let status = response.status();
        let payload: Value = response
            .json()
            .await
            .map_err(|e| Error::Model(format!("anthropic response decode failed: {e}")))?;

        if !status.is_success() {
            let message = payload["error"]["message"].as_str().unwrap_or("unknown error");
            return if status.as_u16() == 429 || status.is_server_error() {
                Err(Error::Unavailable(format!("anthropic {status}: {message}")))
            } else {
                Err(Error::Model(format!("anthropic {status}: {message}")))
            };
        }

        let content = payload["content"]
            .as_array()
            .map(|blocks| blocks.iter().filter_map(Self::decode_block).collect())
            .unwrap_or_default();
        let stop_reason = match payload["stop_reason"].as_str() {
            Some("end_turn") => StopReason::EndTurn,
            Some("tool_use") => StopReason::ToolUse,
            Some("max_tokens") => StopReason::MaxTokens,
            Some("stop_sequence") => StopReason::StopSequence,
            _ => StopReason::Other,
        };
        let usage = TokenUsage {
            input_tokens: payload["usage"]["input_tokens"].as_u64().unwrap_or(0),
            output_tokens: payload["usage"]["output_tokens"].as_u64().unwrap_or(0),
        };

        Ok(ModelResponse { content, stop_reason, usage })
    }
}
