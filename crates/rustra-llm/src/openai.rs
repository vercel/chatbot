use async_trait::async_trait;
use serde_json::{json, Value};

use rustra_core::{Error, Result};

use crate::types::{ContentBlock, Message, ModelRequest, ModelResponse, Role, StopReason};
use crate::LanguageModel;

const OPENAI_BASE_URL: &str = "https://api.openai.com";
const LM_STUDIO_BASE_URL: &str = "http://localhost:1234";

/// [`LanguageModel`] backed by any OpenAI-compatible Chat Completions API.
///
/// The wire shape (`/v1/chat/completions`, `role`/`content`/`tool_calls`
/// messages, function tools, `Bearer` auth) is spoken by OpenAI itself and
/// by every local server that emulates it — [LM Studio], Ollama, llama.cpp,
/// vLLM, LiteLLM. This one adapter reaches all of them; the constructor just
/// picks the base URL.
///
/// For local testing against LM Studio, no API key or network is needed —
/// point it at the built-in server and name whatever model you loaded:
///
/// ```no_run
/// # use rustra_llm::OpenAiModel;
/// // LM Studio → Developer tab → Start Server (defaults to :1234).
/// let model = OpenAiModel::lm_studio("qwen2.5-7b-instruct");
/// ```
///
/// Against hosted OpenAI, pass a key (configuration is explicit — no ambient
/// env reads, so hosts manage secrets however they like):
///
/// ```no_run
/// # use rustra_llm::OpenAiModel;
/// let model = OpenAiModel::new("gpt-4o-mini", std::env::var("OPENAI_API_KEY").unwrap());
/// ```
///
/// [LM Studio]: https://lmstudio.ai
pub struct OpenAiModel {
    id: String,
    model: String,
    api_key: String,
    base_url: String,
    client: reqwest::Client,
}

impl OpenAiModel {
    /// Talk to hosted OpenAI. The [`LanguageModel::id`] becomes
    /// `openai/<model>`.
    pub fn new(model: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self::with_provider("openai", OPENAI_BASE_URL, model, api_key)
    }

    /// Talk to a locally running [LM Studio] server (default
    /// `http://localhost:1234`). LM Studio ignores the API key, so a
    /// placeholder is sent; override the address with [`Self::with_base_url`]
    /// if you changed the server port. The id becomes `lmstudio/<model>`.
    ///
    /// [LM Studio]: https://lmstudio.ai
    pub fn lm_studio(model: impl Into<String>) -> Self {
        Self::with_provider("lmstudio", LM_STUDIO_BASE_URL, model, "lm-studio")
    }

    /// Build against an arbitrary OpenAI-compatible endpoint, choosing the
    /// `<provider>/<model>` id prefix yourself (e.g. `ollama`, `vllm`).
    pub fn with_provider(
        provider: impl AsRef<str>,
        base_url: impl Into<String>,
        model: impl Into<String>,
        api_key: impl Into<String>,
    ) -> Self {
        let model = model.into();
        Self {
            id: format!("{}/{model}", provider.as_ref()),
            model,
            api_key: api_key.into(),
            base_url: base_url.into(),
            client: reqwest::Client::new(),
        }
    }

