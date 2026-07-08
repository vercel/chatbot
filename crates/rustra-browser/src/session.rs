//! Browser sessions: the [`BrowserSession`] trait, the command-queue
//! [`RemoteBrowserSession`] bridge, and the replayable [`ActionLog`].

use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;
use std::time::Duration;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;

use rustra_core::{new_id, Error, Result};

use crate::action::{BrowserAction, BrowserActionResult};

/// Default time to wait for the client-side executor to answer a command.
pub const DEFAULT_COMMAND_TIMEOUT: Duration = Duration::from_secs(30);

/// Lock helper that recovers from poisoning (a panicked holder cannot leave
/// the queue in an invalid state — every mutation is a single push/pop).
fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// An active browser being driven on behalf of one user.
#[async_trait]
pub trait BrowserSession: Send + Sync {
    fn id(&self) -> &str;

    /// Execute one action and wait for its result.
    async fn perform(&self, action: BrowserAction) -> Result<BrowserActionResult>;
}

/// A command handed to the client-side executor by the polling endpoint.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IssuedCommand {
    pub id: String,
    pub action: BrowserAction,
}

/// A queued command still waiting to be picked up by the executor.
struct PendingCommand {
    id: String,
    action: BrowserAction,
    responder: oneshot::Sender<BrowserActionResult>,
}

/// One entry of the replayable action log.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LoggedAction {
    /// Monotonic sequence number within the session (0-based).
    pub seq: u64,
    pub action: BrowserAction,
    pub result: BrowserActionResult,
    pub at: DateTime<Utc>,
}

/// A serializable, replayable record of everything a session did.
#[derive(Debug, Default)]
pub struct ActionLog {
    entries: Mutex<Vec<LoggedAction>>,
}

impl ActionLog {
    pub fn new() -> Self {
        Self::default()
    }

    /// Append an action/result pair; returns its sequence number.
    pub fn record(&self, action: BrowserAction, result: BrowserActionResult) -> u64 {
        let mut entries = lock(&self.entries);
        let seq = entries.len() as u64;
        entries.push(LoggedAction { seq, action, result, at: Utc::now() });
        seq
    }

    /// All entries, oldest first.
    pub fn entries(&self) -> Vec<LoggedAction> {
        lock(&self.entries).clone()
    }

    /// The action sequence in execution order — feed it back through
    /// `perform` to replay the session.
    pub fn replay_script(&self) -> Vec<BrowserAction> {
        lock(&self.entries).iter().map(|entry| entry.action.clone()).collect()
    }

    pub fn len(&self) -> usize {
        lock(&self.entries).len()
    }

    pub fn is_empty(&self) -> bool {
        lock(&self.entries).is_empty()
    }
}

/// The default [`BrowserSession`]: a command-queue bridge for a client-side
/// executor (the Chrome extension, or any WebDriver-BiDi/Playwright shim).
///
/// Flow: `perform` enqueues the command and awaits a oneshot; the server's
/// polling endpoint drains the queue with [`next_command`] on behalf of the
/// executor; the executor runs the action in the page and posts the outcome
/// back through [`submit_result`], which completes the oneshot. Commands not
/// answered within the configured timeout fail with [`Error::Timeout`] and
/// are dropped from the bridge.
///
/// [`next_command`]: Self::next_command
/// [`submit_result`]: Self::submit_result
pub struct RemoteBrowserSession {
    id: String,
    user_id: String,
    command_timeout: Duration,
    queue: Mutex<VecDeque<PendingCommand>>,
    inflight: Mutex<HashMap<String, oneshot::Sender<BrowserActionResult>>>,
    log: ActionLog,
}

impl RemoteBrowserSession {
    /// Create a session (id `brw_...`) owned by `user_id` with the default
    /// 30s command timeout.
    pub fn new(user_id: impl Into<String>) -> Self {
        Self::with_timeout(user_id, DEFAULT_COMMAND_TIMEOUT)
    }

    pub fn with_timeout(user_id: impl Into<String>, command_timeout: Duration) -> Self {
        Self {
            id: new_id("brw"),
            user_id: user_id.into(),
            command_timeout,
            queue: Mutex::new(VecDeque::new()),
            inflight: Mutex::new(HashMap::new()),
            log: ActionLog::new(),
        }
    }

    /// The session id (`brw_...`). Also available via [`BrowserSession::id`].
    pub fn id(&self) -> &str {
        &self.id
    }

    /// The user this session belongs to.
    pub fn user_id(&self) -> &str {
        &self.user_id
    }

    /// The session's replayable action log.
    pub fn log(&self) -> &ActionLog {
        &self.log
    }

    /// Pop the next queued command for the client-side executor (called by
    /// the server's polling endpoint). The command moves to the in-flight
    /// set until [`Self::submit_result`] answers it.
    pub fn next_command(&self) -> Option<IssuedCommand> {
        let pending = lock(&self.queue).pop_front()?;
        let issued = IssuedCommand { id: pending.id.clone(), action: pending.action };
        lock(&self.inflight).insert(pending.id, pending.responder);
        Some(issued)
    }

    /// Complete an in-flight command with the executor's result.
    pub fn submit_result(&self, command_id: &str, result: BrowserActionResult) -> Result<()> {
        let responder = lock(&self.inflight)
            .remove(command_id)
            .ok_or_else(|| Error::not_found("browser_command", command_id))?;
        responder.send(result).map_err(|_| {
            Error::Unavailable(format!("no caller is awaiting browser command `{command_id}`"))
        })
    }

    /// Drop a command from both the queue and the in-flight set (timeout
    /// cleanup).
    fn forget(&self, command_id: &str) {
        lock(&self.queue).retain(|pending| pending.id != command_id);
        lock(&self.inflight).remove(command_id);
    }
}

