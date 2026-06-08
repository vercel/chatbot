/**
 * get-v2-session tool — Get detailed info about a specific v2 session.
 */
import { tool } from "ai";
import { z } from "zod";
import { getV2Session } from "@/lib/v2/bridge";

export const getV2SessionTool = tool({
  description:
    "Get detailed information about a specific neptune-v2 coding session, including status, progress, and any output.",
  inputSchema: z.object({
    sessionId: z.string().describe("The v2 session ID to query"),
  }),
  execute: async ({ sessionId }) => {
    const session = await getV2Session(sessionId);
    return session;
  },
});
