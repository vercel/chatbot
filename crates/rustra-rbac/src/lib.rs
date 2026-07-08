//! # rustra-rbac
//!
//! Access control for every governable resource, combining the
//! industry-standard layers (in evaluation order):
//!
//! 1. **System principal** — internal supervisors bypass checks.
//! 2. **Ownership** — you can do anything to what you own.
//! 3. **RBAC** — roles map to `(ResourceKind, Action)` permissions. Default
//!    roles: `builder`, `developer`, `admin`; the matrix is extensible with
//!    custom roles.
//! 4. **ACLs** — explicit sharing grants on individual resources (to a user
//!    or to a role), the only way private resources cross user boundaries.
//! 5. **Visibility** — `shared`/`public` artifacts allow reads (and
//!    execute for public) without individual grants.
//! 6. **Default deny** — least privilege.
//!
//! Mastra models auth as a pluggable provider (`authenticateToken` /
//! `authorizeUser`) plus fine-grained authorization; [`AuthProvider`] mirrors
//! the former, [`AccessControl`] implements the latter over the storage ACL
//! domain.

use async_trait::async_trait;
use chrono::Utc;
use std::collections::{HashMap, HashSet};
use std::sync::RwLock;

use rustra_core::{new_id, Action, Error, Principal, ResourceKind, Result, Role, Visibility};
use rustra_storage::types::{GrantRecord, UserRecord};
use rustra_storage::SharedStorage;

/// One permission: an action on a kind of resource (not a specific instance —
/// instance-level access is ownership/ACL territory).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Permission {
    pub kind: ResourceKind,
    pub action: Action,
}

impl Permission {
    pub const fn new(kind: ResourceKind, action: Action) -> Self {
        Self { kind, action }
    }
}

/// Maps role names to permission sets. Ships with the three default roles;
/// custom roles are added with [`RolePolicy::define_role`].
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

        let builder_kinds = [Agent, Skill, Knowledge, Flow, Ui, Memory, Workspace, Run, Task];
        let mut builder = HashSet::new();
        for kind in builder_kinds {
            for action in [Create, Read, Update, Delete, Execute, Share] {
                builder.insert(Permission::new(kind, action));
            }
        }
        builder.insert(Permission::new(Tool, Execute));
        builder.insert(Permission::new(Tool, Read));
        builder.insert(Permission::new(McpServer, Execute));
        builder.insert(Permission::new(McpServer, Read));
        builder.insert(Permission::new(Schedule, Create));
        builder.insert(Permission::new(Schedule, Read));
        builder.insert(Permission::new(Schedule, Update));
        builder.insert(Permission::new(Schedule, Delete));
        builder.insert(Permission::new(Signal, Create));
        builder.insert(Permission::new(Signal, Read));

        let mut developer = builder.clone();
        for kind in [McpServer, Channel] {
            for action in [Create, Read, Update, Delete, Execute, Share] {
                developer.insert(Permission::new(kind, action));
            }
        }
        developer.insert(Permission::new(Log, Read));
        developer.insert(Permission::new(Trace, Read));

        let mut admin = HashSet::new();
        for kind in [
            Agent, Skill, Knowledge, Memory, Workspace, Tool, McpServer, Run, Log, Trace, Flow,
            Task, Schedule, Signal, Ui, Channel,
        ] {
            for action in [Create, Read, Update, Delete, Execute, Share, Manage] {
                admin.insert(Permission::new(kind, action));
            }
        }

        let mut map = HashMap::new();
        map.insert(Role::BUILDER.to_string(), builder);
        map.insert(Role::DEVELOPER.to_string(), developer);
        map.insert(Role::ADMIN.to_string(), admin);
        Self { roles: RwLock::new(map) }
    }

    /// Define or replace a custom role.
    pub fn define_role(&self, name: impl Into<String>, permissions: HashSet<Permission>) {
        self.roles.write().expect("role policy poisoned").insert(name.into(), permissions);
    }

    pub fn role_allows(&self, role: &str, permission: Permission) -> bool {
        self.roles
            .read()
            .expect("role policy poisoned")
            .get(role)
            .is_some_and(|perms| perms.contains(&permission))
    }
}

