//! A minimal, generic LSP client speaking JSON-RPC over stdio with
//! `Content-Length` framing.
//!
//! The client covers the small slice of the protocol workspaces need:
//! `initialize`/`initialized`, `textDocument/didOpen`, waiting for
//! `textDocument/publishDiagnostics`, and `shutdown`/`exit`. A background
//! task reads framed messages from the server's stdout; responses are routed
//! to their awaiting request by id, notifications are pushed into a channel
//! consumed by [`LspClient::diagnostics_for`].
//!
//! The framing codec (`encode_message` / `read_message`) is kept as free
//! functions (not methods) so it can be tested with in-memory buffers — no
//! language server needs to be installed to test this module.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;
use tokio::io::{AsyncBufRead, AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{mpsc, oneshot, Mutex};

use rustra_core::{Error, Result};

/// How long to wait for the server's `initialize` response.
const INITIALIZE_TIMEOUT: Duration = Duration::from_secs(15);
/// How long `shutdown` waits for the request/exit before killing the process.
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(2);
/// Upper bound on a single framed LSP message body; anything larger is treated
/// as a framing error rather than allocated.
const MAX_LSP_MESSAGE_BYTES: usize = 64 * 1024 * 1024;

/// How to launch a language server.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LspServerConfig {
    /// Language id sent in `textDocument/didOpen` (e.g. `typescript`).
    pub language: String,
    /// Executable name or path.
    pub command: String,
    /// Arguments passed to `command` (e.g. `--stdio`).
    pub args: Vec<String>,
}

impl LspServerConfig {
    /// `typescript-language-server --stdio` (JS/TS).
    pub fn typescript() -> Self {
        Self {
            language: "typescript".into(),
            command: "typescript-language-server".into(),
            args: vec!["--stdio".into()],
        }
    }

    /// `pyright-langserver --stdio` (Python).
    pub fn python() -> Self {
        Self {
            language: "python".into(),
            command: "pyright-langserver".into(),
            args: vec!["--stdio".into()],
        }
    }
}

/// A simplified LSP diagnostic (start position + severity + message).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Diagnostic {
    /// 0-based line of the diagnostic's start.
    pub line: u32,
    /// 0-based character of the diagnostic's start.
    pub character: u32,
    /// LSP severity (1 = error … 4 = hint) when reported.
    pub severity: Option<u8>,
    /// Human-readable message as reported by the server.
    pub message: String,
}

// ---------------------------------------------------------------------------
// Framing codec
// ---------------------------------------------------------------------------

/// Encode a JSON-RPC message with LSP `Content-Length` framing.
pub(crate) fn encode_message(message: &Value) -> Vec<u8> {
    let body = message.to_string();
    let mut framed = format!("Content-Length: {}\r\n\r\n", body.len()).into_bytes();
    framed.extend_from_slice(body.as_bytes());
    framed
}

/// Read one `Content-Length`-framed JSON-RPC message. Returns `Ok(None)` on
/// a clean EOF (stream closed between messages).
pub(crate) async fn read_message<R>(reader: &mut R) -> Result<Option<Value>>
where
    R: AsyncBufRead + Unpin,
{
    let mut content_length: Option<usize> = None;
    let mut saw_header = false;
    let mut line = String::new();
    loop {
        line.clear();
        let read = reader.read_line(&mut line).await?;
        if read == 0 {
            if saw_header {
                return Err(Error::Unavailable("LSP stream closed mid-message".into()));
            }
            return Ok(None);
        }
        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed.is_empty() {
            match content_length {
                Some(_) => break,
                // Tolerate stray blank lines between messages.
                None => continue,
            }
        }
        saw_header = true;
        if let Some((name, value)) = trimmed.split_once(':') {
            if name.trim().eq_ignore_ascii_case("content-length") {
                content_length = Some(value.trim().parse().map_err(|_| {
                    Error::Validation(format!("invalid LSP Content-Length header: `{trimmed}`"))
                })?);
            }
            // Other headers (Content-Type) are ignored.
        }
    }
    let length = content_length
        .ok_or_else(|| Error::Validation("LSP message missing Content-Length".into()))?;
    if length > MAX_LSP_MESSAGE_BYTES {
        return Err(Error::Validation(format!(
            "LSP Content-Length {length} exceeds the {MAX_LSP_MESSAGE_BYTES}-byte limit"
        )));
    }
    let mut body = vec![0u8; length];
    reader.read_exact(&mut body).await?;
    Ok(Some(serde_json::from_slice(&body)?))
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

type PendingMap = Arc<StdMutex<HashMap<i64, oneshot::Sender<Value>>>>;

/// A running language-server process plus the plumbing to talk to it.
pub struct LspClient {
    config: LspServerConfig,
    child: Mutex<Child>,
    stdin: Mutex<ChildStdin>,
    next_id: AtomicI64,
    pending: PendingMap,
    /// Server-initiated notifications (and requests, which we ignore).
    notifications: Mutex<mpsc::UnboundedReceiver<Value>>,
}

impl std::fmt::Debug for LspClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LspClient")
            .field("config", &self.config)
            .finish_non_exhaustive()
    }
}

