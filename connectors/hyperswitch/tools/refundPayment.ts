/**
 * Hyperswitch refundPayment — proxy through vps-tools-bridge
 */
import { tool } from "ai";
import { z } from "zod";

const BRIDGE_URL = process.env.VPS_TOOLS_BRIDGE_URL || "";
const BASE44_KEY = process.env.BASE44_API_KEY || "";

export const refundPayment = tool({
  description:
    "Refund a settled Hyperswitch payment by payment_id. Proxied through VPS bridge.",
  inputSchema: z.object({
    paymentId: z.string().describe("Hyperswitch payment_id to refund"),
    amount: z
      .number()
      .positive()
      .optional()
      .describe("Amount in cents (defaults to full amount)"),
    reason: z.string().optional().describe("Reason for the refund"),
  }),
  execute: async (input) => {
    if (!BRIDGE_URL) return { error: "VPS_TOOLS_BRIDGE_URL not configured." };
    try {
      const res = await fetch(`${BRIDGE_URL}/tool/hyperswitch/refund`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BASE44_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) return { error: `Bridge returned ${res.status}` };
      return await res.json();
    } catch (err) {
      return {
        error: `Bridge unavailable: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});
