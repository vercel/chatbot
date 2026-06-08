/**
 * stream-v2-progress tool — Open SSE stream to track v2 session progress.
 */
import { tool } from "ai";
import { z } from "zod";
import { getV2StreamUrl } from "@/lib/v2/bridge";

export const streamV2ProgressTool = tool({
  description:
    "Get the SSE stream URL for a neptune-v2 coding session to track live progress.",
  inputSchema: z.object({
    sessionId: z.string().describe("The v2 session ID to stream progress for"),
  }),
  execute: async ({ sessionId }) => {
    const streamUrl = getV2StreamUrl(sessionId);
    return {
      streamUrl,
      sessionId,
      message:
        "Subscribe to this SSE URL to receive live coding progress events.",
    };
  },
});
