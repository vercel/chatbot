---
name: mcp-hub-skills
version: 1.0.0
connector: mcp-hub
scope: neptune-custom
total_actions: 15
priority: P1
intent_tags:
  - mcp
  - mcp-hub
  - integration
  - server
  - protocol
associated_connectors:
  - github
  - base44
headline: |
  15 MCP Hub actions: servers, tools, connections, health, resources,
  prompts, and protocol management. Multi-server MCP aggregator mastery.
type: "skill"
access: internal
---

# MCP Hub Skills — 15 Actions

## Core Intent
Complete MCP Hub management: register and manage MCP servers, discover tools at runtime, monitor server health, access resources, invoke prompts, and manage the MCP protocol lifecycle.

## Action Catalog

### Server Management (5 actions)
| # | Action | Description |
|---|--------|-------------|
| 1 | `server.list` | List all registered MCP servers with status |
| 2 | `server.register` | Register a new MCP server by name and transport |
| 3 | `server.connect` | Connect to a server (stdio spawn or HTTP handshake) |
| 4 | `server.disconnect` | Disconnect a server gracefully |
| 5 | `server.remove` | Remove a server from the registry |

### Tool Discovery (3 actions)
| 6 | `tool.list` | List all tools from all connected servers |
| 7 | `tool.search` | Search for tools by name or description |
| 8 | `tool.schema` | Get input/output schema for a specific tool |

### Health & Monitoring (3 actions)
| 9 | `health.ping` | Ping a server to verify liveness |
| 10 | `health.status` | Get health status for all servers |
| 11 | `health.events` | Get recent server events (online, offline, error) |

### Resources & Prompts (2 actions)
| 12 | `resource.list` | List static resources from a server |
| 13 | `resource.read` | Read a specific resource by URI |

### Protocol Operations (2 actions)
| 14 | `protocol.initialize` | Initialize MCP protocol handshake |
| 15 | `protocol.capabilities` | Get negotiated capabilities for a server |

## Operational Context
- MCP protocol: JSON-RPC 2.0 over stdio or HTTP
- Tool namespacing: `mcp.{serverName}.{toolName}`
- Connection timeout: 10 seconds
- Health check interval: 30 seconds
- Max retries on failure: 3
- NEVER assume tools are available — check connection status first

## Anti-Patterns
- NEVER register duplicate server names
- NEVER call MCP tools in tight loops (50-200ms overhead)
- NEVER hardcode tool names — use runtime discovery
- NEVER share MCP connection state across requests
- NEVER allow arbitrary server registration without validation

## Workflow Examples

### Connect a New MCP Server
```
1. server.register({ name: "github-mcp", transport: "stdio", command: "npx" })
2. server.connect({ name: "github-mcp" })
3. protocol.initialize({ name: "github-mcp" })
4. tool.list() → verify tools are available
```

### Diagnostic: Tool Not Available
```
1. health.ping({ name: "server-name" }) → check liveness
2. health.status() → check all servers
3. server.connect({ name: "server-name" }) → reconnect if needed
```

### Discover All Available Capabilities
```
1. server.list() → all registered servers
2. tool.search({ query: "search" }) → find search tools
3. tool.schema({ serverName, toolName }) → understand parameters
```