impl LspClient {
    /// Spawn the configured server rooted at `root`, then perform the
    /// `initialize`/`initialized` handshake.
    ///
    /// Returns [`Error::Unavailable`] when the server binary cannot be
    /// spawned (e.g. not installed).
    pub async fn start(config: LspServerConfig, root: &Path) -> Result<Self> {
        let mut child = Command::new(&config.command)
            .args(&config.args)
            .current_dir(root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| {
                Error::Unavailable(format!(
                    "failed to start {} language server `{}`: {e}; \
                     install it and make sure it is on PATH",
                    config.language, config.command
                ))
            })?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| Error::Unavailable("LSP server stdin was not piped".into()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| Error::Unavailable("LSP server stdout was not piped".into()))?;

        let pending: PendingMap = Arc::default();
        let (notification_tx, notification_rx) = mpsc::unbounded_channel();
        tokio::spawn(reader_loop(
            BufReader::new(stdout),
            Arc::clone(&pending),
            notification_tx,
        ));

        let client = Self {
            config,
            child: Mutex::new(child),
            stdin: Mutex::new(stdin),
            next_id: AtomicI64::new(1),
            pending,
            notifications: Mutex::new(notification_rx),
        };

        let root_uri = path_to_uri(root);
        client
            .request(
                "initialize",
                json!({
                    "processId": std::process::id(),
                    "rootUri": root_uri,
                    "workspaceFolders": [{ "uri": root_uri, "name": "workspace" }],
                    "capabilities": {
                        "textDocument": { "publishDiagnostics": {} }
                    },
                }),
                INITIALIZE_TIMEOUT,
            )
            .await?;
        client.notify("initialized", json!({})).await?;
        Ok(client)
    }

    /// The launch configuration this client was started with.
    pub fn config(&self) -> &LspServerConfig {
        &self.config
    }

    /// Notify the server that a document was opened.
    pub async fn did_open(&self, path: &Path, language_id: &str, text: &str) -> Result<()> {
        self.notify(
            "textDocument/didOpen",
            json!({
                "textDocument": {
                    "uri": path_to_uri(path),
                    "languageId": language_id,
                    "version": 1,
                    "text": text,
                }
            }),
        )
        .await
    }

    /// Open `path` with `text` and wait (up to `timeout`) for the server to
    /// publish diagnostics for it.
    pub async fn diagnostics_for(
        &self,
        path: &Path,
        text: &str,
        timeout: Duration,
    ) -> Result<Vec<Diagnostic>> {
        let uri = path_to_uri(path);
        let mut notifications = self.notifications.lock().await;
        // Discard notifications queued before this didOpen: servers publish
        // diagnostics more than once per open (syntactic then semantic pass),
        // and a leftover publish for the same uri would be returned as this
        // call's — stale — answer.
        while notifications.try_recv().is_ok() {}
        self.did_open(path, &self.config.language, text).await?;

        let deadline = tokio::time::Instant::now() + timeout;
        loop {
            let message = tokio::time::timeout_at(deadline, notifications.recv())
                .await
                .map_err(|_| {
                    Error::Timeout(format!(
                        "no diagnostics for `{}` within {timeout:?}",
                        path.display()
                    ))
                })?
                .ok_or_else(|| Error::Unavailable("LSP server stream closed".into()))?;

            if message.get("method").and_then(Value::as_str)
                != Some("textDocument/publishDiagnostics")
            {
                continue;
            }
            let params = &message["params"];
            if params.get("uri").and_then(Value::as_str) != Some(uri.as_str()) {
                continue;
            }
            let diagnostics = params
                .get("diagnostics")
                .and_then(Value::as_array)
                .map(|list| list.iter().map(parse_diagnostic).collect())
                .unwrap_or_default();
            return Ok(diagnostics);
        }
    }

