/**
 * Base44 customer360 — complete customer dossier
 */
import { tool } from "ai";
import { z } from "zod";
import { base44Service } from "../client";

export const customer360 = tool({
  description:
    "Get a complete customer dossier: profile + payments + calls + emails + tickets + credit reports. Pass customerId, email, or phone.",
  inputSchema: z.object({
    customerId: z.string().optional().describe("Base44 customer ID"),
    email: z.string().email().optional().describe("Customer email"),
    phone: z.string().optional().describe("Customer phone number"),
  }),
  execute: async (input) => {
    if (!input.customerId && !input.email && !input.phone) {
      return { error: "Provide at least one of: customerId, email, phone" };
    }
    try {
      const result = await base44Service.functions.invoke("reportingHubQuery", {
        action: "customer_360",
        ...input,
      });
      return { customer: result };
    } catch (err) {
      return {
        error: `Customer 360 failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});
