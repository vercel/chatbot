//! [`DefinitionStore`]: versioned user-created artifact definitions.

use async_trait::async_trait;
use rusqlite::{params, Row};
use rustra_core::{ResourceKind, Result};
use rustra_storage::types::DefinitionRecord;
use rustra_storage::{DefinitionStore, Page};

use crate::util::*;
use crate::SqliteStorage;

const SELECT_DEFINITION: &str = "SELECT id, kind, owner_id, name, version, spec, visibility, \
                                 latest, created_at FROM rustra_definitions";

fn definition_from_row(row: &Row<'_>) -> Result<DefinitionRecord> {
    Ok(DefinitionRecord {
        id: col(row, "id")?,
        kind: col_kind(row, "kind")?,
        owner_id: col(row, "owner_id")?,
        name: col(row, "name")?,
        version: col(row, "version")?,
        spec: col_json(row, "spec")?,
        visibility: col_vis(row, "visibility")?,
        latest: col(row, "latest")?,
        created_at: col_ts(row, "created_at")?,
    })
}

#[async_trait]
impl DefinitionStore for SqliteStorage {
    async fn put_definition(&self, mut record: DefinitionRecord) -> Result<DefinitionRecord> {
        self.db
            .call(move |conn| {
                with_tx(conn, |tx| {
                    let kind = kind_to_sql(record.kind);
                    let next_version: u32 = tx
                        .query_row(
                            "SELECT COALESCE(MAX(version), 0) + 1 FROM rustra_definitions \
                             WHERE kind = ?1 AND id = ?2",
                            params![kind, record.id],
                            |row| row.get(0),
                        )
                        .map_err(storage_err)?;
                    exec(
                        tx,
                        "UPDATE rustra_definitions SET latest = 0 WHERE kind = ?1 AND id = ?2",
                        params![kind, record.id],
                    )?;
                    record.version = next_version;
                    record.latest = true;
                    exec(
                        tx,
                        "INSERT INTO rustra_definitions \
                         (id, kind, owner_id, name, version, spec, visibility, latest, \
                          created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                        params![
                            record.id,
                            kind,
                            record.owner_id,
                            record.name,
                            record.version,
                            json_to_sql(&record.spec)?,
                            vis_to_sql(record.visibility),
                            record.latest,
                            to_ts(record.created_at),
                        ],
                    )?;
                    Ok(record)
                })
            })
            .await
    }

    async fn get_definition(
        &self,
        kind: ResourceKind,
        id: &str,
    ) -> Result<Option<DefinitionRecord>> {
        let id = id.to_owned();
        self.db
            .call(move |conn| {
                query_opt(
                    conn,
                    &format!("{SELECT_DEFINITION} WHERE kind = ?1 AND id = ?2 AND latest = 1"),
                    params![kind_to_sql(kind), id],
                    definition_from_row,
                )
            })
            .await
    }

    async fn get_definition_version(
        &self,
        kind: ResourceKind,
        id: &str,
        version: u32,
    ) -> Result<Option<DefinitionRecord>> {
        let id = id.to_owned();
        self.db
            .call(move |conn| {
                query_opt(
                    conn,
                    &format!("{SELECT_DEFINITION} WHERE kind = ?1 AND id = ?2 AND version = ?3"),
                    params![kind_to_sql(kind), id, version],
                    definition_from_row,
                )
            })
            .await
    }

    async fn list_definitions(
        &self,
        kind: ResourceKind,
        owner_id: &str,
        include_shared: bool,
        page: Page,
    ) -> Result<Vec<DefinitionRecord>> {
        let owner_id = owner_id.to_owned();
        let (limit, offset) = page_params(page);
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_DEFINITION} WHERE kind = ?1 AND latest = 1 \
                         AND (owner_id = ?2 OR (?3 AND visibility <> 'private')) \
                         ORDER BY created_at DESC, rowid DESC LIMIT ?4 OFFSET ?5"
                    ),
                    params![kind_to_sql(kind), owner_id, include_shared, limit, offset],
                    definition_from_row,
                )
            })
            .await
    }

    async fn delete_definition(&self, kind: ResourceKind, id: &str) -> Result<()> {
        let id = id.to_owned();
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "DELETE FROM rustra_definitions WHERE kind = ?1 AND id = ?2",
                    params![kind_to_sql(kind), id],
                )?;
                Ok(())
            })
            .await
    }
}
