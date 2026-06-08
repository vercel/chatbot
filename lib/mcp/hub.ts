/**
 * MCP Hub — Multi-server MCP client aggregator.
 * Manages connections to multiple MCP servers and surfaces unified tool set.
 */
import { experimental_createMCPClient } from "@ai-sdk/mcp";

interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  transport: "http" | "sse";
  enabled: boolean;
}

interface MCPHubState {
  servers: Map<
    string,
    { config: MCPServerConfig; tools: string[]; connected: boolean }
  >;
}

class MCPHub {
  private state: MCPHubState = { servers: new Map() };

  register(config: MCPServerConfig): void {
    this.state.servers.set(config.id, { config, tools: [], connected: false });
  }

  async connect(serverId: string): Promise<boolean> {
    const entry = this.state.servers.get(serverId);
    if (!entry || !entry.config.enabled) return false;

    try {
      const client = await experimental_createMCPClient({
        transport: {
          type: entry.config.transport,
          url: entry.config.url,
        },
        clientName: `neptune-hub-${serverId}`,
        version: "3.1.0",
      });

      const result = await client.listTools();
      entry.tools = result.tools.map((t: { name: string }) => t.name);
      entry.connected = true;
      return true;
    } catch (e) {
      console.warn(`[mcp-hub] Failed to connect to ${serverId}:`, e);
      entry.connected = false;
      return false;
    }
  }

  async connectAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const [id] of this.state.servers) {
      results[id] = await this.connect(id);
    }
    return results;
  }

  getServerList(): Array<{
    id: string;
    name: string;
    url: string;
    connected: boolean;
    tools: string[];
  }> {
    return [...this.state.servers.entries()].map(([id, entry]) => ({
      id,
      name: entry.config.name,
      url: entry.config.url,
      connected: entry.connected,
      tools: entry.tools,
    }));
  }

  getAllTools(): string[] {
    return [...this.state.servers.values()]
      .filter((s) => s.connected)
      .flatMap((s) => s.tools);
  }

  isConnected(serverId: string): boolean {
    return this.state.servers.get(serverId)?.connected ?? false;
  }
}

export const mcpHub = new MCPHub();

// Pre-register known MCP servers
mcpHub.register({
  id: "github",
  name: "GitHub MCP",
  url: "https://api.github.com/mcp",
  transport: "http",
  enabled: false,
});
mcpHub.register({
  id: "filesystem",
  name: "Filesystem MCP",
  url: "http://localhost:5173/mcp",
  transport: "http",
  enabled: false,
});
mcpHub.register({
  id: "brave-search",
  name: "Brave Search MCP",
  url: "https://api.search.brave.com/mcp",
  transport: "http",
  enabled: false,
});
