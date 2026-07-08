//! Hermetic test of the HTTP transport: a minimal in-process HTTP/1.1
//! responder speaks just enough of the protocol for `reqwest`.

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};

use rustra_core::Error;
use rustra_mcp::{McpClient, McpServerDefinition};

/// Serve JSON-RPC over bare HTTP/1.1 on `listener`, forever.
async fn serve(listener: TcpListener) {
    loop {
        let Ok((stream, _)) = listener.accept().await else {
            return;
        };
        tokio::spawn(handle_connection(stream));
    }
}

async fn handle_connection(stream: TcpStream) {
    let mut reader = BufReader::new(stream);
    loop {
        // Read the request head.
        let mut content_length = 0usize;
        let mut saw_request_line = false;
        let mut auth_header = String::new();
        loop {
            let mut line = String::new();
            match reader.read_line(&mut line).await {
                Ok(0) => return, // connection closed
                Ok(_) => {}
                Err(_) => return,
            }
            let line = line.trim_end();
            if !saw_request_line {
                saw_request_line = true;
                continue;
            }
            if line.is_empty() {
                break;
            }
            let lower = line.to_ascii_lowercase();
            if let Some(v) = lower.strip_prefix("content-length:") {
                content_length = v.trim().parse().unwrap_or(0);
            }
            if let Some(v) = line
                .strip_prefix("authorization:")
                .or_else(|| line.strip_prefix("Authorization:"))
            {
                auth_header = v.trim().to_string();
            }
        }

        // Read the body.
        let mut body = vec![0u8; content_length];
        if reader.read_exact(&mut body).await.is_err() {
            return;
        }
        let message: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
        let method = message.get("method").and_then(Value::as_str).unwrap_or("");
        let id = message.get("id").cloned();

        let (status, payload) = match (method, id) {
            // Notification: 202, empty body.
            (_, None) => ("202 Accepted", None),
            ("initialize", Some(id)) => (
                "200 OK",
                Some(json!({
                    "jsonrpc": "2.0", "id": id,
                    "result": {
                        "protocolVersion": message["params"]["protocolVersion"],
                        "capabilities": {},
                        "serverInfo": { "name": "fake-http", "version": "0" }
                    }
                })),
            ),
            ("tools/list", Some(id)) => (
                "200 OK",
                Some(json!({
                    "jsonrpc": "2.0", "id": id,
                    "result": { "tools": [
                        { "name": "whoami", "description": "Reports the auth header",
                          "inputSchema": { "type": "object" } }
                    ] }
                })),
            ),
            ("tools/call", Some(id)) => (
                "200 OK",
                Some(json!({
                    "jsonrpc": "2.0", "id": id,
                    "result": {
                        "content": [ { "type": "text", "text": format!("auth={auth_header}") } ],
                        "isError": false
                    }
                })),
            ),
            (other, Some(id)) => (
                "200 OK",
                Some(json!({
                    "jsonrpc": "2.0", "id": id,
                    "error": { "code": -32601, "message": format!("no method {other}") }
                })),
            ),
        };

        let body = payload.map(|p| p.to_string()).unwrap_or_default();
        let response = format!(
            "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nMcp-Session-Id: sess-123\r\nContent-Length: {}\r\n\r\n{body}",
            body.len()
        );
        if reader
            .get_mut()
            .write_all(response.as_bytes())
            .await
            .is_err()
        {
            return;
        }
    }
}

#[tokio::test]
async fn http_transport_end_to_end() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(serve(listener));

    let mut def = McpServerDefinition::http("remote", format!("http://{addr}/mcp"));
    if let rustra_mcp::McpTransport::Http { headers, .. } = &mut def.transport {
        headers.insert("Authorization".into(), "Bearer test-token".into());
    }
    def.timeout_ms = Some(5_000);

    let client = McpClient::connect(&def).await.unwrap();

    let tools = client.list_tools().await.unwrap();
    assert_eq!(tools.len(), 1);
    assert_eq!(tools[0].name, "whoami");

    // Configured headers reach the server on every request.
    let out = client.call_tool("whoami", json!({})).await.unwrap();
    assert_eq!(out["content"], "auth=Bearer test-token");
    assert_eq!(out["is_error"], false);
}

#[tokio::test]
async fn http_unreachable_is_unavailable() {
    // Bind then drop a listener to get a port that refuses connections.
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    drop(listener);

    let mut def = McpServerDefinition::http("gone", format!("http://{addr}/mcp"));
    def.timeout_ms = Some(1_000);
    let err = McpClient::connect(&def).await.unwrap_err();
    assert!(matches!(err, Error::Unavailable(_)), "got {err:?}");
}
