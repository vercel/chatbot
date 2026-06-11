/**
 * GET /api/connectors/[name] — Individual connector detail
 * POST /api/connectors/[name] — Test connection or invoke tool
 */
import { NextResponse } from "next/server";
import { initConnectors, manifests } from "@/lib/connectors/init";
import { getConnector } from "@/lib/connectors/registry";
import type { ConnectorManifest } from "@/lib/connectors/types";

initConnectors();

function findManifest(name: string): ConnectorManifest | undefined {
  return manifests.find((m) => m.id === name);
}

function getAuthType(manifest: ConnectorManifest): string {
  const envs = manifest.envKeys;
  if (envs.some((k) => k.includes("OAUTH"))) return "OAuth 2.0";
  if (envs.some((k) => k.includes("MCP"))) return "MCP";
  if (envs.some((k) => k.includes("TOKEN"))) return "Bearer Token";
  if (envs.some((k) => k.includes("API_KEY") || k.includes("KEY"))) return "API Key";
  if (envs.length === 0) return "None";
  return "Bearer Token";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const manifest = findManifest(name);

  if (!manifest) {
    return NextResponse.json(
      { error: `Connector not found: ${name}` },
      { status: 404 }
    );
  }

  const status = manifest.getStatus();
  const entry = getConnector(name);

  // Try to load tools for full detail
  let toolDetails: any[] = [];
  try {
    const tools = await manifest.toolModule();
    toolDetails = manifest.capabilities.map((cap) => {
      const toolFn = (tools as any)[cap.id] || (tools as any)[`default.${cap.id}`];
      return {
        id: cap.id,
        label: cap.label,
        description: cap.description || toolFn?.description || "No description",
        icon: cap.icon ?? null,
        hasSchema: !!toolFn?.inputSchema,
        schemaShape: toolFn?.inputSchema
          ? JSON.stringify((toolFn.inputSchema as any)._def?.shape
              ? Object.keys((toolFn.inputSchema as any)._def.shape)
              : "custom")
          : null,
      };
    });
  } catch {
    toolDetails = manifest.capabilities.map((cap) => ({
      id: cap.id,
      label: cap.label,
      description: cap.description,
      icon: cap.icon ?? null,
      hasSchema: false,
      schemaShape: null,
    }));
  }

  return NextResponse.json({
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    brandColor: manifest.brandColor,
    iconName: manifest.icon.displayName || manifest.id,
    authType: getAuthType(manifest),
    status: {
      connected: status.connected,
      message: status.message ?? null,
    },
    capabilities: toolDetails,
    toolCount: toolDetails.length,
    envKeys: manifest.envKeys,
    docs: manifest.docs ?? null,
    playbookPath: manifest.playbookPath,
  });
}