impl Default for RolePolicy {
    fn default() -> Self {
        Self::with_defaults()
    }
}

/// A resource as seen by the policy engine: identity plus its sharing state.
#[derive(Debug, Clone)]
pub struct Governed {
    pub kind: ResourceKind,
    pub id: String,
    pub owner_id: Option<String>,
    pub visibility: Visibility,
}

impl Governed {
    pub fn new(
        kind: ResourceKind,
        id: impl Into<String>,
        owner_id: Option<String>,
        visibility: Visibility,
    ) -> Self {
        Self { kind, id: id.into(), owner_id, visibility }
    }

    /// A resource owned by a user with default (private) visibility.
    pub fn owned(kind: ResourceKind, id: impl Into<String>, owner_id: impl Into<String>) -> Self {
        Self::new(kind, id, Some(owner_id.into()), Visibility::Private)
    }
}

/// The policy engine. Combines the role matrix with ownership, visibility,
/// and stored ACL grants.
pub struct AccessControl {
    storage: SharedStorage,
    policy: RolePolicy,
}

impl AccessControl {
    pub fn new(storage: SharedStorage) -> Self {
        Self { storage, policy: RolePolicy::with_defaults() }
    }

    pub fn with_policy(storage: SharedStorage, policy: RolePolicy) -> Self {
        Self { storage, policy }
    }

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
        let role_allows = principal
            .roles
            .iter()
            .any(|role| self.policy.role_allows(role.as_str(), permission));
        if resource.owner_id.as_deref() == Some(principal.user_id.as_str()) && role_allows {
            return Ok(true);
        }
        // 4. Visibility: shared/public artifacts are readable; public ones
        //    executable. Still gated by the role matrix.
        if role_allows {
            match (resource.visibility, action) {
                (Visibility::Public, Action::Read | Action::Execute) => return Ok(true),
                (Visibility::Shared, Action::Read) => return Ok(true),
                _ => {}
            }
        }
        // 5. Explicit ACL grants (to the user or to one of their roles).
        let grants =
            self.storage.list_grants_for_resource(resource.kind, &resource.id).await?;
        let action_name = action.as_str();
        for grant in grants {
            let matches_grantee = grant.grantee == principal.user_id
                || principal
                    .roles
                    .iter()
                    .any(|r| grant.grantee == format!("role:{}", r.as_str()));
            if matches_grantee && grant.actions.iter().any(|a| a == action_name) {
                return Ok(true);
            }
        }
        // 6. Default deny.
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
        actions: Vec<Action>,
    ) -> Result<GrantRecord> {
        self.require(principal, Action::Share, resource).await?;
        let grant = GrantRecord {
            id: new_id("grant"),
            resource_kind: resource.kind,
            resource_id: resource.id.clone(),
            grantee: grantee.into(),
            actions: actions.iter().map(|a| a.as_str().to_string()).collect(),
            granted_by: principal.user_id.clone(),
            created_at: Utc::now(),
        };
        self.storage.insert_grant(grant.clone()).await?;
        Ok(grant)
    }

    /// Revoke a grant. Only the granter, the resource owner, or an admin.
    pub async fn revoke(&self, principal: &Principal, grant: &GrantRecord) -> Result<()> {
        let allowed = principal.system
            || principal.is_admin()
            || grant.granted_by == principal.user_id;
        if !allowed {
            return Err(Error::PermissionDenied("only the granter or an admin may revoke".into()));
        }
        self.storage.delete_grant(&grant.id).await
    }
}

/// Token authentication, mirroring Mastra's `MastraAuthProvider`
/// (`authenticateToken` → user, then authorization decisions).
#[async_trait]
pub trait AuthProvider: Send + Sync {
    /// Resolve a bearer token to a principal, or `None` if invalid.
    async fn authenticate_token(&self, token: &str) -> Result<Option<Principal>>;
}

