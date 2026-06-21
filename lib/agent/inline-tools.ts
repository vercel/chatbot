/**
 * inline-tools.ts — Real inline tools for Neptune Chat ToolLoopAgent.
 *
 * PRD ref: Section 3, Layer 2 — Agent Capabilities
 * Provides 11 tools across 4 categories:
 *   Knowledge:  readSkill, readPRD, listSkills, searchKnowledge
 *   Data:      queryDatabase, pullSlackMessages, fetchURL
 *   Workflow:  runWorkflow
 *   V2 Bridge: listV2Sessions, getV2Session, postV2Session, streamV2Progress, controlV2Session
 */

import { WebClient } from "@slack/web-api";
import { tool } from "ai";
import { z } from "zod";
import { secrets } from "@/secrets";
import {
  createWorkflow,
  updateWorkflow,
} from "@/lib/ai/tools/create-workflow";
import { selfCode } from "@/lib/ai/tools/self-code";
import { loadSkill } from "@/lib/ai/tools/load-skill";
import { queryKnowledge } from "@/lib/ai/tools/query-knowledge";
import { graphQueryTool } from "@/lib/ai/tools/graph-query";
import { viewGithubFile } from "@/lib/ai/tools/view-github-file";

// ── Phase 38.5 Wiring Fix: Bulk Discovery Tools ───────────────────────────
import { pullSlackChannelHistory as pullSlackChannelHistoryV2 } from "@/lib/agents/tools/pullSlackChannelHistory";
import { bulkNmiQuery as bulkNmiQueryV2 } from "@/lib/agents/tools/bulkNmiQuery";
import { bulkBase44Pull as bulkBase44PullV2 } from "@/lib/agents/tools/bulkBase44Pull";
import { runDiscoveryWorkflow as runDiscoveryWorkflowV2 } from "@/lib/agents/tools/runDiscoveryWorkflow";

// ── Configuration ────────────────────────────────────────────────────────

const VPS_FS_BRIDGE_URL =
  secrets.vps.fsBridgeUrl || "https://187.127.250.171:8102/api/fs";

const SLACK_BOT_TOKEN = secrets.slack.botToken;
const NEPTUNE_V2_URL =
  secrets.neptuneV2.chatUrl || "https://neptune-v2.vercel.app";
const NEPTUNE_V2_HANDOFF_SECRET = secrets.neptuneV2.handoffSecret;

// ── Slack Channel Shortcuts ──────────────────────────────────────────────

const SLACK_CHANNEL_SHORTCUTS: Record<string, string | undefined> = {
  "newleaf-admin": secrets.slack.newleafAdminChannelId || "C096PSS45Q9",
  "jarvis-admin": secrets.slack.jarvisAdminChannelId,
};

// ── Shared Helpers ───────────────────────────────────────────────────────

interface FsListResult {
  success: boolean;
  files?: Array<{ name: string; path: string; size: number }>;
  error?: string;
}

interface FsReadResult {
  success: boolean;
  content?: string;
  path?: string;
  error?: string;
}

/**
 * Calls the VPS file system bridge to list files.
 * Gracefully degrades if bridge is unavailable.
 */
