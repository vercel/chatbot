/**
 * /library/connectors/[name] — Connector Detail
 * Phase 22: Detailed view showing SKILL.md, functions, and back-references.
 */

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ConnectorDetailClient } from "./client";

// Full connector detail data
const CONNECTOR_DETAILS: Record<string, {
  id: string;
  name: string;
  description: string;
  brandColor: string;
  functionCount: number;
  functions: string[];
  skillMd: string;
  usedBy: { id: string; name: string }[];
}> = {
  nmi: {
    id: "nmi",
    name: "NMI",
    description: "Payment gateway connector — customer vault management, charges, refunds, subscriptions. The financial backbone of billing-flow and agent-payments playbooks.",
    brandColor: "#06b6d4",
    functionCount: 41,
    functions: [
      "charge", "refund", "void", "vault_create", "vault_update",
      "subscription_create", "subscription_cancel", "transaction_query",
      "customer_vault_query", "validate_payment", "process_recurring",
      "batch_charge", "settlement_report", "chargeback_handle",
    ],
    skillMd: `# NMI Connector\n\n## Overview\nPayment gateway connector for NMI (Network Merchants Inc). Handles customer vault management, payment processing, and subscription lifecycle.\n\n## Architecture\n- **Vault-based**: All cards stored as ` + "`customer_vault_id`" + `\n- **DPAN**: Network tokens used for recurring payments\n- **CIT/MIT**: Customer-initiated vs merchant-initiated transaction modes\n\n## Key Rules\n- Never use ` + "`source_transaction_id`" + ` — always ` + "`customer_vault_id`" + `\n- MIT transactions: no CVV/IP required\n- CIT transactions: CVV+IP required\n- Velocity limit: 10 auth requests/second\n\n## Environment\n- **Endpoint**: \`https://secure.nmi.com/api/v4\`\n- **Auth**: API key in header\n- **Webhooks**: transaction_complete, subscription_renewal, chargeback_alert`,
    usedBy: [
      { id: "billing-flow", name: "Billing Flow" },
      { id: "agent-payments", name: "Agent Payments" },
      { id: "customer-enrollment", name: "Customer Enrollment" },
    ],
  },
  slack: {
    id: "slack",
    name: "Slack",
    description: "Communication bridge — post messages, threads, reactions, channel archives. Used by customer-comms, support-triage, and system-health.",
    brandColor: "#10b981",
    functionCount: 27,
    functions: [
      "post_message", "post_thread", "get_channel_history",
      "get_user_info", "react", "update_message", "archive_channel",
      "create_channel", "invite_user", "list_channels",
    ],
    skillMd: `# Slack Connector\n\n## Overview\nCommunication bridge for Slack workspace integration.\n\n## Channels\n- **#jarvis-admin**: Primary admin channel (REQUIRED)\n- **#newleaf-admin**: BANNED for agent posts\n\n## Rate Limits\n- Tier 2: 20 messages/minute\n- Bulk operations: queue + throttle\n\n## Message Format\n- Keep under 3000 chars\n- Use Block Kit for rich formatting\n- Always include trace ID`,
    usedBy: [
      { id: "customer-comms", name: "Customer Comms" },
      { id: "support-triage", name: "Support Triage" },
      { id: "system-health", name: "System Health" },
    ],
  },
  base44: {
    id: "base44",
    name: "Base44",
    description: "Core data engine — the central nervous system. Entity CRUD, customer 360, reporting hub, knowledge graph, and MCP bridge.",
    brandColor: "#8b5cf6",
    functionCount: 63,
    functions: [
      "entity_query", "entity_get", "entity_create", "entity_update",
      "b44_count", "b44_aggregate", "customer_360", "cross_system_lookup",
      "reporting_hub", "schema_describe", "schema_list_entities",
      "query_warehouse", "validated_query", "kg_recall", "kg_search",
    ],
    skillMd: `# Base44 Connector\n\n## Overview\nCore data engine powering all NewLeaf operations. Largest connector with 63 functions.\n\n## Entities\n50+ entities including: CustomerProfile, PaymentLog, SupportTicket, NmiTransaction, SlackMessage, RecoveryItem, Agreement, etc.\n\n## Key Capabilities\n- Full customer 360: profile + payments + calls + emails + tickets + credit reports\n- Server-side aggregation (b44_aggregate)\n- Cursor-based streaming for 100K+ records\n- Cross-system lookup (customer by phone/email/vault_id)\n- Knowledge graph with neighbor traversal\n\n## Access Pattern\nAll read operations are ungated. Writes require admin role.`,
    usedBy: [
      { id: "billing-flow", name: "Billing Flow" },
      { id: "credit-disputes", name: "Credit Disputes" },
      { id: "customer-enrollment", name: "Customer Enrollment" },
      { id: "reporting", name: "Reporting" },
      { id: "data-sync", name: "Data Sync" },
    ],
  },
};

function getConnector(id: string) {
  if (CONNECTOR_DETAILS[id]) return CONNECTOR_DETAILS[id];

  // Generate fallback for unlisted connectors
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    description: `Connector for ${id} integration.`,
    brandColor: "#6b7280",
    functionCount: 5,
    functions: ["connect", "query", "execute"],
    skillMd: `# ${id} Connector\n\nDocumentation coming soon.`,
    usedBy: [],
  };
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const data = getConnector(name);
  return {
    title: `${data.name} — Connector`,
    description: data.description,
  };
}

export default async function ConnectorDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  cookies();

  const data = getConnector(name);
  if (!data) notFound();

  return <ConnectorDetailClient connector={data} />;
}
