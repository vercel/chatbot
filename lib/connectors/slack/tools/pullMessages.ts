/**
 * Slack pullMessages — enhanced with name→ID resolver + channel shortcuts.
 */
import { WebClient } from "@slack/web-api";
import { tool } from "ai";
import { z } from "zod";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";

const CHANNEL_SHORTCUTS: Record<string, string> = {
  "newleaf-admin": process.env.NEWLEAF_ADMIN_CHANNEL_ID || "C096PSS45Q9",
  "jarvis-admin": process.env.JARVIS_ADMIN_CHANNEL_ID || "C0AQDDC3HAB",
};

function parseSince(since: string): number | undefined {
  if (!since) return undefined;
  if (/^\d{10,}$/.test(since)) return Number.parseInt(since, 10);
  const iso = Date.parse(since);
  if (!Number.isNaN(iso)) return Math.floor(iso / 1000);
  const m = since.match(
    /^(\d+)\s*(second|minute|hour|day|week|month)s?\s*ago$/i
  );
  if (m) {
    const mults: Record<string, number> = {
      second: 1,
      minute: 60,
      hour: 3600,
      day: 86_400,
      week: 604_800,
      month: 2_592_000,
    };
    const mult = mults[m[2]];
    if (mult)
      return Math.floor(Date.now() / 1000) - Number.parseInt(m[1]) * mult;
  }
  return undefined;
}

export const pullMessages = tool({
  description:
    "Pull recent messages from a Slack channel. Accepts channel name OR ID. Shortcuts: 'newleaf-admin', 'jarvis-admin'. Requires SLACK_BOT_TOKEN.",
  inputSchema: z.object({
    channel: z
      .string()
      .describe(
        "Channel name (e.g. 'newleaf-admin') or ID (e.g. 'C096PSS45Q9')"
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .default(50)
      .describe("Messages to pull (max 200)"),
    since: z
      .string()
      .optional()
      .describe("Time filter: ISO timestamp or relative like '7 days ago'"),
  }),
  execute: async ({ channel, limit, since }) => {
    if (!SLACK_BOT_TOKEN) return { error: "SLACK_BOT_TOKEN not configured." };

    const slack = new WebClient(SLACK_BOT_TOKEN);
    let channelId = channel;

    try {
      if (CHANNEL_SHORTCUTS[channel]) {
        channelId = CHANNEL_SHORTCUTS[channel];
      } else if (!channel.startsWith("C") && !channel.startsWith("G")) {
        const list = await slack.conversations.list({
          types: "public_channel,private_channel",
          limit: 200,
        });
        if (!list.ok)
          return { error: `Failed to list channels: ${list.error}` };
        const match = list.channels?.find(
          (c) => c.name === channel.replace(/^#/, "")
        );
        if (!match?.id)
          return {
            error: `Channel "${channel}" not found.`,
            availableChannels: list.channels
              ?.slice(0, 20)
              .map((c) => ({ name: c.name, id: c.id })),
          };
        channelId = match.id;
      }

      const oldest = since ? parseSince(since) : undefined;
      const res = await slack.conversations.history({
        channel: channelId,
        limit: limit ?? 50,
        ...(oldest ? { oldest: String(oldest) } : {}),
      });

      if (!res.ok)
        return { error: `Slack API error: ${res.error}`, channel: channelId };

      const messages = (res.messages ?? []).map(
        (m: { user?: string; text?: string; ts?: string; type?: string }) => ({
          user: m.user ?? "unknown",
          text: m.text ?? "",
          ts: m.ts ?? "",
          type: m.type ?? "message",
        })
      );

      return {
        channel: channelId,
        channelName: channel,
        count: messages.length,
        hasMore: res.has_more ?? false,
        messages,
      };
    } catch (err) {
      return {
        error: `Slack pull failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});
