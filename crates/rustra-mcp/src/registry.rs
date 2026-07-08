//! Persistence and permissioning for configured MCP servers.
//!
//! The registry is how **dynamic** servers enter the system: any user can
//! register a private ([`McpScope::User`]) server; deployment-wide
//! ([`McpScope::Shared`]) servers require the `developer` or `admin` role.
//! Mutations (enable/disable, removal) are owner-or-admin only. Reads follow
//! the storage layer's sharing rules: users see their own servers plus, on
//! request, shared/deployment ones.

use chrono::Utc;

use rustra_core::{new_id, Error, Principal, ResourceKind, Result, Role, Visibility};
use rustra_rbac::Governed;
use rustra_storage::types::McpServerRecord;
use rustra_storage::{Page, SharedStorage};

use crate::client::McpClient;
use crate::config::{McpScope, McpServerDefinition, McpSide};

/// The [`Governed`] view of an MCP server record, for hosts that route
/// access decisions through [`rustra_rbac::AccessControl`].
pub fn governed(record: &McpServerRecord) -> Governed {
    Governed::new(
        ResourceKind::McpServer,
        record.id.clone(),
        record.owner_id.clone(),
        record.visibility,
    )
}

/// Stores, lists, and connects configured MCP servers.
pub struct McpRegistry {
    storage: SharedStorage,
}

impl McpRegistry {
    pub fn new(storage: SharedStorage) -> Self {
        Self { storage }
    }

    /// Register a server definition on behalf of `principal`.
    ///
    /// * [`McpScope::User`] — always allowed; the record is owned by the
    ///   principal and private.
    /// * [`McpScope::Shared`] — requires the `developer` or `admin` role; the
    ///   record is deployment-owned (`owner_id: None`) and shared.
    pub async fn register(
        &self,
        principal: &Principal,
        definition: McpServerDefinition,
    ) -> Result<McpServerRecord> {
        definition.validate()?;
        if definition.scope == McpScope::Shared
            && !(principal.is_admin() || principal.has_role(Role::DEVELOPER))
        {
            return Err(Error::PermissionDenied(format!(
                "user `{}` may not register shared MCP servers (requires developer or admin role)",
                principal.user_id
            )));
        }
        let record = definition.to_record(new_id("mcp"), &principal.user_id)?;
        self.storage.upsert_mcp_server(record.clone()).await?;
        tracing::info!(
            server = %record.name,
            id = %record.id,
            owner = record.owner_id.as_deref().unwrap_or("<deployment>"),
            "registered mcp server"
        );
        Ok(record)
    }

    /// Fetch a server record, enforcing read visibility: owner, admin, or
    /// anyone for shared/deployment servers.
    pub async fn get(&self, principal: &Principal, id: &str) -> Result<McpServerRecord> {
        let record = self.load(id).await?;
        let readable = principal.is_admin()
            || record.owner_id.as_deref() == Some(principal.user_id.as_str())
            || record.owner_id.is_none()
            || record.visibility != Visibility::Private;
        if !readable {
            return Err(Error::PermissionDenied(format!(
                "user `{}` may not read mcp server `{id}`",
                principal.user_id
            )));
        }
        Ok(record)
    }

    /// Servers owned by `user_id`, plus shared/deployment-wide ones when
    /// `include_shared` is set.
    pub async fn list_for_user(
        &self,
        user_id: &str,
        include_shared: bool,
    ) -> Result<Vec<McpServerRecord>> {
        self.storage.list_mcp_servers(user_id, include_shared, Page::default()).await
    }

    /// Enable or disable a server. Owner-or-admin only.
    pub async fn set_enabled(
        &self,
        principal: &Principal,
        id: &str,
        enabled: bool,
    ) -> Result<McpServerRecord> {
        let mut record = self.load(id).await?;
        self.require_owner_or_admin(principal, &record)?;
        record.enabled = enabled;
        // Keep the embedded definition consistent with the record flag.
        let mut definition = McpServerDefinition::from_record(&record)?;
        definition.enabled = enabled;
        record.config = serde_json::to_value(&definition)?;
        record.updated_at = Utc::now();
        self.storage.upsert_mcp_server(record.clone()).await?;
        Ok(record)
    }

    /// Delete a server. Owner-or-admin only.
    pub async fn remove(&self, principal: &Principal, id: &str) -> Result<()> {
        let record = self.load(id).await?;
        self.require_owner_or_admin(principal, &record)?;
        self.storage.delete_mcp_server(id).await?;
        tracing::info!(server = %record.name, id = %record.id, "removed mcp server");
        Ok(())
    }

    /// Connect to a stored server.
    ///
    /// Only [`McpSide::ServerSide`] servers can be connected here — for
    /// client-side servers the Rustra process merely stores/forwards the
    /// configuration, so connecting is a configuration error. Disabled
    /// servers are also rejected.
    pub async fn connect(&self, record: &McpServerRecord) -> Result<McpClient> {
        if !record.enabled {
            return Err(Error::Config(format!("mcp server `{}` is disabled", record.name)));
        }
        let definition = McpServerDefinition::from_record(record)?;
        if definition.side == McpSide::ClientSide {
            return Err(Error::Config(format!(
                "mcp server `{}` is client-side: client-side MCP servers are executed by the client, not the Rustra server",
                record.name
            )));
        }
        McpClient::connect(&definition).await
    }

