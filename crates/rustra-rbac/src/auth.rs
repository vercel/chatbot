//! Token authentication: bearer tokens resolved to principals via SHA-256
//! hashes stored on user records.

use async_trait::async_trait;
use chrono::Utc;

use rustra_core::{new_id, Principal, Result, Role};
use rustra_storage::types::UserRecord;
use rustra_storage::SharedStorage;

use crate::sha256::sha256_hex;

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
    /// Token provider verifying bearer tokens against SHA-256 hashes on stored
    /// user records.
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
    pub async fn issue_token(
        &self,
        user_id: &str,
        display_name: &str,
        roles: impl IntoIterator<Item = Role>,
    ) -> Result<String> {
        let roles: Vec<String> = roles.into_iter().map(|r| r.as_str().to_string()).collect();
        let token = format!("rsk_{}", new_id("tok"));
        let existing = self.storage.get_user(user_id).await?;
        let (profile, created_at) = existing
            .map(|u| (u.profile, u.created_at))
            .unwrap_or_else(|| (serde_json::Value::Null, Utc::now()));
        let user = UserRecord {
            id: user_id.to_string(),
            display_name: display_name.to_string(),
            roles,
            token_hash: Some(Self::hash_token(&token)),
            profile,
            created_at,
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
            user.roles.into_iter().map(Role::from).collect(),
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_storage::InMemoryStorage;
    use std::sync::Arc;

    #[tokio::test]
    async fn token_auth_roundtrip() {
        let storage: SharedStorage = Arc::new(InMemoryStorage::new());
        let provider = TokenAuthProvider::new(storage);
        let token = provider
            .issue_token("alice", "Alice", vec![Role::builder()])
            .await
            .unwrap();

        let principal = provider.authenticate_token(&token).await.unwrap().unwrap();
        assert_eq!(principal.user_id, "alice");
        assert!(provider
            .authenticate_token("rsk_wrong")
            .await
            .unwrap()
            .is_none());
    }
}
