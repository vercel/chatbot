//! Session ownership and per-user isolation.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::Duration;

use rustra_core::{Error, Result};

use crate::session::{RemoteBrowserSession, DEFAULT_COMMAND_TIMEOUT};
use crate::sync::{read, write};

/// Creates and owns [`RemoteBrowserSession`]s. Every session is tagged with
/// its owning user, and every lookup requires the caller's user id to match
/// — the permission boundary [`crate::browser_tool`] relies on.
pub struct BrowserSessionManager {
    sessions: RwLock<HashMap<String, Arc<RemoteBrowserSession>>>,
    command_timeout: Duration,
}

impl std::fmt::Debug for BrowserSessionManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BrowserSessionManager")
            .field("sessions", &read(&self.sessions).len())
            .field("command_timeout", &self.command_timeout)
            .finish()
    }
}

impl Default for BrowserSessionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl BrowserSessionManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
            command_timeout: DEFAULT_COMMAND_TIMEOUT,
        }
    }

    /// Override the per-command timeout applied to newly created sessions.
    pub fn with_command_timeout(mut self, command_timeout: Duration) -> Self {
        self.command_timeout = command_timeout;
        self
    }

    /// Create a session (`brw_...`) owned by `user_id`.
    pub fn create_session(&self, user_id: &str) -> Arc<RemoteBrowserSession> {
        let session = Arc::new(RemoteBrowserSession::with_timeout(
            user_id,
            self.command_timeout,
        ));
        write(&self.sessions).insert(session.id().to_string(), session.clone());
        session
    }

    /// Look up a session, enforcing that it belongs to `user_id`.
    pub fn get(&self, user_id: &str, session_id: &str) -> Result<Arc<RemoteBrowserSession>> {
        let session = read(&self.sessions)
            .get(session_id)
            .cloned()
            .ok_or_else(|| Error::not_found("browser_session", session_id))?;
        if session.user_id() != user_id {
            return Err(Error::PermissionDenied(format!(
                "browser session `{session_id}` does not belong to `{user_id}`"
            )));
        }
        Ok(session)
    }

    /// Remove (close) a session. Same ownership check as [`Self::get`];
    /// pending commands fail as their oneshot senders drop with the bridge.
    pub fn remove(&self, user_id: &str, session_id: &str) -> Result<()> {
        // Validate ownership before mutating.
        self.get(user_id, session_id)?;
        write(&self.sessions).remove(session_id);
        Ok(())
    }

    /// Ids of the sessions owned by `user_id`.
    pub fn list(&self, user_id: &str) -> Vec<String> {
        let mut ids: Vec<String> = read(&self.sessions)
            .values()
            .filter(|session| session.user_id() == user_id)
            .map(|session| session.id().to_string())
            .collect();
        ids.sort();
        ids
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manager_enforces_user_isolation() {
        let manager = BrowserSessionManager::new();
        let session = manager.create_session("u1");
        let id = session.id().to_string();
        assert!(id.starts_with("brw_"));

        // Owner can get and list.
        assert_eq!(manager.get("u1", &id).unwrap().id(), id);
        assert_eq!(manager.list("u1"), vec![id.clone()]);

        // Another user cannot get, remove, or see it.
        assert!(matches!(
            manager.get("u2", &id).unwrap_err(),
            Error::PermissionDenied(_)
        ));
        assert!(matches!(
            manager.remove("u2", &id).unwrap_err(),
            Error::PermissionDenied(_)
        ));
        assert!(manager.list("u2").is_empty());
        assert!(
            manager.get("u1", &id).is_ok(),
            "failed remove must not drop the session"
        );

        // Owner removal works; the id is gone afterwards.
        manager.remove("u1", &id).unwrap();
        assert!(matches!(
            manager.get("u1", &id).unwrap_err(),
            Error::NotFound {
                kind: "browser_session",
                ..
            }
        ));
    }

    #[test]
    fn unknown_session_is_not_found() {
        let manager = BrowserSessionManager::new();
        assert!(matches!(
            manager.get("u1", "brw_nope").unwrap_err(),
            Error::NotFound { .. }
        ));
    }
}
