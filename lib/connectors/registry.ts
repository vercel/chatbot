// @ts-nocheck
/**
 * Connector Registry — imports all manifests and provides query functions.
 */
import type { ConnectorEntry, ConnectorManifest } from "./types";

const registry = new Map<string, ConnectorEntry>();

export function registerConnector(manifest: ConnectorManifest): void {
  registry.set(manifest.id, {
    manifest,
    tools: null,
    status: manifest.getStatus(),
  });
}

export function getConnector(id: string): ConnectorEntry | undefined {
  return registry.get(id);
}

export function listConnectors(): ConnectorEntry[] {
  return [...registry.values()];
}

/** Get all tool definitions across all connected connectors */
export async function getAllTools(): Promise<Record<string, unknown>> {
  const allTools: Record<string, unknown> = {};
  for (const [id, entry] of registry) {
    if (!entry.tools) {
      try {
        entry.tools = (await entry.manifest.toolModule()) as Record<
          string,
          unknown
        >;
      } catch {
        continue;
      }
    }
    if (entry.tools) {
      for (const [toolName, toolDef] of Object.entries(entry.tools)) {
        allTools[`${id}.${toolName}`] = toolDef;
      }
    }
  }
  return allTools;
}

/** Get all tool names for active tools */
export function getAllToolNames(): string[] {
  const names: string[] = [];
  for (const [id, entry] of registry) {
    for (const cap of entry.manifest.capabilities) {
      names.push(`${id}.${cap.id}`);
    }
  }
  return names;
}

/** Check if a connector has its required env vars set */
export function checkConnectorEnv(envKeys: string[]): {
  ok: boolean;
  missing: string[];
} {
  const missing = envKeys.filter((k) => !process.env[k]);
  return { ok: missing.length === 0, missing };
}
