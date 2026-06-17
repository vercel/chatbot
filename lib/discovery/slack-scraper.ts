/**
 * lib/discovery/slack-scraper.ts
 * Phase 38 Stream 0 — Paginated Bulk Slack Scraper
 *
 * Builds on existing connectors/slack/tools/pullMessages.ts foundation.
 * Adds: cursor-based pagination, rate limit safety, message classification,
 * customer mention extraction, user name resolution cache.
 */

import { WebClient } from "@slack/web-api";
import { secrets } from "@/secrets";
import type {
  SlackScrapeConfig,
  SlackScrapeResult,
  ScrapedSlackMessage,
  SlackChannelResult,
  MessageType,
  ExtractedCustomerMention,
} from "./types";
import { extractCustomerMentions } from "./customer-matcher";

const SLACK_BOT_TOKEN = secrets.slack.botToken;

// ── Channel Shortcuts ────────────────────────────────────────────

const CHANNEL_SHORTCUTS: Record<string, string> = {
  "newleaf-admin": secrets.slack.newleafAdminChannelId || "C096PSS45Q9",
  "newleaf-panda-submissions": process.env.SLACK_PANDA_CHANNEL_ID || "",
  "all-billing": process.env.SLACK_BILLING_CHANNEL_ID || "",
  "jarvis-admin": secrets.slack.jarvisAdminChannelId || "C0AQDDC3HAB",
};

// ── Rate Limiting ────────────────────────────────────────────────

const MAX_CALLS_PER_MINUTE = 45; // Conservative: well under Tier 3 burst
const BASE_DELAY_MS = 120;       // 120ms between pagination calls
const BACKOFF_MULTIPLIER = 2;    // Exponential backoff on 429

let callsThisMinute = 0;
let minuteWindowStart = Date.now();

function resetRateWindow() {
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
    console.log(`[slack-scraper] Rate limit — waiting ${waitMs}ms`);
    await new Promise((r) => setTimeout(r, waitMs));
    callsThisMinute = 0;
    minuteWindowStart = Date.now();
  }

  // Small inter-request delay for gentle pacing
  await new Promise((r) => setTimeout(r, BASE_DELAY_MS));
}

// ── User Name Resolution Cache ───────────────────────────────────

const userNameCache = new Map<string, string>();

async function resolveUserNames(
  slack: WebClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uncached = userIds.filter((id) => !userNameCache.has(id));

  if (uncached.length === 0) {
    for (const id of userIds) result.set(id, userNameCache.get(id) || id);
    return result;
  }

  // Fetch uncached users in batches of 50
  for (let i = 0; i < uncached.length; i += 50) {
    const batch = uncached.slice(i, i + 50);
    try {
      for (const userId of batch) {
        try {
          await rateLimitedDelay();
          const info = await slack.users.info({ user: userId });
          if (info.ok && info.user) {
            const displayName =
              (info.user as Record<string, unknown>).real_name as string ||
              (info.user as Record<string, unknown>).name as string ||
              userId;
            userNameCache.set(userId, displayName);
            result.set(userId, displayName);
          } else {
            result.set(userId, userId);
          }
        } catch {
          result.set(userId, userId);
        }
      }
    } catch {
      for (const id of batch) result.set(id, id);
    }
  }

  return result;
}

// ── Message Type Classification ──────────────────────────────────

