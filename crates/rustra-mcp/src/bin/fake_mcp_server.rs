//! A tiny fake MCP server used by the integration tests (hermetic — no real
//! MCP servers needed). Speaks newline-delimited JSON-RPC 2.0 on
//! stdin/stdout and supports `initialize`, `tools/list`, and `tools/call`
//! with three canned tools:
//!
//! * `echo` — returns the call arguments serialized as text content;
//! * `fail` — returns a result with `isError: true`;
//! * `slow` — sleeps 5 seconds before answering (for timeout tests).
//!
//! Not part of the public API; located by tests via
//! `env!("CARGO_BIN_EXE_fake_mcp_server")`.

use serde_json::{json, Value};
use std::io::{BufRead, Write};

fn main() {
    let stdin = std::io::stdin();
    let stdout = std::io::stdout();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let Ok(message) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        // Notifications (no id) get no response.
        let Some(id) = message.get("id").cloned() else {
            continue;
        };
        let method = message.get("method").and_then(Value::as_str).unwrap_or("");
        let response = match method {
            "initialize" => result(
                id,
                json!({
                    "protocolVersion": message["params"]["protocolVersion"],
                    "capabilities": { "tools": {} },
                    "serverInfo": { "name": "fake-mcp-server", "version": "0.0.1" }
                }),
            ),
            "tools/list" => result(
                id,
                json!({
                    "tools": [
                        {
                            "name": "echo",
                            "description": "Echo the arguments back as text",
                            "inputSchema": { "type": "object", "additionalProperties": true }
                        },
                        {
                            "name": "fail",
                            "description": "Always fails",
                            "inputSchema": { "type": "object" }
                        },
                        {
                            // No description / inputSchema on purpose: the
                            // client must handle missing fields gracefully.
                            "name": "slow"
                        }
                    ]
                }),
            ),
            "tools/call" => {
                let name = message["params"]["name"].as_str().unwrap_or("");
                let arguments = message["params"]
                    .get("arguments")
                    .cloned()
                    .unwrap_or(Value::Null);
                match name {
                    "echo" => result(
                        id,
                        json!({
                            "content": [
                                { "type": "text", "text": format!("echo: {arguments}") },
                                { "type": "image", "data": "ignored-by-client" }
                            ],
                            "isError": false
                        }),
                    ),
                    "fail" => result(
                        id,
                        json!({
                            "content": [ { "type": "text", "text": "boom" } ],
                            "isError": true
                        }),
                    ),
                    "slow" => {
                        std::thread::sleep(std::time::Duration::from_secs(5));
                        result(id, json!({ "content": [], "isError": false }))
                    }
                    other => error(id, -32602, &format!("unknown tool `{other}`")),
                }
            }
            other => error(id, -32601, &format!("method `{other}` not found")),
        };
        let mut out = stdout.lock();
        if writeln!(out, "{response}")
            .and_then(|()| out.flush())
            .is_err()
        {
            break;
        }
    }
}

fn result(id: Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

fn error(id: Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}
