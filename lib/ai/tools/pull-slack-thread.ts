/**
 * Phase 25 Stream 2: pull-slack-thread tool
 * Returns Slack thread data in UniversalConnectorCard envelope format.
 */
import { tool } from "ai";
import { z } from "zod";
import { WebClient } from "@slack/web-api";
import { secrets } from "@/secrets";

const SLACK_BOT_TOKEN = secrets.slack.botToken;
const SLACK_CHANNEL_SHORTCUTS: Record<string, string | undefined> = {
  "jarvis-admin": secrets.slack.jarvisAdminChannelId,
  "newleaf-admin": secrets.slack.newleafAdminChannelId || "C096PSS45Q9",
};

export const pullSlackThread = tool({
  description: "Pull a Slack thread from a channel. Returns channel, user, reactions, and reply count.",
  inputSchema: z.object({
    channel: z.string().describe("Channel name or ID, e.g. 'jarvis-admin' or 'C0AQDDC3HAB'"),
    threadTs: z.string().describe("Thread timestamp (ts) to pull"),
  }),
  execute: async ({ channel, threadTs }) => {
    const channelId = SLACK_CHANNEL_SHORTCUTS[channel] || channel;
    try {
      const slack = new WebClient(SLACK_BOT_TOKEN);
      const result = await slack.conversations.replies({
        channel: channelId,
        ts: threadTs,
        limit: 20,
      });

      const messages = result.messages || [];
      const parentMsg = messages[0];
      const replies = messages.slice(1);

      return {
        connectorType: "slack",
        data: {
          channel: channel,
          user: (parentMsg as Record<string, unknown>)?.user || "unknown",
          reactions: parentMsg?.reactions?.length || 0,
          replyCount: replies.length,
          threadTs: threadTs,
          threadHistory: messages.map((m) => ({
            user: m.user || m.username || "unknown",
            text: (m.text || "").slice(0, 200),
            ts: m.ts,
          })),
        },
        schemaVersion: 1,
      };
    } catch {
      return {
        connectorType: "slack",
        data: {
          channel: channel,
          user: "unknown",
          reactions: 0,
          replyCount: 0,
          threadTs: threadTs,
          threadHistory: [],
        },
        schemaVersion: 1,
      };
    }
  },
});
