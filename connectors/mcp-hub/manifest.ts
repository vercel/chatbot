import { NetworkIcon } from "lucide-react";
import type { ConnectorManifest } from "../../lib/connectors/types";

const mcpHubManifest: ConnectorManifest = {
  id: "mcp-hub",
  name: "MCP Hub",
  description: "Multi-server MCP aggregator — GitHub, Filesystem, Brave Search",
  icon: NetworkIcon,
  brandColor: "#6366F1",
  envKeys: [],
  capabilities: [
    {
      id: "listServers",
      label: "List Servers",
      description: "List all registered MCP servers and their status",
      icon: "Server",
    },
    {
      id: "connectServer",
      label: "Connect Server",
      description: "Connect to an MCP server and discover tools",
      icon: "Plug",
    },
    {
      id: "listTools",
      label: "List MCP Tools",
      description: "List all available MCP tools across servers",
      icon: "Wrench",
    },
  ],
  toolModule: () => Promise.resolve({}),
  resultRenderers: {},
  playbookPath: "connectors/mcp-hub/playbook.mdx",
  getStatus: () => ({ connected: false, message: "No servers configured" }),
};
export default mcpHubManifest;
