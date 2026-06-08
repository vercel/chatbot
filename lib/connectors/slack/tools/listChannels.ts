/**
 * Slack listChannels — list all accessible channels
 */
import { WebClient } from "@slack/web-api";
import { tool } from "ai";
import { z } from "zod";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";

export const listChannels = tool({
  description: "List all Slack channels the bot can access.",
  inputSchema: z.object({
    types: z
      .string()
      .optional()
      .default("public_channel,private_channel")
      .describe("Channel types to list"),
    limit: z.number().int().max(200).optional().default(100),
  }),
  execute: async ({ types, limit }) => {
    if (!SLACK_BOT_TOKEN) return { error: "SLACK_BOT_TOKEN not configured." };
    const slack = new WebClient(SLACK_BOT_TOKEN);
    try {
      const res = await slack.conversations.list({ types, limit });
      if (!res.ok) return { error: `Channel list failed: ${res.error}` };
      const channels = (res.channels ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        isPrivate: c.is_private,
        memberCount: c.num_members,
        topic: c.topic?.value?.slice(0, 100),
      }));
      return { count: channels.length, channels };
    } catch (err) {
      return {
        error: `List failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});
