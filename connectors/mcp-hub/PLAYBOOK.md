---
connector: mcp-hub
version: 0.2.0
scope: connector
auto_load: true
trigger_tools:
  - mcp-hub:listServers
  - mcp-hub:connectServer
  - mcp-hub:listTools
headline: |
  MCP Hub multi-server aggregator. Tools discovered at runtime via MCP protocol.
  Never assume tools are available — always check connection status first.
type: "playbook"
---

# MCP Hub Connector Playbook

## Operational Knowledge

### Architecture
MCP Hub is a multi-server Model Context Protocol aggregator. It acts as a central registry for MCP servers (GitHub MCP, Filesystem MCP, Brave Search MCP, etc.) and exposes their tools as a unified set. The connector does NOT directly call external APIs — it delegates to registered MCP servers.

### MCP Protocol
- Messages are JSON-RPC 2.0 over stdio or HTTP
- Each server registers with `name`, `version`, and `capabilities`
- Tools are discovered via `tools/list` method
- Tool calls use `tools/call` with `{ name, arguments }` payload
- Resources are static references exposed via `resources/list`

### Registered Servers (Typical)
| Server | Purpose | Transport |
|--------|---------|-----------|
| GitHub MCP | Repo access, PRs, code search | HTTP (OAuth) |
| Filesystem MCP | Local file read/write | stdio |
| Brave Search MCP | Web search | HTTP (API key) |
| Postgres MCP | Database queries | HTTP (connection string) |

### Connection Lifecycle
1. **Register**: Server added to hub config
2. **Connect**: Transport established (stdio spawn or HTTP handshake)
3. **Initialize**: Capabilities negotiated
4. **Discover**: Tools listed via `tools/list`
5. **Ready**: Tools available for agent use
6. **Health Check**: Periodic ping to verify liveness

### Tool Naming Convention
MCP tools are namespaced as `mcp.{serverName}.{toolName}` to avoid conflicts between servers. Example: `mcp.github.search_code`, `mcp.brave.web_search`.

## Business Context

### Why MCP Hub
Neptune needs to integrate with multiple external systems (GitHub, filesystem, web search, databases) without hardcoding each integration. MCP Hub provides:
1. **Pluggable architecture**: Add/remove servers without code changes
2. **Unified interface**: All tools use the same calling convention
3. **Discovery**: Tools are auto-discovered, no manual registration
4. **Isolation**: Server failures don't cascade
5. **Vendor independence**: Swap GitHub for GitLab by changing the MCP server

### Use Cases
- **Code search**: Agent searches across repos via GitHub MCP
- **Web research**: Agent searches the web via Brave Search MCP
- **File operations**: Agent reads/writes files via Filesystem MCP
- **Database access**: Agent queries Postgres via Postgres MCP

### When NOT to Use MCP Hub
- Tools that need sub-100ms latency (MCP adds 50-200ms overhead)
- Tools that are already available as direct Neptune tools (use the direct version)
- Tools requiring streaming (MCP is request-response, not streaming)

## Anti-Patterns

### ❌ NEVER:
1. **Register duplicate server names** — hub enforces uniqueness
2. **Assume a server's tools are available** — always check connection status first
3. **Call MCP tools in tight loops** — MCP protocol overhead is non-trivial
4. **Hardcode tool names from MCP servers** — they can change when server updates
5. **Share MCP connection state across requests** — each request is isolated
6. **Block on MCP server startup** — async initialization with timeout

### ⚠️ DANGEROUS:
- Exposing MCP tool results that contain credentials or tokens
- Allowing arbitrary MCP server registration without validation
- Cross-server data leakage (one server's output fed to another without sanitization)

## Safeguards

### Connection Management
- Connection timeout: 10 seconds
- Health check interval: 30 seconds
- Max retries on failure: 3
- Stale connection cleanup: 5 minutes of inactivity

### Error Handling
- Server unreachable → return `{ error: "Server {name} unreachable" }` with graceful degradation
- Tool not found → return available tools list
- Invalid arguments → return Zod validation errors
- Server crash → auto-remove from registry, emit `server:offline` event

### Security
- Filesystem MCP: sandbox to allowed directories only
- GitHub MCP: OAuth scoped to specific repos
- Brave Search: API key never exposed in tool responses
- All MCP traffic: local-only (localhost or Unix socket) for stdio transports

## Common Workflows

### List All Available MCP Tools
```typescript
const servers = await listServers();
// Returns: [{ name, version, status, toolCount }]

const tools = await listTools();
// Returns: [{ serverName, toolName, description, inputSchema }]
```

### Connect a New MCP Server
```typescript
const result = await connectServer({
  name: "github-mcp",
  transport: "stdio",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-github"]
});
// Returns: { connected: true, tools: [...] }
```

### Use MCP Tools in Agent
```typescript
// Agent sees tools as:
// mcp.github.search_code({ query, language })
// mcp.brave.web_search({ query })
// mcp.filesystem.read_file({ path })
// mcp.postgres.query({ sql })
```

## Refinement Notes

- **Version:** 1.0.0
- **Created:** 2026-06-09
- **Last Reviewed:** 2026-06-09
- **Source:** MCP spec (modelcontextprotocol.io), Vercel AI SDK MCP integration
- **Note:** Currently empty tool module — tools are registered dynamically via MCP transport. The manifest uses `Promise.resolve({})` as toolModule because tools are discovered at runtime.
