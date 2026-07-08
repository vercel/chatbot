//! A minimal MCP client: JSON-RPC 2.0 over stdio or HTTP.
//!
//! Implements exactly the slice of the Model Context Protocol the framework
//! needs for config-only servers: `initialize` /
//! `notifications/initialized`, `tools/list`, and `tools/call`.
//!
//! * **stdio** — the child process is spawned with `kill_on_drop`; messages
//!   are newline-delimited JSON (the MCP stdio framing). A background reader
//!   task routes responses to waiting requests by id and ignores
//!   notifications/requests originating from the server.
//! * **http** — each JSON-RPC message is POSTed to the configured URL
//!   (simplified Streamable HTTP: plain request/response bodies, no SSE
//!   stream). An `Mcp-Session-Id` returned by the server is echoed on
//!   subsequent requests.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::{oneshot, Mutex};

use rustra_core::{Error, Result};

use crate::config::{McpServerDefinition, McpTransport};

/// The MCP protocol revision this client advertises.
pub const MCP_PROTOCOL_VERSION: &str = "2025-06-18";

/// A tool advertised by a connected MCP server (`tools/list` entry).
#[derive(Debug, Clone, PartialEq)]
pub struct McpToolInfo {
    pub name: String,
    pub description: String,
    /// JSON Schema of the tool input (`inputSchema`); defaults to a bare
    /// object schema when the server omits it.
    pub input_schema: Value,
}

type Pending = Arc<StdMutex<HashMap<u64, oneshot::Sender<Value>>>>;

/// A connected MCP client. Cheap to share behind an `Arc`; all methods take
/// `&self`.
pub struct McpClient {
    server_name: String,
    timeout: Duration,
    next_id: AtomicU64,
    transport: Transport,
}

enum Transport {
    Stdio(Box<StdioTransport>),
    Http(HttpTransport),
}

struct StdioTransport {
    child: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
    pending: Pending,
    reader: tokio::task::JoinHandle<()>,
}

impl Drop for StdioTransport {
    fn drop(&mut self) {
        // The child itself is killed by `kill_on_drop`; stop the reader too.
        self.reader.abort();
    }
}

struct HttpTransport {
    client: reqwest::Client,
    url: String,
    session_id: StdMutex<Option<String>>,
}

impl McpClient {
    /// Spawn/dial the server described by `definition`, run the MCP
    /// initialize handshake, and return a ready client.
    ///
    /// For stdio transports the `env` map is passed to the child verbatim —
    /// resolve secret placeholders first via
    /// [`McpServerDefinition::resolve_env`].
    pub async fn connect(definition: &McpServerDefinition) -> Result<Self> {
        definition.validate()?;
        let transport = match &definition.transport {
            McpTransport::Stdio { command, args, env } => Transport::Stdio(Box::new(
                StdioTransport::spawn(&definition.name, command, args, env)?,
            )),
            McpTransport::Http { url, headers } => {
                Transport::Http(HttpTransport::new(url, headers, definition.timeout())?)
            }
        };
        let client = Self {
            server_name: definition.name.clone(),
            timeout: definition.timeout(),
            next_id: AtomicU64::new(1),
            transport,
        };
        client.initialize().await?;
        Ok(client)
    }

    /// The configured server name (used as the tool namespace).
    pub fn server_name(&self) -> &str {
        &self.server_name
    }

    /// MCP handshake: `initialize` request then `notifications/initialized`.
    async fn initialize(&self) -> Result<()> {
        let result = self
            .request(
                "initialize",
                json!({
                    "protocolVersion": MCP_PROTOCOL_VERSION,
                    "capabilities": {},
                    "clientInfo": {
                        "name": "rustra",
                        "version": env!("CARGO_PKG_VERSION"),
                    },
                }),
            )
            .await?;
        tracing::debug!(
            server = %self.server_name,
            protocol = %result.get("protocolVersion").and_then(|v| v.as_str()).unwrap_or("?"),
            "mcp server initialized"
        );
        self.notify("notifications/initialized").await
    }

    /// `tools/list` — the tools the server exposes. Entries without a name
    /// are skipped; missing descriptions/schemas get safe defaults.
    pub async fn list_tools(&self) -> Result<Vec<McpToolInfo>> {
        let result = self.request("tools/list", json!({})).await?;
        let raw = result.get("tools").and_then(Value::as_array).cloned().unwrap_or_default();
        let mut tools = Vec::with_capacity(raw.len());
        for entry in raw {
            let Some(name) = entry.get("name").and_then(Value::as_str) else {
                tracing::warn!(server = %self.server_name, "mcp tool entry without a name, skipping");
                continue;
            };
            tools.push(McpToolInfo {
                name: name.to_string(),
                description: entry
                    .get("description")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                input_schema: entry
                    .get("inputSchema")
                    .cloned()
                    .unwrap_or_else(|| json!({ "type": "object" })),
            });
        }
        Ok(tools)
    }

