//! Micro-benchmarks for the LLM message codec: encoding a [`ModelRequest`]
//! into a provider's wire body and decoding a provider response back into a
//! [`ModelResponse`]. Pure CPU — no network — so it measures exactly the
//! per-turn translation cost the agent loop pays on both sides of every call.
//!
//! Benched for both providers so the OpenAI (`tool_calls` array, JSON-string
//! arguments, tool-role messages) and Anthropic (content-block) shapes can be
//! compared directly.
//!
//! ```sh
//! cargo bench -p rustra-llm
//! ```

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use serde_json::json;

use rustra_core::ToolSpec;
use rustra_llm::{AnthropicModel, ContentBlock, Message, ModelRequest, OpenAiModel, Role};

/// A conversation of `turns` user/assistant pairs, where assistant turns
/// carry a tool call and the following user turn carries its result — the
/// realistic shape of a tool-using agent loop, and the case the codec works
/// hardest on.
fn conversation(turns: usize) -> Vec<Message> {
    let mut messages = Vec::with_capacity(turns * 3);
    for i in 0..turns {
        messages.push(Message::user(format!(
            "Question {i}: please look up the current value and summarise it."
        )));
        messages.push(Message {
            role: Role::Assistant,
            content: vec![
                ContentBlock::text(format!("Let me check that for you (step {i}).")),
                ContentBlock::ToolUse {
                    id: format!("call_{i}"),
                    name: "lookup".into(),
                    input: json!({"key": format!("item-{i}"), "detail": true}),
                },
            ],
        });
        messages.push(Message {
            role: Role::User,
            content: vec![ContentBlock::ToolResult {
                tool_use_id: format!("call_{i}"),
                content: format!("{{\"value\": {i}, \"unit\": \"widgets\"}}"),
                is_error: false,
            }],
        });
    }
    messages
}

fn request(turns: usize) -> ModelRequest {
    ModelRequest {
        system: Some("You are a precise assistant. Use tools when helpful.".into()),
        messages: conversation(turns),
        tools: vec![ToolSpec {
            id: "lookup".into(),
            description: "Look up the current value for a key.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "key": {"type": "string"},
                    "detail": {"type": "boolean"}
                },
                "required": ["key"]
            }),
            output_schema: None,
        }],
        max_tokens: Some(1024),
        temperature: Some(0.2),
        stop_sequences: vec![],
    }
}

/// A response body of the shape each provider actually returns, sized so
/// decode does representative work (text + a tool call + usage).
fn openai_response() -> serde_json::Value {
    json!({
        "choices": [{
            "message": {
                "content": "Here is the summary you asked for.",
                "tool_calls": [{
                    "id": "call_final",
                    "type": "function",
                    "function": {"name": "lookup", "arguments": "{\"key\":\"item-final\",\"detail\":true}"}
                }]
            },
            "finish_reason": "tool_calls"
        }],
        "usage": {"prompt_tokens": 812, "completion_tokens": 143}
    })
}

fn anthropic_response() -> serde_json::Value {
    json!({
        "content": [
            {"type": "text", "text": "Here is the summary you asked for."},
            {"type": "tool_use", "id": "call_final", "name": "lookup",
             "input": {"key": "item-final", "detail": true}}
        ],
        "stop_reason": "tool_use",
        "usage": {"input_tokens": 812, "output_tokens": 143}
    })
}

fn bench_encode(c: &mut Criterion) {
    let openai = OpenAiModel::lm_studio("bench");
    let anthropic = AnthropicModel::new("bench", "unused");

    let mut group = c.benchmark_group("encode_request");
    for turns in [1usize, 8, 32] {
        let req = request(turns);
        // One "message" of throughput == one conversation turn, so numbers
        // read as per-turn cost regardless of conversation length.
        group.throughput(Throughput::Elements(turns as u64));
        group.bench_with_input(BenchmarkId::new("openai", turns), &req, |b, req| {
            b.iter(|| black_box(openai.encode_request(black_box(req))))
        });
        group.bench_with_input(BenchmarkId::new("anthropic", turns), &req, |b, req| {
            b.iter(|| black_box(anthropic.encode_request(black_box(req))))
        });
    }
    group.finish();
}

fn bench_decode(c: &mut Criterion) {
    let openai = openai_response();
    let anthropic = anthropic_response();

    let mut group = c.benchmark_group("decode_response");
    group.bench_function("openai", |b| {
        b.iter(|| black_box(OpenAiModel::decode_response(black_box(&openai))))
    });
    group.bench_function("anthropic", |b| {
        b.iter(|| black_box(AnthropicModel::decode_response(black_box(&anthropic))))
    });
    group.finish();
}

criterion_group!(benches, bench_encode, bench_decode);
criterion_main!(benches);
