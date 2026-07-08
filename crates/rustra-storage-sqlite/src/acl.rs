//! [`AclStore`]: users and sharing grants.

use async_trait::async_trait;
use rusqlite::{params, Row};
use rustra_core::{ResourceKind, Result};
use rustra_storage::types::{GrantRecord, UserRecord};
use rustra_storage::{AclStore, Page};

use crate::util::*;
use crate::SqliteStorage;

const SELECT_USER: &str =
    "SELECT id, display_name, roles, token_hash, profile, created_at FROM rustra_users";

const SELECT_GRANT: &str = "SELECT id, resource_kind, resource_id, grantee, actions, granted_by, \
                            created_at FROM rustra_grants";

fn user_from_row(row: &Row<'_>) -> Result<UserRecord> {
    Ok(UserRecord {
        id: col(row, 0)?,
        display_name: col(row, 1)?,
        roles: string_vec_from_sql(&col::<String>(row, 2)?)?,
        token_hash: col(row, 3)?,
        profile: col_json(row, 4)?,
        created_at: col_ts(row, 5)?,
    })
}

fn grant_from_row(row: &Row<'_>) -> Result<GrantRecord> {
    Ok(GrantRecord {
        id: col(row, 0)?,
        resource_kind: kind_from_sql(&col::<String>(row, 1)?)?,
        resource_id: col(row, 2)?,
        grantee: col(row, 3)?,
        actions: string_vec_from_sql(&col::<String>(row, 4)?)?,
        granted_by: col(row, 5)?,
        created_at: col_ts(row, 6)?,
    })
}

#[async_trait]
impl AclStore for SqliteStorage {
    async fn upsert_user(&self, user: UserRecord) -> Result<()> {
        self.db
            .call(move |conn| {
                let roles = string_vec_to_sql(&user.roles)?;
                exec(
                    conn,
                    "INSERT OR REPLACE INTO rustra_users \
                     (id, display_name, roles, token_hash, profile, created_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        user.id,
                        user.display_name,
                        roles,
                        user.token_hash,
                        json_to_sql(&user.profile)?,
                        to_ts(user.created_at),
                    ],
                )?;
                Ok(())
            })
            .await
    }

    async fn get_user(&self, user_id: &str) -> Result<Option<UserRecord>> {
        let user_id = user_id.to_owned();
        self.db
            .call(move |conn| {
                query_opt(
                    conn,
                    &format!("{SELECT_USER} WHERE id = ?1"),
                    params![user_id],
                    user_from_row,
                )
            })
            .await
    }

    async fn find_user_by_token_hash(&self, token_hash: &str) -> Result<Option<UserRecord>> {
        let token_hash = token_hash.to_owned();
        self.db
            .call(move |conn| {
                query_opt(
                    conn,
                    &format!("{SELECT_USER} WHERE token_hash = ?1"),
                    params![token_hash],
                    user_from_row,
                )
            })
            .await
    }

    async fn list_users(&self, page: Page) -> Result<Vec<UserRecord>> {
        let (limit, offset) = page_params(page);
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!("{SELECT_USER} ORDER BY created_at ASC LIMIT ?1 OFFSET ?2"),
                    params![limit, offset],
                    user_from_row,
                )
            })
            .await
    }

    async fn insert_grant(&self, grant: GrantRecord) -> Result<()> {
        self.db
            .call(move |conn| {
                let actions = string_vec_to_sql(&grant.actions)?;
                exec(
                    conn,
                    "INSERT OR REPLACE INTO rustra_grants \
                     (id, resource_kind, resource_id, grantee, actions, granted_by, created_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        grant.id,
                        kind_to_sql(grant.resource_kind),
                        grant.resource_id,
                        grant.grantee,
                        actions,
                        grant.granted_by,
                        to_ts(grant.created_at),
                    ],
                )?;
                Ok(())
            })
            .await
    }

    async fn delete_grant(&self, grant_id: &str) -> Result<()> {
        let grant_id = grant_id.to_owned();
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "DELETE FROM rustra_grants WHERE id = ?1",
                    params![grant_id],
                )?;
                Ok(())
            })
            .await
    }

    async fn list_grants_for_resource(
        &self,
        kind: ResourceKind,
        resource_id: &str,
    ) -> Result<Vec<GrantRecord>> {
        let resource_id = resource_id.to_owned();
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_GRANT} WHERE resource_kind = ?1 AND resource_id = ?2 \
                         ORDER BY created_at ASC"
                    ),
                    params![kind_to_sql(kind), resource_id],
                    grant_from_row,
                )
            })
            .await
    }

    async fn list_grants_for_grantee(&self, grantee: &str) -> Result<Vec<GrantRecord>> {
        let grantee = grantee.to_owned();
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!("{SELECT_GRANT} WHERE grantee = ?1 ORDER BY created_at ASC"),
                    params![grantee],
                    grant_from_row,
                )
            })
            .await
    }
}
