/**
 * NMI getVault — proxy through vps-tools-bridge
 */
import { tool } from "ai";
import { z } from "zod";
import { secrets } from "@/secrets";

const BRIDGE_URL = secrets.vps.toolsBridgeUrl;
const BASE44_KEY = secrets.base44.apiKey;

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
