/**
 * NMI getVault — proxy through vps-tools-bridge
 */
import { tool } from "ai";
import { z } from "zod";

const BRIDGE_URL = process.env.VPS_TOOLS_BRIDGE_URL || "";
const BASE44_KEY = process.env.BASE44_API_KEY || "";

export const getVault = tool({
  description:
    "Retrieve NMI customer vault details by vault ID. Proxied through VPS bridge.",
  inputSchema: z.object({
    vaultId: z.string().describe("NMI customer_vault_id to look up"),
  }),
  execute: async ({ vaultId }) => {
    if (!BRIDGE_URL) return { error: "VPS_TOOLS_BRIDGE_URL not configured." };
    try {
      const res = await fetch(`${BRIDGE_URL}/tool/nmi/getVault`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BASE44_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vaultId }),
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
