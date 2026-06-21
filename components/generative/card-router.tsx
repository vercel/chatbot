"use client";

/**
 * Phase 24: Card Router
 *
 * Routes tool outputs to the appropriate card component.
 * If the tool result has { connector, type, data }, renders UniversalConnectorCard.
 * Otherwise falls back to ToolResultRenderer (existing behavior).
 */

import { UniversalConnectorCard } from "./universal-connector-card";
import type { CardState } from "@/lib/connectors/types";

interface ToolOutput {
  connector?: string;
  type?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

interface CardRouterProps {
  toolName: string;
  output: ToolOutput;
  state?: CardState;
  onStateChange?: (state: CardState) => void;
  className?: string;
}

/**
 * M-N4: Tool-to-Card Mapping
 *
 * Maps tool names to the generative card component they should render.
 * Used by message.tsx for the primary dispatch path; also exported for
 * documentation and future use by the generative-ui-registry.
 */
export const TOOL_CARD_MAP: Record<string, string> = {
  "billingAlignment": "BillingAlignmentCard",
  "getCustomerProfile": "CustomerProfileCard",
  "reportingHub": "ReportCard",
  "reportingHubQuery": "ReportCard",
  "reporting_hub": "ReportCard",
  "queryKnowledge": "SearchResultCard",
  "graphQuery": "SearchResultCard",
  "discoverResource": "SearchResultCard",
  "searchKnowledge": "SearchResultCard",
  // M-N-META: Multi-lane agent session cards
  "spawn-coding-agent": "AgentSessionCard",
  "spawnCodingAgent": "AgentSessionCard",
  "hermes-vps": "AgentSessionCard",
  "dispatchToVps": "AgentSessionCard",
  "v2-handoff": "AgentSessionCard",
  "createAgentSession": "AgentSessionCard",
};

/** Known connector tools that return connector card data */
const CONNECTOR_TOOL_PATTERNS = [
  "nmi_",
  "slack_",
  "ghl_",
  "vapi_",
  "hyperswitch_",
  "freshcaller_",
  "forth_",
  "base44_",
  "b44_",
  "cross_system",
  "customer_360",
  "reporting_",
  // M-N4: explicit tool names for billing/search routing
  "billingAlignment",
  "queryKnowledge",
  "graphQuery",
  "discoverResource",
];

function detectConnector(
  toolName: string,
  output: ToolOutput
): { connector: string; type: string } | null {
  // Phase 24B: Standard connector envelope { connectorType, data, schemaVersion }
  if (output.connectorType && output.data) {
    return {
      connector: output.connectorType as string,
      type: output.schemaVersion ? `schema-v${output.schemaVersion}` : "default",
    };
  }

  // Explicit connector field (legacy)
  if (output.connector && output.type) {
    return { connector: output.connector as string, type: output.type as string };
  }

  // Detect from tool name patterns
  const lower = toolName.toLowerCase();
  for (const pattern of CONNECTOR_TOOL_PATTERNS) {
    if (lower.startsWith(pattern)) {
      const connector = pattern.replace(/_$/, "");
      // Map to canonical names
      const map: Record<string, string> = {
        b44: "base44",
        cross_system: "base44",
        customer_360: "base44",
        reporting_: "base44",
        forth: "forth-dpp",
      };
      return {
        connector: map[connector] || connector,
        type: output.type || "entity",
      };
    }
  }

  return null;
}

export function CardRouter({
  toolName,
  output,
  state = "inline",
  onStateChange,
  className,
}: CardRouterProps) {
  const match = detectConnector(toolName, output);

  if (match && output.data) {
    return (
      <UniversalConnectorCard
        connector={match.connector}
        type={match.type}
        data={output.data}
        state={state}
        onStateChange={onStateChange}
        className={className}
      />
    );
  }

  // Fallback: return null (message.tsx handles raw rendering)
  return null;
}

/**
 * Check if a tool output should render via CardRouter.
 */
export function shouldUseCardRouter(
  toolName: string,
  output: Record<string, unknown>
): boolean {
  return !!detectConnector(toolName, output) && !!output.data;
}