const MESSAGE_TYPE_PATTERNS: Array<{ type: MessageType; patterns: RegExp[] }> = [
  {
    type: 'enrollment_submission',
    patterns: [
      /enroll(ed|ment)?/i,
      /new\s+(customer|client|lead)/i,
      /sign(ed|ing)?\s*up/i,
      /submission/i,
      /intake/i,
    ],
  },
  {
    type: 'billing_alert',
    patterns: [
      /payment\s*(failed|declined|issue|problem)/i,
      /decline/i,
      /billing\s*(issue|problem|error)/i,
      /card\s*(expired|declined|invalid)/i,
      /charge\s*(failed|declined)/i,
      /insufficient\s*funds/i,
    ],
  },
  {
    type: 'support_ticket',
    patterns: [
      /support\s*(ticket|request|issue)/i,
      /(customer|client)\s*(called|reached?\s*out|contacted)/i,
      /help\s*(with|me|needed)/i,
      /question\s*(about|regarding)/i,
      /how\s*(do|can|to)\s/i,
      /what\s*(is|are|happened)/i,
    ],
  },
  {
    type: 'recovery_action',
    patterns: [
      /recover(y|ing)?/i,
      /retry/i,
      /follow\s*up/i,
      /update\s*(payment|card|billing)/i,
      /rescue/i,
      /save/i,
      /salvage/i,
    ],
  },
  {
    type: 'escalation',
    patterns: [
      /escalat(e|ion)/i,
      /urgent/i,
      /manager/i,
      /supervisor/i,
      /need\s*(help|assistance)/i,
      /critical/i,
      /asap/i,
    ],
  },
  {
    type: 'agent_handoff',
    patterns: [
      /assign(ed)?\s*to/i,
      /hand(ing)?\s*off/i,
      /transfer(red)?/i,
      /@here/i,
      /cc[':]/i,
      /loop(ing)?\s*in/i,
    ],
  },
];

export function classifyMessageType(text: string): MessageType {
  const scores: Record<MessageType, number> = {
    enrollment_submission: 0,
    billing_alert: 0,
    support_ticket: 0,
    recovery_action: 0,
    escalation: 0,
    agent_handoff: 0,
    general_discussion: 0,
    unknown: 0,
  };

  for (const { type, patterns } of MESSAGE_TYPE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        scores[type] += 1;
      }
    }
  }

  // Find the type with the highest score
  let bestType: MessageType = 'general_discussion';
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type as MessageType;
    }
  }

  return bestScore > 0 ? bestType : 'general_discussion';
}

// ── Action Verb Detection ────────────────────────────────────────