    /// Point at a proxy, gateway, or a local server on a non-default port.
    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        self.base_url = base_url.into();
        self
    }

    /// Set the bearer token (useful for gateways that do require auth even
    /// though the underlying server is OpenAI-compatible).
    pub fn with_api_key(mut self, api_key: impl Into<String>) -> Self {
        self.api_key = api_key.into();
        self
    }

    /// Use a preconfigured HTTP client — share one connection pool across
    /// providers, or set timeouts/proxies. Defaults to `reqwest::Client::new()`.
    pub fn with_client(mut self, client: reqwest::Client) -> Self {
        self.client = client;
        self
    }

    /// Translate the Anthropic-shaped internal message log into the OpenAI
    /// Chat Completions shape. Two shapes differ where tool traffic lives:
    /// Anthropic carries tool *results* as user-turn content blocks, OpenAI
    /// as free-standing `role: "tool"` messages; an assistant turn's tool
    /// *calls* move from `tool_use` blocks into a `tool_calls` array.
    fn encode_messages(system: Option<&str>, messages: &[Message]) -> Vec<Value> {
        let mut out = Vec::new();
        if let Some(system) = system {
            out.push(json!({"role": "system", "content": system}));
        }
        for message in messages {
            match message.role {
                Role::User => {
                    let mut text = Vec::new();
                    for block in &message.content {
                        match block {
                            ContentBlock::Text { text: t } => text.push(t.as_str()),
                            ContentBlock::ToolResult {
                                tool_use_id,
                                content,
                                ..
                            } => out.push(json!({
                                "role": "tool",
                                "tool_call_id": tool_use_id,
                                "content": content,
                            })),
                            ContentBlock::ToolUse { .. } => {}
                        }
                    }
                    if !text.is_empty() {
                        out.push(json!({"role": "user", "content": text.join("\n")}));
                    }
                }
                Role::Assistant => {
                    let mut text = Vec::new();
                    let mut tool_calls = Vec::new();
                    for block in &message.content {
                        match block {
                            ContentBlock::Text { text: t } => text.push(t.as_str()),
                            ContentBlock::ToolUse { id, name, input } => {
                                tool_calls.push(json!({
                                    "id": id,
                                    "type": "function",
                                    "function": {
                                        "name": name,
                                        // OpenAI carries tool arguments as a JSON string.
                                        "arguments": input.to_string(),
                                    },
                                }));
                            }
                            ContentBlock::ToolResult { .. } => {}
                        }
                    }
                    let mut msg = json!({ "role": "assistant" });
                    // `content` must always be present; use null when the
                    // turn is only tool calls.
                    msg["content"] = if text.is_empty() {
                        Value::Null
                    } else {
                        json!(text.join("\n"))
                    };
                    if !tool_calls.is_empty() {
                        msg["tool_calls"] = Value::Array(tool_calls);
                    }
                    out.push(msg);
                }
            }
        }
        out
    }

    /// Encode a [`ModelRequest`] into the OpenAI Chat Completions request
    /// body. Public so hosts can log or inspect the exact wire payload
    /// without issuing a call.
    pub fn encode_request(&self, request: &ModelRequest) -> Value {
        let mut body = json!({
            "model": self.model,
            "messages": Self::encode_messages(request.system.as_deref(), &request.messages),
        });
        // OpenAI treats max_tokens as optional (unlike Anthropic), so only
        // send it when the caller asked for a cap — lets local models use
        // their own default budget.
        if let Some(max) = request.max_tokens {
            body["max_tokens"] = json!(max);
        }
        if let Some(t) = request.temperature {
            body["temperature"] = json!(t);
        }
        if !request.stop_sequences.is_empty() {
            body["stop"] = json!(request.stop_sequences);
        }
        if !request.tools.is_empty() {
            body["tools"] = Value::Array(
                request
                    .tools
                    .iter()
                    .map(|t| {
                        json!({
                            "type": "function",
                            "function": {
                                "name": t.id,
                                "description": t.description,
                                "parameters": t.input_schema,
                            },
                        })
                    })
                    .collect(),
            );
        }
        body
    }

    fn api_error(status: reqwest::StatusCode, payload: &Value) -> Error {
        // OpenAI wraps errors as {"error": {"message": ...}}; some
        // compatible servers return a bare {"message": ...} or plain text.
        let message = payload["error"]["message"]
            .as_str()
            .or_else(|| payload["message"].as_str())
            .or_else(|| payload.as_str())
            .unwrap_or("unknown error");
        if status.as_u16() == 429 || status.is_server_error() {
            Error::Unavailable(format!("openai {status}: {message}"))
        } else {
            Error::Model(format!("openai {status}: {message}"))
        }
    }

    /// Decode an OpenAI Chat Completions response body into a
    /// [`ModelResponse`]. Public so hosts can parse a captured payload
    /// (e.g. from a proxy log) without a live call.
    pub fn decode_response(payload: &Value) -> ModelResponse {
        let message = &payload["choices"][0]["message"];
        let mut content = Vec::new();
        if let Some(text) = message["content"].as_str() {
            if !text.is_empty() {
                content.push(ContentBlock::text(text));
            }
        }
        if let Some(calls) = message["tool_calls"].as_array() {
            for call in calls {
                let function = &call["function"];
                content.push(ContentBlock::ToolUse {
                    id: call["id"].as_str().unwrap_or_default().to_string(),
                    name: function["name"].as_str().unwrap_or_default().to_string(),
                    // arguments arrive as a JSON string; recover the object,
                    // falling back to an empty object on malformed output.
                    input: function["arguments"]
                        .as_str()
                        .and_then(|s| serde_json::from_str(s).ok())
                        .unwrap_or_else(|| json!({})),
                });
            }
        }
        let stop_reason = match payload["choices"][0]["finish_reason"].as_str() {
            Some("stop") => StopReason::EndTurn,
            Some("tool_calls") | Some("function_call") => StopReason::ToolUse,
            Some("length") => StopReason::MaxTokens,
            _ => StopReason::Other,
        };
        let usage = crate::types::TokenUsage {
            input_tokens: payload["usage"]["prompt_tokens"].as_u64().unwrap_or(0),
            output_tokens: payload["usage"]["completion_tokens"].as_u64().unwrap_or(0),
        };
        ModelResponse {
            content,
            stop_reason,
            usage,
        }
    }
}

