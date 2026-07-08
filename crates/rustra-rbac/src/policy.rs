//! The role matrix: role names mapped to permission sets.

use std::collections::{HashMap, HashSet};
use std::sync::RwLock;

use rustra_core::{Action, ResourceKind, Role};

/// One permission: an action on a kind of resource (not a specific instance —
/// instance-level access is ownership/ACL territory).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Permission {
    pub kind: ResourceKind,
    pub action: Action,
}

impl Permission {
    /// A permission for `action` on any resource of `kind`.
    pub const fn new(kind: ResourceKind, action: Action) -> Self {
        Self { kind, action }
    }
}

/// Maps role names to permission sets. Ships with the three default roles;
/// custom roles are added with [`RolePolicy::define_role`].
#[derive(Debug)]
pub struct RolePolicy {
    roles: RwLock<HashMap<String, HashSet<Permission>>>,
}

impl RolePolicy {
    /// The default matrix:
    ///
    /// * `builder` — creates and runs their own agents, skills, flows,
    ///   knowledge, UIs; uses tools, memory, workspaces. No management of
    ///   other users' resources, no channel/MCP administration.
    /// * `developer` — everything builder has, plus MCP server and channel
    ///   configuration, and read access to logs/traces for debugging.
    /// * `admin` — everything, including manage on all kinds.
    pub fn with_defaults() -> Self {
        use Action::*;
        use ResourceKind::*;

        let builder_kinds = [
            Agent, Skill, Knowledge, Flow, Ui, Memory, Workspace, Run, Task,
        ];
        let mut builder = HashSet::new();
        for kind in builder_kinds {
            for action in [Create, Read, Update, Delete, Execute, Share] {
                builder.insert(Permission::new(kind, action));
            }
        }
        builder.extend(
            [
                (Tool, Read),
                (Tool, Execute),
                (McpServer, Read),
                (McpServer, Execute),
                (Schedule, Create),
                (Schedule, Read),
                (Schedule, Update),
                (Schedule, Delete),
                (Signal, Create),
                (Signal, Read),
            ]
            .map(|(kind, action)| Permission::new(kind, action)),
        );

        let mut developer = builder.clone();
        for kind in [McpServer, Channel] {
            for action in [Create, Read, Update, Delete, Execute, Share] {
                developer.insert(Permission::new(kind, action));
            }
        }
        developer.extend(
            [(Log, Read), (Trace, Read)].map(|(kind, action)| Permission::new(kind, action)),
        );

        let mut admin = HashSet::new();
        for kind in ResourceKind::ALL {
            for action in Action::ALL {
                admin.insert(Permission::new(kind, action));
            }
        }

        let mut map = HashMap::new();
        map.insert(Role::BUILDER.to_string(), builder);
        map.insert(Role::DEVELOPER.to_string(), developer);
        map.insert(Role::ADMIN.to_string(), admin);
        Self {
            roles: RwLock::new(map),
        }
    }

    /// Define or replace a custom role.
    pub fn define_role(&self, name: impl Into<String>, permissions: HashSet<Permission>) {
        self.roles
            .write()
            .expect("role policy poisoned")
            .insert(name.into(), permissions);
    }

    /// Does `role` include `permission` in the matrix? Unknown role names
    /// allow nothing.
    pub fn role_allows(&self, role: &str, permission: Permission) -> bool {
        self.roles
            .read()
            .expect("role policy poisoned")
            .get(role)
            .is_some_and(|perms| perms.contains(&permission))
    }

    /// Does any of `roles` include `permission`? Unknown role names allow
    /// nothing.
    pub fn any_allows(&self, roles: &[Role], permission: Permission) -> bool {
        roles
            .iter()
            .any(|r| self.role_allows(r.as_str(), permission))
    }
}

impl Default for RolePolicy {
    fn default() -> Self {
        Self::with_defaults()
    }
}
