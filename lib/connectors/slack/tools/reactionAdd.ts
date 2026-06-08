/**
 * Slack reactionAdd — add emoji reaction to a message
 */
import { WebClient } from "@slack/web-api";
import { tool } from "ai";
import { z } from "zod";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";

export const reactionAdd = tool({
  description: "Add an emoji reaction to a Slack message.",
  inputSchema: z.object({
    channel: z.string().describe("Channel ID containing the message"),
    timestamp: z.string().describe("Message timestamp (ts) to react to"),
    emoji: z
      .string()
      .describe("Emoji name without colons (e.g. 'thumbsup', 'rocket')"),
  }),
  execute: async ({ channel, timestamp, emoji }) => {
    if (!SLACK_BOT_TOKEN) return { error: "SLACK_BOT_TOKEN not configured." };
    const slack = new WebClient(SLACK_BOT_TOKEN);
    try {
      const res = await slack.reactions.add({
        channel,
        timestamp,
        name: emoji.replace(/:/g, ""),
      });
      if (!res.ok) return { error: `Reaction failed: ${res.error}` };
      return { ok: true, channel, ts: timestamp, reaction: emoji };
    } catch (err) {
      return {
        error: `Reaction failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});