impl std::fmt::Debug for OpenAiModel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OpenAiModel")
            .field("id", &self.id)
            .field("model", &self.model)
            .field("base_url", &self.base_url)
            .field("api_key", &"<redacted>")
            .finish_non_exhaustive()
    }
}

#[async_trait]
impl LanguageModel for OpenAiModel {
    fn id(&self) -> &str {
        &self.id
    }

    async fn generate(&self, request: ModelRequest) -> Result<ModelResponse> {
        let body = self.encode_request(&request);

        let response = self
            .client
            .post(format!("{}/v1/chat/completions", self.base_url))
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| Error::Unavailable(format!("openai request failed: {e}")))?;

        let status = response.status();
        let bytes = response
            .bytes()
            .await
            .map_err(|e| Error::Unavailable(format!("openai response read failed: {e}")))?;

        if !status.is_success() {
            let payload: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
            return Err(Self::api_error(status, &payload));
        }

        let payload: Value = serde_json::from_slice(&bytes)
            .map_err(|e| Error::Model(format!("openai response decode failed: {e}")))?;
        Ok(Self::decode_response(&payload))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::TokenUsage;
    use reqwest::StatusCode;
    use rustra_core::ToolSpec;

    #[test]
    fn presets_set_id_and_base_url() {
        let lm = OpenAiModel::lm_studio("qwen2.5-7b-instruct");
        assert_eq!(lm.id(), "lmstudio/qwen2.5-7b-instruct");
        assert_eq!(lm.base_url, LM_STUDIO_BASE_URL);

        let oai = OpenAiModel::new("gpt-4o-mini", "sk-test");
        assert_eq!(oai.id(), "openai/gpt-4o-mini");
        assert_eq!(oai.base_url, OPENAI_BASE_URL);

        let custom = OpenAiModel::lm_studio("m").with_base_url("http://box:5000");
        assert_eq!(custom.base_url, "http://box:5000");
    }

    #[test]
    fn encode_messages_maps_tool_traffic_to_openai_shape() {
        let messages = vec![
            Message::user("add 2 and 3"),
            Message {
                role: Role::Assistant,
                content: vec![
                    ContentBlock::text("sure"),
                    ContentBlock::ToolUse {
                        id: "call_1".into(),
                        name: "add".into(),
                        input: json!({"a": 2, "b": 3}),
                    },
                ],
            },
            Message {
                role: Role::User,
                content: vec![ContentBlock::ToolResult {
                    tool_use_id: "call_1".into(),
                    content: "5".into(),
                    is_error: false,
                }],
            },
        ];

        let encoded = OpenAiModel::encode_messages(Some("be terse"), &messages);
        assert_eq!(
            encoded,
            vec![
                json!({"role": "system", "content": "be terse"}),
                json!({"role": "user", "content": "add 2 and 3"}),
                json!({
                    "role": "assistant",
                    "content": "sure",
                    "tool_calls": [{
                        "id": "call_1",
                        "type": "function",
                        "function": {"name": "add", "arguments": "{\"a\":2,\"b\":3}"},
                    }],
                }),
                // Tool result becomes a standalone tool-role message.
                json!({"role": "tool", "tool_call_id": "call_1", "content": "5"}),
            ]
        );
    }

