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
    /// Every variant; keep in sync when adding variants (RBAC matrices iterate this).
    pub const ALL: [ResourceKind; 16] = [
        Self::Agent,
        Self::Skill,
        Self::Knowledge,
        Self::Memory,
        Self::Workspace,
        Self::Tool,
        Self::McpServer,
        Self::Run,
        Self::Log,
        Self::Trace,
        Self::Flow,
        Self::Task,
        Self::Schedule,
        Self::Signal,
        Self::Ui,
        Self::Channel,
    ];

    /// Stable snake_case name. Guaranteed to match the serde (snake_case)
    /// representation — storage backends write via `as_str` and read back via
    /// serde.
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
    /// Every variant; keep in sync when adding variants (RBAC matrices iterate this).
    pub const ALL: [Action; 7] = [
        Self::Create,
        Self::Read,
        Self::Update,
        Self::Delete,
        Self::Execute,
        Self::Share,
        Self::Manage,
    ];

    /// Stable snake_case name. Guaranteed to match the serde (snake_case)
    /// representation — storage backends write via `as_str` and read back via
    /// serde.
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
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ResourceRef {
    pub kind: ResourceKind,
    pub id: String,
    /// The owning user id. `None` for system-owned/global resources.
    pub owner_id: Option<String>,
}

impl ResourceRef {
    pub fn new(kind: ResourceKind, id: impl Into<String>, owner_id: Option<String>) -> Self {
        Self {
            kind,
            id: id.into(),
            owner_id,
        }
    }

    pub fn owned_by(&self, user_id: &str) -> bool {
        self.owner_id.as_deref() == Some(user_id)
    }
}

/// Who can see a user-created artifact. Everything defaults to `Private`;
/// sharing is always an explicit act.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Visibility {
    /// Owner only (default).
    #[default]
    Private,
    /// Readable by any authenticated principal whose role matrix permits
    /// reading this resource kind; other actions still require ownership or an
    /// explicit grant. (Explicit grants also work on `Private` resources —
    /// `Shared` widens reads only.)
    Shared,
    /// Readable and executable by every authenticated principal whose role
    /// matrix permits it.
    Public,
}

impl Visibility {
    /// Stable snake_case name, identical to the serde representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Private => "private",
            Self::Shared => "shared",
            Self::Public => "public",
        }
    }
}

impl fmt::Display for Visibility {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resource_kind_as_str_agrees_with_serde() {
        use ResourceKind::*;
        // Keep exhaustive: when adding a variant, add it here (kind_from_sql
        // in the storage crates depends on as_str/serde agreement).
        let all = [
            Agent, Skill, Knowledge, Memory, Workspace, Tool, McpServer, Run, Log, Trace, Flow,
            Task, Schedule, Signal, Ui, Channel,
        ];
        for kind in all {
            let via_serde = serde_json::to_value(kind).unwrap();
            assert_eq!(
                via_serde,
                serde_json::Value::String(kind.as_str().to_owned())
            );
            assert_eq!(
                serde_json::from_value::<ResourceKind>(via_serde).unwrap(),
                kind
            );
        }
    }

    #[test]
    fn action_as_str_agrees_with_serde() {
        use Action::*;
        // Keep exhaustive: when adding a variant, add it here (the storage
        // crates depend on as_str/serde agreement).
        let all = [Create, Read, Update, Delete, Execute, Share, Manage];
        for action in all {
            let via_serde = serde_json::to_value(action).unwrap();
            assert_eq!(
                via_serde,
                serde_json::Value::String(action.as_str().to_owned())
            );
            assert_eq!(serde_json::from_value::<Action>(via_serde).unwrap(), action);
        }
    }

    #[test]
    fn visibility_as_str_agrees_with_serde() {
        use Visibility::*;
        // Keep exhaustive: when adding a variant, add it here (the storage
        // crates depend on as_str/serde agreement).
        let all = [Private, Shared, Public];
        for vis in all {
            let via_serde = serde_json::to_value(vis).unwrap();
            assert_eq!(
                via_serde,
                serde_json::Value::String(vis.as_str().to_owned())
            );
            assert_eq!(
                serde_json::from_value::<Visibility>(via_serde).unwrap(),
                vis
            );
        }
    }
}
