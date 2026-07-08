//! Bridges MCP server tools into the Rustra tool system.
//!
//! Given a connected [`McpClient`], [`McpToolset::tools`] discovers the
//! server's tools and wraps each one as a [`rustra_core::Tool`] with a
//! namespaced id `"{server}_{tool}"` — the same convention Mastra uses when
//! it merges MCP toolsets into an agent. The definition's `allowed_tools`
//! allow-list filters what gets exposed.

use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;

use rustra_core::{Error, Result, Tool, ToolContext};

use crate::client::{McpClient, McpToolInfo};
use crate::config::McpServerDefinition;

/// The set of Rustra tools backed by one connected MCP server.
pub struct McpToolset {
    client: Arc<McpClient>,
    definition: McpServerDefinition,
}

impl McpToolset {
    /// Wrap an already-connected client and its definition; call
    /// [`Self::tools`] to discover and bridge.
    pub fn new(client: Arc<McpClient>, definition: McpServerDefinition) -> Self {
        Self { client, definition }
    }

    /// Discover the server's tools and bridge them, applying the
    /// `allowed_tools` filter and the `{server}_{tool}` namespace.
    pub async fn tools(&self) -> Result<Vec<Arc<dyn Tool>>> {
        let infos = self.client.list_tools().await?;
        Ok(infos
            .into_iter()
            .filter(|info| self.is_exposed(info))
            .map(|info| {
                Arc::new(McpTool::new(
                    Arc::clone(&self.client),
                    &self.definition,
                    info,
                )) as Arc<dyn Tool>
            })
            .collect())
    }

    /// Whether the definition's `allowed_tools` allow-list exposes `info`.
    fn is_exposed(&self, info: &McpToolInfo) -> bool {
        match &self.definition.allowed_tools {
            Some(allowed) if !allowed.iter().any(|name| name == &info.name) => {
                tracing::debug!(
                    server = %self.definition.name,
                    tool = %info.name,
                    "mcp tool filtered out by allowed_tools"
                );
                false
            }
            _ => true,
        }
    }
}

/// One MCP server tool exposed as a [`rustra_core::Tool`].
pub struct McpTool {
    id: String,
    description: String,
    input_schema: Value,
    /// The un-namespaced name used on the wire (`tools/call`).
    remote_name: String,
    requires_approval: bool,
    client: Arc<McpClient>,
}

impl McpTool {
    fn new(client: Arc<McpClient>, definition: &McpServerDefinition, info: McpToolInfo) -> Self {
        let description = if info.description.is_empty() {
            format!("MCP tool `{}` from server `{}`", info.name, definition.name)
        } else {
            info.description
        };
        Self {
            id: format!("{}_{}", definition.name, info.name),
            description,
            input_schema: info.input_schema,
            remote_name: info.name,
            requires_approval: definition.require_tool_approval,
            client,
        }
    }

    /// The tool's name on the MCP server (without the namespace prefix).
    pub fn remote_name(&self) -> &str {
        &self.remote_name
    }

    /// Whether the owning definition demands human approval before each
    /// call. Enforced by the agent loop, not by `execute`.
    pub fn requires_approval(&self) -> bool {
        self.requires_approval
    }
}

impl std::fmt::Debug for McpTool {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("McpTool")
            .field("id", &self.id)
            .field("remote_name", &self.remote_name)
            .finish_non_exhaustive()
    }
}

#[async_trait]
impl Tool for McpTool {
    fn id(&self) -> &str {
        &self.id
    }

    fn description(&self) -> &str {
        &self.description
    }

    fn input_schema(&self) -> Value {
        self.input_schema.clone()
    }

    async fn execute(&self, input: Value, _ctx: &ToolContext) -> Result<Value> {
        self.client
            .call_tool(&self.remote_name, input)
            .await
            .map_err(|e| match e {
                e @ Error::Timeout(_) => e, // let retry policies see timeouts
                other => Error::tool(&self.id, other.to_string()),
            })
    }
}
