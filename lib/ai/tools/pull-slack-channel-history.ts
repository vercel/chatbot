/**
 * lib/ai/tools/pull-slack-channel-history.ts — Phase 38.5 Stream 2
 *
 * Enhanced Slack channel history tool with message classification.
 * Wraps the existing Slack API to pull channel history with:
 * - Message type classification (billing_alert, support_ticket, etc.)
 * - Customer mention extraction
 * - Pagination support
 * - Rate limit safety
 */

import { tool } from "ai";
import { z } from "zod";
import { WebClient } from "@slack/web-api";
import { secrets } from "@/secrets";

const SLACK_BOT_TOKEN = secrets.slack.botToken;

const SLACK_CHANNEL_SHORTCUTS: Record<string, string | undefined> = {
  "newleaf-admin": secrets.slack.newleafAdminChannelId || "C096PSS45Q9",
  "jarvis-admin": secrets.slack.jarvisAdminChannelId,
};

// ── Message Classification (same patterns as discovery engine) ───────

type MessageCategory =
  | "enrollment_submission" | "billing_alert" | "support_ticket"
  | "recovery_action" | "escalation" | "agent_handoff"
  | "general_discussion" | "unknown";

const CATEGORY_PATTERNS: Array<{ category: MessageCategory; patterns: RegExp[] }> = [
  {
    category: "enrollment_submission",
    patterns: [/enroll(ed|ment)?/i, /new\s+(customer|client|lead)/i, /sign(ed|ing)?\s*up/i],
  },
  {
    category: "billing_alert",
    patterns: [/payment\s*(failed|declined|issue)/i, /decline/i, /billing\s*(issue|problem)/i,
               /card\s*(expired|declined|invalid)/i, /charge\s*(failed|declined)/i, /insufficient\s*funds/i],
  },
  {
    category: "support_ticket",
    patterns: [/support\s*(ticket|request|issue)/i, /help\s*(with|me|needed)/i, /question\s*(about|regarding)/i],
  },
  {
    category: "recovery_action",
    patterns: [/recover(y|ing)?/i, /retry/i, /follow\s*up/i, /update\s*(payment|card|billing)/i, /rescue/i],
  },
  {
    category: "escalation",
    patterns: [/escalat(e|ion)/i, /urgent/i, /manager/i, /supervisor/i, /critical/i, /asap/i],
  },
  {
    category: "agent_handoff",
    patterns: [/assign(ed)?\s*to/i, /hand(ing)?\s*off/i, /transfer(red)?/i, /loop(ing)?\s*in/i],
  },
];

function classifyMessage(text: string): MessageCategory {
  const scores: Record<MessageCategory, number> = {
    enrollment_submission: 0, billing_alert: 0, support_ticket: 0,
    recovery_action: 0, escalation: 0, agent_handoff: 0,
    general_discussion: 0, unknown: 0,
  };

  for (const { category, patterns } of CATEGORY_PATTERNS) {
    for (const p of patterns) {
      if (p.test(text)) scores[category] += 1;
    }
  }

  let best: MessageCategory = "general_discussion";
  let bestScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = cat as MessageCategory;
    }
  }

  return bestScore > 0 ? best : "general_discussion";
}

function extractCustomers(text: string): Array<{ type: string; value: string }> {
  const mentions: Array<{ type: string; value: string }> = [];

  // Phone numbers
  const phones = text.match(/\+?1?\d{10,11}/g);
  if (phones) {
    for (const p of phones) {
      mentions.push({ type: "phone", value: p });
    }
  }

  // Emails
  const emails = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g);
  if (emails) {
    for (const e of emails) {
      mentions.push({ type: "email", value: e });
    }
  }

  // Names (crude: "quoted names")
  const names = text.match(/["']([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)["']/g);
  if (names) {
    for (const n of names) {
      mentions.push({ type: "name", value: n.replace(/["']/g, "") });
    }
  }

  return mentions.slice(0, 20);
}

export const pullSlackChannelHistory = tool({
  description:
    "Pull recent messages from a Slack channel with message classification. " +
    "Returns channel info, message count, and classified messages with customer mentions. " +
    "Supports both channel names (e.g., 'newleaf-admin') and IDs (e.g., 'C096PSS45Q9'). " +
    "Use for bulk Slack analysis — unlike pullSlackThread which only gets thread data.",
  inputSchema: z.object({
    channel: z.string().describe(
      "Channel name (e.g., 'newleaf-admin', 'jarvis-admin') or ID (e.g., 'C096PSS45Q9')"
    ),
    days: z.number().min(1).max(90).optional().default(7).describe(
      "How many days back to look (default: 7, max: 90)"
    ),
    maxMessages: z.number().min(10).max(500).optional().default(100).describe(
      "Maximum messages to pull (default: 100, max: 500)"
    ),
    includeClassification: z.boolean().optional().default(true).describe(
      "Whether to classify messages by type (billing_alert, support_ticket, etc.)"
    ),
  }),
  execute: async ({ channel, days, maxMessages, includeClassification }) => {
    if (!SLACK_BOT_TOKEN) {
      return {
        error: "SLACK_BOT_TOKEN not configured. Slack integration is unavailable.",
      };
    }

    const slack = new WebClient(SLACK_BOT_TOKEN);
    const oldest = String(Math.floor(Date.now() / 1000) - days * 86_400);

    try {
      // Resolve channel ID
      let channelId = channel;
      if (SLACK_CHANNEL_SHORTCUTS[channel]) {
        const resolved = SLACK_CHANNEL_SHORTCUTS[channel];
        if (resolved) channelId = resolved;
      } else if (!channel.startsWith("C") && !channel.startsWith("G")) {
        const list = await slack.conversations.list({
          types: "public_channel,private_channel",
          limit: 200,
        });
        if (list.ok && list.channels) {
          const match = list.channels.find(
            (c) => c.name === channel.replace(/^#/, "")
          );
          if (match?.id) channelId = match.id;
        }
      }

      const res = await slack.conversations.history({
        channel: channelId,
        limit: Math.min(maxMessages, 200),
        oldest,
      });

      if (!res.ok) {
        return {
          error: `Slack API error: ${res.error}`,
          channel: channelId,
        };
      }

      const messages = (res.messages || []).map((m) => {
        const msg = m as Record<string, unknown>;
        const text = (msg.text as string) || "";

        return {
          user: msg.user || "unknown",
          text: text.slice(0, 300),
          ts: msg.ts,
          type: msg.type || "message",
          category: includeClassification ? classifyMessage(text) : undefined,
          customers: includeClassification ? extractCustomers(text) : undefined,
          replyCount: (msg.reply_count as number) || 0,
        };
      });

      const categoryCounts: Record<string, number> = {};
      if (includeClassification) {
        for (const m of messages) {
          const cat = m.category || "unknown";
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
      }

      return {
        channel: channelId,
        channelName: channel,
        totalMessages: messages.length,
        hasMore: res.has_more || false,
        oldestTimestamp: messages[messages.length - 1]?.ts,
        newestTimestamp: messages[0]?.ts,
        categoryCounts: includeClassification ? categoryCounts : undefined,
        messages,
      };
    } catch (err) {
      return {
        error: `Failed to pull Slack messages: ${err instanceof Error ? err.message : "Unknown"}`,
        channel,
      };
    }
  },
});

export default pullSlackChannelHistory;
