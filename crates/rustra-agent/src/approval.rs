//! Tool approval hook — the agent-loop end of human-in-the-loop.
//!
//! Mirrors Mastra's `requireToolApproval`/tool-approvals: before any tool
//! executes, the configured [`ToolApprover`] reviews it. Implementations can
//! auto-approve ([`AllowAll`]), apply policy (allowlists, RBAC), or park the
//! call on a pending decision and await the human (the task runtime's
//! interrupt controller does exactly that — see `rustra-tasks`).

use async_trait::async_trait;
use serde_json::Value;

use rustra_core::{Result, RuntimeContext};

/// Outcome of reviewing a tool call.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ApprovalDecision {
    /// Execute the tool call.
    Approved,
    /// Refuse the call; `reason` is surfaced to the model as an error tool
    /// result.
    Denied { reason: String },
}

/// Reviews tool calls before execution. `review` may take arbitrarily long —
/// e.g. blocking on a human decision — the agent loop simply awaits it.
#[async_trait]
pub trait ToolApprover: Send + Sync {
    async fn review(
        &self,
        tool_name: &str,
        input: &Value,
        runtime: &RuntimeContext,
    ) -> Result<ApprovalDecision>;
}

/// Default approver: everything is allowed. Appropriate for trusted local
/// tools; wire a policy or HITL approver for anything with side effects.
#[derive(Debug, Clone, Copy, Default)]
pub struct AllowAll;

#[async_trait]
impl ToolApprover for AllowAll {
    async fn review(
        &self,
        _tool_name: &str,
        _input: &Value,
        _runtime: &RuntimeContext,
    ) -> Result<ApprovalDecision> {
        Ok(ApprovalDecision::Approved)
    }
}
