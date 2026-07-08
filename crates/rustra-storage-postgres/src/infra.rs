//! [`InfraStore`]: workspaces, MCP server configs, UI artifacts, channel
//! messages.

use async_trait::async_trait;
use rustra_core::Result;
use rustra_storage::types::{
    ChannelMessageRecord, McpServerRecord, UiArtifactRecord, WorkspaceRecord,
};
use rustra_storage::{InfraStore, Page};
use tokio_postgres::Row;

use crate::util::*;
use crate::PostgresStorage;

const SELECT_WORKSPACE: &str =
    "SELECT id, user_id, name, root_path, settings, created_at FROM rustra_workspaces";

const SELECT_MCP_SERVER: &str = "SELECT id, owner_id, name, config, enabled, visibility, \
                                 created_at, updated_at FROM rustra_mcp_servers";

const SELECT_UI_ARTIFACT: &str = "SELECT id, owner_id, title, kind, html, data, version, \
                                  visibility, created_at, updated_at FROM rustra_ui_artifacts";

const SELECT_CHANNEL_MESSAGE: &str = "SELECT id, user_id, channel, sender, content, metadata, \
                                      \"read\", created_at FROM rustra_channel_messages";

impl FromRow for WorkspaceRecord {
    fn from_row(row: &Row) -> Result<WorkspaceRecord> {
        Ok(WorkspaceRecord {
            id: col(row, 0)?,
            user_id: col(row, 1)?,
            name: col(row, 2)?,
            root_path: col(row, 3)?,
            settings: col(row, 4)?,
            created_at: col(row, 5)?,
        })
    }
}

impl FromRow for McpServerRecord {
    fn from_row(row: &Row) -> Result<McpServerRecord> {
        Ok(McpServerRecord {
            id: col(row, 0)?,
            owner_id: col(row, 1)?,
            name: col(row, 2)?,
            config: col(row, 3)?,
            enabled: col(row, 4)?,
            visibility: vis_from_sql(&col::<String>(row, 5)?)?,
            created_at: col(row, 6)?,
            updated_at: col(row, 7)?,
        })
    }
}

impl FromRow for UiArtifactRecord {
    fn from_row(row: &Row) -> Result<UiArtifactRecord> {
        Ok(UiArtifactRecord {
            id: col(row, 0)?,
            owner_id: col(row, 1)?,
            title: col(row, 2)?,
            kind: col(row, 3)?,
            html: col(row, 4)?,
            data: col(row, 5)?,
            version: col_u32(row, 6)?,
            visibility: vis_from_sql(&col::<String>(row, 7)?)?,
            created_at: col(row, 8)?,
            updated_at: col(row, 9)?,
        })
    }
}

impl FromRow for ChannelMessageRecord {
    fn from_row(row: &Row) -> Result<ChannelMessageRecord> {
        Ok(ChannelMessageRecord {
            id: col(row, 0)?,
            user_id: col(row, 1)?,
            channel: col(row, 2)?,
            sender: col(row, 3)?,
            content: col(row, 4)?,
            metadata: col(row, 5)?,
            read: col(row, 6)?,
            created_at: col(row, 7)?,
        })
    }
}

#[async_trait]
impl InfraStore for PostgresStorage {
    async fn upsert_workspace(&self, ws: WorkspaceRecord) -> Result<()> {
        self.db
            .execute(
                "INSERT INTO rustra_workspaces \
                 (id, user_id, name, root_path, settings, created_at) \
                 VALUES ($1, $2, $3, $4, $5, $6) \
                 ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, \
                 name = EXCLUDED.name, root_path = EXCLUDED.root_path, \
                 settings = EXCLUDED.settings, created_at = EXCLUDED.created_at",
                &[
                    &ws.id,
                    &ws.user_id,
                    &ws.name,
                    &ws.root_path,
                    &ws.settings,
                    &ws.created_at,
                ],
            )
            .await?;
        Ok(())
    }

    async fn get_workspace(&self, ws_id: &str) -> Result<Option<WorkspaceRecord>> {
        self.db
            .query_opt_as::<WorkspaceRecord>(
                &format!("{SELECT_WORKSPACE} WHERE id = $1"),
                &[&ws_id],
            )
            .await
    }

    async fn list_workspaces(&self, user_id: &str, page: Page) -> Result<Vec<WorkspaceRecord>> {
        let (limit, offset) = page_params(page);
        self.db
            .query_as::<WorkspaceRecord>(
                &format!(
                    "{SELECT_WORKSPACE} WHERE user_id = $1 \
                     ORDER BY created_at ASC LIMIT $2 OFFSET $3"
                ),
                &[&user_id, &limit, &offset],
            )
            .await
    }

    async fn delete_workspace(&self, ws_id: &str) -> Result<()> {
        self.db
            .execute("DELETE FROM rustra_workspaces WHERE id = $1", &[&ws_id])
            .await?;
        Ok(())
    }

