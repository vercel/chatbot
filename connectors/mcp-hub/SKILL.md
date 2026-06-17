---
name: mcp-hub-connector
description: Multi-server MCP aggregator — GitHub, Filesystem, Brave Search
version: 1.0.0
domain: mcp-edits
mcp: false
custom_client: true
type: "skill"
access: internal
---
# MCP Hub Integration Pack

## File Capabilities & Paths
- **Custom API Client:** `connectors/mcp-hub/index.ts`
- **Manifest:** `connectors/mcp-hub/manifest.ts`
- **Schema:** `connectors/mcp-hub/schema.ts`

## Available Actions
| Tool | Description |
|------|-------------|
| listServers | List all connected MCP servers |
| discoverTools | Discover tools from an MCP server |
| connectServer | Connect to a new MCP server |
| queryServer | Run a query against a connected MCP server |
