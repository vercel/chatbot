/**
 * Hyperswitch createPaymentLink — proxy through vps-tools-bridge
 */
import { tool } from "ai";
import { z } from "zod";

const BRIDGE_URL = process.env.VPS_TOOLS_BRIDGE_URL || "";
const BASE44_KEY = process.env.BASE44_API_KEY || "";

export const createPaymentLink = tool({
  description:
    "Create a Hyperswitch payment link for a customer. Returns a branded pay.newleaf.financial URL.",
  inputSchema: z.object({
    amount: z
      .number()
      .positive()
      .describe("Amount in cents (e.g. 12999 = $129.99)"),
    currency: z.string().optional().default("USD"),
    customerId: z.string().optional().describe("Customer identifier"),
    styleId: z
      .string()
      .optional()
      .default("newleaf-sub-signup")
      .describe("Style ID for checkout branding"),
    description: z
      .string()
      .optional()
      .describe("Payment description shown to customer"),
  }),
  execute: async (input) => {
    if (!BRIDGE_URL) return { error: "VPS_TOOLS_BRIDGE_URL not configured." };
    try {
      const payload = {
        amount: input.amount,
        currency: input.currency || "USD",
        payment_link_config_id: input.styleId || "newleaf-sub-signup",
        ...(input.customerId ? { customer_id: input.customerId } : {}),
        ...(input.description ? { description: input.description } : {}),
        branding_visibility: false,
      };
      const res = await fetch(
        `${BRIDGE_URL}/tool/hyperswitch/createPaymentLink`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${BASE44_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) return { error: `Bridge returned ${res.status}` };
      return await res.json();
    } catch (err) {
      return {
        error: `Bridge unavailable: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});
