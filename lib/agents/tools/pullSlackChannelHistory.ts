/**
 * lib/agents/tools/pullSlackChannelHistory.ts — Phase 38.5 Wiring Fix
 *
 * Enhanced Slack channel history puller with CURSOR-BASED pagination.
 * Unlike the simplified pullSlackThread (thread-only), this tool pulls
 * full channel message history with proper pagination via Slack cursor.
 *
 * Uses AI SDK v6 ai.tool() with inputSchema.
 * Requires SLACK_BOT_TOKEN configured in secrets.
 */

import { tool } from "ai";
import { z } from "zod";
import { WebClient } from "@slack/web-api";
import { secrets } from "@/secrets";

const SLACK_BOT_TOKEN = secrets.slack.botToken;

// ── Channel Shortcuts ────────────────────────────────────────────────

const CHANNEL_SHORTCUTS: Record<string, string | undefined> = {
  "newleaf-admin": secrets.slack.newleafAdminChannelId || "C096PSS45Q9",
  "jarvis-admin": secrets.slack.jarvisAdminChannelId,
};

// ── Rate Limiting ────────────────────────────────────────────────────

const MAX_CALLS_PER_MINUTE = 45;
const BASE_DELAY_MS = 120;

let callsThisMinute = 0;
let minuteWindowStart = Date.now();

function resetRateWindow(): void {
  const now = Date.now();
  if (now - minuteWindowStart >= 60_000) {
    callsThisMinute = 0;
    minuteWindowStart = now;
  }
}

async function rateLimitedDelay(): Promise<void> {
  resetRateWindow();
  callsThisMinute++;
  if (callsThisMinute > MAX_CALLS_PER_MINUTE) {
    const waitMs = 60_000 - (Date.now() - minuteWindowStart) + 1000;
    await new Promise((r) => setTimeout(r, waitMs));
    callsThisMinute = 0;
    minuteWindowStart = Date.now();
  }
  await new Promise((r) => setTimeout(r, BASE_DELAY_MS));
}

// ── Message Classification ───────────────────────────────────────────

const CATEGORY_PATTERNS: Array<{
  category: string;
  patterns: RegExp[];
}> = [
  {
    category: "enrollment_submission",
    patterns: [
      /enroll(ed|ment)?/i, /new\s+(customer|client|lead)/i,
      /sign(ed|ing)?\s*up/i,
    ],
  },
  {
    category: "billing_alert",
    patterns: [
      /payment\s*(failed|declined|issue)/i, /decline/i,
      /billing\s*(issue|problem)/i, /card\s*(expired|declined|invalid)/i,
      /charge\s*(failed|declined)/i, /insufficient\s*funds/i,
    ],
  },
  {
    category: "support_ticket",
    patterns: [
      /support\s*(ticket|request|issue)/i, /help\s*(with|me|needed)/i,
      /question\s*(about|regarding)/i,
    ],
  },
  {
    category: "recovery_action",
    patterns: [
      /recover(y|ing)?/i, /retry/i, /follow\s*up/i,
      /update\s*(payment|card|billing)/i, /rescue/i,
    ],
  },
  {
    category: "escalation",
    patterns: [
      /escalat(e|ion)/i, /urgent/i, /manager/i, /supervisor/i,
      /critical/i, /asap/i,
    ],
  },
  {
    category: "agent_handoff",
    patterns: [
      /assign(ed)?\s*to/i, /hand(ing)?\s*off/i,
      /transfer(red)?/i, /loop(ing)?\s*in/i,
    ],
  },
];

