//! [`AclStore`]: users and sharing grants.

use async_trait::async_trait;
use rustra_core::{ResourceKind, Result};
use rustra_storage::types::{GrantRecord, UserRecord};
use rustra_storage::{AclStore, Page};
use serde_json::Value;
use tokio_postgres::Row;

use crate::util::*;
use crate::PostgresStorage;

const SELECT_USER: &str =
    "SELECT id, display_name, roles, token_hash, profile, created_at FROM rustra_users";

const SELECT_GRANT: &str = "SELECT id, resource_kind, resource_id, grantee, actions, granted_by, \
                            created_at FROM rustra_grants";

impl FromRow for UserRecord {
    fn from_row(row: &Row) -> Result<UserRecord> {
        Ok(UserRecord {
            id: col(row, 0)?,
            display_name: col(row, 1)?,
            roles: string_vec_from_json(col::<Value>(row, 2)?)?,
            token_hash: col(row, 3)?,
            profile: col(row, 4)?,
            created_at: col(row, 5)?,
        })
    }
}

impl FromRow for GrantRecord {
    fn from_row(row: &Row) -> Result<GrantRecord> {
        Ok(GrantRecord {
            id: col(row, 0)?,
            resource_kind: kind_from_sql(&col::<String>(row, 1)?)?,
            resource_id: col(row, 2)?,
            grantee: col(row, 3)?,
            actions: string_vec_from_json(col::<Value>(row, 4)?)?,
            granted_by: col(row, 5)?,
            created_at: col(row, 6)?,
        })
    }
}

#[async_trait]
impl AclStore for PostgresStorage {
    async fn upsert_user(&self, user: UserRecord) -> Result<()> {
        let roles = string_vec_to_json(&user.roles);
        self.db
            .execute(
                "INSERT INTO rustra_users \
                 (id, display_name, roles, token_hash, profile, created_at) \
                 VALUES ($1, $2, $3, $4, $5, $6) \
                 ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, \
                 roles = EXCLUDED.roles, token_hash = EXCLUDED.token_hash, \
                 profile = EXCLUDED.profile, created_at = EXCLUDED.created_at",
                &[
                    &user.id,
                    &user.display_name,
                    &roles,
                    &user.token_hash,
                    &user.profile,
                    &user.created_at,
                ],
            )
            .await?;
        Ok(())
    }

    async fn get_user(&self, user_id: &str) -> Result<Option<UserRecord>> {
        self.db
            .query_opt_as::<UserRecord>(&format!("{SELECT_USER} WHERE id = $1"), &[&user_id])
            .await
    }

    async fn find_user_by_token_hash(&self, token_hash: &str) -> Result<Option<UserRecord>> {
        self.db
            .query_opt_as::<UserRecord>(
                &format!("{SELECT_USER} WHERE token_hash = $1"),
                &[&token_hash],
            )
            .await
    }

    async fn list_users(&self, page: Page) -> Result<Vec<UserRecord>> {
        let (limit, offset) = page_params(page);
        self.db
            .query_as::<UserRecord>(
                &format!("{SELECT_USER} ORDER BY created_at ASC LIMIT $1 OFFSET $2"),
                &[&limit, &offset],
            )
            .await
    }

    async fn insert_grant(&self, grant: GrantRecord) -> Result<()> {
        let actions = string_vec_to_json(&grant.actions);
        self.db
            .execute(
                "INSERT INTO rustra_grants \
                 (id, resource_kind, resource_id, grantee, actions, granted_by, created_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7) \
                 ON CONFLICT (id) DO UPDATE SET resource_kind = EXCLUDED.resource_kind, \
                 resource_id = EXCLUDED.resource_id, grantee = EXCLUDED.grantee, \
                 actions = EXCLUDED.actions, granted_by = EXCLUDED.granted_by, \
                 created_at = EXCLUDED.created_at",
                &[
                    &grant.id,
                    &kind_to_sql(grant.resource_kind),
                    &grant.resource_id,
                    &grant.grantee,
                    &actions,
                    &grant.granted_by,
                    &grant.created_at,
                ],
            )
            .await?;
        Ok(())
    }

    async fn delete_grant(&self, grant_id: &str) -> Result<()> {
        self.db
            .execute("DELETE FROM rustra_grants WHERE id = $1", &[&grant_id])
            .await?;
        Ok(())
    }

    async fn list_grants_for_resource(
        &self,
        kind: ResourceKind,
        resource_id: &str,
    ) -> Result<Vec<GrantRecord>> {
        self.db
            .query_as::<GrantRecord>(
                &format!(
                    "{SELECT_GRANT} WHERE resource_kind = $1 AND resource_id = $2 \
                     ORDER BY created_at ASC"
                ),
                &[&kind_to_sql(kind), &resource_id],
            )
            .await
    }

    async fn list_grants_for_grantee(&self, grantee: &str) -> Result<Vec<GrantRecord>> {
        self.db
            .query_as::<GrantRecord>(
                &format!("{SELECT_GRANT} WHERE grantee = $1 ORDER BY created_at ASC"),
                &[&grantee],
            )
            .await
    }
}
