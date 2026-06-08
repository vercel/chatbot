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

// ── Configuration ────────────────────────────────────────────────────────

const VPS_FS_BRIDGE_URL =
  process.env.VPS_FS_BRIDGE_URL || "https://187.127.250.171:8102/api/fs";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";
const NEPTUNE_V2_URL =
  process.env.NEPTUNE_V2_CHAT_URL || "https://neptune-v2.vercel.app";
const NEPTUNE_V2_HANDOFF_SECRET = process.env.NEPTUNE_V2_HANDOFF_SECRET || "";

// ── Slack Channel Shortcuts ──────────────────────────────────────────────

const SLACK_CHANNEL_SHORTCUTS: Record<string, string | undefined> = {
  "newleaf-admin": process.env.NEWLEAF_ADMIN_CHANNEL_ID || "C096PSS45Q9",
  "jarvis-admin": process.env.JARVIS_ADMIN_CHANNEL_ID,
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
        connectionString: process.env.POSTGRES_URL,
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

// ── Tool Registry ────────────────────────────────────────────────────────

/** All inline tools available to the agent, keyed by name. */
export const inlineTools = {
  // Knowledge
  readSkill,
  readPRD,
  listSkills,
  searchKnowledge,
  // Data
  queryDatabase,
  pullSlackMessages,
  fetchURL,
  // Workflow
  runWorkflow,
  // V2 Bridge
  listV2Sessions,
  getV2Session,
  postV2Session,
  streamV2Progress,
  controlV2Session,
};

/** Map of which tools require which env vars to function. */
export const TOOL_REQUIREMENTS: Record<string, string[]> = {
  readSkill: ["VPS_FS_BRIDGE_URL"],
  readPRD: ["VPS_FS_BRIDGE_URL"],
  listSkills: ["VPS_FS_BRIDGE_URL"],
  searchKnowledge: ["VPS_FS_BRIDGE_URL"],
  queryDatabase: ["POSTGRES_URL"],
  pullSlackMessages: ["SLACK_BOT_TOKEN"],
  fetchURL: [],
  runWorkflow: [],
  listV2Sessions: [],
  getV2Session: [],
  postV2Session: [],
  streamV2Progress: [],
  controlV2Session: [],
};

/**
 * Returns the list of tool names that are currently available
 * based on configured environment variables.
 */
export function getAvailableToolNames(): string[] {
  const available: string[] = [];
  for (const [name, reqs] of Object.entries(TOOL_REQUIREMENTS)) {
    const allMet = reqs.every((env) => Boolean(process.env[env]));
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
    const allMet = reqs.every((env) => Boolean(process.env[env]));
    if (allMet && inlineTools[name as keyof typeof inlineTools]) {
      available[name] = inlineTools[name as keyof typeof inlineTools];
    }
  }
  return available;
}
