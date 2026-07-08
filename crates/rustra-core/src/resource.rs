use serde::{Deserialize, Serialize};
use std::fmt;

/// Every kind of governable resource in the system.
///
/// This is the closed set the permission model quantifies over. Adding a new
/// resource type means adding a variant here so RBAC/ACL rules can name it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceKind {
    Agent,
    Skill,
    Knowledge,
    Memory,
    Workspace,
    Tool,
    McpServer,
    Run,
    Log,
    Trace,
    Flow,
    Task,
    Schedule,
    Signal,
    Ui,
    Channel,
}

impl ResourceKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Agent => "agent",
            Self::Skill => "skill",
            Self::Knowledge => "knowledge",
            Self::Memory => "memory",
            Self::Workspace => "workspace",
            Self::Tool => "tool",
            Self::McpServer => "mcp_server",
            Self::Run => "run",
            Self::Log => "log",
            Self::Trace => "trace",
            Self::Flow => "flow",
            Self::Task => "task",
            Self::Schedule => "schedule",
            Self::Signal => "signal",
            Self::Ui => "ui",
            Self::Channel => "channel",
        }
    }
}

impl fmt::Display for ResourceKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Actions a principal can perform on a resource.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Create,
    Read,
    Update,
    Delete,
    Execute,
    Share,
    Manage,
}

impl Action {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Create => "create",
            Self::Read => "read",
            Self::Update => "update",
            Self::Delete => "delete",
            Self::Execute => "execute",
            Self::Share => "share",
            Self::Manage => "manage",
        }
    }
}

impl fmt::Display for Action {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// A concrete resource instance: kind + id + owner.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceRef {
    pub kind: ResourceKind,
    pub id: String,
    /// The owning user id. `None` for system-owned/global resources.
    pub owner_id: Option<String>,
}

impl ResourceRef {
    pub fn new(kind: ResourceKind, id: impl Into<String>, owner_id: Option<String>) -> Self {
        Self { kind, id: id.into(), owner_id }
    }

    pub fn owned_by(&self, user_id: &str) -> bool {
        self.owner_id.as_deref() == Some(user_id)
    }
}

/// Who can see a user-created artifact. Everything defaults to `Private`;
/// sharing is always an explicit act.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Visibility {
    /// Owner only (default).
    #[default]
    Private,
    /// Owner plus principals with explicit ACL grants.
    Shared,
    /// Every authenticated user in the deployment.
    Public,
}
