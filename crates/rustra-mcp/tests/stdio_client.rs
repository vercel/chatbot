//! End-to-end tests of the stdio transport and the tool bridge against the
//! hermetic `fake_mcp_server` binary shipped with this crate.

use std::collections::BTreeMap;
use std::sync::Arc;

use rustra_core::{Error, Principal, RuntimeContext, ToolContext};
use rustra_mcp::{McpClient, McpServerDefinition, McpToolset, McpTransport};
use serde_json::json;

fn fake_server_def(name: &str, timeout_ms: u64) -> McpServerDefinition {
    McpServerDefinition::stdio(name, env!("CARGO_BIN_EXE_fake_mcp_server"), vec![])
        .with_timeout_ms(timeout_ms)
}

#[tokio::test]
async fn connect_list_and_call() {
    let client = McpClient::connect(&fake_server_def("fake", 5_000))
        .await
        .unwrap();
    assert_eq!(client.server_name(), "fake");

    let tools = client.list_tools().await.unwrap();
    let names: Vec<_> = tools.iter().map(|t| t.name.as_str()).collect();
    assert_eq!(names, vec!["echo", "fail", "slow"]);

    let echo = &tools[0];
    assert_eq!(echo.description, "Echo the arguments back as text");
    assert_eq!(echo.input_schema["type"], "object");

    // Missing description / inputSchema handled gracefully.
    let slow = &tools[2];
    assert_eq!(slow.description, "");
    assert_eq!(slow.input_schema, json!({ "type": "object" }));

    // Text content items are concatenated (non-text items ignored).
    let out = client.call_tool("echo", json!({ "x": 1 })).await.unwrap();
    assert_eq!(out["is_error"], false);
    let content = out["content"].as_str().unwrap();
    assert!(content.contains("echo:"), "content: {content}");
    assert!(content.contains("\"x\":1"), "content: {content}");

    client.disconnect().await.unwrap();
}

#[tokio::test]
async fn tool_error_result_becomes_mcp_error() {
    let client = McpClient::connect(&fake_server_def("fake", 5_000))
        .await
        .unwrap();
    let err = client.call_tool("fail", json!({})).await.unwrap_err();
    assert!(
        matches!(&err, Error::Mcp(msg) if msg.contains("boom")),
        "got {err:?}"
    );
    client.disconnect().await.unwrap();
}

#[tokio::test]
async fn jsonrpc_error_becomes_mcp_error() {
    let client = McpClient::connect(&fake_server_def("fake", 5_000))
        .await
        .unwrap();
    let err = client
        .call_tool("nonexistent", json!({}))
        .await
        .unwrap_err();
    assert!(
        matches!(&err, Error::Mcp(msg) if msg.contains("unknown tool")),
        "got {err:?}"
    );
    client.disconnect().await.unwrap();
}

#[tokio::test]
async fn slow_tool_times_out() {
    let client = McpClient::connect(&fake_server_def("fake", 300))
        .await
        .unwrap();
    let err = client.call_tool("slow", json!({})).await.unwrap_err();
    assert!(matches!(err, Error::Timeout(_)), "got {err:?}");
    client.disconnect().await.unwrap();
}

#[tokio::test]
async fn spawn_failure_is_unavailable() {
    let mut def = fake_server_def("ghost", 1_000);
    def.transport = McpTransport::Stdio {
        command: "/nonexistent/mcp-server-binary".into(),
        args: vec![],
        env: BTreeMap::new(),
    };
    let err = McpClient::connect(&def).await.unwrap_err();
    assert!(matches!(err, Error::Unavailable(_)), "got {err:?}");
}

#[tokio::test]
async fn bridge_namespaces_and_filters_tools() {
    let mut def = fake_server_def("fake", 5_000);
    def.allowed_tools = Some(vec!["echo".into()]);
    def.require_tool_approval = true;

    let client = Arc::new(McpClient::connect(&def).await.unwrap());
    let toolset = McpToolset::new(Arc::clone(&client), def);

    let tools = toolset.tools().await.unwrap();
    assert_eq!(tools.len(), 1, "allowed_tools should filter out fail/slow");
    let tool = &tools[0];
    assert_eq!(tool.id(), "fake_echo");
    assert_eq!(tool.spec().id, "fake_echo");

    let ctx = ToolContext::new(RuntimeContext::new(Principal::user("u1")));
    let out = tool
        .execute(json!({ "hello": "world" }), &ctx)
        .await
        .unwrap();
    assert!(out["content"].as_str().unwrap().contains("hello"));

    client.disconnect().await.unwrap();
}

#[tokio::test]
async fn bridge_exposes_all_tools_without_allowlist() {
    let def = fake_server_def("fake", 5_000);
    let client = Arc::new(McpClient::connect(&def).await.unwrap());
    let toolset = McpToolset::new(Arc::clone(&client), def);

    let ids: Vec<_> = toolset
        .tools()
        .await
        .unwrap()
        .iter()
        .map(|t| t.id().to_string())
        .collect();
    assert_eq!(ids, vec!["fake_echo", "fake_fail", "fake_slow"]);

    client.disconnect().await.unwrap();
}
