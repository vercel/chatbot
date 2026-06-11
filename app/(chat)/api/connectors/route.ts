/**
 * GET /api/connectors — List all connectors with status, tools, and auth info
 */
import { NextResponse } from "next/server";
import { initConnectors, manifests } from "@/lib/connectors/init";
import { registerConnector } from "@/lib/connectors/registry";
import type { ConnectorManifest } from "@/lib/connectors/types";

// Ensure registry is populated at module load
initConnectors();

function getAuthType(manifest: ConnectorManifest): string {
  const envs = manifest.envKeys;
  if (envs.some((k) => k.includes("OAUTH"))) return "OAuth 2.0";
  if (envs.some((k) => k.includes("MCP"))) return "MCP";
  if (envs.some((k) => k.includes("TOKEN"))) return "Bearer Token";
  if (envs.some((k) => k.includes("API_KEY") || k.includes("KEY"))) return "API Key";
  if (envs.length === 0) return "None";
  return "Bearer Token";
}

export async function GET() {
  const connectors = manifests.map((m) => {
    const status = m.getStatus();
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      brandColor: m.brandColor,
      iconName: m.icon.displayName || m.id,
      authType: getAuthType(m),
      status: {
        connected: status.connected,
        message: status.message ?? null,
      },
      capabilities: m.capabilities.map((c) => ({
        id: c.id,
        label: c.label,
        description: c.description,
        icon: c.icon ?? null,
      })),
      toolCount: m.capabilities.length,
      envKeys: m.envKeys,
      docs: m.docs ?? null,
    };
  });

  return NextResponse.json({
    total: connectors.length,
    connected: connectors.filter((c) => c.status.connected).length,
    connectors,
  });
}
