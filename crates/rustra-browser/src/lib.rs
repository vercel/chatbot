//! # rustra-browser
//!
//! The computer-use protocol: how agents drive a real browser. This crate
//! defines the **backend contract only** — a small action vocabulary
//! ([`BrowserAction`]) modeled on WebDriver-BiDi / Playwright-style
//! primitives (navigate, click, type, press, scroll, wait-for, read-DOM,
//! screenshot, evaluate). Execution happens **client-side in JavaScript**:
//! the Chrome extension (or a Playwright bridge) polls for commands, runs
//! them against the live page, and posts results back.
//!
//! * [`BrowserSession`] — the session trait: `perform(action) -> result`.
//! * [`RemoteBrowserSession`] — the default implementation: a command-queue
//!   bridge. `perform` enqueues a [`PendingCommand`]-shaped entry and awaits
//!   a oneshot; the server's polling endpoint calls
//!   [`RemoteBrowserSession::next_command`] on behalf of the extension and
//!   feeds answers back through [`RemoteBrowserSession::submit_result`].
//!   Unanswered commands fail with [`rustra_core::Error::Timeout`]
//!   (default 30s, configurable).
//! * [`ActionLog`] — a replayable, serializable record of every action and
//!   its result; [`ActionLog::replay_script`] extracts the action sequence
//!   for deterministic re-runs.
//! * [`BrowserSessionManager`] — creates/owns sessions (`brw_...` ids),
//!   tagged with the owning user; `get` enforces the user match, so one
//!   user's agent can never drive another user's browser.
//! * [`browser_tool`] — the agent-facing tool; the permission check is the
//!   manager's user match against `ctx.runtime.user_id()`.
//!
//! [`PendingCommand`]: RemoteBrowserSession::next_command

mod action;
mod manager;
mod session;
mod tool;

pub use action::{BrowserAction, BrowserActionResult};
pub use manager::BrowserSessionManager;
pub use session::{ActionLog, BrowserSession, IssuedCommand, LoggedAction, RemoteBrowserSession};
pub use tool::browser_tool;