    async fn upsert_mcp_server(&self, server: McpServerRecord) -> Result<()> {
        let vis = vis_to_sql(server.visibility);
        self.db
            .execute(
                "INSERT INTO rustra_mcp_servers \
                 (id, owner_id, name, config, enabled, visibility, created_at, updated_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
                 ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id, \
                 name = EXCLUDED.name, config = EXCLUDED.config, enabled = EXCLUDED.enabled, \
                 visibility = EXCLUDED.visibility, created_at = EXCLUDED.created_at, \
                 updated_at = EXCLUDED.updated_at",
                &[
                    &server.id,
                    &server.owner_id,
                    &server.name,
                    &server.config,
                    &server.enabled,
                    &vis,
                    &server.created_at,
                    &server.updated_at,
                ],
            )
            .await?;
        Ok(())
    }

    async fn get_mcp_server(&self, server_id: &str) -> Result<Option<McpServerRecord>> {
        self.db
            .query_opt_as::<McpServerRecord>(
                &format!("{SELECT_MCP_SERVER} WHERE id = $1"),
                &[&server_id],
            )
            .await
    }

    async fn list_mcp_servers(
        &self,
        user_id: &str,
        include_shared: bool,
        page: Page,
    ) -> Result<Vec<McpServerRecord>> {
        let (limit, offset) = page_params(page);
        self.db
            .query_as::<McpServerRecord>(
                &format!(
                    "{SELECT_MCP_SERVER} WHERE owner_id = $1 \
                     OR ($2 AND (owner_id IS NULL OR visibility <> 'private')) \
                     ORDER BY created_at ASC LIMIT $3 OFFSET $4"
                ),
                &[&user_id, &include_shared, &limit, &offset],
            )
            .await
    }

    async fn delete_mcp_server(&self, server_id: &str) -> Result<()> {
        self.db
            .execute(
                "DELETE FROM rustra_mcp_servers WHERE id = $1",
                &[&server_id],
            )
            .await?;
        Ok(())
    }

    async fn upsert_ui_artifact(&self, artifact: UiArtifactRecord) -> Result<()> {
        let version = u32_to_db(artifact.version);
        let vis = vis_to_sql(artifact.visibility);
        self.db
            .execute(
                "INSERT INTO rustra_ui_artifacts \
                 (id, owner_id, title, kind, html, data, version, visibility, created_at, \
                  updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
                 ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id, \
                 title = EXCLUDED.title, kind = EXCLUDED.kind, html = EXCLUDED.html, \
                 data = EXCLUDED.data, version = EXCLUDED.version, \
                 visibility = EXCLUDED.visibility, created_at = EXCLUDED.created_at, \
                 updated_at = EXCLUDED.updated_at",
                &[
                    &artifact.id,
                    &artifact.owner_id,
                    &artifact.title,
                    &artifact.kind,
                    &artifact.html,
                    &artifact.data,
                    &version,
                    &vis,
                    &artifact.created_at,
                    &artifact.updated_at,
                ],
            )
            .await?;
        Ok(())
    }

    async fn get_ui_artifact(&self, artifact_id: &str) -> Result<Option<UiArtifactRecord>> {
        self.db
            .query_opt_as::<UiArtifactRecord>(
                &format!("{SELECT_UI_ARTIFACT} WHERE id = $1"),
                &[&artifact_id],
            )
            .await
    }

    async fn list_ui_artifacts(&self, owner_id: &str, page: Page) -> Result<Vec<UiArtifactRecord>> {
        let (limit, offset) = page_params(page);
        self.db
            .query_as::<UiArtifactRecord>(
                &format!(
                    "{SELECT_UI_ARTIFACT} WHERE owner_id = $1 \
                     ORDER BY updated_at DESC LIMIT $2 OFFSET $3"
                ),
                &[&owner_id, &limit, &offset],
            )
            .await
    }

    async fn delete_ui_artifact(&self, artifact_id: &str) -> Result<()> {
        self.db
            .execute(
                "DELETE FROM rustra_ui_artifacts WHERE id = $1",
                &[&artifact_id],
            )
            .await?;
        Ok(())
    }

    async fn insert_channel_message(&self, message: ChannelMessageRecord) -> Result<()> {
        self.db
            .execute(
                "INSERT INTO rustra_channel_messages \
                 (id, user_id, channel, sender, content, metadata, \"read\", created_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
                &[
                    &message.id,
                    &message.user_id,
                    &message.channel,
                    &message.sender,
                    &message.content,
                    &message.metadata,
                    &message.read,
                    &message.created_at,
                ],
            )
            .await?;
        Ok(())
    }

    async fn list_channel_messages(
        &self,
        user_id: &str,
        channel: Option<&str>,
        page: Page,
    ) -> Result<Vec<ChannelMessageRecord>> {
        let (limit, offset) = page_params(page);
        self.db
            .query_as::<ChannelMessageRecord>(
                &format!(
                    "{SELECT_CHANNEL_MESSAGE} WHERE user_id = $1 \
                     AND ($2::TEXT IS NULL OR channel = $2) \
                     ORDER BY created_at DESC LIMIT $3 OFFSET $4"
                ),
                &[&user_id, &channel, &limit, &offset],
            )
            .await
    }

    async fn mark_message_read(&self, message_id: &str) -> Result<()> {
        self.db
            .execute(
                "UPDATE rustra_channel_messages SET \"read\" = TRUE WHERE id = $1",
                &[&message_id],
            )
            .await?;
        Ok(())
    }
}
