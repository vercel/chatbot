//! The policy engine: ownership, visibility, and stored ACL grants layered
//! over the role matrix.

use chrono::Utc;

use rustra_core::{new_id, Action, Error, Principal, ResourceKind, Result, Role, Visibility};
use rustra_storage::types::{DefinitionRecord, GrantRecord, McpServerRecord};
use rustra_storage::SharedStorage;

use crate::policy::{Permission, RolePolicy};

/// A resource as seen by the policy engine: identity plus its sharing state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Governed {
    pub kind: ResourceKind,
    pub id: String,
    pub owner_id: Option<String>,
    pub visibility: Visibility,
}

impl Governed {
    /// A resource with explicit ownership and visibility; `owner_id: None`
    /// means system-owned/global.
    pub fn new(
        kind: ResourceKind,
        id: impl Into<String>,
        owner_id: Option<String>,
        visibility: Visibility,
    ) -> Self {
        Self {
            kind,
            id: id.into(),
            owner_id,
            visibility,
        }
    }

    /// A resource owned by a user with default (private) visibility.
    pub fn owned(kind: ResourceKind, id: impl Into<String>, owner_id: impl Into<String>) -> Self {
        Self::new(kind, id, Some(owner_id.into()), Visibility::Private)
    }
}

impl From<&DefinitionRecord> for Governed {
    fn from(r: &DefinitionRecord) -> Self {
        Self::new(r.kind, r.id.clone(), Some(r.owner_id.clone()), r.visibility)
    }
}

impl From<&McpServerRecord> for Governed {
    fn from(r: &McpServerRecord) -> Self {
        Self::new(
            ResourceKind::McpServer,
            r.id.clone(),
            r.owner_id.clone(),
            r.visibility,
        )
    }
}

/// The policy engine. Combines the role matrix with ownership, visibility,
/// and stored ACL grants.
pub struct AccessControl {
    storage: SharedStorage,
    policy: RolePolicy,
}

impl AccessControl {
    /// Policy engine over `storage` grants using the default role matrix
    /// ([`RolePolicy::with_defaults`]).
    pub fn new(storage: SharedStorage) -> Self {
        Self {
            storage,
            policy: RolePolicy::with_defaults(),
        }
    }

    /// Policy engine with a custom role matrix in place of the defaults.
    pub fn with_policy(storage: SharedStorage, policy: RolePolicy) -> Self {
        Self { storage, policy }
    }

    /// The role matrix in use, e.g. to [`RolePolicy::define_role`] custom
    /// roles.
    pub fn policy(&self) -> &RolePolicy {
        &self.policy
    }

    /// Can `principal` perform `action` on `resource`?
    pub async fn can(
        &self,
        principal: &Principal,
        action: Action,
        resource: &Governed,
    ) -> Result<bool> {
        // 1. System bypass.
        if principal.system {
            return Ok(true);
        }
        // 2. Admin role.
        if principal.is_admin() {
            return Ok(true);
        }
        // 3. Ownership: full control over what you own — provided the role
        //    matrix lets this principal touch this resource kind at all.
        let permission = Permission::new(resource.kind, action);
        let role_allows = self.policy.any_allows(&principal.roles, permission);
        if resource.owner_id.as_deref() == Some(principal.user_id.as_str()) && role_allows {
            return Ok(true);
        }
        // 4. Visibility: shared/public artifacts are readable; public ones
        //    executable. Still gated by the role matrix.
        if role_allows && Self::visibility_allows(resource.visibility, action) {
            return Ok(true);
        }
        // 5. Explicit ACL grants (to the user or to one of their roles).
        if self.grant_allows(principal, action, resource).await? {
            return Ok(true);
        }
        // 6. Default deny.
        Ok(false)
    }

    /// Layer 4: does `visibility` alone permit `action` (before the role-matrix
    /// gate is applied)? `public` allows read and execute; `shared` allows
    /// read.
    fn visibility_allows(visibility: Visibility, action: Action) -> bool {
        matches!(
            (visibility, action),
            (Visibility::Public, Action::Read | Action::Execute)
                | (Visibility::Shared, Action::Read)
        )
    }

