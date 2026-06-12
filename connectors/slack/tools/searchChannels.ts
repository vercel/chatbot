/**
 * Slack searchChannels — searches by channel name via conversations.list.
 * NOTE: Uses conversations.list + name filter, NOT search.messages (needs user token).
 */
import { WebClient } from "@slack/web-api";
import { tool } from "ai";
import { z } from "zod";

import { secrets } from "@/secrets";

const SLACK_BOT_TOKEN = secrets.slack.botToken;

export const searchChannels = tool({
  description:
    "Search Slack channels by name or topic. Uses conversations.list (bot token compatible).",
  inputSchema: z.object({
    query: z.string().describe("Search term to match against channel names"),
    types: z
      .string()
      .optional()
      .default("public_channel,private_channel")
      .describe("Channel types to search"),
  }),
  execute: async ({ query, types }) => {
    if (!SLACK_BOT_TOKEN) return { error: "SLACK_BOT_TOKEN not configured." };
    const slack = new WebClient(SLACK_BOT_TOKEN);
    try {
      const res = await slack.conversations.list({ types, limit: 200 });
      if (!res.ok) return { error: `Channel list failed: ${res.error}` };
      const q = query.toLowerCase();
      const matches = (res.channels ?? [])
        .filter(
          (c) =>
            c.name?.toLowerCase().includes(q) ||
            c.purpose?.value?.toLowerCase().includes(q) ||
            c.topic?.value?.toLowerCase().includes(q)
        )
        .map((c) => ({
          id: c.id,
          name: c.name,
          isPrivate: c.is_private,
          memberCount: c.num_members,
          topic: c.topic?.value,
        }));
      return { query, count: matches.length, channels: matches.slice(0, 25) };
    } catch (err) {
      return {
        error: `Search failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});
