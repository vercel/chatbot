/**
 * lib/ai/tools/search-slack-messages.ts — Phase 38.5 Stream 6
 *
 * Cross-channel Slack message search tool.
 * Uses Slack search API to find messages matching a query across channels.
 * Rate-limited with caching for channel lists.
 */

import { tool } from "ai";
import { z } from "zod";
import { WebClient } from "@slack/web-api";
import { secrets } from "@/secrets";

const SLACK_BOT_TOKEN = secrets.slack.botToken;

let channelListCache: { name: string; id: string }[] | null = null;
let channelListCacheTime = 0;
const CHANNEL_CACHE_TTL_MS = 300_000; // 5 min

async function getChannelList(slack: WebClient): Promise<{ name: string; id: string }[]> {
  if (channelListCache && Date.now() - channelListCacheTime < CHANNEL_CACHE_TTL_MS) {
    return channelListCache;
  }

  try {
    const list = await slack.conversations.list({
      types: "public_channel,private_channel",
      limit: 200,
    });

    if (list.ok && list.channels) {
      channelListCache = list.channels.map((c) => ({
        name: c.name || "",
        id: c.id || "",
      }));
      channelListCacheTime = Date.now();
      return channelListCache;
    }
  } catch { /* fall through */ }

  return channelListCache || [];
}

export const searchSlackMessages = tool({
  description:
    "Search Slack messages across channels for a query string. " +
    "Returns matching messages with channel context and timestamps. " +
    "Use for finding specific discussions, customer mentions, or issues across the workspace.",
  inputSchema: z.object({
    query: z.string().describe(
      "Search query (supports Slack search syntax: 'from:user', 'in:#channel', etc.)"
    ),
    channels: z.array(z.string()).optional().describe(
      "Limit search to specific channel names (e.g., ['newleaf-admin']). Searches all if omitted."
    ),
    days: z.number().min(1).max(90).optional().default(7).describe(
      "How many days back to search (default: 7)"
    ),
    maxResults: z.number().min(1).max(50).optional().default(20).describe(
      "Maximum results to return (default: 20, max: 50)"
    ),
  }),
  execute: async ({ query, channels, days, maxResults }) => {
    if (!SLACK_BOT_TOKEN) {
      return { error: "SLACK_BOT_TOKEN not configured" };
    }

    const slack = new WebClient(SLACK_BOT_TOKEN);

    try {
      // Build search query
      let searchQuery = query;
      if (channels && channels.length > 0) {
        const channelFilters = channels.map((c) => `in:#${c.replace(/^#/, "")}`).join(" ");
        searchQuery = `${query} ${channelFilters}`;
      }
      if (days) {
        const after = new Date(Date.now() - days * 86_400_000);
        searchQuery = `${searchQuery} after:${after.toISOString().split("T")[0]}`;
      }

      const res = await slack.search.messages({
        query: searchQuery,
        count: Math.min(maxResults || 20, 50),
        sort: "timestamp",
        sort_dir: "desc",
      });

      if (!res.ok) {
        return {
          error: `Slack search error: ${res.error}`,
          query: searchQuery,
        };
      }

      const matches = res.messages?.matches || [];
      const results = matches.map((m) => ({
        channel: (m.channel as Record<string, unknown>)?.name || m.channel?.id || "unknown",
        user: m.username || m.user || "unknown",
        text: (m.text || "").slice(0, 300),
        ts: m.ts,
        permalink: m.permalink,
      }));

      return {
        query,
        totalMatches: res.messages?.total || 0,
        resultsCount: results.length,
        hasMore: res.messages?.pagination?.page_count
          ? res.messages.pagination.page_count > 1
          : false,
        results,
      };
    } catch (err) {
      return {
        error: `Slack search failed: ${err instanceof Error ? err.message : "Unknown"}`,
        query,
      };
    }
  },
});

export const listSlackChannels = tool({
  description:
    "List all Slack channels the bot has access to. " +
    "Returns channel names, IDs, and topic. Results cached for 5 minutes. " +
    "Use to discover available channels before pulling message history.",
  inputSchema: z.object({
    filter: z.string().optional().describe(
      "Optional filter to search channel names (case-insensitive)"
    ),
  }),
  execute: async ({ filter }) => {
    if (!SLACK_BOT_TOKEN) {
      return { error: "SLACK_BOT_TOKEN not configured" };
    }

    const slack = new WebClient(SLACK_BOT_TOKEN);

    try {
      const allChannels = await getChannelList(slack);

      const filtered = filter
        ? allChannels.filter((c) =>
            c.name.toLowerCase().includes(filter.toLowerCase())
          )
        : allChannels;

      return {
        totalChannels: filtered.length,
        allChannelsCount: allChannels.length,
        cached: channelListCache !== null,
        channels: filtered.slice(0, 50).map((c) => ({
          name: c.name,
          id: c.id,
        })),
        truncated: filtered.length > 50,
      };
    } catch (err) {
      return {
        error: `Failed to list channels: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});

export default searchSlackMessages;
