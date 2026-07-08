//! [`InfraStore`]: workspaces, MCP server configs, UI artifacts, channel
//! messages.

use async_trait::async_trait;
use rusqlite::{params, Row};
use rustra_core::Result;
use rustra_storage::types::{
    ChannelMessageRecord, McpServerRecord, UiArtifactRecord, WorkspaceRecord,
};
use rustra_storage::{InfraStore, Page};

use crate::util::*;
use crate::SqliteStorage;

const SELECT_WORKSPACE: &str =
    "SELECT id, user_id, name, root_path, settings, created_at FROM rustra_workspaces";

const SELECT_MCP_SERVER: &str = "SELECT id, owner_id, name, config, enabled, visibility, \
                                 created_at, updated_at FROM rustra_mcp_servers";

const SELECT_UI_ARTIFACT: &str = "SELECT id, owner_id, title, kind, html, data, version, \
                                  visibility, created_at, updated_at FROM rustra_ui_artifacts";

const SELECT_CHANNEL_MESSAGE: &str = "SELECT id, user_id, channel, sender, content, metadata, \
                                      \"read\", created_at FROM rustra_channel_messages";

fn workspace_from_row(row: &Row<'_>) -> Result<WorkspaceRecord> {
    Ok(WorkspaceRecord {
        id: col(row, 0)?,
        user_id: col(row, 1)?,
        name: col(row, 2)?,
        root_path: col(row, 3)?,
        settings: col_json(row, 4)?,
        created_at: col_ts(row, 5)?,
    })
}

fn mcp_server_from_row(row: &Row<'_>) -> Result<McpServerRecord> {
    Ok(McpServerRecord {
        id: col(row, 0)?,
        owner_id: col(row, 1)?,
        name: col(row, 2)?,
        config: col_json(row, 3)?,
        enabled: col(row, 4)?,
        visibility: vis_from_sql(&col::<String>(row, 5)?)?,
        created_at: col_ts(row, 6)?,
        updated_at: col_ts(row, 7)?,
    })
}

fn ui_artifact_from_row(row: &Row<'_>) -> Result<UiArtifactRecord> {
    Ok(UiArtifactRecord {
        id: col(row, 0)?,
        owner_id: col(row, 1)?,
        title: col(row, 2)?,
        kind: col(row, 3)?,
        html: col(row, 4)?,
        data: col_json(row, 5)?,
        version: col(row, 6)?,
        visibility: vis_from_sql(&col::<String>(row, 7)?)?,
        created_at: col_ts(row, 8)?,
        updated_at: col_ts(row, 9)?,
    })
}

fn channel_message_from_row(row: &Row<'_>) -> Result<ChannelMessageRecord> {
    Ok(ChannelMessageRecord {
        id: col(row, 0)?,
        user_id: col(row, 1)?,
        channel: col(row, 2)?,
        sender: col(row, 3)?,
        content: col(row, 4)?,
        metadata: col_json(row, 5)?,
        read: col(row, 6)?,
        created_at: col_ts(row, 7)?,
    })
}