    #[test]
    fn assistant_tool_only_turn_sends_null_content() {
        let messages = vec![Message {
            role: Role::Assistant,
            content: vec![ContentBlock::ToolUse {
                id: "c1".into(),
                name: "noop".into(),
                input: json!({}),
            }],
        }];
        let encoded = OpenAiModel::encode_messages(None, &messages);
        assert_eq!(encoded[0]["content"], Value::Null);
        assert!(encoded[0]["tool_calls"].is_array());
    }

    #[test]
    fn request_body_omits_max_tokens_and_maps_tools() {
        let model = OpenAiModel::lm_studio("m");
        let request = ModelRequest {
            messages: vec![Message::user("hi")],
            tools: vec![ToolSpec {
                id: "add".into(),
                description: "adds".into(),
                input_schema: json!({"type": "object"}),
                output_schema: None,
            }],
            stop_sequences: vec!["END".into()],
            ..Default::default()
        };
        let body = model.encode_request(&request);
        assert!(body.get("max_tokens").is_none());
        assert_eq!(body["stop"], json!(["END"]));
        assert_eq!(
            body["tools"],
            json!([{
                "type": "function",
                "function": {
                    "name": "add",
                    "description": "adds",
                    "parameters": {"type": "object"},
                },
            }])
        );

        let capped = model.encode_request(&ModelRequest {
            max_tokens: Some(256),
            ..request
        });
        assert_eq!(capped["max_tokens"], json!(256));
    }

    #[test]
    fn decode_response_reads_text_tools_and_usage() {
        let payload = json!({
            "choices": [{
                "message": {
                    "content": "the answer",
                    "tool_calls": [{
                        "id": "call_9",
                        "type": "function",
                        "function": {"name": "search", "arguments": "{\"q\":\"rust\"}"},
                    }],
                },
                "finish_reason": "tool_calls",
            }],
            "usage": {"prompt_tokens": 12, "completion_tokens": 34},
        });
        let response = OpenAiModel::decode_response(&payload);
        assert_eq!(
            response.content,
            vec![
                ContentBlock::text("the answer"),
                ContentBlock::ToolUse {
                    id: "call_9".into(),
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
    }

    #[test]
    fn decode_response_tolerates_missing_and_malformed_fields() {
        // Plain text completion with no tool calls or usage.
        let simple = OpenAiModel::decode_response(&json!({
            "choices": [{"message": {"content": "hi"}, "finish_reason": "stop"}],
        }));
        assert_eq!(simple.content, vec![ContentBlock::text("hi")]);
        assert_eq!(simple.stop_reason, StopReason::EndTurn);
        assert_eq!(simple.usage, TokenUsage::default());

        // Malformed tool arguments degrade to an empty object, not a panic.
        let bad_args = OpenAiModel::decode_response(&json!({
            "choices": [{
                "message": {
                    "content": Value::Null,
                    "tool_calls": [{"id": "c", "function": {"name": "f", "arguments": "{not json"}}],
                },
                "finish_reason": "tool_calls",
            }],
        }));
        assert_eq!(
            bad_args.content,
            vec![ContentBlock::ToolUse {
                id: "c".into(),
                name: "f".into(),
                input: json!({}),
            }]
        );

        // Unknown finish reasons fold into Other.
        let unknown = OpenAiModel::decode_response(&json!({
            "choices": [{"message": {"content": "x"}, "finish_reason": "content_filter"}],
        }));
        assert_eq!(unknown.stop_reason, StopReason::Other);
    }

    #[test]
    fn api_error_classifies_by_status() {
        let err = OpenAiModel::api_error(StatusCode::BAD_GATEWAY, &Value::Null);
        assert!(matches!(err, Error::Unavailable(_)));

        let body = json!({"error": {"message": "rate limited"}});
        match OpenAiModel::api_error(StatusCode::TOO_MANY_REQUESTS, &body) {
            Error::Unavailable(m) => assert!(m.contains("rate limited")),
            other => panic!("expected Unavailable, got {other:?}"),
        }

        // Bare {"message": ...} shape used by some local servers.
        let body = json!({"message": "model not found"});
        match OpenAiModel::api_error(StatusCode::NOT_FOUND, &body) {
            Error::Model(m) => assert!(m.contains("model not found")),
            other => panic!("expected Model, got {other:?}"),
        }
    }
}
