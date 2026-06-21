# Connector Architecture Best Practices -- MCP Integration Patterns
**Date:** 2026-06-21 | **Context:** Neptune Chat connector system (50+ tools, 12+ backend services)

---

## 1. Vercel AI SDK `createMCPClient` (formerly `experimental_createMCPClient`)

The SDK provides `createMCPClient()` from `@ai-sdk/mcp`. Each client connects to **one** MCP server. The `tools()` method acts as an adapter converting MCP tools into AI SDK tools.

**Transport options:**
- **HTTP** (`type: 'http'`) -- recommended for production; supports OAuth via `authProvider`
- **SSE** (`type: 'sse'`) -- alternative streaming transport
- **Stdio** (`Experimental_StdioMCPTransport` from `@ai-sdk/mcp/mcp-stdio`) -- local dev only
- **Custom** -- implement `MCPTransport` interface

**Tool discovery modes:**
```ts
// Schema Discovery -- auto-discovers all server tools (no static types)
const tools = await mcpClient.tools();

// Schema Definition -- explicit Zod schemas, type-safe (only pulls defined tools)
const tools = mcpClient.tools({
  schemas: {
    'get-weather': {
      inputSchema: z.object({ city: z.string() }),
      outputSchema: z.object({ temp: z.number() }),  // optional structured output
    },
  },
});
```

**Key hooks:**
- `validateAuthorizationServerURL` -- SSRF protection for OAuth auth server URLs
- `onElicitationRequest` -- handles server elicitation requests (accept/decline/cancel)
- `close()` -- lifecycle cleanup (call in `onFinish` for streaming, `try/finally` for non-streaming)

**Capabilities:** Pass `{ elicitation: {} }` to enable elicitation support.

**Server prompts & resources:** `experimental_listPrompts()`, `experimental_getPrompt()`, `listResources()`, `readResource()`, `listResourceTemplates()`.

**Key insight:** The SDK favors AI SDK native tools for production ("full control, type safety, optimal performance") and positions MCP tools for rapid iteration and user-brought tools.

---

## 2. Open WebUI -- MCP Plugin & Tool Architecture

Open WebUI (50k+ GitHub stars) supports four tool extension mechanisms:

1. **Python Tools & Functions** -- inline scripts with built-in code editor
2. **Pipelines** -- modular plugin framework for filters, providers, custom logic
3. **MCP Support** -- native Streamable HTTP for MCP servers
4. **OpenAPI Servers** -- auto-discover tools from any OpenAPI-compatible endpoint

**Context-flooding prevention strategies:**

- **Agentic retrieval** -- models search & read documents autonomously; fetch only what's needed
- **RAG for large collections** -- vector search for knowledge vs full-content injection
- **Notes for precision** -- opt-in targeted injection (no chunking) when fidelity matters
- **Granular tool binding** -- admins can force-enable specific tools per model, giving control over which tools each agent sees
- **Selective exposure pattern** -- models are wrappers: "pick any base model, bind knowledge, tools, and a system prompt"

---

## 3. Composio -- Exposing Hundreds of APIs as MCP Tools

**Pattern:** Explicit allowlist per MCP server instance.

```python
server = composio.mcp.create(
    name="my-gmail-server",
    toolkits=[{"toolkit": "gmail", "auth_config": "ac_xyz123"}],
    allowed_tools=["GMAIL_FETCH_EMAILS", "GMAIL_SEND_EMAIL"]  # explicit whitelist
)
```

**Discovery:** Clients connect to `https://backend.composio.dev/v3/mcp/{SERVER_ID}?user_id={USER_ID}` with `x-api-key`. The server exposes ONLY tools in `allowed_tools`.

**Session-based approach (recommended):** Uses `session.mcp.url` + `session.mcp.headers` without manual server creation. "Sessions provide dynamic tool access and a much better MCP experience."

**Scale handling:** Filtering via `allowed_tools` is the primary mechanism. No hierarchical namespacing or dynamic negotiation exposed at the MCP layer. Toolkits are the grouping unit -- servers are created per-toolkit with explicit tool selection.

---

## 4. Smithery -- MCP Registry & Discovery

**Architecture:** Namespace-centric registry model.

**Core entities:**
- **Namespaces** -- group servers, connections, and skills
- **Servers** -- MCP server definitions with three release types: hosted (JS module), external (URL), stdio (MCPB bundle)
- **Connections** -- live MCP sessions tied to a server, exposing tools and triggers
- **Skills** -- reusable prompt-based skills backed by GitHub repos

**Tool discovery pathways:**
1. List all servers -- full-text + semantic search with `q` parameter, filter by status/verification
2. List tools across namespace -- aggregates tools from every connection in one response (envelope pattern isolates failures)
3. List tools per connection -- single connection tool query
4. Get tool -- retrieve single tool or list under "slash-separated category"
5. Search namespaces -- filter by owner, content type (hasServers/hasSkills), text search