/// Default provider: SHA-256 token hashes stored on user records.
pub struct TokenAuthProvider {
    storage: SharedStorage,
}

impl TokenAuthProvider {
    pub fn new(storage: SharedStorage) -> Self {
        Self { storage }
    }

    /// Hex SHA-256 used for token storage. Public so registration flows can
    /// hash consistently.
    pub fn hash_token(token: &str) -> String {
        sha256_hex(token.as_bytes())
    }

    /// Create (or update) a user with a freshly issued token; returns the
    /// plaintext token exactly once.
    pub async fn issue_token(&self, user_id: &str, display_name: &str, roles: Vec<Role>) -> Result<String> {
        let token = format!("rsk_{}", new_id("tok"));
        let existing = self.storage.get_user(user_id).await?;
        let user = UserRecord {
            id: user_id.to_string(),
            display_name: display_name.to_string(),
            roles: roles.iter().map(|r| r.as_str().to_string()).collect(),
            token_hash: Some(Self::hash_token(&token)),
            profile: existing.map(|u| u.profile).unwrap_or(serde_json::Value::Null),
            created_at: Utc::now(),
        };
        self.storage.upsert_user(user).await?;
        Ok(token)
    }
}

#[async_trait]
impl AuthProvider for TokenAuthProvider {
    async fn authenticate_token(&self, token: &str) -> Result<Option<Principal>> {
        let hash = Self::hash_token(token);
        let Some(user) = self.storage.find_user_by_token_hash(&hash).await? else {
            return Ok(None);
        };
        Ok(Some(Principal::with_roles(
            user.id,
            user.roles.into_iter().map(Role).collect(),
        )))
    }
}

/// Minimal dependency-free SHA-256 (FIPS 180-4). Tokens are low-volume, so a
/// hand-rolled, well-tested implementation beats pulling in a crypto crate
/// for one digest. Verified against NIST test vectors in the tests below.
fn sha256_hex(data: &[u8]) -> String {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
        0x5be0cd19,
    ];
    let mut message = data.to_vec();
    let bit_len = (data.len() as u64) * 8;
    message.push(0x80);
    while message.len() % 64 != 56 {
        message.push(0);
    }
    message.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in message.chunks_exact(64) {
        let mut w = [0u32; 64];
        for (i, word) in chunk.chunks_exact(4).enumerate() {
            w[i] = u32::from_be_bytes([word[0], word[1], word[2], word[3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }
        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }
    h.iter().map(|word| format!("{word:08x}")).collect()
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

        ac.share(&alice, &resource, "bob", vec![Action::Read, Action::Execute]).await.unwrap();
        assert!(ac.can(&bob, Action::Read, &resource).await.unwrap());
        assert!(ac.can(&bob, Action::Execute, &resource).await.unwrap());
        assert!(!ac.can(&bob, Action::Update, &resource).await.unwrap());
    }

    #[tokio::test]
    async fn non_owner_cannot_share() {
        let ac = acl();
        let bob = Principal::user("bob");
        let resource = Governed::owned(ResourceKind::Knowledge, "kn_1", "alice");
        let err = ac.share(&bob, &resource, "eve", vec![Action::Read]).await.unwrap_err();
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
    async fn token_auth_roundtrip() {
        let storage: SharedStorage = Arc::new(InMemoryStorage::new());
        let provider = TokenAuthProvider::new(storage);
        let token = provider.issue_token("alice", "Alice", vec![Role::builder()]).await.unwrap();

        let principal = provider.authenticate_token(&token).await.unwrap().unwrap();
        assert_eq!(principal.user_id, "alice");
        assert!(provider.authenticate_token("rsk_wrong").await.unwrap().is_none());
    }

    #[test]
    fn sha256_matches_nist_vectors() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(
            sha256_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            sha256_hex(b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
            "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
        );
    }
}