    /// Politely shut the server down (`shutdown` request + `exit`
    /// notification), killing the process if it does not exit promptly.
    pub async fn shutdown(&self) -> Result<()> {
        let _ = self
            .request("shutdown", Value::Null, SHUTDOWN_TIMEOUT)
            .await;
        let _ = self.notify("exit", Value::Null).await;
        let mut child = self.child.lock().await;
        if tokio::time::timeout(SHUTDOWN_TIMEOUT, child.wait())
            .await
            .is_err()
        {
            child.kill().await?;
        }
        Ok(())
    }

    /// Send a request and await its response (routed back by id).
    async fn request(&self, method: &str, params: Value, timeout: Duration) -> Result<Value> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.lock_pending()?.insert(id, tx);

        let message = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
        if let Err(e) = self.send(&message).await {
            let _ = self.lock_pending().map(|mut p| p.remove(&id));
            return Err(e);
        }

        let response = match tokio::time::timeout(timeout, rx).await {
            Ok(Ok(response)) => response,
            Ok(Err(_)) => {
                return Err(Error::Unavailable(format!(
                    "LSP server exited before answering `{method}`"
                )))
            }
            Err(_) => {
                let _ = self.lock_pending().map(|mut p| p.remove(&id));
                return Err(Error::Timeout(format!("LSP request `{method}` timed out")));
            }
        };
        if let Some(error) = response.get("error") {
            return Err(Error::Other(format!("LSP `{method}` failed: {error}")));
        }
        Ok(response.get("result").cloned().unwrap_or(Value::Null))
    }

    /// Send a notification (no response expected).
    async fn notify(&self, method: &str, params: Value) -> Result<()> {
        self.send(&json!({ "jsonrpc": "2.0", "method": method, "params": params }))
            .await
    }

    async fn send(&self, message: &Value) -> Result<()> {
        let framed = encode_message(message);
        let mut stdin = self.stdin.lock().await;
        stdin.write_all(&framed).await?;
        stdin.flush().await?;
        Ok(())
    }

    fn lock_pending(
        &self,
    ) -> Result<std::sync::MutexGuard<'_, HashMap<i64, oneshot::Sender<Value>>>> {
        self.pending
            .lock()
            .map_err(|_| Error::Other("LSP pending-request map poisoned".into()))
    }
}

/// Background task: read framed messages, route responses to their pending
/// request, forward everything else (notifications) to the channel.
async fn reader_loop<R>(
    mut reader: R,
    pending: PendingMap,
    notifications: mpsc::UnboundedSender<Value>,
) where
    R: AsyncBufRead + Unpin,
{
    loop {
        match read_message(&mut reader).await {
            Ok(Some(message)) => {
                let is_response = message.get("id").is_some() && message.get("method").is_none();
                if is_response {
                    let waiter = message
                        .get("id")
                        .and_then(Value::as_i64)
                        .and_then(|id| pending.lock().ok().and_then(|mut map| map.remove(&id)));
                    if let Some(tx) = waiter {
                        let _ = tx.send(message);
                    }
                } else if notifications.send(message).is_err() {
                    break; // client dropped
                }
            }
            Ok(None) => break,
            Err(e) => {
                tracing::debug!(error = %e, "lsp reader stopped");
                break;
            }
        }
    }
    // The stream is gone: no pending request will ever get a response. Dropping
    // the senders wakes each waiter with a recv error, which request() maps to
    // Unavailable instead of sitting out its full timeout.
    if let Ok(mut map) = pending.lock() {
        map.clear();
    }
}