    /// `tools/call` — invoke `name` with `arguments`.
    ///
    /// Text content items in the result are concatenated; the return value is
    /// `{"content": <text>, "is_error": false}`. A result flagged with
    /// `isError: true` becomes [`Error::Mcp`].
    pub async fn call_tool(&self, name: &str, arguments: Value) -> Result<Value> {
        let result = self
            .request("tools/call", json!({ "name": name, "arguments": arguments }))
            .await?;
        let text = result
            .get("content")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter(|item| item.get("type").and_then(Value::as_str) == Some("text"))
                    .filter_map(|item| item.get("text").and_then(Value::as_str))
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default();
        if result.get("isError").and_then(Value::as_bool).unwrap_or(false) {
            return Err(Error::Mcp(format!(
                "tool `{name}` on server `{}` reported an error: {text}",
                self.server_name
            )));
        }
        Ok(json!({ "content": text, "is_error": false }))
    }

    /// Tear the connection down: kill the child process (stdio) and stop the
    /// background reader. Dropping the client has the same effect
    /// (`kill_on_drop`); this makes it explicit and awaits the kill.
    pub async fn disconnect(&self) -> Result<()> {
        if let Transport::Stdio(stdio) = &self.transport {
            stdio.reader.abort();
            // Closing stdin lets well-behaved servers exit on their own...
            *stdio.stdin.lock().await = None;
            // ...but do not wait for them: kill outright.
            if let Some(mut child) = stdio.child.lock().await.take() {
                if let Err(e) = child.kill().await {
                    tracing::debug!(server = %self.server_name, error = %e, "mcp child kill failed");
                }
            }
        }
        Ok(())
    }

    /// One JSON-RPC request/response round-trip with the configured timeout.
    async fn request(&self, method: &str, params: Value) -> Result<Value> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let message = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
        let round_trip = async {
            match &self.transport {
                Transport::Stdio(t) => t.request(id, &message).await,
                Transport::Http(t) => t.request(&message).await,
            }
        };
        let response = match tokio::time::timeout(self.timeout, round_trip).await {
            Ok(result) => result?,
            Err(_) => {
                if let Transport::Stdio(t) = &self.transport {
                    t.forget(id);
                }
                return Err(Error::Timeout(format!(
                    "mcp request `{method}` to server `{}` timed out after {:?}",
                    self.server_name, self.timeout
                )));
            }
        };
        if let Some(err) = response.get("error") {
            let code = err.get("code").and_then(Value::as_i64).unwrap_or(0);
            let msg = err.get("message").and_then(Value::as_str).unwrap_or("unknown error");
            return Err(Error::Mcp(format!(
                "server `{}` returned JSON-RPC error {code} for `{method}`: {msg}",
                self.server_name
            )));
        }
        Ok(response.get("result").cloned().unwrap_or(Value::Null))
    }

    /// Fire-and-forget JSON-RPC notification.
    async fn notify(&self, method: &str) -> Result<()> {
        let message = json!({ "jsonrpc": "2.0", "method": method });
        match &self.transport {
            Transport::Stdio(t) => t.send(&message).await,
            Transport::Http(t) => t.notify(&message).await,
        }
    }
}

impl std::fmt::Debug for McpClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("McpClient")
            .field("server_name", &self.server_name)
            .field("timeout", &self.timeout)
            .finish_non_exhaustive()
    }
}

// ---------------------------------------------------------------------------
// stdio transport
// ---------------------------------------------------------------------------

impl StdioTransport {
    fn spawn(
        server: &str,
        command: &str,
        args: &[String],
        env: &std::collections::BTreeMap<String, String>,
    ) -> Result<Self> {
        let mut child = Command::new(command)
            .args(args)
            .envs(env)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| {
                Error::Unavailable(format!("failed to spawn mcp server `{server}` (`{command}`): {e}"))
            })?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| Error::Mcp(format!("mcp server `{server}`: child stdin unavailable")))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| Error::Mcp(format!("mcp server `{server}`: child stdout unavailable")))?;
        let pending: Pending = Arc::new(StdMutex::new(HashMap::new()));
        let reader = tokio::spawn(read_loop(server.to_string(), stdout, Arc::clone(&pending)));
        Ok(Self {
            child: Mutex::new(Some(child)),
            stdin: Mutex::new(Some(stdin)),
            pending,
            reader,
        })
    }

    /// Send a request and await its response (routed by the reader task).
    async fn request(&self, id: u64, message: &Value) -> Result<Value> {
        let (tx, rx) = oneshot::channel();
        self.pending.lock().expect("mcp pending map poisoned").insert(id, tx);
        if let Err(e) = self.send(message).await {
            self.forget(id);
            return Err(e);
        }
        rx.await.map_err(|_| {
            Error::Unavailable("mcp server closed the connection before responding".into())
        })
    }

    /// Write one newline-delimited JSON message to the child's stdin.
    async fn send(&self, message: &Value) -> Result<()> {
        let mut line = serde_json::to_string(message)?;
        line.push('\n');
        let mut guard = self.stdin.lock().await;
        let stdin = guard
            .as_mut()
            .ok_or_else(|| Error::Unavailable("mcp stdio transport is disconnected".into()))?;
        stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| Error::Unavailable(format!("failed to write to mcp server stdin: {e}")))?;
        stdin
            .flush()
            .await
            .map_err(|e| Error::Unavailable(format!("failed to flush mcp server stdin: {e}")))
    }

    /// Drop a pending request (after a timeout or a failed write).
    fn forget(&self, id: u64) {
        self.pending.lock().expect("mcp pending map poisoned").remove(&id);
    }
}

