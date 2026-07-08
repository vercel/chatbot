use serde::{Deserialize, Serialize};

/// A named role held by a principal.
///
/// Rustra ships three default roles (`builder`, `developer`, `admin`) but the
/// role system is open: any string is a valid role name, and the RBAC crate
/// maps roles to permission sets.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Role(String);

impl Role {
    pub const BUILDER: &'static str = "builder";
    pub const DEVELOPER: &'static str = "developer";
    pub const ADMIN: &'static str = "admin";

    pub fn builder() -> Self {
        Self(Self::BUILDER.into())
    }
    pub fn developer() -> Self {
        Self(Self::DEVELOPER.into())
    }
    pub fn admin() -> Self {
        Self(Self::ADMIN.into())
    }
    /// A role beyond the three built-ins; the RBAC policy decides what it
    /// grants.
    pub fn custom(name: impl Into<String>) -> Self {
        Self(name.into())
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<&str> for Role {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

impl From<String> for Role {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl AsRef<str> for Role {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for Role {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

/// The identity on whose behalf an operation runs.
///
/// Every entry point into the runtime (HTTP request, scheduled task, signal,
/// webhook, extension call) resolves to a `Principal` before any work
/// happens. Per-user isolation falls out of this: storage queries, memory,
/// workspaces, and discovery are all scoped by `user_id` unless a resource is
/// explicitly shared.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Principal {
    /// Stable user identifier. Also used as the memory `resource_id` scope.
    pub user_id: String,
    /// Roles held by this user. Empty means "least privilege": owner-only
    /// access to resources they created.
    #[serde(default)]
    pub roles: Vec<Role>,
    /// True only for the internal system principal used by supervisors and
    /// migrations. Never derived from external input.
    #[serde(default)]
    pub system: bool,
}

impl Principal {
    /// A standard user principal holding the default `builder` role.
    pub fn user(user_id: impl Into<String>) -> Self {
        Self {
            user_id: user_id.into(),
            roles: vec![Role::builder()],
            system: false,
        }
    }

    /// A user principal with an explicit role set. An empty set means
    /// owner-only access to resources the user created.
    pub fn with_roles(user_id: impl Into<String>, roles: Vec<Role>) -> Self {
        Self {
            user_id: user_id.into(),
            roles,
            system: false,
        }
    }

    /// The internal system principal. Bypasses RBAC checks; use only for
    /// framework-internal maintenance (schedulers, migrations, supervisors).
    pub fn system() -> Self {
        Self {
            user_id: "system".into(),
            roles: vec![Role::admin()],
            system: true,
        }
    }

    /// Whether this principal holds `role` (exact, case-sensitive
    /// comparison).
    pub fn has_role(&self, role: &str) -> bool {
        self.roles.iter().any(|r| r.as_str() == role)
    }

    /// True for the system principal and for any principal holding the
    /// `admin` role.
    pub fn is_admin(&self) -> bool {
        self.system || self.has_role(Role::ADMIN)
    }
}