fn parse_diagnostic(value: &Value) -> Diagnostic {
    Diagnostic {
        line: value
            .pointer("/range/start/line")
            .and_then(Value::as_u64)
            .unwrap_or(0) as u32,
        character: value
            .pointer("/range/start/character")
            .and_then(Value::as_u64)
            .unwrap_or(0) as u32,
        severity: value
            .get("severity")
            .and_then(Value::as_u64)
            .map(|s| s as u8),
        message: value
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
    }
}

fn path_to_uri(path: &Path) -> String {
    format!("file://{}", path.display())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn framing_roundtrip() {
        let message =
            json!({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"a": 1}});
        let bytes = encode_message(&message);
        let text = String::from_utf8(bytes.clone()).unwrap();
        assert!(text.starts_with("Content-Length: "));
        assert!(text.contains("\r\n\r\n"));

        let mut reader = BufReader::new(bytes.as_slice());
        let decoded = read_message(&mut reader).await.unwrap().unwrap();
        assert_eq!(decoded, message);
        // Clean EOF afterwards.
        assert!(read_message(&mut reader).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn decodes_multiple_messages_and_extra_headers() {
        let first = json!({"jsonrpc": "2.0", "method": "one", "params": {}});
        let second = json!({"jsonrpc": "2.0", "id": 7, "result": {"ok": true}});
        let body = second.to_string();
        let mut stream = encode_message(&first);
        // Second message hand-rolled with an extra header and lowercase name.
        stream.extend_from_slice(
            format!(
                "content-length: {}\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n{}",
                body.len(),
                body
            )
            .as_bytes(),
        );

        let mut reader = BufReader::new(stream.as_slice());
        assert_eq!(read_message(&mut reader).await.unwrap().unwrap(), first);
        assert_eq!(read_message(&mut reader).await.unwrap().unwrap(), second);
        assert!(read_message(&mut reader).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn truncated_body_is_an_error() {
        let message = json!({"jsonrpc": "2.0", "method": "x"});
        let mut bytes = encode_message(&message);
        bytes.truncate(bytes.len() - 5);
        let mut reader = BufReader::new(bytes.as_slice());
        assert!(read_message(&mut reader).await.is_err());
    }

    #[tokio::test]
    async fn oversized_content_length_is_an_error() {
        let bytes = b"Content-Length: 999999999999\r\n\r\n".to_vec();
        let mut reader = BufReader::new(bytes.as_slice());
        assert!(read_message(&mut reader).await.is_err());
    }

    #[tokio::test]
    async fn missing_content_length_is_an_error() {
        let bytes = b"Content-Type: application/json\r\n".to_vec();
        let mut reader = BufReader::new(bytes.as_slice());
        assert!(read_message(&mut reader).await.is_err());
    }

    #[tokio::test]
    async fn start_with_missing_server_is_unavailable() {
        let dir = tempfile::tempdir().unwrap();
        let config = LspServerConfig {
            language: "typescript".into(),
            command: "definitely-not-a-real-lsp-server-9c4f".into(),
            args: vec!["--stdio".into()],
        };
        let err = LspClient::start(config, dir.path()).await.unwrap_err();
        assert!(matches!(err, Error::Unavailable(_)), "got: {err}");
    }

    #[test]
    fn default_configs() {
        let ts = LspServerConfig::typescript();
        assert_eq!(ts.command, "typescript-language-server");
        assert_eq!(ts.args, vec!["--stdio".to_string()]);
        let py = LspServerConfig::python();
        assert_eq!(py.command, "pyright-langserver");
        assert_eq!(py.language, "python");
    }

    #[test]
    fn parses_diagnostics() {
        let raw = json!({
            "range": {"start": {"line": 3, "character": 9}, "end": {"line": 3, "character": 12}},
            "severity": 1,
            "message": "Cannot find name 'foo'."
        });
        let diag = parse_diagnostic(&raw);
        assert_eq!(
            diag,
            Diagnostic {
                line: 3,
                character: 9,
                severity: Some(1),
                message: "Cannot find name 'foo'.".into()
            }
        );
    }
}
