/**
 * Phase 25 Stream 2: get-customer-profile tool
 * Returns Base44 CustomerProfile data in UniversalConnectorCard envelope format.
 */
import { tool } from "ai";
import { z } from "zod";

export const getCustomerProfile = tool({
  description: "Get a customer profile from Base44. Returns entity type, customer details, and related records.",
  inputSchema: z.object({
    customerId: z.string().describe("Customer ID or email"),
  }),
  execute: async ({ customerId }) => {
    const bridgeUrl = process.env.BASE44_BRIDGE_URL || "";
    try {
      const res = await fetch(`${bridgeUrl}/vpsAgentToolRouter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          internalToken: process.env.BASE44_DIAG_KEY || "",
          tool: "cross_system_lookup",
          identifier: customerId,
          identifier_type: customerId.includes("@") ? "email" : "customer_id",
        }),
      });
      const json = await res.json().catch(() => ({}));
      const profile = json.result || json;

      return {
        connectorType: "base44",
        data: {
          entity: "CustomerProfile",
          entityType: "CustomerProfile",
          recordCount: profile.relatedCount || 1,
          status: profile.status || "active",
          queryResults: profile,
          relatedEntities: [
            `NMI Transactions: ${profile.nmiTransactions || 0}`,
            `Support Tickets: ${profile.tickets || 0}`,
            `Slack Messages: ${profile.slackMessages || 0}`,
          ],
        },
        schemaVersion: 1,
      };
    } catch {
      return {
        connectorType: "base44",
        data: {
          entity: "CustomerProfile",
          entityType: "CustomerProfile",
          recordCount: 0,
          status: "error",
          queryResults: {},
          relatedEntities: [],
        },
        schemaVersion: 1,
      };
    }
  },
});