async function vpsFsList(parentPath: string): Promise<FsListResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${VPS_FS_BRIDGE_URL}/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentPath }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, error: `Bridge returned ${res.status}` };
    }

    const data = await res.json();
    return { success: true, files: data.files ?? data };
  } catch (err) {
    return {
      success: false,
      error: `VPS bridge unavailable: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

/**
 * Calls the VPS file system bridge to read a file.
 */
async function vpsFsRead(path: string): Promise<FsReadResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${VPS_FS_BRIDGE_URL}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, error: `Bridge returned ${res.status}` };
    }

    const data = await res.json();
    return { success: true, content: data.content, path: data.path };
  } catch (err) {
    return {
      success: false,
      error: `VPS bridge unavailable: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

// ── Category 1: Knowledge Tools ──────────────────────────────────────────

export const readSkill = tool({
  description:
    "Read a skill/playbook from the Jarvis cortex. Provide the skill name (e.g., 'neptune-project-hierarchy-LOCKED'). Returns the full markdown content of the skill file.",
  inputSchema: z.object({
    name: z
      .string()
      .describe(
        "The skill file name without .md extension (e.g., 'neptune-v6-agent-patterns')"
      ),
  }),
  execute: async ({ name }) => {
    const result = await vpsFsRead(`jarvis/cortex/skills/${name}.md`);
    if (!result.success) {
      // Fallback: try PRD directory
      const altResult = await vpsFsRead(`jarvis/prd/${name}.md`);
      if (!altResult.success) {
        return {
          error: `Skill "${name}" not found in cortex or PRD directories. Bridge status: ${result.error}`,
        };
      }
      return { skill: name, source: "prd", content: altResult.content };
    }
    return { skill: name, source: "cortex/skills", content: result.content };
  },
});

export const readPRD = tool({
  description:
    "Read a PRD (Product Requirements Document) from the Jarvis knowledge base. Provide the PRD name (e.g., 'neptune-chat-production-grade-master-v2').",
  inputSchema: z.object({
    name: z.string().describe("The PRD file name without .md extension"),
  }),
  execute: async ({ name }) => {
    const result = await vpsFsRead(`jarvis/prd/${name}.md`);
    if (!result.success) {
      return {
        error: `PRD "${name}" not found. Bridge status: ${result.error}`,
      };
    }
    return { prd: name, content: result.content };
  },
});

export const listSkills = tool({
  description:
    "List all available skills and playbooks from the Jarvis cortex. Returns an array of file names and sizes.",
  inputSchema: z.object({
    category: z
      .enum(["skills", "prds", "all"])
      .optional()
      .default("all")
      .describe("Filter by category: skills, prds, or all"),
    search: z
      .string()
      .optional()
      .describe("Optional search filter for file names"),
  }),
  execute: async ({ category, search }) => {
    const results: Array<{
      name: string;
      category: string;
      path: string;
    }> = [];

    if (category === "skills" || category === "all") {
      const skillsResult = await vpsFsList("jarvis/cortex/skills");
      if (skillsResult.success && skillsResult.files) {
        for (const f of skillsResult.files) {
          if (!search || f.name.toLowerCase().includes(search.toLowerCase())) {
            results.push({
              name: f.name,
              category: "skills",
              path: `jarvis/cortex/skills/${f.name}`,
            });
          }
        }
      }
    }

    if (category === "prds" || category === "all") {
      const prdsResult = await vpsFsList("jarvis/prd");
      if (prdsResult.success && prdsResult.files) {
        for (const f of prdsResult.files) {
          if (!search || f.name.toLowerCase().includes(search.toLowerCase())) {
            results.push({
              name: f.name,
              category: "prd",
              path: `jarvis/prd/${f.name}`,
            });
          }
        }
      }
    }

    if (results.length === 0) {
      return {
        total: 0,
        message:
          "No skills/PRDs found. VPS bridge may be unavailable — these files live on the Hermes VPS.",
        bridgeStatus: "check VPS_FS_BRIDGE_URL env var",
        items: [],
      };
    }

    return {
      total: results.length,
      items: results.slice(0, 50),
    };
  },
});

export const searchKnowledge = tool({
  description:
    "Search across all Jarvis knowledge files (skills, PRDs, docs) for a query string. Returns matching snippets with file paths.",
  inputSchema: z.object({
    query: z.string().describe("Search query (keywords or phrase)"),
    category: z
      .enum(["skills", "prds", "all"])
      .optional()
      .default("all")
      .describe("Limit search to a category"),
    maxResults: z
      .number()
      .optional()
      .default(5)
      .describe("Maximum number of results to return (default 5)"),
  }),
  execute: async ({ query, category, maxResults }) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(`${VPS_FS_BRIDGE_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, category, maxResults }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        // Fallback: return bridge unavailable message
        return {
          error: `Knowledge search unavailable. VPS bridge returned ${res.status}. Configure VPS_FS_BRIDGE_URL to enable semantic search.`,
        };
      }

      const data = await res.json();
      return {
        query,
        results: data.results ?? [],
        totalFound: data.total ?? data.results?.length ?? 0,
      };
    } catch {
      return {
        error:
          "Knowledge search is currently unavailable. The VPS file system bridge is not reachable. This feature requires network access to the Hermes VPS.",
      };
    }
  },
});

// ── Category 2: Data Tools ───────────────────────────────────────────────

export const queryDatabase = tool({
  description:
    "Run a read-only SQL SELECT query against the Neon Postgres database. Returns up to 50 rows. Only SELECT statements are allowed. Use for looking up customer data, transactions, tickets, etc.",
  inputSchema: z.object({
    sql: z
      .string()
      .describe("A read-only SQL SELECT query. Must start with SELECT."),
    limit: z
      .number()
      .optional()
      .default(50)
      .describe("Maximum rows to return (default 50, max 100)"),
  }),
  execute: async ({ sql, limit }) => {
    const trimmedSQL = sql.trim();

    // Security: block non-SELECT queries
    if (!trimmedSQL.toLowerCase().startsWith("select")) {
      return {
        error: "Only SELECT queries are allowed. This is a read-only tool.",
      };
    }

    // Block dangerous SQL patterns
    const dangerous =
      /drop\s|alter\s|truncate\s|insert\s|update\s|delete\s|create\s|grant\s|revoke\s/i;
    if (dangerous.test(trimmedSQL)) {
      return {
        error:
          "Dangerous SQL pattern detected. Only SELECT queries are permitted.",
      };
    }

    const safeLimit = Math.min(Math.max(limit ?? 50, 1), 100);

    try {
      const { createClient } = await import("@vercel/postgres");

      const client = createClient({
        connectionString: secrets.internal.postgresUrl,
      });

      await client.connect();

      try {
        // Add LIMIT if not present
        let finalSQL = trimmedSQL;
        if (!trimmedSQL.toLowerCase().includes("limit")) {
          finalSQL = `${trimmedSQL.replace(/;$/, "")} LIMIT ${safeLimit}`;
        }

        const result = await client.query(finalSQL);
        return {
          rowCount: result.rowCount ?? 0,
          rows: result.rows.slice(0, safeLimit),
          fields: result.fields.map((f: { name: string }) => f.name),
        };
      } finally {
        await client.end();
      }
    } catch (err) {
      return {
        error: `Database query failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * Parse a "since" string into a Unix timestamp.
 * Supports ISO 8601 timestamps and relative strings like "7 days ago", "1 hour ago".
 */
function parseSince(since: string): number | undefined {
  if (!since) return undefined;

  // Already a Unix timestamp (numeric)
  if (/^\d{10,}$/.test(since)) {
    return Number.parseInt(since, 10);
  }

  // ISO 8601 timestamp
  const iso = Date.parse(since);
  if (!Number.isNaN(iso)) {
    return Math.floor(iso / 1000);
  }

  // Relative strings like "7 days ago", "1 hour ago"
  const relativeMatch = since.match(
    /^(\d+)\s*(second|minute|hour|day|week|month)s?\s*ago$/i
  );
  if (relativeMatch) {
    const amount = Number.parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    const multipliers: Record<string, number> = {
      second: 1,
      minute: 60,
      hour: 3600,
      day: 86_400,
      week: 604_800,
      month: 2_592_000,
    };
    const multiplier = multipliers[unit];
    if (multiplier) {
      return Math.floor(Date.now() / 1000) - amount * multiplier;
    }
  }

  return undefined;
}

export const pullSlackMessages = tool({
  description:
    "Pull recent messages from a Slack channel. Accepts channel name OR ID. Knows about newleaf-admin and jarvis-admin shortcuts. Requires SLACK_BOT_TOKEN to be configured.",
  inputSchema: z.object({
    channel: z
      .string()
      .describe(
        "Channel name (e.g., 'newleaf-admin', 'jarvis-admin') or ID (e.g., 'C096PSS45Q9')"
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .default(50)
      .describe("Number of messages to pull (default 50, max 200)"),
    since: z
      .string()
      .optional()
      .describe(
        "Only return messages after this time. Accepts ISO timestamps (e.g., '2026-06-01T00:00:00Z') or relative strings like '7 days ago', '1 hour ago'."
      ),
  }),
  execute: async ({ channel, limit, since }) => {
    if (!SLACK_BOT_TOKEN) {
      return {
        error:
          "SLACK_BOT_TOKEN not configured. Slack integration is unavailable.",
      };
    }

    const slack = new WebClient(SLACK_BOT_TOKEN);

    try {
      // Resolve channel ID via shortcuts, env vars, or channel name lookup
      let channelId = channel;

      // Check shortcuts first
      if (SLACK_CHANNEL_SHORTCUTS[channel]) {
        const resolved = SLACK_CHANNEL_SHORTCUTS[channel];
        if (resolved) channelId = resolved;
      }
      // If not a channel ID (doesn't start with C or G), resolve by name
      else if (!channel.startsWith("C") && !channel.startsWith("G")) {
        const list = await slack.conversations.list({
          types: "public_channel,private_channel",
          limit: 200,
        });

        if (!list.ok || !list.channels) {
          return {
            error: `Failed to list Slack channels: ${list.error || "Unknown error"}`,
          };
        }

        const match = list.channels.find(
          (c) => c.name === channel.replace(/^#/, "")
        );

        if (match?.id) {
          channelId = match.id;
        } else {
          return {
            error: `Channel "${channel}" not found or bot lacks access. Make sure the bot is invited to the channel.`,
            availableChannels: list.channels
              .slice(0, 20)
              .map((c) => ({ name: c.name, id: c.id })),
          };
        }
      }

      const oldest = since ? parseSince(since) : undefined;

      const res = await slack.conversations.history({
        channel: channelId,
        limit: limit ?? 50,
        ...(oldest ? { oldest: String(oldest) } : {}),
      });

      if (!res.ok) {
        return {
          error: `Slack API error: ${res.error}`,
          channel: channelId,
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messages = ((res.messages ?? []) as any[]).map((m: any) => ({
        user: m.user ?? "unknown",
        text: m.text ?? "",
        ts: m.ts ?? "",
        type: m.type ?? "message",
      }));

      return {
        channel: channelId,
        channelName: channel,
        count: messages.length,
        hasMore: res.has_more ?? false,
        messages,
      };
    } catch (err) {
      return {
        error: `Failed to pull Slack messages: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});

export const fetchURL = tool({
  description:
    "Fetch content from a URL and return it as text or markdown. Use for reading documentation, API responses, or web pages. Supports text/html (returns stripped text) and JSON (returns formatted).",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to fetch"),
    returnType: z
      .enum(["text", "json", "markdown"])
      .optional()
      .default("text")
      .describe("How to return the content"),
    maxLength: z
      .number()
      .optional()
      .default(10_000)
      .describe("Maximum characters to return (default 10000)"),
  }),
  execute: async ({ url, returnType, maxLength }) => {
    const safeMax = Math.min(maxLength ?? 10_000, 50_000);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const res = await fetch(url, {
        headers: {
          "User-Agent": "Neptune-Chat/3.1 (ToolLoopAgent)",
          Accept: "text/html, application/json, text/plain, */*",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return {
          error: `Fetch failed: ${res.status} ${res.statusText}`,
          url,
        };
      }

      const contentType = res.headers.get("content-type") ?? "";

      if (returnType === "json" || contentType.includes("json")) {
        const json = await res.json();
        const text = JSON.stringify(json, null, 2);
        return {
          url,
          contentType,
          status: res.status,
          content: text.slice(0, safeMax),
          truncated: text.length > safeMax,
        };
      }

      const text = await res.text();

      if (returnType === "markdown") {
        // Basic HTML-to-text stripping
        const stripped = text
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        return {
          url,
          contentType,
          status: res.status,
          content: stripped.slice(0, safeMax),
          truncated: stripped.length > safeMax,
        };
      }

      return {
        url,
        contentType,
        status: res.status,
        content: text.slice(0, safeMax),
        truncated: text.length > safeMax,
      };
    } catch (err) {
      return {
        error: `Failed to fetch URL: ${err instanceof Error ? err.message : "Unknown"}`,
        url,
      };
    }
  },
});

// ── Category 3: Workflow Tools ───────────────────────────────────────────

export const runWorkflow = tool({
  description:
    "Trigger a Workflow SDK 5 durable workflow. The workflow runs asynchronously on the server. Provide a task description and optional parameters. Returns a workflow ID for tracking.",
  inputSchema: z.object({
    task: z.string().describe("The task description for the workflow"),
    params: z
      .record(z.unknown())
      .optional()
      .describe("Optional parameters for the workflow"),
    model: z
      .string()
      .optional()
      .describe("Model to use for the workflow (default: deepseek-v4-pro)"),
  }),
  execute: async ({ task, params, model }) => {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const res = await fetch(`${baseUrl}/api/workflow/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          params: params ?? {},
          model: model ?? "deepseek-v4-pro",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return {
          error: `Workflow endpoint returned ${res.status}. Ensure /api/workflow/run is deployed.`,
        };
      }

      const data = await res.json();
      return {
        workflowId: data.workflowId ?? data.id,
        status: data.status ?? "started",
        message: "Workflow triggered successfully",
        ...data,
      };
    } catch (err) {
      return {
        error: `Failed to trigger workflow: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});

// ── Category 4: V2 Bridge Tools ──────────────────────────────────────────

function authV2Headers(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (NEPTUNE_V2_HANDOFF_SECRET) {
    headers.Authorization = `Bearer ${NEPTUNE_V2_HANDOFF_SECRET}`;
  }
  return headers;
}

export const listV2Sessions = tool({
  description:
    "List recent coding sessions from Neptune V2 (the coding engine). Returns session IDs, statuses, and creation times. Use to check what's running on V2.",
  inputSchema: z.object({
    status: z
      .enum(["running", "completed", "failed", "all"])
      .optional()
      .default("all")
      .describe("Filter by session status"),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum sessions to return"),
  }),
  execute: async ({ status, limit }) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const headers = authV2Headers();
      const params = new URLSearchParams({
        limit: String(Math.min(limit ?? 10, 25)),
      });
      if (status && status !== "all") {
        params.set("status", status);
      }

      const res = await fetch(
        `${NEPTUNE_V2_URL}/api/sessions/list?${params.toString()}`,
        {
          headers,
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        return {
          error: `V2 returned ${res.status}. V2 may not have a sessions API yet.`,
        };
      }

      const data = await res.json();
      return {
        sessions: data.sessions ?? data ?? [],
        count: Array.isArray(data.sessions)
          ? data.sessions.length
          : Array.isArray(data)
            ? data.length
            : 0,
      };
    } catch (err) {
      return {
        error: `V2 unreachable: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});

export const getV2Session = tool({
  description:
    "Get detailed information about a specific Neptune V2 coding session, including status, progress, and output.",
  inputSchema: z.object({
    sessionId: z.string().describe("The V2 session ID"),
  }),
  execute: async ({ sessionId }) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const headers = authV2Headers();

      const res = await fetch(`${NEPTUNE_V2_URL}/api/sessions/${sessionId}`, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return {
          error: `V2 returned ${res.status} for session ${sessionId}`,
        };
      }

      const data = await res.json();
      return {
        sessionId,
        status: data.status ?? "unknown",
        createdAt: data.createdAt ?? data.created_at,
        ...data,
      };
    } catch (err) {
      return {
        error: `V2 unreachable: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});

export const postV2Session = tool({
  description:
    "Hand off a coding task to Neptune V2. V2 will spawn a coding session (sandbox or repo) and execute the task. Returns a session ID and stream URL for tracking progress.",
  inputSchema: z.object({
    prompt: z.string().describe("The coding task description to send to V2"),
    context: z
      .string()
      .optional()
      .describe("Additional context about the codebase or requirements"),
    model: z
      .string()
      .optional()
      .describe("Model for V2 to use (default: deepseek-v4-pro)"),
  }),
  execute: async ({ prompt, context, model }) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const headers = authV2Headers();

      const res = await fetch(`${NEPTUNE_V2_URL}/api/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt,
          context,
          model: model ?? "deepseek-v4-pro",
          source: "neptune-chat-tool",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          success: false,
          error: `V2 returned ${res.status}: ${body.slice(0, 200)}`,
        };
      }

      const data = await res.json();
      return {
        success: true,
        sessionId: data.sessionId ?? data.id,
        sessionUrl:
          data.sessionUrl ??
          `${NEPTUNE_V2_URL}/sessions/${data.sessionId ?? data.id}`,
        sseUrl: data.sseUrl ?? data.streamUrl,
        message: "V2 handoff successful. Track progress via the session URL.",
      };
    } catch (err) {
      return {
        success: false,
        error: `V2 handoff failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});

export const streamV2Progress = tool({
  description:
    "Get the SSE stream URL for a running Neptune V2 coding session. Use this to monitor real-time progress of a V2 handoff. Returns a stream URL that can be consumed via EventSource.",
  inputSchema: z.object({
    sessionId: z.string().describe("The V2 session ID to stream progress for"),
  }),
  execute: ({ sessionId }) => {
    return {
      sessionId,
      streamUrl: `/api/v2/sessions/${sessionId}/stream`,
      v2DirectStreamUrl: `${NEPTUNE_V2_URL}/api/sessions/${sessionId}/stream`,
      message:
        "Use the streamUrl with an EventSource to receive real-time progress events. Each event contains: step, status, and text fields.",
    };
  },
});

export const controlV2Session = tool({
  description:
    "Control a running Neptune V2 coding session. Valid actions: pause (pause execution), resume (continue paused session), cancel (terminate session). Use when a user wants to stop or pause a long-running V2 task.",
  inputSchema: z.object({
    sessionId: z.string().describe("The V2 session ID to control"),
    action: z
      .enum(["pause", "resume", "cancel"])
      .describe("Control action: pause, resume, or cancel the session"),
  }),
  execute: async ({ sessionId, action }) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const headers = authV2Headers();

      const res = await fetch(
        `${NEPTUNE_V2_URL}/api/sessions/${sessionId}/control`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ action }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          success: false,
          sessionId,
          action,
          error: `V2 returned ${res.status}: ${body.slice(0, 200)}`,
        };
      }

      return {
        success: true,
        sessionId,
        action,
        message: `Session ${sessionId} ${action}d successfully`,
      };
    } catch (err) {
      return {
        success: false,
        sessionId,
        action,
        error: `V2 control failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});

// ── Category 5: Integration Discovery ───────────────────────────────────

export const listIntegrations = tool({
  description:
    "List ALL available integrations/connectors that Neptune Chat has access to. Returns connector name, status, tool count, tool names, and playbook references. Use this whenever the user asks 'what integrations do you have', 'list your integrations', 'what can you connect to', or similar. There are 13 connectors: nmi, hyperswitch, slack, github, linear, forth, vapi, ghl, base44, vercel, mcp-hub, wiki, affy.",
  inputSchema: z.object({
    filter: z
      .enum(["all", "connected", "configured", "disconnected"])
      .optional()
      .default("all")
      .describe("Filter connectors by status"),
  }),
  execute: async ({ filter }) => {
    try {
      const { getIntegrationSummaries } = await import(
        "@/lib/connectors/catalog"
      );
      const all = getIntegrationSummaries();

      const filtered =
        filter === "all"
          ? all
          : all.filter((s) => s.status === filter);

      return {
        total: all.length,
        connected: all.filter((s) => s.status === "connected").length,
        configured: all.filter((s) => s.status === "configured").length,
        disconnected: all.filter((s) => s.status === "disconnected").length,
        integrations: filtered.map((s) => ({
          name: s.name,
          id: s.id,
          status: s.status,
          tools: s.tools,
          toolNames: s.toolNames,
          description: s.description,
          playbook: s.playbook,
        })),
        fullList: all.map((s) => s.name),
      };
    } catch (err) {
      return {
        error: `Failed to list integrations: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});

// ── Category 6: Gatekeeper Tools (U2.1.A — Progressive Disclosure) ──────

/**
 * view_file — Read any file from the filesystem.
 *
 * Gatekeeper tool for Pattern A (Documentation-Driven Runtime).
 * Provides direct file access. Reads from:
 *   - Local repo files (playbooks/, skills/, lib/ etc.) via fs
 *   - VPS cortex files (jarvis/cortex/, jarvis/prd/) via bridge
 *
 * This replaces the need for domain-specific read tools — the agent
 * loads what it needs on demand via this single gate.
 */
export const viewFile = tool({
  description:
    "Read any file from the knowledge base or codebase. " +
    "Use for reading playbooks, skills, PRDs, configuration, or source code. " +
    "Paths: playbooks/<domain>/playbook-*.md for domain playbooks, " +
    "jarvis/cortex/skills/<name>.md for VPS skills, " +
    "jarvis/prd/<name>.md for PRD documents, " +
    "lib/ or app/ for source code.",
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        "File path to read. Examples: 'playbooks/billing/playbook-billing.md', " +
        "'jarvis/cortex/skills/neptune-v6-agent-patterns.md', " +
        "'skills/registry.json', 'NEPTUNE.md'. " +
        "Use list_playbooks to discover available playbook paths."
      ),
    maxLength: z
      .number()
      .optional()
      .default(20000)
      .describe("Maximum characters to return (default 20000, max 50000)"),
  }),
  execute: async ({ path: filePath, maxLength }) => {
    const safeMax = Math.min(maxLength ?? 20000, 50000);

    // VPS bridge paths
    if (filePath.startsWith("jarvis/")) {
      const result = await vpsFsRead(filePath);
      if (result.success && result.content) {
        return {
          path: filePath,
          content: result.content.slice(0, safeMax),
          truncated: result.content.length > safeMax,
          length: result.content.length,
          source: "vps-bridge",
        };
      }
      return {
        path: filePath,
        error: `File not found via VPS bridge: ${result.error || "Unknown error"}`,
        hint: "Try list_playbooks or listSkills to discover available files.",
      };
    }

    // Local repo files
    try {
      const { readFileSync, existsSync } = await import("fs");
      const { join } = await import("path");
      const fullPath = join(process.cwd(), filePath);

      if (!existsSync(fullPath)) {
        return {
          path: filePath,
          error: `File not found at ${filePath}. Check the path and try again.`,
          hint: "Use list_playbooks to discover playbook paths, or try reading from jarvis/cortex/ for VPS files.",
        };
      }

      const content = readFileSync(fullPath, "utf-8");
      return {
        path: filePath,
        content: content.slice(0, safeMax),
        truncated: content.length > safeMax,
        length: content.length,
        source: "local-repo",
      };
    } catch (err) {
      return {
        path: filePath,
        error: `Failed to read file: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});

// ── U2.5.B: Skill-Author Safety Audit ──────────────────────────────────────

const FORBIDDEN_CONNECTORS = ["base44", "nmi", "slack", "hyperswitch", "vapi"];

/**
 * Audit a skill-author script result for safety.
 * Returns {pass: true} if no forbidden connectors were modified.
 */
function auditSkillAuthorResult(
  scriptName: string,
  result: { success?: boolean; data?: Record<string, unknown>; error?: string }
): { pass: boolean; note: string } {
  const data = result?.data;
  if (!data) return { pass: true, note: "No data to audit." };

  // Check for forbidden connector names in output
  const dataStr = JSON.stringify(data);
  for (const forbidden of FORBIDDEN_CONNECTORS) {
    if (dataStr.includes(forbidden)) {
      return {
        pass: false,
        note: `SAFETY: Script '${scriptName}' may have referenced forbidden connector '${forbidden}'. Production connectors must not be modified by skill-author.`,
      };
    }
  }

  // Check file_updated / files_created paths
  for (const key of ["file_updated", "files_created", "output_path"]) {
    const val = data[key];
    if (typeof val === "string") {
      for (const forbidden of FORBIDDEN_CONNECTORS) {
        if (val.includes(`connectors/${forbidden}`)) {
          return {
            pass: false,
            note: `SAFETY: Script '${scriptName}' wrote to forbidden path containing 'connectors/${forbidden}'. Roll back this change.`,
          };
        }
      }
    }
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === "string") {
          for (const forbidden of FORBIDDEN_CONNECTORS) {
            if (item.includes(`connectors/${forbidden}`)) {
              return {
                pass: false,
                note: `SAFETY: Script '${scriptName}' created file in forbidden path containing 'connectors/${forbidden}'. Roll back this change.`,
              };
            }
          }
        }
      }
    }
  }

  return { pass: true, note: "Safety audit passed — no forbidden connectors modified." };
}

/**
 * execute_skill — Load and execute a skill from the knowledge base.
 *
 * Gatekeeper tool for Pattern A. Loads a SKILL.md (with YAML frontmatter
 * per Anthropic Agent Skills Spec), parses its tools/input/output contract,
 * and returns structured execution context. The agent then follows the
 * skill's prescribed steps.
 *
 * U2.5.B: Also resolves and executes skill-author scripts.
 * When skill_name starts with "skills/skill-author/scripts/", it
 * dynamically imports the script module and calls execute(params).
 *
 * Skill resolution order:
 *   1. skills/skill-author/scripts/<name>.ts → dynamic import + execute()
 *   2. skills/<category>/<name>/SKILL.md (local repo skills)
 *   3. jarvis/cortex/skills/<name>.md (VPS cortex)
 *   4. playbooks/<domain>/playbook-*.md (domain playbooks)
 */
export const executeSkill = tool({
  description:
    "Execute a named skill from the knowledge base. " +
    "Loads the skill's SKILL.md, parses its YAML frontmatter for tools/input/output definitions, " +
    "and returns the full execution contract. Use this when you need to perform a domain-specific " +
    "operation that has a documented skill procedure. " +
    "Also supports skill-author scripts: pass 'skills/skill-author/scripts/<script-name>' " +
    "to run scaffolding/indexing tools. " +
    "Examples: 'billing-flow-retry', 'cof-health-audit', 'skills/skill-author/scripts/create-connector-pack'. " +
    "Use listSkills or listPlaybooks to discover available skills.",
  inputSchema: z.object({
    skill_name: z
      .string()
      .describe(
        "Name of the skill to execute. Can be a domain skill name (e.g., 'billing-flow-retry') " +
        "OR a skill-author script path (e.g., 'skills/skill-author/scripts/create-connector-pack'). " +
        "Use listSkills or listPlaybooks to discover available skills."
      ),
    params: z
      .record(z.unknown())
      .optional()
      .describe("Optional parameters to pass to the skill execution"),
  }),
  execute: async ({ skill_name, params }) => {
    // ── U2.5.B: Skill-author script execution path ────────────────────────
    // Check if this is a skill-author script invocation
    const skillAuthorScriptMatch = skill_name.match(
      /^skills\/skill-author\/scripts\/([a-z][\w-]+)(?:\.ts)?$/i
    );

    if (skillAuthorScriptMatch) {
      const scriptName = skillAuthorScriptMatch[1];
      const validScripts = [
        "create-connector-pack",
        "wrap-api-endpoint",
        "update-playbook-md",
        "ingest-api-docs",
        "regenerate-skill-index",
        "update-master-registry",
      ];

      if (!validScripts.includes(scriptName)) {
        return {
          skill_name,
          loaded: false,
          error: `Unknown skill-author script: '${scriptName}'. Available: ${validScripts.join(", ")}`,
          hint: "Valid skill-author scripts: create-connector-pack, wrap-api-endpoint, update-playbook-md, ingest-api-docs, regenerate-skill-index, update-master-registry.",
        };
      }

      try {
        // Dynamic import hidden from bundler (Turbopack cannot trace this path)
        const scriptPath = `/home/neptune/neptune-chat/skills/skill-author/scripts/${scriptName}.ts`;
        const mod = await new Function('p', 'return import(p)')(scriptPath);

        if (typeof mod.default !== "function" && typeof mod.execute !== "function") {
          return {
            skill_name,
            loaded: false,
            error: `Skill-author script '${scriptName}' does not export an execute function. Found: ${Object.keys(mod).join(", ")}`,
          };
        }

        const execFn = mod.execute || mod.default;
        const result = await execFn(params || {});

        // Safety audit: verify the script didn't touch forbidden connectors
        const safetyCheck = auditSkillAuthorResult(scriptName, result);

        return {
          skill_name,
          loaded: true,
          source: "skill-author-script",
          script_name: scriptName,
          script_path: scriptPath,
          execution_result: result,
          safety_pass: safetyCheck.pass,
          safety_note: safetyCheck.note,
          hint: safetyCheck.pass
            ? `Script '${scriptName}' executed successfully. Check execution_result for details.`
            : `Script executed but safety warning: ${safetyCheck.note}`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          skill_name,
          loaded: false,
          error: `Failed to execute skill-author script '${scriptName}': ${msg}`,
          hint: "Check that the script file exists and TypeScript compilation succeeds. Scripts may need to run locally (pnpm dev) or via Vercel Sandbox.",
        };
      }
    }

    // Resolve skill paths using same logic as loadSkill
    const skillPath = skill_name;
    const paths = [
      `skills/${skillPath}/SKILL.md`,
      `jarvis/cortex/skills/${skillPath}.md`,
      `jarvis/cortex/skills/${skillPath}-skill.md`,
      `jarvis/cortex/skills/${skillPath}-connector.md`,
      `jarvis/prd/${skillPath}.md`,
    ];

    let skillContent = "";
    let foundPath = "";
    let source = "";

    // Try local files first
    try {
      const { readFileSync, existsSync } = await import("fs");
      const { join } = await import("path");

      for (const p of paths.filter(p => !p.startsWith("jarvis/"))) {
        const fullPath = join(process.cwd(), p);
        if (existsSync(fullPath)) {
          skillContent = readFileSync(fullPath, "utf-8");
          foundPath = p;
          source = "local-repo";
          break;
        }
      }
    } catch {
      // Fall through to VPS bridge
    }

    // Try VPS bridge if not found locally
    if (!skillContent) {
      for (const p of paths.filter(p => p.startsWith("jarvis/"))) {
        const result = await vpsFsRead(p);
        if (result.success && result.content) {
          skillContent = result.content;
          foundPath = p;
          source = "vps-bridge";
          break;
        }
      }
    }

    if (!skillContent) {
      return {
        skill_name,
        loaded: false,
        error: `Skill "${skill_name}" not found. Tried: ${paths.join(", ")}`,
        hint: "Use listSkills or listPlaybooks to discover available skills.",
      };
    }

    // Parse YAML frontmatter (Anthropic Agent Skills Spec)
    let frontmatter: Record<string, unknown> = {};
    let bodyContent = skillContent;
    if (skillContent.startsWith("---")) {
      const endIdx = skillContent.indexOf("---", 3);
      if (endIdx > 0) {
        const fmBlock = skillContent.substring(3, endIdx).trim();
        bodyContent = skillContent.substring(endIdx + 3).trim();
        // Simple YAML parser for frontmatter
        for (const line of fmBlock.split("\n")) {
          const colonIdx = line.indexOf(":");
          if (colonIdx > 0) {
            const key = line.substring(0, colonIdx).trim();
            let value: unknown = line.substring(colonIdx + 1).trim();
            // Parse arrays
            if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
              value = value.slice(1, -1).split(",").map(v => v.trim().replace(/['"]/g, ""));
            }
            frontmatter[key] = value;
          }
        }
      }
    }

    // Extract tool references from the skill content
    const toolRefs = new Set<string>();
    const toolMatches = bodyContent.matchAll(/[`'](\w+)[`']/g);
    for (const m of toolMatches) {
      if (!toolRefs.has(m[1])) toolRefs.add(m[1]);
    }

    // Extract step sequence if present
    const steps: string[] = [];
    const stepMatches = bodyContent.matchAll(/^\d+\.\s+(.+)$/gm);
    for (const m of stepMatches) {
      steps.push(m[1].trim());
    }

    return {
      skill_name,
      loaded: true,
      source,
      path: foundPath,
      frontmatter,
      name: frontmatter.name || skill_name,
      description: frontmatter.description || bodyContent.split("\n").find(l => l.trim() && !l.startsWith("#"))?.slice(0, 200) || "",
      tools_referenced: [...toolRefs].slice(0, 30),
      steps: steps.slice(0, 20),
      content: bodyContent.slice(0, 15000),
      content_truncated: bodyContent.length > 15000,
      params_provided: params || null,
      hint: steps.length > 0
        ? `This skill has ${steps.length} defined steps. Follow them in order.`
        : "Review the skill content and execute the prescribed operations.",
    };
  },
});

/**
 * list_playbooks — List all available playbooks in playbooks/.
 *
 * Gatekeeper tool for Pattern A. Scans the playbooks/ directory
 * and returns all playbook paths with their domains and titles.
 * This is how the agent discovers what operational playbooks exist.
 */
export const listPlaybooks = tool({
  description:
    "List all available domain playbooks from playbooks/. " +
    "Returns each playbook's path, domain, title, and available routines. " +
    "Use this to discover what operational procedures are documented before " +
    "loading a specific playbook with view_file or execute_skill. " +
    "Playbooks contain domain rules, safeguards, anti-patterns, and step-by-step routines.",
  inputSchema: z.object({
    org: z
      .string()
      .optional()
      .default("newleaf-financial")
      .describe("Organization to list playbooks for (default: newleaf-financial)"),
    domain: z
      .string()
      .optional()
      .describe("Filter to a specific domain (e.g., 'billing', 'disputes', 'customer-support')"),
    search: z
      .string()
      .optional()
      .describe("Search playbook titles and routines for a keyword"),
  }),
  execute: async ({ org: _org, domain, search }) => {
    try {
      const { readdirSync, existsSync, statSync, readFileSync } = await import("fs");
      const { join } = await import("path");

      const playbooksRoot = join(process.cwd(), "playbooks");
      if (!existsSync(playbooksRoot)) {
        return {
          total: 0,
          playbooks: [],
          message: "No playbooks/ directory found. Playbooks are loaded from playbooks/<domain>/playbook-<domain>.md",
        };
      }

      const results: Array<{
        domain: string;
        path: string;
        title: string;
        routineCount: number;
        safeguardCount: number;
      }> = [];

      const entries = readdirSync(playbooksRoot).filter((d) =>
        statSync(join(playbooksRoot, d)).isDirectory() && !d.startsWith(".") && !d.startsWith("_")
      );

      for (const currentDomain of entries) {
        // Apply domain filter early
        if (domain && currentDomain !== domain) continue;

        const domainPath = join(playbooksRoot, currentDomain);
        const playbookNames = [`playbook-${currentDomain}.md`, "PLAYBOOK.md", "playbook.md", "SKILL.md"];

        for (const pbName of playbookNames) {
          const pbPath = join(domainPath, pbName);
          if (existsSync(pbPath)) {
            const raw = readFileSync(pbPath, "utf-8");
            const titleLine = raw.split("\n").find(l => l.startsWith("# "))?.replace("# ", "") || currentDomain;
            const routineCount = (raw.match(/###\s*Routine:/gi) || []).length;
            const safeguardCount = (raw.match(/^-\s.+$/gm) || []).length;

            const relativePath = `playbooks/${currentDomain}/${pbName}`;

            // Apply search filter
            if (search) {
              const searchLower = search.toLowerCase();
              if (!titleLine.toLowerCase().includes(searchLower) &&
                  !currentDomain.toLowerCase().includes(searchLower) &&
                  !raw.toLowerCase().includes(searchLower)) {
                continue;
              }
            }

            results.push({
              domain: currentDomain,
              path: relativePath,
              title: titleLine,
              routineCount,
              safeguardCount,
            });
            break; // Only count first matching playbook per domain
          }
        }
      }

      // Also scan connectors/ directory for connector playbooks
      const connectorsRoot = join(process.cwd(), "connectors");
      const connectorPlaybooks: typeof results = [];
      try {
        if (existsSync(connectorsRoot)) {
          const connDirs = readdirSync(connectorsRoot).filter((d) =>
            statSync(join(connectorsRoot, d)).isDirectory() && !d.startsWith(".") && !d.startsWith("_")
          );
          for (const connDir of connDirs) {
            const connPlaybookPaths = [
              join(connectorsRoot, connDir, "PLAYBOOK.md"),
              join(connectorsRoot, connDir, "SKILL.md"),
            ];
            for (const pp of connPlaybookPaths) {
              if (existsSync(pp)) {
                const raw = readFileSync(pp, "utf-8");
                const titleLine = raw.split("\n").find(l => l.startsWith("# "))?.replace("# ", "") || connDir;
                const routineCount = (raw.match(/###\s*Routine:/gi) || []).length;
                connectorPlaybooks.push({
                  domain: connDir,
                  path: `connectors/${connDir}/${pp.split("/").pop()}`,
                  title: `${titleLine} (connector)`,
                  routineCount,
                  safeguardCount: (raw.match(/^-\s.+$/gm) || []).length,
                });
                break;
              }
            }
          }
        }
      } catch {
        // connectors scan is optional
      }

      // Also scan for VPS playbooks via bridge as fallback
      const vpsPlaybooks: typeof results = [];
      try {
        const skillsList = await vpsFsList("jarvis/cortex/skills");
        if (skillsList.success && skillsList.files) {
          for (const f of skillsList.files) {
            if (f.name.includes("playbook") || f.name.includes("connector")) {
              vpsPlaybooks.push({
                domain: f.name.replace(".md", ""),
                path: `jarvis/cortex/skills/${f.name}`,
                title: f.name.replace(".md", ""),
                routineCount: 0,
                safeguardCount: 0,
              });
            }
          }
        }
      } catch {
        // VPS bridge optional
      }

      const allResults = [...results, ...connectorPlaybooks, ...vpsPlaybooks];

      return {
        domain: domain || null,
        total: allResults.length,
        localPlaybooks: results.length,
        connectorPlaybooks: connectorPlaybooks.length,
        vpsCortex: vpsPlaybooks.length,
        playbooks: allResults,
        hint: "Use view_file with any path to read the full playbook. Playbooks contain domain rules, safeguards, and executable routines.",
      };
    } catch (err) {
      return {
        total: 0,
        playbooks: [],
        error: `Failed to list playbooks: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});

// ── Tool Registry ────────────────────────────────────────────────────────

/** All inline tools available to the agent, keyed by name. */
export const inlineTools = {
  // ── Gatekeeper Tools (U2.1 Progressive Disclosure) ──
  viewFile,
  viewGithubFile,
  executeSkill,
  listPlaybooks,
  loadSkill,
  selfCode,
  // ── Legacy Knowledge Tools (kept for backward compat, prefer gatekeepers) ──
  readSkill,
  readPRD,
  listSkills,
  searchKnowledge,
  // ── Legacy Data Tools ──
  queryDatabase,
  pullSlackMessages,
  fetchURL,
  // ── Legacy Workflow Tools ──
  runWorkflow,
  createWorkflow,
  updateWorkflow,
  // ── Legacy V2 Bridge Tools ──
  listV2Sessions,
  getV2Session,
  postV2Session,
  streamV2Progress,
  controlV2Session,
  // ── U7.4 Knowledge Graph Gatekeeper (Pattern A+2, 8th tool) ──
  queryKnowledge,
  // ── Phase 24: Visual KG Explorer slash command ──
  graphQuery: graphQueryTool,
  // ── Legacy Integration Discovery ──
  listIntegrations,
  // ── Phase 38.5: Bulk Discovery Tools (V2 — cursor pagination + batch) ──
  pullSlackChannelHistoryV2,
  bulkNmiQueryV2,
  bulkBase44PullV2,
  runDiscoveryWorkflowV2,
};

/** Map of which tools require which env vars to function. */
export const TOOL_REQUIREMENTS: Record<string, string[]> = {
  // ── Gatekeeper Tools (U2.1 — Progressive Disclosure) ──
  viewFile: ["VPS_FS_BRIDGE_URL"],
  viewGithubFile: ["GITHUB_TOKEN"],
  executeSkill: ["VPS_FS_BRIDGE_URL"],
  listPlaybooks: [],
  loadSkill: ["VPS_FS_BRIDGE_URL"],
  selfCode: ["OPEN_AGENTS_API_KEY"],
  // ── Legacy Knowledge Tools ──
  readSkill: ["VPS_FS_BRIDGE_URL"],
  readPRD: ["VPS_FS_BRIDGE_URL"],
  listSkills: ["VPS_FS_BRIDGE_URL"],
  searchKnowledge: ["VPS_FS_BRIDGE_URL"],
  // ── Legacy Data Tools ──
  queryDatabase: ["POSTGRES_URL"],
  pullSlackMessages: ["SLACK_BOT_TOKEN"],
  fetchURL: [],
  // ── Legacy Workflow Tools ──
  runWorkflow: [],
  createWorkflow: [],
  updateWorkflow: [],
  // ── Legacy V2 Bridge Tools ──
  listV2Sessions: [],
  getV2Session: [],
  postV2Session: [],
  streamV2Progress: [],
  controlV2Session: [],
  // ── U7.4 Knowledge Graph Gatekeeper ──
  queryKnowledge: ["POSTGRES_URL"],
  // ── Phase 24: Visual KG Explorer slash command ──
  graphQuery: ["POSTGRES_URL"],
  // ── Legacy Integration Discovery ──
  listIntegrations: [],
  // ── Phase 38.5: Bulk Discovery Tools ──
  pullSlackChannelHistoryV2: ["SLACK_BOT_TOKEN"],
  bulkNmiQueryV2: ["VPS_BRIDGE_URL"],
  bulkBase44PullV2: ["VPS_BRIDGE_URL"],
  runDiscoveryWorkflowV2: [],
};

/**
 * Returns the list of tool names that are currently available
 * based on configured secrets values.
 */
export function getAvailableToolNames(): string[] {
  const available: string[] = [];
  for (const [name, reqs] of Object.entries(TOOL_REQUIREMENTS)) {
    const allMet = reqs.every((env) => {
      switch (env) {
        case "VPS_FS_BRIDGE_URL": return !!secrets.vps.fsBridgeUrl;
        case "GITHUB_TOKEN": return !!secrets.github.token;
        case "SLACK_BOT_TOKEN": return !!secrets.slack.botToken;
        case "POSTGRES_URL": return !!secrets.internal.postgresUrl;
        case "OPEN_AGENTS_API_KEY": return !!secrets.neptuneV2.openAgentsApiKey;
        default: return Boolean(process.env[env]);
      }
    });
    if (allMet) {
      available.push(name);
    }
  }
  return available;
}

/**
 * Returns a filtered tools object containing only tools whose
 * env requirements are satisfied.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAvailableTools(): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const available: Record<string, any> = {};
  for (const [name, reqs] of Object.entries(TOOL_REQUIREMENTS)) {
    const allMet = reqs.every((env) => {
      switch (env) {
        case "VPS_FS_BRIDGE_URL": return !!secrets.vps.fsBridgeUrl;
        case "GITHUB_TOKEN": return !!secrets.github.token;
        case "SLACK_BOT_TOKEN": return !!secrets.slack.botToken;
        case "POSTGRES_URL": return !!secrets.internal.postgresUrl;
        case "OPEN_AGENTS_API_KEY": return !!secrets.neptuneV2.openAgentsApiKey;
        default: return Boolean(process.env[env]);
      }
    });
    if (allMet && inlineTools[name as keyof typeof inlineTools]) {
      available[name] = inlineTools[name as keyof typeof inlineTools];
    }
  }
  return available;
}

/**
 * U2.1.C — Gatekeeper-only tool set.
 * Returns ONLY the 6 gatekeeper tools: viewFile, executeSkill, listPlaybooks,
 * loadSkill, selfCode, spawnCodingAgent.
 *
 * All legacy tools (readSkill, queryDatabase, etc.) are excluded.
 * The agent accesses those capabilities through load_skill → playbook → execute_skill.
 */
export const GATEKEEPER_TOOL_NAMES = [
  "viewFile",
  "viewGithubFile",
  "executeSkill",
  "listPlaybooks",
  "loadSkill",
  "selfCode",
  "runWorkflow",   // U2.1.D: 7th gatekeeper tool — U3.6 Workflow Engine
  "queryKnowledge", // U7.4: 8th gatekeeper tool — Postgres KG query (Pattern A+2 documented exception)
  "graphQuery",     // Phase 24: 9th gatekeeper tool — Visual KG explorer slash command
];

/**
 * Returns only the 6 gatekeeper tools (U2.1 progressive disclosure).
 * The 6th tool (spawnCodingAgent) is provided by the sandbox toolset,
 * not inline tools, so it's excluded here but available through sandboxTools.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGatekeeperTools(): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gatekeeper: Record<string, any> = {};
  for (const name of GATEKEEPER_TOOL_NAMES) {
    if (inlineTools[name as keyof typeof inlineTools]) {
      gatekeeper[name] = inlineTools[name as keyof typeof inlineTools];
    }
  }
  return gatekeeper;
}
