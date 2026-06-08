/**
 * Slack postMessage tool
 */
import { WebClient } from "@slack/web-api";
import { tool } from "ai";
import { z } from "zod";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";

export const postMessage = tool({
  description: "Post a message to a Slack channel. Use channel name or ID.",
  inputSchema: z.object({
    channel: z.string().describe("Channel name or ID to post to"),
    text: z.string().max(40_000).describe("Message text (max 40,000 chars)"),
    threadTs: z
      .string()
      .optional()
      .describe("Thread timestamp to reply in thread"),
  }),
  execute: async ({ channel, text, threadTs }) => {
    if (!SLACK_BOT_TOKEN) return { error: "SLACK_BOT_TOKEN not configured." };
    const slack = new WebClient(SLACK_BOT_TOKEN);
    try {
      const res = await slack.chat.postMessage({
        channel,
        text,
        ...(threadTs ? { thread_ts: threadTs } : {}),
      });
      if (!res.ok) return { error: `Slack post failed: ${res.error}` };
      return {
        ok: true,
        channel: res.channel,
        ts: res.ts,
        message: res.message?.text,
      };
    } catch (err) {
      return {
        error: `Slack post failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});
