//! # rustra-tasks
//!
//! The task runtime — every way an agent or flow gets invoked besides a
//! direct API call:
//!
//! * [`TaskManager`] — one-off and background tasks with supervision:
//!   status inspection, cancellation, retry with backoff.
//! * [`Scheduler`] — cron schedules (Mastra's `mastra.schedules`:
//!   create/read/update/delete plus pause/resume/run-now).
//! * [`SignalBus`] — named events (signals, webhooks, browser/extension
//!   events) matched against persisted subscriptions that launch tasks.
//! * [`InterruptController`] — human-in-the-loop: pending decisions that
//!   pause work until a person approves, answers, or rejects; plugs into the
//!   agent loop via [`HitlToolApprover`].
//!
//! The runtime executes work through the [`TaskExecutor`] trait so this
//! crate stays independent of the agent/workflow crates — the `rustra`
//! facade wires the executor to its registries.

mod interrupts;
mod manager;
mod scheduler;
mod signals;

pub use interrupts::{decision_status, HitlToolApprover, InterruptController};
pub use manager::{TaskExecutor, TaskManager, TaskOptions};
pub use scheduler::Scheduler;
pub use signals::SignalBus;

/// Owner-or-admin scope check shared by every user-scoped record in this
/// crate. `kind` names the record type in the error ("task", "schedule",
/// "decision").
pub(crate) fn ensure_owner(
    principal: &rustra_core::Principal,
    owner_id: &str,
    kind: &str,
    id: &str,
) -> rustra_core::Result<()> {
    if owner_id != principal.user_id && !principal.is_admin() {
        return Err(rustra_core::Error::PermissionDenied(format!(
            "{kind} `{id}` belongs to another user"
        )));
    }
    Ok(())
}

/// Task trigger names persisted on [`rustra_storage::types::TaskRecord`].
pub mod trigger {
    pub const DIRECT: &str = "direct";
    pub const BACKGROUND: &str = "background";
    pub const SCHEDULE: &str = "schedule";
    pub const SIGNAL: &str = "signal";
    pub const WEBHOOK: &str = "webhook";
}

/// Task status values persisted on [`rustra_storage::types::TaskRecord`].
pub mod task_status {
    pub const PENDING: &str = "pending";
    pub const RUNNING: &str = "running";
    pub const COMPLETED: &str = "completed";
    pub const FAILED: &str = "failed";
    pub const CANCELLED: &str = "cancelled";
}