    async fn load(&self, id: &str) -> Result<McpServerRecord> {
        self.storage
            .get_mcp_server(id)
            .await?
            .ok_or_else(|| Error::not_found("mcp_server", id))
    }

    fn require_owner_or_admin(
        &self,
        principal: &Principal,
        record: &McpServerRecord,
    ) -> Result<()> {
        let allowed = principal.is_admin()
            || record.owner_id.as_deref() == Some(principal.user_id.as_str());
        if allowed {
            Ok(())
        } else {
            Err(Error::PermissionDenied(format!(
                "user `{}` may not modify mcp server `{}`",
                principal.user_id, record.id
            )))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_storage::InMemoryStorage;
    use std::sync::Arc;

    fn registry() -> McpRegistry {
        McpRegistry::new(Arc::new(InMemoryStorage::new()))
    }

    fn private_def(name: &str) -> McpServerDefinition {
        McpServerDefinition::stdio(name, "some-command", vec![])
    }

    fn shared_def(name: &str) -> McpServerDefinition {
        let mut def = private_def(name);
        def.scope = McpScope::Shared;
        def
    }

    #[tokio::test]
    async fn private_server_is_invisible_to_others_but_shared_is_seen() {
        let reg = registry();
        let alice = Principal::user("alice");
        let dev = Principal::with_roles("dev", vec![Role::developer()]);

        let record = reg.register(&alice, private_def("alice-fs")).await.unwrap();
        assert_eq!(record.owner_id.as_deref(), Some("alice"));
        assert_eq!(record.visibility, Visibility::Private);

        let shared = reg.register(&dev, shared_def("team-github")).await.unwrap();
        assert_eq!(shared.owner_id, None);
        assert_eq!(shared.visibility, Visibility::Shared);

        // Alice sees both (hers + shared).
        let names: Vec<_> = reg
            .list_for_user("alice", true)
            .await
            .unwrap()
            .into_iter()
            .map(|r| r.name)
            .collect();
        assert!(names.contains(&"alice-fs".to_string()));
        assert!(names.contains(&"team-github".to_string()));

        // Bob sees only the shared one, and nothing without include_shared.
        let names: Vec<_> = reg
            .list_for_user("bob", true)
            .await
            .unwrap()
            .into_iter()
            .map(|r| r.name)
            .collect();
        assert_eq!(names, vec!["team-github".to_string()]);
        assert!(reg.list_for_user("bob", false).await.unwrap().is_empty());

        // Bob cannot fetch Alice's private server, but Alice and admins can.
        let bob = Principal::user("bob");
        let err = reg.get(&bob, &record.id).await.unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));
        reg.get(&alice, &record.id).await.unwrap();
        reg.get(&bob, &shared.id).await.unwrap();
    }

    #[tokio::test]
    async fn non_owner_mutations_denied_admin_allowed() {
        let reg = registry();
        let alice = Principal::user("alice");
        let bob = Principal::user("bob");
        let admin = Principal::with_roles("root", vec![Role::admin()]);

        let record = reg.register(&alice, private_def("alice-fs")).await.unwrap();

        let err = reg.set_enabled(&bob, &record.id, false).await.unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));
        let err = reg.remove(&bob, &record.id).await.unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));

        let updated = reg.set_enabled(&alice, &record.id, false).await.unwrap();
        assert!(!updated.enabled);
        // The embedded definition tracks the record flag.
        assert!(!McpServerDefinition::from_record(&updated).unwrap().enabled);

        reg.remove(&admin, &record.id).await.unwrap();
        assert!(matches!(reg.get(&alice, &record.id).await, Err(Error::NotFound { .. })));
    }

    #[tokio::test]
    async fn builder_cannot_register_shared_but_developer_can() {
        let reg = registry();
        let builder = Principal::user("alice"); // default builder role
        let dev = Principal::with_roles("dev", vec![Role::developer()]);

        let err = reg.register(&builder, shared_def("team-x")).await.unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));
        reg.register(&dev, shared_def("team-x")).await.unwrap();
    }

    #[tokio::test]
    async fn invalid_definition_rejected() {
        let reg = registry();
        let alice = Principal::user("alice");
        let err = reg.register(&alice, private_def("Bad Name")).await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn connect_rejects_disabled_and_client_side() {
        let reg = registry();
        let alice = Principal::user("alice");

        // Disabled.
        let record = reg.register(&alice, private_def("fs")).await.unwrap();
        let record = reg.set_enabled(&alice, &record.id, false).await.unwrap();
        let err = reg.connect(&record).await.unwrap_err();
        assert!(matches!(err, Error::Config(_)));

        // Client-side (the default `side`).
        let mut def = private_def("local-browser");
        def.side = McpSide::ClientSide;
        let record = reg.register(&alice, def).await.unwrap();
        let err = reg.connect(&record).await.unwrap_err();
        assert!(matches!(err, Error::Config(msg) if msg.contains("client-side")));
    }

    #[test]
    fn governed_view_matches_record() {
        let def = shared_def("team-x");
        let record = def.to_record("mcp_9", "dev").unwrap();
        let g = governed(&record);
        assert_eq!(g.kind, ResourceKind::McpServer);
        assert_eq!(g.id, "mcp_9");
        assert_eq!(g.owner_id, None);
        assert_eq!(g.visibility, Visibility::Shared);
    }
}
