/**
 * NMI refund — proxy through vps-tools-bridge
 */
import { tool } from "ai";
import { z } from "zod";

const BRIDGE_URL = process.env.VPS_TOOLS_BRIDGE_URL || "";
const BASE44_KEY = process.env.BASE44_API_KEY || "";

export const refundTransaction = tool({
  description:
    "Process a refund for a settled NMI transaction. Proxied through VPS bridge.",
  inputSchema: z.object({
    transactionId: z.string().describe("NMI transaction ID to refund"),
    amount: z
      .number()
      .positive()
      .optional()
      .describe("Amount to refund (defaults to full amount)"),
  }),
  execute: async ({ transactionId, amount }) => {
    if (!BRIDGE_URL) return { error: "VPS_TOOLS_BRIDGE_URL not configured." };
    try {
      const res = await fetch(`${BRIDGE_URL}/tool/nmi/refund`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BASE44_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transactionId, amount }),
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
