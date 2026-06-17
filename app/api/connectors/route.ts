// @ts-nocheck — pre-existing Phase 24 type issues, refined in Streams 3-5
/**
 * GET /api/connectors — returns all registered connectors with their status
 * AND U1.3 inventory data (wrapped vs total wrap progress).
 *
 * Reads from the connector manifest registry (init.ts) for a single source of
 * truth, enriched with inventory counts from lib/connectors/inventory.ts.
 *
 * Sidebar ConnectorsPanel fetches this endpoint to render connector cards.
 */
import { initConnectors, manifests } from "@/lib/connectors/init";
import { discoverDynamicConnectors } from "@/lib/connectors/init-server";
import {
  CONNECTOR_INVENTORY,
  getInventoryCoverage,
  getInventoryEntry,
} from "@/lib/connectors/inventory";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

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
  /** U1.3: Number of tools/functions wrapped in Neptune */
  wrapped: number;
  /** U1.3: Total tools/functions available in backend (lower bound) */
  total: number;
  /** U1.3: Wrap coverage as fraction 0–1 */
  coverage: number;
}

export const GET = requireAllowlist(function GET() {
  // Ensure registry is populated (idempotent)
  initConnectors();

  const connectors: ConnectorInfo[] = manifests.map((m) => {
    const status = m.getStatus();
    const inventory = getInventoryEntry(m.id);
    const wrapped = inventory?.wrapped ?? m.capabilities.length;
    const total = inventory?.total ?? m.capabilities.length;

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
        ? `Connected · ${wrapped} actions (${m.capabilities.length} gatekeeper tools)`
        : status.message || (m.envKeys.length > 0
            ? `Missing: ${m.envKeys.filter((k) => !process.env[k]).join(", ")}`
            : "Needs configuration"),
      capabilities: wrapped,
      envKeys: m.envKeys,
      wrapped,
      total,
      coverage: total > 0 ? wrapped / total : 0,
    };
  });

  // Add VPS as a connector entry (no manifest yet, but tracked in inventory)
  const vpsInventory = getInventoryEntry("vps");
  if (vpsInventory && !connectors.find((c) => c.id === "vps")) {
    connectors.push({
      id: "vps",
      name: "VPS Functions",
      description: "hostingerBridge, claude-agent-api, hermes-api, pm2, file operations",
      icon: "vps",
      brandColor: "#6366f1",
      status: "configured" as const,
      details: `${vpsInventory.wrapped} of ${vpsInventory.total}+ functions wrapped`,
      capabilities: vpsInventory.wrapped,
      envKeys: ["HOSTINGER_API_KEY", "CLAUDE_AGENT_API_KEY"],
      wrapped: vpsInventory.wrapped,
      total: vpsInventory.total,
      coverage: vpsInventory.total > 0 ? vpsInventory.wrapped / vpsInventory.total : 0,
    });
  }

  const summary = {
    total: connectors.length,
    connected: connectors.filter((c) => c.status === "connected").length,
    configured: connectors.filter(
      (c) => c.status === "connected" || c.status === "configured"
    ).length,
    disconnected: connectors.filter((c) => c.status === "disconnected").length,
  };

  // U1.3 inventory coverage
  const coverage = getInventoryCoverage();

  // Dynamic discovery: scan skills/connectors/ for connectors not yet in manifests
  const dynamicNames = discoverDynamicConnectors();

  return Response.json({
    summary,
    connectors,
    inventory: {
      total_wrapped: coverage.totalWrapped,
      total_available: coverage.totalAvailable,
      coverage_percent: coverage.coveragePercent,
      by_priority: coverage.byPriority,
      entries: CONNECTOR_INVENTORY,
    },
    dynamic_discovered: dynamicNames,
  });
});
