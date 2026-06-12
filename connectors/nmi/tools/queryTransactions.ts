/**
 * NMI queryTransactions — proxy through vps-tools-bridge
 */
import { tool } from "ai";
import { z } from "zod";
import { secrets } from "@/secrets";

const BRIDGE_URL = secrets.vps.toolsBridgeUrl;
const BASE44_KEY = secrets.base44.apiKey;

export const queryTransactions = tool({
  description:
    "Query NMI transactions in a date range. Proxied through VPS bridge (NMI keys stay on VPS).",
  inputSchema: z.object({
    startDate: z.string().describe("Start date YYYYMMDD"),
    endDate: z.string().describe("End date YYYYMMDD"),
    condition: z
      .enum(["complete", "failed", "pending"])
      .optional()
      .describe("Filter by transaction condition"),
    limit: z.number().int().min(1).max(500).optional().default(100),
  }),
  execute: async (input) => {
    if (!BRIDGE_URL) return { error: "VPS_TOOLS_BRIDGE_URL not configured." };
    try {
      const res = await fetch(`${BRIDGE_URL}/tool/nmi/queryTransactions`, {
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
