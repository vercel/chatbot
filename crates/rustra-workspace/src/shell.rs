//! Policy-guarded shell execution inside a workspace.
//!
//! Commands run under `sh -c` with the workspace's `files/` directory as the
//! working directory. A [`ShellPolicy`] controls availability, a wall-clock
//! timeout (the process is killed on expiry), an output cap, and a denylist
//! of command substrings.

use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::time::Duration;

use rustra_core::{Error, Result};

use crate::fs::Workspace;

/// Guard rails for [`Workspace::exec`].
#[derive(Debug, Clone)]
pub struct ShellPolicy {
    /// Master switch; when false every `exec` is denied.
    pub enabled: bool,
    /// Wall-clock limit; the process is killed when it expires.
    pub timeout: Duration,
    /// Per-stream cap on captured output, in bytes.
    pub max_output_bytes: usize,
    /// Commands containing any of these substrings are denied.
    pub denied_commands: Vec<String>,
}

impl Default for ShellPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            timeout: Duration::from_secs(60),
            max_output_bytes: 512 * 1024,
            denied_commands: vec!["sudo".into(), "shutdown".into(), "reboot".into()],
        }
    }
}

/// The captured result of a shell command.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShellOutput {
    pub stdout: String,
    pub stderr: String,
    /// Process exit code; `-1` when terminated by a signal.
    pub exit_code: i32,
    /// True when stdout and/or stderr were cut at `max_output_bytes`.
    pub truncated: bool,
}

impl Workspace {
    /// Run `sh -c <command>` with cwd = the workspace `files/` directory,
    /// enforcing `policy` (enablement, denylist, timeout, output cap).
    ///
    /// Returns [`Error::PermissionDenied`] for disabled/denied commands and
    /// [`Error::Timeout`] when the timeout expires (the process is killed).
    pub async fn exec(&self, command: &str, policy: &ShellPolicy) -> Result<ShellOutput> {
        if !policy.enabled {
            return Err(Error::PermissionDenied(
                "shell access is disabled for this workspace".into(),
            ));
        }
        if let Some(denied) =
            policy.denied_commands.iter().find(|denied| command.contains(denied.as_str()))
        {
            return Err(Error::PermissionDenied(format!(
                "command contains denied term `{denied}`"
            )));
        }

        let child = tokio::process::Command::new("sh")
            .arg("-c")
            .arg(command)
            .current_dir(self.files_dir())
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            // Dropping the wait future on timeout kills the process.
            .kill_on_drop(true)
            .spawn()?;

        let output = tokio::time::timeout(policy.timeout, child.wait_with_output())
            .await
            .map_err(|_| {
                Error::Timeout(format!(
                    "command exceeded the {:?} shell timeout and was killed",
                    policy.timeout
                ))
            })??;

        let (stdout, out_truncated) = truncate_bytes(output.stdout, policy.max_output_bytes);
        let (stderr, err_truncated) = truncate_bytes(output.stderr, policy.max_output_bytes);
        Ok(ShellOutput {
            stdout,
            stderr,
            exit_code: output.status.code().unwrap_or(-1),
            truncated: out_truncated || err_truncated,
        })
    }
}

/// Lossily decode `bytes`, cutting at `max` bytes first.
fn truncate_bytes(mut bytes: Vec<u8>, max: usize) -> (String, bool) {
    let truncated = bytes.len() > max;
    if truncated {
        bytes.truncate(max);
    }
    (String::from_utf8_lossy(&bytes).into_owned(), truncated)
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn workspace() -> (tempfile::TempDir, Workspace) {
        let dir = tempfile::tempdir().unwrap();
        let ws = Workspace::open("u1", dir.path().join("u1")).await.unwrap();
        (dir, ws)
    }

    #[tokio::test]
    async fn exec_captures_output_and_exit_code() {
        let (_dir, ws) = workspace().await;
        let out = ws.exec("echo hello && echo oops >&2", &ShellPolicy::default()).await.unwrap();
        assert_eq!(out.stdout, "hello\n");
        assert_eq!(out.stderr, "oops\n");
        assert_eq!(out.exit_code, 0);
        assert!(!out.truncated);

        let fail = ws.exec("exit 3", &ShellPolicy::default()).await.unwrap();
        assert_eq!(fail.exit_code, 3);
    }

    #[tokio::test]
    async fn exec_runs_in_files_dir() {
        let (_dir, ws) = workspace().await;
        let out = ws.exec("pwd", &ShellPolicy::default()).await.unwrap();
        assert_eq!(out.stdout.trim(), ws.files_dir().to_string_lossy());
    }

    #[tokio::test]
    async fn exec_times_out_and_kills() {
        let (_dir, ws) = workspace().await;
        let policy = ShellPolicy { timeout: Duration::from_millis(100), ..Default::default() };
        let err = ws.exec("sleep 5", &policy).await.unwrap_err();
        assert!(matches!(err, Error::Timeout(_)), "expected timeout, got: {err}");
    }

    #[tokio::test]
    async fn exec_denies_denylisted_and_disabled() {
        let (_dir, ws) = workspace().await;
        let err = ws.exec("sudo rm -rf /", &ShellPolicy::default()).await.unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));

        let disabled = ShellPolicy { enabled: false, ..Default::default() };
        let err = ws.exec("echo hi", &disabled).await.unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));
    }

    #[tokio::test]
    async fn exec_truncates_output() {
        let (_dir, ws) = workspace().await;
        let policy = ShellPolicy { max_output_bytes: 4, ..Default::default() };
        let out = ws.exec("echo hello world", &policy).await.unwrap();
        assert_eq!(out.stdout, "hell");
        assert!(out.truncated);
    }
}
