//! [`DefinitionStore`]: versioned user-created artifact definitions.

use async_trait::async_trait;
use rustra_core::{ResourceKind, Result};
use rustra_storage::types::DefinitionRecord;
use rustra_storage::{DefinitionStore, Page};
use tokio_postgres::Row;

use crate::util::*;
use crate::PostgresStorage;

const SELECT_DEFINITION: &str = "SELECT id, kind, owner_id, name, version, spec, visibility, \
                                 latest, created_at FROM rustra_definitions";

/// The version bump is a single data-modifying-CTE statement, so demoting the
/// previous latest and inserting the new head are atomic even though the
/// shared client cannot open interactive transactions. (Two racing
/// `put_definition` calls for the same id can still both compute the same
/// next version; the second then fails on the `(kind, id, version)` primary
/// key rather than corrupting history.)
const PUT_DEFINITION: &str = "WITH demoted AS ( \
         UPDATE rustra_definitions SET latest = FALSE \
         WHERE kind = $1 AND id = $2 AND latest = TRUE \
     ) \
     INSERT INTO rustra_definitions \
         (id, kind, owner_id, name, version, spec, visibility, latest, created_at) \
     SELECT $2, $1, $3, $4, \
            COALESCE((SELECT MAX(version) FROM rustra_definitions \
                      WHERE kind = $1 AND id = $2), 0) + 1, \
            $5, $6, TRUE, $7 \
     RETURNING version";

impl FromRow for DefinitionRecord {
    fn from_row(row: &Row) -> Result<DefinitionRecord> {
        Ok(DefinitionRecord {
            id: col(row, 0)?,
            kind: kind_from_sql(&col::<String>(row, 1)?)?,
            owner_id: col(row, 2)?,
            name: col(row, 3)?,
            version: col_u32(row, 4)?,
            spec: col(row, 5)?,
            visibility: vis_from_sql(&col::<String>(row, 6)?)?,
            latest: col(row, 7)?,
            created_at: col(row, 8)?,
        })
    }
}

#[async_trait]
impl DefinitionStore for PostgresStorage {
    async fn put_definition(&self, mut record: DefinitionRecord) -> Result<DefinitionRecord> {
        let kind = kind_to_sql(record.kind);
        let vis = vis_to_sql(record.visibility);
        let row = self
            .db
            .query_one(
                PUT_DEFINITION,
                &[
                    &kind,
                    &record.id,
                    &record.owner_id,
                    &record.name,
                    &record.spec,
                    &vis,
                    &record.created_at,
                ],
            )
            .await?;
        record.version = col_u32(&row, 0)?;
        record.latest = true;
        Ok(record)
    }

    async fn get_definition(
        &self,
        kind: ResourceKind,
        id: &str,
    ) -> Result<Option<DefinitionRecord>> {
        self.db
            .query_opt_as::<DefinitionRecord>(
                &format!("{SELECT_DEFINITION} WHERE kind = $1 AND id = $2 AND latest = TRUE"),
                &[&kind_to_sql(kind), &id],
            )
            .await
    }

    async fn get_definition_version(
        &self,
        kind: ResourceKind,
        id: &str,
        version: u32,
    ) -> Result<Option<DefinitionRecord>> {
        let version = u32_to_db(version);
        self.db
            .query_opt_as::<DefinitionRecord>(
                &format!("{SELECT_DEFINITION} WHERE kind = $1 AND id = $2 AND version = $3"),
                &[&kind_to_sql(kind), &id, &version],
            )
            .await
    }

    async fn list_definitions(
        &self,
        kind: ResourceKind,
        owner_id: &str,
        include_shared: bool,
        page: Page,
    ) -> Result<Vec<DefinitionRecord>> {
        let (limit, offset) = page_params(page);
        self.db
            .query_as::<DefinitionRecord>(
                &format!(
                    "{SELECT_DEFINITION} WHERE kind = $1 AND latest = TRUE \
                     AND (owner_id = $2 OR ($3 AND visibility <> 'private')) \
                     ORDER BY created_at DESC LIMIT $4 OFFSET $5"
                ),
                &[
                    &kind_to_sql(kind),
                    &owner_id,
                    &include_shared,
                    &limit,
                    &offset,
                ],
            )
            .await
    }

    async fn delete_definition(&self, kind: ResourceKind, id: &str) -> Result<()> {
        self.db
            .execute(
                "DELETE FROM rustra_definitions WHERE kind = $1 AND id = $2",
                &[&kind_to_sql(kind), &id],
            )
            .await?;
        Ok(())
    }
}