function classifySlackMessage(text: string): string {
  let bestCategory = "general_discussion";
  let bestScore = 0;
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    let score = 0;
    for (const p of patterns) {
      if (p.test(text)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }
  return bestScore > 0 ? bestCategory : "general_discussion";
}

function extractCustomerMentions(text: string): Array<{ type: string; value: string }> {
  const mentions: Array<{ type: string; value: string }> = [];
  const phones = text.match(/\+?1?\d{10,11}/g);
  if (phones) for (const p of phones) mentions.push({ type: "phone", value: p });
  const emails = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g);
  if (emails) for (const e of emails) mentions.push({ type: "email", value: e });
  const names = text.match(/["']([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)["']/g);
  if (names) for (const n of names) mentions.push({ type: "name", value: n.replace(/["']/g, "") });
  return mentions.slice(0, 20);
}

// ── Tool Definition ──────────────────────────────────────────────────

export const pullSlackChannelHistory = tool({
  description:
    "Pull FULL Slack channel history with cursor-based pagination. " +
    "Unlike pullSlackThread (which only pulls a single thread by timestamp), " +
    "this tool pulls ALL recent messages from a Slack channel with automatic " +
    "pagination, message classification (billing_alert, support_ticket, etc.), " +
    "and extracted customer mentions. Use this whenever the user asks to " +
    "'pull Slack', 'get Slack messages', 'check Slack channel', or 'scrape Slack'. " +
    "Supports channel names (e.g. 'newleaf-admin') and IDs (e.g. 'C096PSS45Q9'). " +
    "REAL Slack data — no simulation.",
  inputSchema: z.object({
    channel: z
      .string()
      .describe(
        "Channel name (e.g., 'newleaf-admin', 'jarvis-admin') or channel ID (e.g., 'C096PSS45Q9')"
      ),
    daysBack: z
      .number()
      .min(1)
      .max(90)
      .optional()
      .default(7)
      .describe("How many days back to look (default: 7, max: 90)"),
    maxPages: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .default(3)
      .describe("Maximum pages of cursor pagination (200 msgs/page, default: 3)"),
    classifyMessages: z
      .boolean()
      .optional()
      .default(true)
      .describe("Classify each message by type (billing_alert, support_ticket, etc.)"),
    cursor: z
      .string()
      .optional()
      .describe("Slack pagination cursor for resuming. Omit for first page."),
  }),

  execute: async ({ channel, daysBack, maxPages, classifyMessages, cursor }) => {
    if (!SLACK_BOT_TOKEN) {
      return {
        error: "SLACK_BOT_TOKEN not configured. Slack integration is unavailable.",
        hint: "Set SLACK_BOT_TOKEN in Vercel env vars to enable Slack data pulls.",
      };
    }

    const slack = new WebClient(SLACK_BOT_TOKEN);
    const oldestTimestamp = String(
      Math.floor(Date.now() / 1000) - (daysBack ?? 7) * 86_400
    );

    try {
      // ── Resolve Channel ID ─────────────────────────────────────────
      let channelId = channel;
      if (CHANNEL_SHORTCUTS[channel]) {
        const resolved = CHANNEL_SHORTCUTS[channel];
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
          else {
            return {
              error: `Channel "${channel}" not found or bot lacks access.`,
              availableChannels: list.channels.slice(0, 20).map((c) => ({
                name: c.name,
                id: c.id,
              })),
            };
          }
        }
      }

      // ── Cursor-Based Pagination ─────────────────────────────────────
      const safeMaxPages = Math.min(maxPages ?? 3, 10);
      const allMessages: Array<Record<string, unknown>> = [];
      let currentCursor: string | undefined = cursor;
      let pagesFetched = 0;
      let hasMore = true;

      while (pagesFetched < safeMaxPages && hasMore) {
        await rateLimitedDelay();

        const res = (await slack.conversations.history({
          channel: channelId,
          limit: 200,
          oldest: oldestTimestamp,
          ...(currentCursor ? { cursor: currentCursor } : {}),
        })) as unknown as Record<string, unknown>;

        if (!res.ok) {
          return {
            error: `Slack API error on page ${pagesFetched + 1}: ${res.error}`,
            channel: channelId,
            messagesSoFar: allMessages.length,
          };
        }

        const pageMessages = (res.messages as Array<Record<string, unknown>>) || [];
        allMessages.push(...pageMessages);
        pagesFetched++;

        // Check for next page cursor
        const nextCursor = res.response_metadata as Record<string, unknown> | undefined;
        hasMore = (res.has_more as boolean) || false;
        currentCursor = (nextCursor?.next_cursor as string) || undefined;

        // Break if we've gone past the date window
        if (pageMessages.length > 0) {
          const lastMsgTs = pageMessages[pageMessages.length - 1]?.ts as string;
          if (lastMsgTs && Number.parseFloat(lastMsgTs) < Number.parseFloat(oldestTimestamp)) {
            hasMore = false;
          }
        }
      }

      // ── Process Messages ────────────────────────────────────────────
      const processed = allMessages.map((m) => {
        const text = (m.text as string) || "";
        return {
          user: m.user || "unknown",
          text: text.slice(0, 500),
          ts: m.ts,
          type: m.type || "message",
          category: classifyMessages ? classifySlackMessage(text) : undefined,
          customers: classifyMessages ? extractCustomerMentions(text) : undefined,
          replyCount: (m.reply_count as number) || 0,
          hasThread: !!m.thread_ts && m.thread_ts !== m.ts,
        };
      });

      // ── Category Summary ────────────────────────────────────────────
      const categoryCounts: Record<string, number> = {};
      if (classifyMessages) {
        for (const m of processed) {
          const cat = m.category || "general_discussion";
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
      }

      return {
        success: true,
        channel: channelId,
        channelName: channel,
        totalMessages: processed.length,
        pagesFetched,
        hasMore,
        nextCursor: currentCursor || null,
        oldestTimestamp,
        newestTimestamp: processed[0]?.ts || null,
        oldestMessageTs: processed[processed.length - 1]?.ts || null,
        categoryCounts: classifyMessages ? categoryCounts : undefined,
        messages: processed,
        hint:
          hasMore && currentCursor
            ? `More messages available. Re-invoke with cursor="${currentCursor}" to fetch next page.`
            : "All available messages in date range pulled.",
      };
    } catch (err) {
      return {
        error: `Slack pull failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        channel,
        hint: "Check SLACK_BOT_TOKEN validity and bot channel membership.",
      };
    }
  },
});

export default pullSlackChannelHistory;
