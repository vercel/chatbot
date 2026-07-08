//! [`MemoryStore`]: threads, messages, per-resource working memory.

use async_trait::async_trait;
use rustra_core::{Error, Result};
use rustra_storage::types::{ResourceRecord, StoredMessage, Thread};
use rustra_storage::{MemoryStore, Page};
use tokio_postgres::Row;

use crate::util::*;
use crate::PostgresStorage;

const SELECT_THREAD: &str =
    "SELECT id, resource_id, title, metadata, created_at, updated_at FROM rustra_threads";

const SELECT_MESSAGE: &str =
    "SELECT id, thread_id, resource_id, role, content, created_at FROM rustra_messages";

fn thread_from_row(row: &Row) -> Result<Thread> {
    Ok(Thread {
        id: col(row, 0)?,
        resource_id: col(row, 1)?,
        title: col(row, 2)?,
        metadata: col(row, 3)?,
        created_at: col(row, 4)?,
        updated_at: col(row, 5)?,
    })
}

fn message_from_row(row: &Row) -> Result<StoredMessage> {
    Ok(StoredMessage {
        id: col(row, 0)?,
        thread_id: col(row, 1)?,
        resource_id: col(row, 2)?,
        role: col(row, 3)?,
        content: col(row, 4)?,
        created_at: col(row, 5)?,
    })
}

fn resource_from_row(row: &Row) -> Result<ResourceRecord> {
    Ok(ResourceRecord {
        id: col(row, 0)?,
        working_memory: col(row, 1)?,
        metadata: col(row, 2)?,
        updated_at: col(row, 3)?,
    })
}

#[async_trait]
impl MemoryStore for PostgresStorage {
    async fn create_thread(&self, thread: Thread) -> Result<()> {
        self.db
            .execute(
                "INSERT INTO rustra_threads \
                 (id, resource_id, title, metadata, created_at, updated_at) \
                 VALUES ($1, $2, $3, $4, $5, $6) \
                 ON CONFLICT (id) DO UPDATE SET resource_id = EXCLUDED.resource_id, \
                 title = EXCLUDED.title, metadata = EXCLUDED.metadata, \
                 created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at",
                &[
                    &thread.id,
                    &thread.resource_id,
                    &thread.title,
                    &thread.metadata,
                    &thread.created_at,
                    &thread.updated_at,
                ],
            )
            .await?;
        Ok(())
    }

    async fn get_thread(&self, thread_id: &str) -> Result<Option<Thread>> {
        let row = self
            .db
            .query_opt(&format!("{SELECT_THREAD} WHERE id = $1"), &[&thread_id])
            .await?;
        row_opt(row, thread_from_row)
    }

    async fn update_thread(&self, thread: Thread) -> Result<()> {
        let changed = self
            .db
            .execute(
                "UPDATE rustra_threads SET resource_id = $2, title = $3, metadata = $4, \
                 created_at = $5, updated_at = $6 WHERE id = $1",
                &[
                    &thread.id,
                    &thread.resource_id,
                    &thread.title,
                    &thread.metadata,
                    &thread.created_at,
                    &thread.updated_at,
                ],
            )
            .await?;
        if changed == 0 {
            return Err(Error::not_found("thread", &thread.id));
        }
        Ok(())
    }

    async fn delete_thread(&self, thread_id: &str) -> Result<()> {
        // A single data-modifying-CTE statement keeps the cascade atomic.
        self.db
            .execute(
                "WITH deleted_messages AS ( \
                     DELETE FROM rustra_messages WHERE thread_id = $1 \
                 ) \
                 DELETE FROM rustra_threads WHERE id = $1",
                &[&thread_id],
            )
            .await?;
        Ok(())
    }

    async fn list_threads(&self, resource_id: &str, page: Page) -> Result<Vec<Thread>> {
        let (limit, offset) = page_params(page);
        let rows = self
            .db
            .query(
                &format!(
                    "{SELECT_THREAD} WHERE resource_id = $1 \
                     ORDER BY updated_at DESC LIMIT $2 OFFSET $3"
                ),
                &[&resource_id, &limit, &offset],
            )
            .await?;
        rows_map(rows, thread_from_row)
    }

    async fn append_message(&self, message: StoredMessage) -> Result<()> {
        self.db
            .execute(
                "INSERT INTO rustra_messages \
                 (id, thread_id, resource_id, role, content, created_at) \
                 VALUES ($1, $2, $3, $4, $5, $6)",
                &[
                    &message.id,
                    &message.thread_id,
                    &message.resource_id,
                    &message.role,
                    &message.content,
                    &message.created_at,
                ],
            )
            .await?;
        Ok(())
    }

    async fn recent_messages(&self, thread_id: &str, limit: usize) -> Result<Vec<StoredMessage>> {
        let limit = as_i64(limit);
        // Take the newest `limit` messages, then flip to chronological.
        let rows = self
            .db
            .query(
                &format!(
                    "{SELECT_MESSAGE} WHERE thread_id = $1 \
                     ORDER BY created_at DESC, seq DESC LIMIT $2"
                ),
                &[&thread_id, &limit],
            )
            .await?;
        let mut messages = rows_map(rows, message_from_row)?;
        messages.reverse();
        Ok(messages)
    }

    async fn get_messages(&self, ids: &[String]) -> Result<Vec<StoredMessage>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let ids = ids.to_vec();
        let rows = self
            .db
            .query(
                &format!(
                    "{SELECT_MESSAGE} WHERE id = ANY($1) ORDER BY created_at ASC, seq ASC"
                ),
                &[&ids],
            )
            .await?;
        rows_map(rows, message_from_row)
    }

    async fn get_resource(&self, resource_id: &str) -> Result<Option<ResourceRecord>> {
        let row = self
            .db
            .query_opt(
                "SELECT id, working_memory, metadata, updated_at \
                 FROM rustra_resources WHERE id = $1",
                &[&resource_id],
            )
            .await?;
        row_opt(row, resource_from_row)
    }

    async fn save_resource(&self, resource: ResourceRecord) -> Result<()> {
        self.db
            .execute(
                "INSERT INTO rustra_resources (id, working_memory, metadata, updated_at) \
                 VALUES ($1, $2, $3, $4) \
                 ON CONFLICT (id) DO UPDATE SET working_memory = EXCLUDED.working_memory, \
                 metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at",
                &[
                    &resource.id,
                    &resource.working_memory,
                    &resource.metadata,
                    &resource.updated_at,
                ],
            )
            .await?;
        Ok(())
    }
}
