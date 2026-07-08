//! [`MemoryStore`]: threads, messages, per-resource working memory.

use async_trait::async_trait;
use rusqlite::{params, params_from_iter, Row};
use rustra_core::{Error, Result};
use rustra_storage::types::{ResourceRecord, StoredMessage, Thread};
use rustra_storage::{MemoryStore, Page};

use crate::util::*;
use crate::SqliteStorage;

const SELECT_THREAD: &str =
    "SELECT id, resource_id, title, metadata, created_at, updated_at FROM rustra_threads";

const SELECT_MESSAGE: &str =
    "SELECT id, thread_id, resource_id, role, content, created_at FROM rustra_messages";

fn thread_from_row(row: &Row<'_>) -> Result<Thread> {
    Ok(Thread {
        id: col(row, "id")?,
        resource_id: col(row, "resource_id")?,
        title: col(row, "title")?,
        metadata: col_json(row, "metadata")?,
        created_at: col_ts(row, "created_at")?,
        updated_at: col_ts(row, "updated_at")?,
    })
}

fn message_from_row(row: &Row<'_>) -> Result<StoredMessage> {
    Ok(StoredMessage {
        id: col(row, "id")?,
        thread_id: col(row, "thread_id")?,
        resource_id: col(row, "resource_id")?,
        role: col(row, "role")?,
        content: col_json(row, "content")?,
        created_at: col_ts(row, "created_at")?,
    })
}

fn resource_from_row(row: &Row<'_>) -> Result<ResourceRecord> {
    Ok(ResourceRecord {
        id: col(row, "id")?,
        working_memory: col(row, "working_memory")?,
        metadata: col_json(row, "metadata")?,
        updated_at: col_ts(row, "updated_at")?,
    })
}

#[async_trait]
impl MemoryStore for SqliteStorage {
    async fn create_thread(&self, thread: Thread) -> Result<()> {
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "INSERT OR REPLACE INTO rustra_threads \
                     (id, resource_id, title, metadata, created_at, updated_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        thread.id,
                        thread.resource_id,
                        thread.title,
                        json_to_sql(&thread.metadata)?,
                        to_ts(thread.created_at),
                        to_ts(thread.updated_at),
                    ],
                )?;
                Ok(())
            })
            .await
    }

    async fn get_thread(&self, thread_id: &str) -> Result<Option<Thread>> {
        let thread_id = thread_id.to_owned();
        self.db
            .call(move |conn| {
                query_opt(
                    conn,
                    &format!("{SELECT_THREAD} WHERE id = ?1"),
                    params![thread_id],
                    thread_from_row,
                )
            })
            .await
    }

    async fn update_thread(&self, thread: Thread) -> Result<()> {
        self.db
            .call(move |conn| {
                let changed = exec(
                    conn,
                    "UPDATE rustra_threads SET resource_id = ?2, title = ?3, metadata = ?4, \
                     created_at = ?5, updated_at = ?6 WHERE id = ?1",
                    params![
                        thread.id,
                        thread.resource_id,
                        thread.title,
                        json_to_sql(&thread.metadata)?,
                        to_ts(thread.created_at),
                        to_ts(thread.updated_at),
                    ],
                )?;
                if changed == 0 {
                    return Err(Error::not_found("thread", &thread.id));
                }
                Ok(())
            })
            .await
    }

    async fn delete_thread(&self, thread_id: &str) -> Result<()> {
        let thread_id = thread_id.to_owned();
        self.db
            .call(move |conn| {
                with_tx(conn, |tx| {
                    exec(
                        tx,
                        "DELETE FROM rustra_messages WHERE thread_id = ?1",
                        params![thread_id],
                    )?;
                    exec(
                        tx,
                        "DELETE FROM rustra_threads WHERE id = ?1",
                        params![thread_id],
                    )?;
                    Ok(())
                })
            })
            .await
    }

    async fn list_threads(&self, resource_id: &str, page: Page) -> Result<Vec<Thread>> {
        let resource_id = resource_id.to_owned();
        let (limit, offset) = page_params(page);
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_THREAD} WHERE resource_id = ?1 \
                         ORDER BY updated_at DESC, rowid DESC LIMIT ?2 OFFSET ?3"
                    ),
                    params![resource_id, limit, offset],
                    thread_from_row,
                )
            })
            .await
    }

    async fn append_message(&self, message: StoredMessage) -> Result<()> {
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "INSERT INTO rustra_messages \
                     (id, thread_id, resource_id, role, content, created_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        message.id,
                        message.thread_id,
                        message.resource_id,
                        message.role,
                        json_to_sql(&message.content)?,
                        to_ts(message.created_at),
                    ],
                )?;
                Ok(())
            })
            .await
    }

    async fn recent_messages(&self, thread_id: &str, limit: usize) -> Result<Vec<StoredMessage>> {
        let thread_id = thread_id.to_owned();
        let limit = as_i64(limit);
        self.db
            .call(move |conn| {
                // Take the newest `limit` messages, then flip to chronological.
                let mut messages = query_all(
                    conn,
                    &format!(
                        "{SELECT_MESSAGE} WHERE thread_id = ?1 \
                         ORDER BY created_at DESC, rowid DESC LIMIT ?2"
                    ),
                    params![thread_id, limit],
                    message_from_row,
                )?;
                messages.reverse();
                Ok(messages)
            })
            .await
    }

    async fn get_messages(&self, ids: &[String]) -> Result<Vec<StoredMessage>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut ids = ids.to_vec();
        ids.sort_unstable();
        ids.dedup();
        self.db
            .call(move |conn| {
                // Chunk the IN-list to stay under SQLite's bound-parameter
                // ceiling; the (created_at, rowid) sort below reproduces the
                // single query's `ORDER BY created_at ASC, rowid ASC`.
                let mut msgs: Vec<(i64, StoredMessage)> = Vec::new();
                for chunk in ids.chunks(500) {
                    let placeholders = vec!["?"; chunk.len()].join(", ");
                    msgs.extend(query_all(
                        conn,
                        &format!(
                            "SELECT id, thread_id, resource_id, role, content, created_at, \
                             rowid FROM rustra_messages WHERE id IN ({placeholders})"
                        ),
                        params_from_iter(chunk.iter()),
                        |row| Ok((col::<i64, _>(row, "rowid")?, message_from_row(row)?)),
                    )?);
                }
                msgs.sort_by(|a, b| (a.1.created_at, a.0).cmp(&(b.1.created_at, b.0)));
                Ok(msgs.into_iter().map(|(_, m)| m).collect())
            })
            .await
    }

    async fn get_resource(&self, resource_id: &str) -> Result<Option<ResourceRecord>> {
        let resource_id = resource_id.to_owned();
        self.db
            .call(move |conn| {
                query_opt(
                    conn,
                    "SELECT id, working_memory, metadata, updated_at \
                     FROM rustra_resources WHERE id = ?1",
                    params![resource_id],
                    resource_from_row,
                )
            })
            .await
    }

    async fn save_resource(&self, resource: ResourceRecord) -> Result<()> {
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "INSERT OR REPLACE INTO rustra_resources \
                     (id, working_memory, metadata, updated_at) VALUES (?1, ?2, ?3, ?4)",
                    params![
                        resource.id,
                        resource.working_memory,
                        json_to_sql(&resource.metadata)?,
                        to_ts(resource.updated_at),
                    ],
                )?;
                Ok(())
            })
            .await
    }
}