    /// Layer 5: does an explicit ACL grant on `resource` (to the principal or
    /// one of their roles) allow `action`? Grants are additive and NOT gated by
    /// the role matrix.
    async fn grant_allows(
        &self,
        principal: &Principal,
        action: Action,
        resource: &Governed,
    ) -> Result<bool> {
        let grants = self
            .storage
            .list_grants_for_resource(resource.kind, &resource.id)
            .await?;
        let action_name = action.as_str();
        for grant in grants {
            if GranteeRef::parse(&grant.grantee).matches(principal)
                && grant.actions.iter().any(|a| a == action_name)
            {
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// Like [`AccessControl::can`] but returns `Error::PermissionDenied`.
    pub async fn require(
        &self,
        principal: &Principal,
        action: Action,
        resource: &Governed,
    ) -> Result<()> {
        if self.can(principal, action, resource).await? {
            Ok(())
        } else {
            Err(Error::PermissionDenied(format!(
                "user `{}` may not {} {} `{}`",
                principal.user_id, action, resource.kind, resource.id
            )))
        }
    }

    /// Share a resource: grant `actions` to `grantee` (a user id or
    /// `role:<name>`). Only the owner, someone with `Share`, or an admin may
    /// share.
    pub async fn share(
        &self,
        principal: &Principal,
        resource: &Governed,
        grantee: impl Into<String>,
        actions: impl IntoIterator<Item = Action>,
    ) -> Result<GrantRecord> {
        let actions: Vec<String> = actions
            .into_iter()
            .map(|a| a.as_str().to_string())
            .collect();
        self.require(principal, Action::Share, resource).await?;
        let grant = GrantRecord {
            id: new_id("grant"),
            resource_kind: resource.kind,
            resource_id: resource.id.clone(),
            grantee: grantee.into(),
            actions,
            granted_by: principal.user_id.clone(),
            created_at: Utc::now(),
        };
        self.storage.insert_grant(grant.clone()).await?;
        Ok(grant)
    }

    /// Revoke a grant. Only the granter, a system principal, or an admin may
    /// revoke; the resource owner has no special standing here unless they
    /// issued the grant.
    pub async fn revoke(&self, principal: &Principal, grant: &GrantRecord) -> Result<()> {
        let allowed =
            principal.system || principal.is_admin() || grant.granted_by == principal.user_id;
        if !allowed {
            return Err(Error::PermissionDenied(format!(
                "user `{}` may not revoke grant `{}`: only the granter, a system principal, or an admin may revoke",
                principal.user_id, grant.id
            )));
        }
        self.storage.delete_grant(&grant.id).await
    }
}

/// Prefix marking a grant grantee as a role rather than a user id.
pub const ROLE_GRANTEE_PREFIX: &str = "role:";

/// Format a role as a grant grantee (`role:<name>`) — the write-side
/// counterpart of the grantee syntax accepted by [`AccessControl::share`] and
/// matched during [`AccessControl::can`].
pub fn role_grantee(role: &Role) -> String {
    format!("{ROLE_GRANTEE_PREFIX}{}", role.as_str())
}

/// A parsed grant grantee: either a user id or a `role:<name>` reference.
enum GranteeRef<'a> {
    User(&'a str),
    Role(&'a str),
}

impl<'a> GranteeRef<'a> {
    fn parse(s: &'a str) -> Self {
        match s.strip_prefix(ROLE_GRANTEE_PREFIX) {
            Some(r) => Self::Role(r),
            None => Self::User(s),
        }
    }

    fn matches(&self, principal: &Principal) -> bool {
        match self {
            Self::User(id) => *id == principal.user_id.as_str(),
            Self::Role(name) => principal.roles.iter().any(|r| r.as_str() == *name),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_storage::InMemoryStorage;
    use std::sync::Arc;

    fn acl() -> AccessControl {
        AccessControl::new(Arc::new(InMemoryStorage::new()))
    }

    #[tokio::test]
    async fn owner_has_full_control_others_denied() {
        let ac = acl();
        let alice = Principal::user("alice");
        let bob = Principal::user("bob");
        let resource = Governed::owned(ResourceKind::Skill, "skl_1", "alice");

        assert!(ac.can(&alice, Action::Update, &resource).await.unwrap());
        assert!(ac.can(&alice, Action::Execute, &resource).await.unwrap());
        assert!(!ac.can(&bob, Action::Read, &resource).await.unwrap());
        assert!(!ac.can(&bob, Action::Execute, &resource).await.unwrap());
    }

    #[tokio::test]
    async fn explicit_share_grants_access() {
        let ac = acl();
        let alice = Principal::user("alice");
        let bob = Principal::user("bob");
        let resource = Governed::owned(ResourceKind::Skill, "skl_1", "alice");

        ac.share(
            &alice,
            &resource,
            "bob",
            vec![Action::Read, Action::Execute],
        )
        .await
        .unwrap();
        assert!(ac.can(&bob, Action::Read, &resource).await.unwrap());
        assert!(ac.can(&bob, Action::Execute, &resource).await.unwrap());
        assert!(!ac.can(&bob, Action::Update, &resource).await.unwrap());
    }

    #[tokio::test]
    async fn non_owner_cannot_share() {
        let ac = acl();
        let bob = Principal::user("bob");
        let resource = Governed::owned(ResourceKind::Knowledge, "kn_1", "alice");
        let err = ac
            .share(&bob, &resource, "eve", vec![Action::Read])
            .await
            .unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));
    }

    #[tokio::test]
    async fn admin_bypasses_ownership() {
        let ac = acl();
        let admin = Principal::with_roles("root", vec![Role::admin()]);
        let resource = Governed::owned(ResourceKind::Agent, "agt_1", "alice");
        assert!(ac.can(&admin, Action::Delete, &resource).await.unwrap());
    }

    #[tokio::test]
    async fn builder_cannot_manage_channels() {
        let ac = acl();
        let builder = Principal::user("alice");
        let dev = Principal::with_roles("dev", vec![Role::developer()]);
        let channel = Governed::owned(ResourceKind::Channel, "slack", "alice");
        // Even as owner, builder's role matrix has no Channel permissions.
        assert!(!ac.can(&builder, Action::Update, &channel).await.unwrap());
        let dev_channel = Governed::owned(ResourceKind::Channel, "slack", "dev");
        assert!(ac.can(&dev, Action::Update, &dev_channel).await.unwrap());
    }

    #[tokio::test]
    async fn role_grant_matches_principal_roles() {
        let ac = acl();
        let alice = Principal::user("alice");
        let resource = Governed::owned(ResourceKind::Skill, "skl_1", "alice");
        ac.share(&alice, &resource, "role:developer", vec![Action::Read])
            .await
            .unwrap();

        let dev = Principal::with_roles("dev", vec![Role::developer()]);
        assert!(ac.can(&dev, Action::Read, &resource).await.unwrap());
        assert!(!ac.can(&dev, Action::Update, &resource).await.unwrap());
        assert!(!ac
            .can(&Principal::user("bob"), Action::Read, &resource)
            .await
            .unwrap());
    }

    #[tokio::test]
    async fn public_visibility_allows_read_and_execute() {
        let ac = acl();
        let bob = Principal::user("bob");
        let resource = Governed::new(
            ResourceKind::Skill,
            "skl_pub",
            Some("alice".into()),
            Visibility::Public,
        );
        assert!(ac.can(&bob, Action::Read, &resource).await.unwrap());
        assert!(ac.can(&bob, Action::Execute, &resource).await.unwrap());
        assert!(!ac.can(&bob, Action::Update, &resource).await.unwrap());
    }

    #[tokio::test]
    async fn shared_visibility_allows_read_only() {
        let ac = acl();
        let bob = Principal::user("bob");
        let resource = Governed::new(
            ResourceKind::Skill,
            "skl_pub",
            Some("alice".into()),
            Visibility::Shared,
        );
        assert!(ac.can(&bob, Action::Read, &resource).await.unwrap());
        assert!(!ac.can(&bob, Action::Execute, &resource).await.unwrap());
    }

    #[tokio::test]
    async fn visibility_is_gated_by_role_matrix() {
        let ac = acl();
        let norole = Principal::with_roles("norole", vec![]);
        let resource = Governed::new(
            ResourceKind::Skill,
            "skl_pub",
            Some("alice".into()),
            Visibility::Public,
        );
        assert!(!ac.can(&norole, Action::Read, &resource).await.unwrap());
    }

    #[tokio::test]
    async fn grants_bypass_role_matrix_and_only_granter_or_admin_revokes() {
        let ac = acl();
        let dev = Principal::with_roles("dev", vec![Role::developer()]);
        let bob = Principal::user("bob");
        let resource = Governed::owned(ResourceKind::Channel, "ch_1", "dev");
        let grant = ac
            .share(&dev, &resource, "bob", vec![Action::Update])
            .await
            .unwrap();

        // bob is a builder whose matrix has no Channel permissions, yet the
        // grant bypasses the role matrix.
        assert!(ac.can(&bob, Action::Update, &resource).await.unwrap());
        // Only the granter, a system principal, or an admin may revoke.
        assert!(matches!(
            ac.revoke(&bob, &grant).await.unwrap_err(),
            Error::PermissionDenied(_)
        ));
        ac.revoke(&dev, &grant).await.unwrap();
        assert!(!ac.can(&bob, Action::Update, &resource).await.unwrap());
    }
}
