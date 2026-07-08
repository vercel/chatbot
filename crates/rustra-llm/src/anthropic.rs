use async_trait::async_trait;
use serde_json::{json, Value};

use rustra_core::{Error, Result};

use crate::types::{ContentBlock, Message, ModelRequest, ModelResponse, StopReason};
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
    /// The [`LanguageModel::id`] becomes `anthropic/<model>`. Requests
    /// without `max_tokens` send 4096.
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

    /// Use a preconfigured HTTP client — share one connection pool across
    /// providers, or set timeouts/proxies. Defaults to `reqwest::Client::new()`.
    pub fn with_client(mut self, client: reqwest::Client) -> Self {
        self.client = client;
        self
    }

    fn encode_message(message: &Message) -> Value {
        serde_json::to_value(message).expect("message serialization is infallible")
    }

    fn decode_block(block: &Value) -> Option<ContentBlock> {
        serde_json::from_value(block.clone()).ok()
    }

    fn request_body(&self, request: &ModelRequest) -> Value {
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
        body
    }

    fn api_error(status: reqwest::StatusCode, payload: &Value) -> Error {
        let message = payload["error"]["message"]
            .as_str()
            .unwrap_or("unknown error");
        if status.as_u16() == 429 || status.is_server_error() {
            Error::Unavailable(format!("anthropic {status}: {message}"))
        } else {
            Error::Model(format!("anthropic {status}: {message}"))
        }
    }

    fn decode_response(payload: &Value) -> ModelResponse {
        let content = payload["content"]
            .as_array()
            .map(|blocks| blocks.iter().filter_map(Self::decode_block).collect())
            .unwrap_or_default();
        let stop_reason =
            serde_json::from_value(payload["stop_reason"].clone()).unwrap_or(StopReason::Other);
        let usage = serde_json::from_value(payload["usage"].clone()).unwrap_or_default();
        ModelResponse {
            content,
            stop_reason,
            usage,
        }
    }
}

impl std::fmt::Debug for AnthropicModel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AnthropicModel")
            .field("id", &self.id)
            .field("model", &self.model)
            .field("base_url", &self.base_url)
            .field("api_key", &"<redacted>")
            .finish_non_exhaustive()
    }
}

#[async_trait]
impl LanguageModel for AnthropicModel {
    fn id(&self) -> &str {
        &self.id
    }

    async fn generate(&self, request: ModelRequest) -> Result<ModelResponse> {
        let body = self.request_body(&request);

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
        let bytes = response
            .bytes()
            .await
            .map_err(|e| Error::Unavailable(format!("anthropic response read failed: {e}")))?;

        if !status.is_success() {
            let payload: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
            return Err(Self::api_error(status, &payload));
        }

        let payload: Value = serde_json::from_slice(&bytes)
            .map_err(|e| Error::Model(format!("anthropic response decode failed: {e}")))?;
        Ok(Self::decode_response(&payload))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Role, TokenUsage};
    use reqwest::StatusCode;

    #[test]
    fn encode_message_matches_anthropic_wire_shape() {
        let message = Message {
            role: Role::Assistant,
            content: vec![
                ContentBlock::text("let me add those"),
                ContentBlock::ToolUse {
                    id: "tu_1".into(),
                    name: "add".into(),
                    input: json!({"a": 2, "b": 3}),
                },
                ContentBlock::ToolResult {
                    tool_use_id: "tu_1".into(),
                    content: "5".into(),
                    is_error: false,
                },
            ],
        };
        assert_eq!(
            AnthropicModel::encode_message(&message),
            json!({
                "role": "assistant",
                "content": [
                    {"type": "text", "text": "let me add those"},
                    {"type": "tool_use", "id": "tu_1", "name": "add", "input": {"a": 2, "b": 3}},
                    {"type": "tool_result", "tool_use_id": "tu_1", "content": "5", "is_error": false},
                ],
            })
        );
    }

    #[test]
    fn decode_response_skips_unknown_blocks_and_maps_stop_reason() {
        let payload = json!({
            "content": [
                {"type": "thinking", "thinking": "hmm"},
                {"type": "text", "text": "the answer"},
                {"type": "tool_use", "id": "tu_9", "name": "search", "input": {"q": "rust"}},
            ],
            "stop_reason": "tool_use",
            "usage": {"input_tokens": 12, "output_tokens": 34},
        });
        let response = AnthropicModel::decode_response(&payload);
        assert_eq!(
            response.content,
            vec![
                ContentBlock::text("the answer"),
                ContentBlock::ToolUse {
                    id: "tu_9".into(),
                    name: "search".into(),
                    input: json!({"q": "rust"}),
                },
            ]
        );
        assert_eq!(response.stop_reason, StopReason::ToolUse);
        assert_eq!(
            response.usage,
            TokenUsage {
                input_tokens: 12,
                output_tokens: 34,
            }
        );

        // Unknown and missing stop reasons both fold into Other.
        let unknown = AnthropicModel::decode_response(&json!({"stop_reason": "pause_turn"}));
        assert_eq!(unknown.stop_reason, StopReason::Other);
        let missing = AnthropicModel::decode_response(&json!({}));
        assert_eq!(missing.stop_reason, StopReason::Other);
    }

    #[test]
    fn api_error_classifies_by_status() {
        // Non-JSON body (e.g. gateway HTML) still classifies 5xx as transient.
        let err = AnthropicModel::api_error(StatusCode::BAD_GATEWAY, &Value::Null);
        match err {
            Error::Unavailable(message) => assert!(message.contains("unknown error")),
            other => panic!("expected Unavailable, got {other:?}"),
        }

        let body = json!({"error": {"message": "rate limited"}});
        let err = AnthropicModel::api_error(StatusCode::TOO_MANY_REQUESTS, &body);
        match err {
            Error::Unavailable(message) => assert!(message.contains("rate limited")),
            other => panic!("expected Unavailable, got {other:?}"),
        }

        let body = json!({"error": {"message": "invalid request"}});
        let err = AnthropicModel::api_error(StatusCode::BAD_REQUEST, &body);
        match err {
            Error::Model(message) => assert!(message.contains("invalid request")),
            other => panic!("expected Model, got {other:?}"),
        }
    }
}
