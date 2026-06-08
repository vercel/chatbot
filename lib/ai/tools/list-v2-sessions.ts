/**
 * list-v2-sessions tool — List active coding sessions on neptune-v2.
 */
import { tool } from "ai";
import { z } from "zod";
import { listV2Sessions } from "@/lib/v2/bridge";

export const listV2SessionsTool = tool({
  description:
    "List all active coding sessions on neptune-v2. Returns session IDs, statuses, and prompts.",
  inputSchema: z.object({}),
  execute: async () => {
    const sessions = await listV2Sessions();
    return { sessions, count: Array.isArray(sessions) ? sessions.length : 0 };
  },
});