impl std::fmt::Debug for RemoteBrowserSession {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RemoteBrowserSession")
            .field("id", &self.id)
            .field("user_id", &self.user_id)
            .field("command_timeout", &self.command_timeout)
            .field("queued", &lock(&self.queue).len())
            .field("inflight", &lock(&self.inflight).len())
            .finish_non_exhaustive()
    }
}

#[async_trait]
impl BrowserSession for RemoteBrowserSession {
    fn id(&self) -> &str {
        &self.id
    }

    async fn perform(&self, action: BrowserAction) -> Result<BrowserActionResult> {
        let command_id = new_id("cmd");
        let (responder, receiver) = oneshot::channel();
        lock(&self.queue).push_back(PendingCommand {
            id: command_id.clone(),
            action: action.clone(),
            responder,
        });

        match tokio::time::timeout(self.command_timeout, receiver).await {
            Ok(Ok(result)) => {
                self.log.record(action, result.clone());
                Ok(result)
            }
            Ok(Err(_dropped)) => {
                let failure = BrowserActionResult::failure("executor dropped the command");
                self.log.record(action, failure);
                Err(Error::Unavailable(format!(
                    "browser executor dropped command `{command_id}`"
                )))
            }
            Err(_elapsed) => {
                self.forget(&command_id);
                self.log.record(
                    action,
                    BrowserActionResult::failure(format!(
                        "timed out after {:?}",
                        self.command_timeout
                    )),
                );
                Err(Error::Timeout(format!(
                    "browser command `{command_id}` was not answered within {:?}",
                    self.command_timeout
                )))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Arc;

    /// Drive the "extension side": poll for commands and answer them with
    /// `respond` until `count` commands have been served.
    async fn serve_commands(
        session: Arc<RemoteBrowserSession>,
        count: usize,
        respond: impl Fn(&IssuedCommand) -> BrowserActionResult,
    ) {
        let mut served = 0;
        while served < count {
            match session.next_command() {
                Some(command) => {
                    session.submit_result(&command.id, respond(&command)).unwrap();
                    served += 1;
                }
                None => tokio::task::yield_now().await,
            }
        }
    }

    #[tokio::test]
    async fn enqueue_poll_submit_roundtrip_completes_perform() {
        let session = Arc::new(RemoteBrowserSession::new("u1"));
        assert!(session.id().starts_with("brw_"));

        let server_side = tokio::spawn(serve_commands(session.clone(), 1, |command| {
            assert!(command.id.starts_with("cmd_"));
            assert_eq!(
                command.action,
                BrowserAction::Navigate { url: "https://example.com".into() }
            );
            BrowserActionResult::success(json!({ "loaded": true }))
        }));

        let result = session
            .perform(BrowserAction::Navigate { url: "https://example.com".into() })
            .await
            .unwrap();
        assert!(result.ok);
        assert_eq!(result.data["loaded"], true);
        server_side.await.unwrap();

        // Nothing left queued or in flight.
        assert!(session.next_command().is_none());
    }

    #[tokio::test]
    async fn unanswered_command_times_out_and_is_forgotten() {
        let session = RemoteBrowserSession::with_timeout("u1", Duration::from_millis(20));
        let err = session.perform(BrowserAction::Screenshot).await.unwrap_err();
        assert!(matches!(err, Error::Timeout(_)));

        // The command was dropped: the executor finds nothing to run and a
        // late result is rejected.
        assert!(session.next_command().is_none());
        let entries = session.log().entries();
        assert_eq!(entries.len(), 1);
        assert!(!entries[0].result.ok);
    }

    #[tokio::test]
    async fn late_submit_after_timeout_is_not_found() {
        let session = Arc::new(RemoteBrowserSession::with_timeout("u1", Duration::from_millis(20)));
        let perform = tokio::spawn({
            let session = session.clone();
            async move { session.perform(BrowserAction::Screenshot).await }
        });
        // Pick the command up but never answer until after the timeout.
        let command = loop {
            match session.next_command() {
                Some(command) => break command,
                None => tokio::task::yield_now().await,
            }
        };
        assert!(matches!(perform.await.unwrap().unwrap_err(), Error::Timeout(_)));
        let err = session
            .submit_result(&command.id, BrowserActionResult::success(json!(null)))
            .unwrap_err();
        assert!(matches!(err, Error::NotFound { kind: "browser_command", .. }));
    }

    #[tokio::test]
    async fn action_log_replays_in_order() {
        let session = Arc::new(RemoteBrowserSession::new("u1"));
        let actions = vec![
            BrowserAction::Navigate { url: "https://example.com".into() },
            BrowserAction::Click { selector: "#go".into() },
            BrowserAction::ReadDom { selector: Some("main".into()) },
        ];

        let server_side = tokio::spawn(serve_commands(session.clone(), actions.len(), |_| {
            BrowserActionResult::success(json!("done"))
        }));
        for action in &actions {
            session.perform(action.clone()).await.unwrap();
        }
        server_side.await.unwrap();

        assert_eq!(session.log().replay_script(), actions);
        let entries = session.log().entries();
        assert_eq!(entries.iter().map(|e| e.seq).collect::<Vec<_>>(), vec![0, 1, 2]);
        assert!(entries.iter().all(|e| e.result.ok));

        // The log serializes (replay scripts are shippable artifacts).
        let encoded = serde_json::to_string(&entries).unwrap();
        let decoded: Vec<LoggedAction> = serde_json::from_str(&encoded).unwrap();
        assert_eq!(decoded, entries);
    }

    #[test]
    fn submit_for_unknown_command_is_not_found() {
        let session = RemoteBrowserSession::new("u1");
        let err = session
            .submit_result("cmd_missing", BrowserActionResult::success(json!(null)))
            .unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }
}
