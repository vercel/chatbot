//! [`WorkflowStore`]: workflow run snapshots.

use async_trait::async_trait;
use rustra_core::Result;
use rustra_storage::types::WorkflowSnapshot;
use rustra_storage::{Page, WorkflowStore};
use tokio_postgres::Row;

use crate::util::*;
use crate::PostgresStorage;

const SELECT_SNAPSHOT: &str = "SELECT run_id, workflow_id, resource_id, status, snapshot, \
                               created_at, updated_at FROM rustra_workflow_snapshots";

fn snapshot_from_row(row: &Row) -> Result<WorkflowSnapshot> {
    Ok(WorkflowSnapshot {
        run_id: col(row, 0)?,
        workflow_id: col(row, 1)?,
        resource_id: col(row, 2)?,
        status: col(row, 3)?,
        snapshot: col(row, 4)?,
        created_at: col(row, 5)?,
        updated_at: col(row, 6)?,
    })
}

#[async_trait]
impl WorkflowStore for PostgresStorage {
    async fn save_snapshot(&self, snapshot: WorkflowSnapshot) -> Result<()> {
        self.db
            .execute(
                "INSERT INTO rustra_workflow_snapshots \
                 (run_id, workflow_id, resource_id, status, snapshot, created_at, updated_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7) \
                 ON CONFLICT (run_id) DO UPDATE SET workflow_id = EXCLUDED.workflow_id, \
                 resource_id = EXCLUDED.resource_id, status = EXCLUDED.status, \
                 snapshot = EXCLUDED.snapshot, created_at = EXCLUDED.created_at, \
                 updated_at = EXCLUDED.updated_at",
                &[
                    &snapshot.run_id,
                    &snapshot.workflow_id,
                    &snapshot.resource_id,
                    &snapshot.status,
                    &snapshot.snapshot,
                    &snapshot.created_at,
                    &snapshot.updated_at,
                ],
            )
            .await?;
        Ok(())
    }

    async fn load_snapshot(&self, run_id: &str) -> Result<Option<WorkflowSnapshot>> {
        let row = self
            .db
            .query_opt(&format!("{SELECT_SNAPSHOT} WHERE run_id = $1"), &[&run_id])
            .await?;
        row_opt(row, snapshot_from_row)
    }

    async fn list_snapshots(
        &self,
        resource_id: &str,
        workflow_id: Option<&str>,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<WorkflowSnapshot>> {
        let (limit, offset) = page_params(page);
        let rows = self
            .db
            .query(
                &format!(
                    "{SELECT_SNAPSHOT} WHERE resource_id = $1 \
                     AND ($2::TEXT IS NULL OR workflow_id = $2) \
                     AND ($3::TEXT IS NULL OR status = $3) \
                     ORDER BY updated_at DESC LIMIT $4 OFFSET $5"
                ),
                &[&resource_id, &workflow_id, &status, &limit, &offset],
            )
            .await?;
        rows_map(rows, snapshot_from_row)
    }

    async fn delete_snapshot(&self, run_id: &str) -> Result<()> {
        self.db
            .execute("DELETE FROM rustra_workflow_snapshots WHERE run_id = $1", &[&run_id])
            .await?;
        Ok(())
    }
}
