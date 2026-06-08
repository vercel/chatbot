/**
 * NMI getSubscription — proxy through vps-tools-bridge
 */
import { tool } from "ai";
import { z } from "zod";

const BRIDGE_URL = process.env.VPS_TOOLS_BRIDGE_URL || "";
const BASE44_KEY = process.env.BASE44_API_KEY || "";

export const getSubscription = tool({
  description:
    "Retrieve NMI subscription details by subscription ID. Proxied through VPS bridge.",
  inputSchema: z.object({
    subscriptionId: z.string().describe("NMI subscription ID to look up"),
  }),
  execute: async ({ subscriptionId }) => {
    if (!BRIDGE_URL) return { error: "VPS_TOOLS_BRIDGE_URL not configured." };
    try {
      const res = await fetch(`${BRIDGE_URL}/tool/nmi/getSubscription`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BASE44_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subscriptionId }),
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
