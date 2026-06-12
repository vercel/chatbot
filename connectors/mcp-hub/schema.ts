/**
 * MCP Hub Connector — Zod schemas for all tool inputs and outputs.
 *
 * MCP Hub aggregates multiple MCP servers (GitHub, Filesystem, Brave Search).
 * Tools are dynamically discovered — schemas defined for the hub management
 * capabilities declared in the manifest.
 */

import { z } from "zod";

export const listServersSchema = {
  input: z.object({}).describe("List all registered MCP servers"),
  output: z.object({
    servers: z.array(
      z.object({
        name: z.string(),
        version: z.string().optional(),
        status: z.enum(["connected", "disconnected", "error"]),
        toolCount: z.number().optional(),
      })
    ),
    count: z.number(),
  }),
};

export const connectServerSchema = {
  input: z.object({
    name: z.string().describe("MCP server name"),
    transport: z.enum(["stdio", "http"]).default("stdio"),
    command: z.string().optional().describe("Command to spawn (stdio)"),
    args: z.array(z.string()).optional().describe("Command arguments"),
    url: z.string().optional().describe("HTTP endpoint (http transport)"),
  }),
  output: z.object({
    connected: z.boolean(),
    name: z.string(),
    tools: z.array(z.record(z.unknown())).optional(),
    error: z.string().optional(),
  }),
};

export const listToolsSchema = {
  input: z.object({
    serverName: z.string().optional().describe("Filter by server name"),
  }),
  output: z.object({
    tools: z.array(
      z.object({
        serverName: z.string(),
        toolName: z.string(),
        description: z.string().optional(),
        inputSchema: z.record(z.unknown()).optional(),
      })
    ),
    count: z.number(),
  }),
};

export type ListServersInput = z.infer<typeof listServersSchema.input>;
export type ConnectServerInput = z.infer<typeof connectServerSchema.input>;
export type ListToolsInput = z.infer<typeof listToolsSchema.input>;

export const mcpHubSchemas = {
  listServers: listServersSchema,
  connectServer: connectServerSchema,
  listTools: listToolsSchema,
} as const;
