//! [`WorkflowStore`]: workflow run snapshots.

use async_trait::async_trait;
use rusqlite::{params, Row};
use rustra_core::Result;
use rustra_storage::types::WorkflowSnapshot;
use rustra_storage::{Page, WorkflowStore};

use crate::util::*;
use crate::SqliteStorage;

const SELECT_SNAPSHOT: &str = "SELECT run_id, workflow_id, resource_id, status, snapshot, \
                               created_at, updated_at FROM rustra_workflow_snapshots";

fn snapshot_from_row(row: &Row<'_>) -> Result<WorkflowSnapshot> {
    Ok(WorkflowSnapshot {
        run_id: col(row, 0)?,
        workflow_id: col(row, 1)?,
        resource_id: col(row, 2)?,
        status: col(row, 3)?,
        snapshot: col_json(row, 4)?,
        created_at: col_ts(row, 5)?,
        updated_at: col_ts(row, 6)?,
    })
}

#[async_trait]
impl WorkflowStore for SqliteStorage {
    async fn save_snapshot(&self, snapshot: WorkflowSnapshot) -> Result<()> {
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "INSERT OR REPLACE INTO rustra_workflow_snapshots \
                     (run_id, workflow_id, resource_id, status, snapshot, created_at, updated_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        snapshot.run_id,
                        snapshot.workflow_id,
                        snapshot.resource_id,
                        snapshot.status,
                        json_to_sql(&snapshot.snapshot)?,
                        to_ts(snapshot.created_at),
                        to_ts(snapshot.updated_at),
                    ],
                )?;
                Ok(())
            })
            .await
    }

    async fn load_snapshot(&self, run_id: &str) -> Result<Option<WorkflowSnapshot>> {
        let run_id = run_id.to_owned();
        self.db
            .call(move |conn| {
                query_opt(
                    conn,
                    &format!("{SELECT_SNAPSHOT} WHERE run_id = ?1"),
                    params![run_id],
                    snapshot_from_row,
                )
            })
            .await
    }

    async fn list_snapshots(
        &self,
        resource_id: &str,
        workflow_id: Option<&str>,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<WorkflowSnapshot>> {
        let resource_id = resource_id.to_owned();
        let workflow_id = workflow_id.map(str::to_owned);
        let status = status.map(str::to_owned);
        let (limit, offset) = page_params(page);
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_SNAPSHOT} WHERE resource_id = ?1 \
                         AND (?2 IS NULL OR workflow_id = ?2) \
                         AND (?3 IS NULL OR status = ?3) \
                         ORDER BY updated_at DESC LIMIT ?4 OFFSET ?5"
                    ),
                    params![resource_id, workflow_id, status, limit, offset],
                    snapshot_from_row,
                )
            })
            .await
    }

    async fn delete_snapshot(&self, run_id: &str) -> Result<()> {
        let run_id = run_id.to_owned();
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "DELETE FROM rustra_workflow_snapshots WHERE run_id = ?1",
                    params![run_id],
                )?;
                Ok(())
            })
            .await
    }
}
