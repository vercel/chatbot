/**
 * Phase 25 Stream 2: get-nmi-transaction tool
 * Returns NMI transaction data in UniversalConnectorCard envelope format.
 */
import { tool } from "ai";
import { z } from "zod";

export const getNmiTransaction = tool({
  description: "Get NMI transaction details. Returns amount, status, cofIndicator, and source transaction trail.",
  inputSchema: z.object({
    transactionId: z.string().describe("NMI transaction ID"),
  }),
  execute: async ({ transactionId }) => {
    // Bridge to Base44 NMI MCP
    const nmiUrl = process.env.VPS_BRIDGE_URL || "";
    try {
      const res = await fetch(`${nmiUrl}/vpsAgentToolRouter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          internalToken: process.env.NEPTUNE_INTERNAL_TOKEN || "",
          tool: "nmi_mcp_bridge",
          action: "query_transactions",
          payload: { transactionId },
        }),
      });
      const json = await res.json().catch(() => ({}));
      const txn = json.result || json;

      return {
        connectorType: "nmi",
        data: {
          amount: txn.amount || "0.00",
          cofIndicator: txn.cofIndicator || "N/A",
          status: txn.status || "unknown",
          sourceTransactionTrail: txn.sourceTransactionTrail || [],
          cardLast4: txn.cardLast4 || "****",
          vaultId: txn.vaultId || "N/A",
          timestamp: txn.timestamp || new Date().toISOString(),
        },
        schemaVersion: 1,
      };
    } catch {
      return {
        connectorType: "nmi",
        data: {
          amount: "0.00",
          cofIndicator: "N/A",
          status: "error",
          sourceTransactionTrail: [],
          cardLast4: "****",
          vaultId: "N/A",
          timestamp: new Date().toISOString(),
        },
        schemaVersion: 1,
      };
    }
  },
});