const ACTION_VERB_PATTERNS: Array<{ verb: string; patterns: RegExp[] }> = [
  { verb: 'payment_failed', patterns: [/payment\s*(failed|didn'?t\s*go\s*through)/i] },
  { verb: 'need_update', patterns: [/need\s*(to|s)?\s*update/i, /has\s*to\s*update/i] },
  { verb: 'cancel_request', patterns: [/cancel/i, /stop\s*(payment|charging|subscription)/i] },
  { verb: 'refund_request', patterns: [/refund/i, /money\s*back/i] },
  { verb: 'check_status', patterns: [/check\s*(on|status|in)/i, /look\s*into/i] },
  { verb: 'callback_promise', patterns: [/(I'?ll|I\s*will|let\s*me)\s*(call|follow\s*up|reach\s*out|get\s*back)/i] },
  { verb: 'update_complete', patterns: [/done/i, /completed/i, /resolved/i, /fixed/i, /taken\s*care\s*of/i] },
];

export function detectActionVerbs(text: string): string[] {
  return ACTION_VERB_PATTERNS
    .filter(({ patterns }) => patterns.some((p) => p.test(text)))
    .map(({ verb }) => verb);
}

// ── Channel Resolution ───────────────────────────────────────────

async function resolveChannelId(
  slack: WebClient,
  channel: string
): Promise<{ id: string; name: string } | { error: string }> {
  // Check shortcuts first
  if (CHANNEL_SHORTCUTS[channel]) {
    return { id: CHANNEL_SHORTCUTS[channel], name: channel };
  }

  // If already an ID (starts with C or G)
  if (channel.startsWith("C") || channel.startsWith("G")) {
    try {
      const info = await slack.conversations.info({ channel });
      if (info.ok && info.channel) {
        return {
          id: channel,
          name: (info.channel as Record<string, unknown>).name as string || channel,
        };
      }
    } catch {
      // Fall through to list approach
    }
  }

  // Search by name
  try {
    const list = await slack.conversations.list({
      types: "public_channel,private_channel",
      limit: 200,
    });
    if (!list.ok) return { error: `Failed to list channels: ${list.error}` };

    const clean = channel.replace(/^#/, "");
    const match = list.channels?.find(
      (c) => c.name === clean
    );
    if (match?.id) return { id: match.id, name: match.name || clean };

    return { error: `Channel "${channel}" not found` };
  } catch (err) {
    return {
      error: `Channel resolution failed: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

// ── Main Scrape Function ─────────────────────────────────────────

export async function scrapeSlackChannels(
  config: SlackScrapeConfig
): Promise<SlackScrapeResult> {
  if (!SLACK_BOT_TOKEN) {
    return {
      totalMessages: 0,
      channels: {},
      messages: [],
      errors: [{ channel: "all", error: "SLACK_BOT_TOKEN not configured" }],
      scrapedAt: new Date().toISOString(),
    };
  }

  const slack = new WebClient(SLACK_BOT_TOKEN);
  const oldest = String(Math.floor(Date.now() / 1000) - config.daysBack * 86_400);
  const maxPerChannel = config.maxMessagesPerChannel || 1000;

  const result: SlackScrapeResult = {
    totalMessages: 0,
    channels: {},
    messages: [],
    errors: [],
    scrapedAt: new Date().toISOString(),
  };

  // Resolve all channel IDs first
  const resolvedChannels: { name: string; id: string }[] = [];
  for (const channel of config.channels) {
    const resolved = await resolveChannelId(slack, channel);
    if ("error" in resolved) {
      result.errors.push({ channel, error: resolved.error });
    } else {
      resolvedChannels.push(resolved);
    }
  }

  if (resolvedChannels.length === 0) {
    return result;
  }

  // Scrape each channel
  for (const { name, id } of resolvedChannels) {
    const channelResult: SlackChannelResult = {
      name,
      id,
      messageCount: 0,
      hasMore: false,
      oldestTs: "",
      newestTs: "",
    };

    try {
      let cursor: string | undefined;
      let pageCount = 0;
      const maxPages = Math.ceil(maxPerChannel / 200);
      const allMessages: ScrapedSlackMessage[] = [];

      do {
        await rateLimitedDelay();

        const res = await slack.conversations.history({
          channel: id,
          limit: 200,
          oldest,
          ...(cursor ? { cursor } : {}),
        });

        if (!res.ok) {
          result.errors.push({
            channel: name,
            error: `Slack API error: ${res.error}`,
          });
          break;
        }

        const messages = res.messages || [];
        if (messages.length === 0) break;

        // Collect unique user IDs for batch name resolution
        const userIds = new Set<string>();
        for (const m of messages) {
          if ((m as Record<string, unknown>).user) {
            userIds.add((m as Record<string, unknown>).user as string);
          }
        }

        // Resolve user names
        const names = await resolveUserNames(slack, [...userIds]);

        // Process each message
        for (const m of messages) {
          const msg = m as Record<string, unknown>;
          const text = (msg.text as string) || "";
          const userId = (msg.user as string) || "unknown";

          const scraped: ScrapedSlackMessage = {
            channelId: id,
            channelName: name,
            userId,
            userName: names.get(userId) || userId,
            text,
            ts: (msg.ts as string) || "",
            threadTs: msg.thread_ts as string | undefined,
            replyCount: (msg.reply_count as number) || 0,
            reactions: Array.isArray(msg.reactions)
              ? (msg.reactions as Array<{ name: string; count: number }>).map(
                  (r) => ({ name: r.name, count: r.count })
                )
              : [],
            messageType: classifyMessageType(text),
            extractedCustomers: extractCustomerMentions(text),
          };

          allMessages.push(scraped);
        }

        // Update channel result
        if (messages.length > 0) {
          if (!channelResult.oldestTs) {
            channelResult.oldestTs = (messages[messages.length - 1] as Record<string, unknown>).ts as string || "";
          }
          if (!channelResult.newestTs && pageCount === 0) {
            channelResult.newestTs = (messages[0] as Record<string, unknown>).ts as string || "";
          }
        }

        cursor = res.response_metadata?.next_cursor;
        channelResult.hasMore = !!cursor;
        pageCount++;

      } while (cursor && pageCount < maxPages && allMessages.length < maxPerChannel);

      channelResult.messageCount = allMessages.length;
      result.channels[name] = channelResult;
      result.messages.push(...allMessages);
      result.totalMessages += allMessages.length;

    } catch (err) {
      result.errors.push({
        channel: name,
        error: `Scrape failed: ${err instanceof Error ? err.message : "Unknown"}`,
      });
    }
  }

  return result;
}

// ── Helper: Get all unique customer mentions from scrape result ──

export function getUniqueCustomersFromScrape(
  result: SlackScrapeResult
): ExtractedCustomerMention[] {
  const seen = new Set<string>();
  const unique: ExtractedCustomerMention[] = [];

  for (const msg of result.messages) {
    for (const mention of msg.extractedCustomers) {
      const key = `${mention.type}:${mention.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(mention);
      }
    }
  }

  return unique.sort((a, b) => b.confidence - a.confidence);
}
