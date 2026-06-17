---
name: mcp-hub-connector
version: 1.0.0
kind: connector
primary_domain: mcp-edits
also_in: [coding]
tools: [listMcpServers, invokeMcpTool, searchMcpTools, registerMcpServer]
dependencies: []
headline: |
  MCP Hub aggregates Smithery-hosted MCP servers. Discover and invoke tools from any registered MCP.
type: "skill"
access: internal
---

# MCP Hub Connector Skill

## Operational Knowledge
Aggregation layer for MCP (Model Context Protocol) servers hosted on Smithery and other registries. Provides unified discovery and invocation.

## Tools
| Tool | Description |
|------|-------------|
| listMcpServers | List all registered MCP servers |
| invokeMcpTool | Call a tool on any MCP server |
| searchMcpTools | Search across all MCP servers |
| registerMcpServer | Register new MCP server |

## Anti-Patterns
- NEVER invoke unverified MCP servers
- NEVER pass secrets to unknown MCP endpoints
