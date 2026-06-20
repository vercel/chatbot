/**
 * Dynamic Connector Catalog — generates formatted connector listing for:
 *   1. System prompt injection (Agent knows what tools are available)
 *   2. /api/integrations endpoint (UI library page)
 *   3. listIntegrations inline tool (Agent can invoke directly)
 *
 * Single source of truth: lib/connectors/registry.ts
 */
import { initConnectors } from "./init";
import { listConnectors } from "./registry";
import { getInventoryEntry } from "./inventory";
import type { ConnectorEntry } from "./types";

export interface IntegrationSummary {
  id: string;
  name: string;
  description: string;
  status: "connected" | "configured" | "disconnected";
  tools: number;
  toolNames: string[];
  playbook: string;
  brandColor: string;
  envKeys: string[];
  details: string;
}

/** Ensure registry is populated (idempotent). Returns all connectors. */
function ensureRegistry(): ConnectorEntry[] {
  initConnectors();
  return listConnectors();
}

/**
 * Generate a structured integration summary for ALL connectors.
 * Format: connector name | tool count | playbook reference | status
 */
export function getIntegrationSummaries(): IntegrationSummary[] {
  const connectors = ensureRegistry();

  return connectors.map((entry) => {
    const m = entry.manifest;
    const toolNames = m.capabilities.map((c) => c.id);
    const status = entry.status;
    // U2.4.5: Use comprehensive wrapped count from inventory, fall back to manifest capabilities
    const inventory = getInventoryEntry(m.id);
    const comprehensiveTools = inventory?.wrapped ?? m.capabilities.length;

    return {
      id: m.id,
      name: m.name,
      description: m.description,
      status: status.connected
        ? ("connected" as const)
        : m.envKeys.some((k) => process.env[k])
          ? ("configured" as const)
          : ("disconnected" as const),
      tools: comprehensiveTools,
      toolNames,
      playbook: m.playbookPath,
      brandColor: m.brandColor,
      envKeys: m.envKeys,
      details: status.connected
        ? `Connected · ${comprehensiveTools} actions`
        : status.message ||
          (m.envKeys.length > 0
            ? `Missing: ${m.envKeys.filter((k) => !process.env[k]).join(", ")}`
            : "Needs configuration"),
    };
  });
}

/**
 * Build the Connector Catalog section for the system prompt.
 * Injected so the agent knows what connectors + tools are available.
 */
export function buildConnectorCatalogPrompt(): string {
  const summaries = getIntegrationSummaries();
  if (summaries.length === 0) return "";

  const connected = summaries.filter((s) => s.status === "connected");
  const configured = summaries.filter((s) => s.status === "configured");
  const disconnected = summaries.filter((s) => s.status === "disconnected");

  const lines: string[] = [];

  lines.push("## Available Connectors");
  lines.push("");
  lines.push(
    `You have ${summaries.length} connectors available (${connected.length} connected, ${configured.length} configured, ${disconnected.length} disconnected).`
  );
  lines.push("");

  lines.push("| # | Connector | Status | Tools | Tool Names |");
  lines.push("|---|-----------|--------|-------|------------|");

  summaries.forEach((s, i) => {
    const statusEmoji =
      s.status === "connected"
        ? "🟢"
        : s.status === "configured"
          ? "🟡"
          : "⚪";
    const toolList =
      s.toolNames.length > 0 ? s.toolNames.join(", ") : "—";
    lines.push(
      `| ${i + 1} | ${s.name} | ${statusEmoji} ${s.status} | ${s.tools} | ${toolList} |`
    );
  });

  lines.push("");
  lines.push(
    "When asked 'what integrations do you have' or 'list your integrations', use the listIntegrations tool to return the full catalog."
  );
  lines.push("");

  return lines.join("\n");
}
