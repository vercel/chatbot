/**
 * Hyperswitch listPayments — proxy through vps-tools-bridge
 */
import { tool } from "ai";
import { z } from "zod";

const BRIDGE_URL = process.env.VPS_TOOLS_BRIDGE_URL || "";
const BASE44_KEY = process.env.BASE44_API_KEY || "";

export const listPayments = tool({
  description:
    "List recent Hyperswitch payments. Includes payment status and connector info (NMI chip).",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(100).optional().default(20),
    customerId: z.string().optional().describe("Filter by customer ID"),
    status: z
      .enum(["succeeded", "failed", "processing", "requires_payment_method"])
      .optional(),
  }),
  execute: async (input) => {
    if (!BRIDGE_URL) return { error: "VPS_TOOLS_BRIDGE_URL not configured." };
    try {
      const res = await fetch(`${BRIDGE_URL}/tool/hyperswitch/listPayments`, {
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
