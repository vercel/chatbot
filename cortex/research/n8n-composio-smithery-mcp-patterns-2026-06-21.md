# n8n, Composio, Smithery — MCP Integration Patterns
## 2026-06-21 | Neptune Chat Connector Architecture Research

---

## 1. n8n Native MCP (Released v2.22.0)

**Three-node architecture:** MCP Client (core node, connects to external servers), MCP Client Tool (cluster sub-node, exposes MCP tools inside AI Agents), MCP Server Trigger (core node, exposes n8n workflows AS MCP tools for external clients like Claude Desktop).

**Key parameters:** MCP URL, Authentication (per-server creds), Path.

**Auth pattern:** Per-server credential configuration at node setup time. Authentication dropdown exists but specific methods (API key, OAuth, header-based) are not detailed in accessible docs.

**Tool discovery:** MCP Client connects to a server URL; MCP Client Tool sub-node enumerates discovered tools and surfaces them in the AI Agent tool palette alongside native tools (Calculator, Wikipedia, etc.).

**Multi-server:** AI Agent can include multiple MCP Client Tool sub-nodes, each bound to a different MCP Client node. The workflow paradigm means orchestration is compositional: chain, branch, or Switch-route between tools.

**Gaps:** Unclear max concurrent servers per MCP Client node. Transport protocol support (stdio/SSE/Streamable HTTP) not documented publicly. No built-in tool dedup.

---

## 2. Composio Tool Registry (1,000+ apps, SOC2/ISO 27001)

**Two paths: Native Tools** (`composio.create(user_id)` → `session.tools()` → provider SDK) and **MCP** (`composio.create(user_id)` → `session.mcp.url` + `session.mcp.headers` → any MCP client). MCP path uses proxy architecture — Composio handles provider logic server-side, no provider SDK needed. Works with Claude Desktop, Cursor, OpenAI Agents.

**Auth model:** User-level, not per-tool-call. `user_id` to `composio.create()` once. Per-toolkit auth via `auth_config_id` param (was "integration ID"). Connected accounts managed declaratively. Rule: NEVER instruct users to manually create auth configs. OAuth flows handled through session creation.

**Tool organization:** `TOOLKIT_ACTION` naming (e.g., `SALESFORCE_CREATE_CONTACT`). Toolkits = apps, tools = actions. Naming convention provides namespace disambiguation. Low-level `composio.tools.get()` / `.execute()` available but discouraged.

**Terminology (v3):** entity ID→user_id, actions→tools, apps→toolkits, integration→auth config, connection→connected account.

**MCP integration:** Each `composio.create(user_id)` session yields a unique MCP endpoint. All that user's tools are aggregated through one proxy URL. Multiple sessions coexist per user but no cross-session aggregation API.

---

## 3. Smithery Registry (Discovery + Distribution + Observability)

**`GET /servers`** — Public registry with full-text + semantic search (`q` param), `topK` (10–500) for search breadth, filters (namespace, verified, remote, isDeployed, ownerId, repoOwner, repoName), paginated (`page`/`pageSize`), `seed` for deterministic deep pagination, `fields` for response trimming.

**`GET /servers/{qualifiedName}`** — Returns full profile: metadata, connections (StdioConnection or HttpConnection), security (`scanPassed` boolean), tools[], resources[], prompts[].

**`GET /connect/{namespace}`** — List connections. States: connected, disconnected, auth_required (includes setupUrl for OAuth), input_required (includes setupUrl + missing params list), error. Transport: http or uplink. Mock mode for LLM-simulated responses.

**`GET /connect/{namespace}/{connectionId}/.tools`** — Per-connection tool listing with full schema: inputSchema (required), outputSchema, annotations (destructiveHint, idempotentHint, readOnlyHint, openWorldHint), execution.taskSupport (required/optional/forbidden).

**`GET /{namespace}/.tools`** — Multi-MCP aggregation: all tools from all connections in one call. Fail-soft isolation (per-connection envelope prevents cascading failures). Graceful skipping of auth_required/input_required connections. Loose response schema for heterogeneous tool sets.

**`GET /health`** — 200 {status, timestamp} or 500 {error}.

**Deployment:** URL (streamable HTTP for externally hosted servers) or Stdio (MCPB bundle artifact). Gateway handles protocol compliance, metadata enrichment, caching. Auto OAuth UI generation for servers needing config. Analytics dashboard for tool call tracking.

**Auth:** Bearer token (Smithery API key) across all endpoints.

---

## 4. Multi-MCP Orchestration (12+ Servers Behind One Chat)

| Platform | Multi-Server Model | Aggregation Mechanism | Fault Isolation |
|----------|-------------------|-----------------------|-----------------|
| **Smithery** | Namespace-based connections | Single `/.tools` call across all connections | Per-connection envelope; auth-gated connections skipped |
| **Composio** | Per-user session proxy | One MCP endpoint per session aggregates all user tools | Proxy-level; server-side failure handling |
| **n8n** | Workflow composition | Multiple MCP Client Tool sub-nodes in AI Agent | Per-node error handling; Switch routing |

**Smithery's model** is closest to an off-the-shelf "12+ servers behind one chat" pattern: namespace = all your servers, one API call returns all tools, failures are isolated. **Composio** provides unified auth proxy but one-session-per-user limitation complicates multi-server without custom aggregation layer. **n8n** offers maximum control (explicit binding per tool node) but requires workflow designer to manually wire 12+ tool nodes; breaks at scale.

**Key insight for Neptune Chat:** Smithery's namespace aggregation is the cleanest API shape for a chat connector that needs to discover tools across 12+ servers. The `namespace` concept maps naturally to a tenant/customer boundary.

---

## 5. Tool Deduplication (Two CRMs, Two Payment Processors)

**None of the three platforms natively solves cross-server tool dedup.** All rely on naming disambiguation:

| Platform | Disambiguation | Routing | Gap |
|----------|---------------|---------|-----|
| **Composio** | `TOOLKIT_ACTION` prefix (SALESFORCE_CREATE_CONTACT vs HUBSPOT_CREATE_CONTACT) | Implicit via name prefix | No conflict resolution when both exist |
| **Smithery** | Per-connection listing with source metadata; tools carry connection origin | Connection ID in path | No cross-connection dedup logic |
| **n8n** | Explicit tool-node-to-server binding at config time | Node-binding routes execution | Designer's responsibility; no programmatic resolution |

**Recommended pattern for Neptune Chat (from platform conventions):**

1. **Registration:** Tag each MCP server with a domain prefix (e.g., `salesforce/`, `hubspot/`, `stripe/`, `nmi/`)
2. **Discovery:** Prefix all tool names with server tag (`salesforce/create_contact`, `hubspot/create_contact`)
3. **Routing:** Strip prefix, route to the tagged connection
4. **Conflict:** When two servers expose identically-named tools, surface both as separate LLM tools with server metadata in descriptions. Let the LLM disambiguate based on conversation context (known CRM, known payment processor).

Smithery's `/{namespace}/.tools` aggregation + per-connection envelopes is the cleanest foundation. Composio's toolkit prefix validates the approach. n8n's explicit binding offers control but doesn't scale for 12+ servers.

---

**Sources:** n8n docs (core nodes, sub-nodes nav, v2.22.0 release notes), docs.composio.dev (introduction, MCP concept, tools, auth, connected accounts), smithery.ai/docs (servers, connections, tools, health check, build APIs), composio.dev homepage.