#[async_trait]
impl InfraStore for SqliteStorage {
    async fn upsert_workspace(&self, ws: WorkspaceRecord) -> Result<()> {
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "INSERT OR REPLACE INTO rustra_workspaces \
                     (id, user_id, name, root_path, settings, created_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        ws.id,
                        ws.user_id,
                        ws.name,
                        ws.root_path,
                        json_to_sql(&ws.settings)?,
                        to_ts(ws.created_at),
                    ],
                )?;
                Ok(())
            })
            .await
    }

    async fn get_workspace(&self, ws_id: &str) -> Result<Option<WorkspaceRecord>> {
        let ws_id = ws_id.to_owned();
        self.db
            .call(move |conn| {
                query_opt(
                    conn,
                    &format!("{SELECT_WORKSPACE} WHERE id = ?1"),
                    params![ws_id],
                    workspace_from_row,
                )
            })
            .await
    }

    async fn list_workspaces(&self, user_id: &str, page: Page) -> Result<Vec<WorkspaceRecord>> {
        let user_id = user_id.to_owned();
        let (limit, offset) = page_params(page);
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_WORKSPACE} WHERE user_id = ?1 \
                         ORDER BY created_at ASC LIMIT ?2 OFFSET ?3"
                    ),
                    params![user_id, limit, offset],
                    workspace_from_row,
                )
            })
            .await
    }

    async fn delete_workspace(&self, ws_id: &str) -> Result<()> {
        let ws_id = ws_id.to_owned();
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "DELETE FROM rustra_workspaces WHERE id = ?1",
                    params![ws_id],
                )?;
                Ok(())
            })
            .await
    }

    async fn upsert_mcp_server(&self, server: McpServerRecord) -> Result<()> {
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "INSERT OR REPLACE INTO rustra_mcp_servers \
                     (id, owner_id, name, config, enabled, visibility, created_at, updated_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        server.id,
                        server.owner_id,
                        server.name,
                        json_to_sql(&server.config)?,
                        server.enabled,
                        vis_to_sql(server.visibility),
                        to_ts(server.created_at),
                        to_ts(server.updated_at),
                    ],
                )?;
                Ok(())
            })
            .await
    }

    async fn get_mcp_server(&self, server_id: &str) -> Result<Option<McpServerRecord>> {
        let server_id = server_id.to_owned();
        self.db
            .call(move |conn| {
                query_opt(
                    conn,
                    &format!("{SELECT_MCP_SERVER} WHERE id = ?1"),
                    params![server_id],
                    mcp_server_from_row,
                )
            })
            .await
    }

    async fn list_mcp_servers(
        &self,
        user_id: &str,
        include_shared: bool,
        page: Page,
    ) -> Result<Vec<McpServerRecord>> {
        let user_id = user_id.to_owned();
        let (limit, offset) = page_params(page);
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_MCP_SERVER} WHERE owner_id = ?1 \
                         OR (?2 AND (owner_id IS NULL OR visibility <> 'private')) \
                         ORDER BY created_at ASC LIMIT ?3 OFFSET ?4"
                    ),
                    params![user_id, include_shared, limit, offset],
                    mcp_server_from_row,
                )
            })
            .await
    }

    async fn delete_mcp_server(&self, server_id: &str) -> Result<()> {
        let server_id = server_id.to_owned();
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "DELETE FROM rustra_mcp_servers WHERE id = ?1",
                    params![server_id],
                )?;
                Ok(())
            })
            .await
    }

    async fn upsert_ui_artifact(&self, artifact: UiArtifactRecord) -> Result<()> {
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "INSERT OR REPLACE INTO rustra_ui_artifacts \
                     (id, owner_id, title, kind, html, data, version, visibility, created_at, \
                      updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        artifact.id,
                        artifact.owner_id,
                        artifact.title,
                        artifact.kind,
                        artifact.html,
                        json_to_sql(&artifact.data)?,
                        artifact.version,
                        vis_to_sql(artifact.visibility),
                        to_ts(artifact.created_at),
                        to_ts(artifact.updated_at),
                    ],
                )?;
                Ok(())
            })
            .await
    }

    async fn get_ui_artifact(&self, artifact_id: &str) -> Result<Option<UiArtifactRecord>> {
        let artifact_id = artifact_id.to_owned();
        self.db
            .call(move |conn| {
                query_opt(
                    conn,
                    &format!("{SELECT_UI_ARTIFACT} WHERE id = ?1"),
                    params![artifact_id],
                    ui_artifact_from_row,
                )
            })
            .await
    }

    async fn list_ui_artifacts(&self, owner_id: &str, page: Page) -> Result<Vec<UiArtifactRecord>> {
        let owner_id = owner_id.to_owned();
        let (limit, offset) = page_params(page);
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_UI_ARTIFACT} WHERE owner_id = ?1 \
                         ORDER BY updated_at DESC LIMIT ?2 OFFSET ?3"
                    ),
                    params![owner_id, limit, offset],
                    ui_artifact_from_row,
                )
            })
            .await
    }

    async fn delete_ui_artifact(&self, artifact_id: &str) -> Result<()> {
        let artifact_id = artifact_id.to_owned();
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "DELETE FROM rustra_ui_artifacts WHERE id = ?1",
                    params![artifact_id],
                )?;
                Ok(())
            })
            .await
    }

    async fn insert_channel_message(&self, message: ChannelMessageRecord) -> Result<()> {
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "INSERT INTO rustra_channel_messages \
                     (id, user_id, channel, sender, content, metadata, \"read\", created_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        message.id,
                        message.user_id,
                        message.channel,
                        message.sender,
                        message.content,
                        json_to_sql(&message.metadata)?,
                        message.read,
                        to_ts(message.created_at),
                    ],
                )?;
                Ok(())
            })
            .await
    }

    async fn list_channel_messages(
        &self,
        user_id: &str,
        channel: Option<&str>,
        page: Page,
    ) -> Result<Vec<ChannelMessageRecord>> {
        let user_id = user_id.to_owned();
        let channel = channel.map(str::to_owned);
        let (limit, offset) = page_params(page);
        self.db
            .call(move |conn| {
                query_all(
                    conn,
                    &format!(
                        "{SELECT_CHANNEL_MESSAGE} WHERE user_id = ?1 \
                         AND (?2 IS NULL OR channel = ?2) \
                         ORDER BY created_at DESC LIMIT ?3 OFFSET ?4"
                    ),
                    params![user_id, channel, limit, offset],
                    channel_message_from_row,
                )
            })
            .await
    }

    async fn mark_message_read(&self, message_id: &str) -> Result<()> {
        let message_id = message_id.to_owned();
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "UPDATE rustra_channel_messages SET \"read\" = 1 WHERE id = ?1",
                    params![message_id],
                )?;
                Ok(())
            })
            .await
    }
}