**Key pattern:** The "envelope" pattern for cross-connection tool listing -- each connection wrapped in an envelope so "a failure on one upstream doesn't fail the request."

---

## 5. n8n -- Native MCP Tool Node

n8n has introduced MCP client nodes for workflow automation. Based on available documentation:

**Pattern:** MCP nodes act as tool clients within n8n workflows. The n8n AI agent node can consume MCP tools by connecting to MCP servers as a "tool source." This aligns with the broader industry pattern of treating MCP servers as pluggable tool providers.

**Discovery:** The MCP client node connects to a server URL and auto-discovers available tools via the standard `tools/list` MCP protocol method. Tools are then exposed as selectable nodes within the workflow builder.

**Key aspect:** n8n treats each MCP tool as a potential workflow step, enabling visual composition of multi-tool pipelines without any single agent needing all tools in context at once.

---

## 6. Context-Efficient MCP Patterns (50+ Tools)

### Pattern A: Explicit Schema Definition (Vercel AI SDK)
Instead of using schema discovery (`mcpClient.tools()`), use explicit Zod schemas. Only tools with defined schemas are loaded. Reduces context payload.

### Pattern B: Per-Domain Server Instances (Composio)
Create separate MCP server instances per domain/toolkit with explicit `allowed_tools` arrays. Agents only connect to the servers relevant to their task.

### Pattern C: Tool Binding per Model (Open WebUI)
Administrators "force-enable specific tools per model." Each agent/model wrapper only sees the tools explicitly bound to it, never the full catalog.

### Pattern D: RAG-Style Tool Retrieval
Apply retrieval-augmented patterns to tools: index tool descriptions, embed user intent, retrieve only the top-K relevant tools for each request rather than sending all 50+ tools.

### Pattern E: Namespaced Tool Names
Use slash-separated names (`billing/create_invoice`, `billing/refund`, `support/create_ticket`). Enables filtering by namespace prefix and clear ownership.

### Pattern F: Dynamic Tool Retrieval
Fetch tools on-demand per request context rather than at session start. Only the tools relevant to the current conversation turn are sent to the model.

### Pattern G: Envelope Isolation (Smithery)
When aggregating tools from multiple servers, wrap each server's response in an envelope that isolates failures.

### Recommended Stack for Neptune:
Combine B (per-domain instances) + D (RAG-style retrieval) + E (namespaced names). Each of 12 backend services gets its own MCP server with namespaced tools. An orchestrator indexes tool descriptions and retrieves only top-K relevant tools per user request.

---

## 7. MCP Tool Routing with Vercel AI SDK

The Vercel AI SDK does **not** provide built-in multi-server tool aggregation. Each `createMCPClient` connects to a single server, and `tools()` returns that server's tools only.

**Manual multi-server pattern (inferred):**
```ts
// Create one client per backend service
const billingClient = createMCPClient({ transport: { type: 'http', url: '.../billing/mcp' } });
const supportClient = createMCPClient({ transport: { type: 'http', url: '.../support/mcp' } });

// Merge tools from multiple clients
const allTools = {
  ...billingClient.tools({ schemas: { /* billing tools */ } }),
  ...supportClient.tools({ schemas: { /* support tools */ } }),
};

// Pass merged tools to streamText/generateText
const result = await streamText({
  model: 'gpt-4o',
  tools: allTools,
  // ...
});
```

**Routing mechanism:** The LLM selects tools by name from the merged set. There is no SDK-level routing/dispatching -- each tool call is routed implicitly by which MCP server registered it.

**Pattern for Neptune:** Create an orchestrator above the Vercel AI SDK that maintains one MCP client per backend service, indexes all tool descriptions/schemas, uses semantic search to select a relevant subset per request, merges only those tools into the model's tool set, and routes calls by tool name prefix.

---

## Summary: Recommended Architecture for Neptune Chat

```
┌──────────────────────────────────────┐
│         Neptune Chat Router          │
│  (tool index + semantic retrieval)   │
└──────┬───────┬───────┬───────────────┘
       │       │       │
   ┌───▼──┐ ┌─▼───┐ ┌─▼───┐  (per-service MCP servers)
   │Billing│ │CRM  │ │Docs │  ...
   └───────┘ └─────┘ └─────┘  (12+ services)
```

**Key principles:**
1. One MCP server per backend service domain
2. Namespaced tool names (`service/action`)
3. Explicit tool allowlists per server instance
4. Semantic tool retrieval -- only send top-K relevant tools to the LLM
5. Envelope pattern for multi-server aggregation
6. Tool binding per agent persona/context
7. Use explicit schemas over auto-discovery for production type safety