/// Background reader: parse each stdout line and route responses by id.
/// Server-initiated notifications and requests are logged and ignored (this
/// client declares no capabilities, so servers should not expect answers).
async fn read_loop(server: String, stdout: ChildStdout, pending: Pending) {
    let mut lines = BufReader::new(stdout).lines();
    // Ends on EOF or a broken pipe.
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        let message: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(server = %server, error = %e, "unparseable mcp stdio line");
                continue;
            }
        };
        let is_response = message.get("result").is_some() || message.get("error").is_some();
        match message.get("id").and_then(Value::as_u64) {
            Some(id) if is_response => {
                let tx = pending.lock().expect("mcp pending map poisoned").remove(&id);
                match tx {
                    // Send fails only if the requester gave up (timeout).
                    Some(tx) => drop(tx.send(message)),
                    None => tracing::debug!(server = %server, id, "mcp response for unknown id"),
                }
            }
            _ => {
                tracing::debug!(
                    server = %server,
                    method = %message.get("method").and_then(|v| v.as_str()).unwrap_or("?"),
                    "ignoring server-initiated mcp message"
                );
            }
        }
    }
    // Wake every waiter with a "connection closed" error (dropping the
    // senders makes their `rx.await` fail).
    pending.lock().expect("mcp pending map poisoned").clear();
}

// ---------------------------------------------------------------------------
// http transport
// ---------------------------------------------------------------------------

impl HttpTransport {
    fn new(
        url: &str,
        headers: &std::collections::BTreeMap<String, String>,
        timeout: Duration,
    ) -> Result<Self> {
        let mut header_map = reqwest::header::HeaderMap::new();
        for (name, value) in headers {
            let name = reqwest::header::HeaderName::from_bytes(name.as_bytes())
                .map_err(|e| Error::Config(format!("invalid mcp header name `{name}`: {e}")))?;
            let value = reqwest::header::HeaderValue::from_str(value)
                .map_err(|e| Error::Config(format!("invalid mcp header value for `{name:?}`: {e}")))?;
            header_map.insert(name, value);
        }
        let client = reqwest::Client::builder()
            .default_headers(header_map)
            .timeout(timeout)
            .build()
            .map_err(|e| Error::Config(format!("failed to build mcp http client: {e}")))?;
        Ok(Self { client, url: url.to_string(), session_id: StdMutex::new(None) })
    }

    fn post(&self, message: &Value) -> reqwest::RequestBuilder {
        let mut req = self
            .client
            .post(&self.url)
            .header(reqwest::header::ACCEPT, "application/json")
            .json(message);
        let session = self.session_id.lock().expect("mcp session id poisoned").clone();
        if let Some(session) = session {
            req = req.header("Mcp-Session-Id", session);
        }
        req
    }

    fn remember_session(&self, response: &reqwest::Response) {
        if let Some(session) = response
            .headers()
            .get("mcp-session-id")
            .and_then(|v| v.to_str().ok())
        {
            *self.session_id.lock().expect("mcp session id poisoned") = Some(session.to_string());
        }
    }

    async fn request(&self, message: &Value) -> Result<Value> {
        let response = self
            .post(message)
            .send()
            .await
            .map_err(|e| Error::Unavailable(format!("mcp http request failed: {e}")))?;
        self.remember_session(&response);
        let status = response.status();
        if !status.is_success() {
            return Err(Error::Mcp(format!("mcp http endpoint returned status {status}")));
        }
        if response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .is_some_and(|ct| ct.starts_with("text/event-stream"))
        {
            return Err(Error::Mcp(
                "mcp http endpoint answered with an SSE stream, which this client does not support".into(),
            ));
        }
        response
            .json::<Value>()
            .await
            .map_err(|e| Error::Mcp(format!("invalid JSON-RPC response body: {e}")))
    }

    async fn notify(&self, message: &Value) -> Result<()> {
        let response = self
            .post(message)
            .send()
            .await
            .map_err(|e| Error::Unavailable(format!("mcp http notification failed: {e}")))?;
        self.remember_session(&response);
        let status = response.status();
        if !status.is_success() {
            return Err(Error::Mcp(format!(
                "mcp http endpoint returned status {status} for a notification"
            )));
        }
        Ok(())
    }
}
