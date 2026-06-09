/**
 * GET /api/connectors — returns all registered connectors with their status.
 * Reads from the connector manifest registry (init.ts) for a single source of truth.
 *
 * Sidebar ConnectorsPanel fetches this endpoint to render connector cards.
 */

import { initConnectors, manifests } from "@/lib/connectors/init";

interface ConnectorInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  brandColor: string;
  status: "connected" | "configured" | "disconnected";
  details: string;
  capabilities: number;
  envKeys: string[];
}

export function GET() {
  // Ensure registry is populated (idempotent)
  initConnectors();

  const connectors: ConnectorInfo[] = manifests.map((m) => {
    const status = m.getStatus();
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      icon: m.id, // icon key matches connector ID for lazy icon map
      brandColor: m.brandColor,
      status: status.connected
        ? ("connected" as const)
        : m.envKeys.some((k) => process.env[k])
          ? ("configured" as const)
          : ("disconnected" as const),
      details: status.connected
        ? `Connected · ${m.capabilities.length} tools`
        : status.message || (m.envKeys.length > 0
            ? `Missing: ${m.envKeys.filter((k) => !process.env[k]).join(", ")}`
            : "Needs configuration"),
      capabilities: m.capabilities.length,
      envKeys: m.envKeys,
    };
  });

  const summary = {
    total: connectors.length,
    connected: connectors.filter((c) => c.status === "connected").length,
    configured: connectors.filter(
      (c) => c.status === "connected" || c.status === "configured"
    ).length,
    disconnected: connectors.filter((c) => c.status === "disconnected").length,
  };

  return Response.json({ summary, connectors });
}
