/**
 * tool-preview.ts — Preview badge generation for tool calls.
 *
 * Each function takes a tool name + optional args/output and returns a compact
 * human-readable string suitable for a Badge in the tool call header.
 *
 * Designed to cover the 50+ tools registered across 17 connectors.
 */

// ── Type ───────────────────────────────────────────────────────────────────

type PreviewInput = unknown;
type PreviewOutput = unknown;

// ── Helpers ────────────────────────────────────────────────────────────────

function countKeys(obj: unknown): number {
  if (!obj || typeof obj !== "object") return 0;
  return Object.keys(obj as Record<string, unknown>).length;
}

function firstLine(text: unknown): string {
  const s = String(text ?? "");
  const nl = s.indexOf("\n");
  return nl > 0 ? s.slice(0, nl) + "…" : s.slice(0, 80);
}

function truncStr(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// ── Preview Generation Maps ────────────────────────────────────────────────

/** Known tool name patterns → preview generator */
type PreviewFn = (toolName: string, input?: PreviewInput, output?: PreviewOutput) => string;

const READ_TOOLS = new Set([
  "read", "Read", "fs_read", "fsRead", "b44_get", "b44Query",
  "entity_get", "entityGet", "github_read", "githubRead",
  "readSkill", "readPRD", "readPRDs", "readPlaybook",
  "listSkills", "searchKnowledge", "query_warehouse",
  "validated_query", "reportingHubQuery", "queryDatabase",
  "queryEntity", "countEntity", "pullSlackMessages",
]);

const WRITE_TOOLS = new Set([
  "write", "Write", "fs_write", "fsWrite", "b44_create",
  "b44Update", "entity_create", "entityUpdate",
  "writeFile", "createFile", "githubWrite",
]);

const BASH_TOOLS = new Set([
  "bash", "Bash", "Run", "execute", "runScript", "runCommand",
]);

const SEARCH_TOOLS = new Set([
  "search", "Search", "webSearch", "grep", "Grep",
  "githubSearch", "knowledgeSearch", "github_search",
  "web_search", "kg_search", "kgSearch",
]);

const FETCH_TOOLS = new Set([
  "fetch", "Fetch", "webFetch", "WebFetch", "fetchURL",
  "getURL", "httpGet", "httpPost",
]);

const MCP_TOOLS = new Set([
  "mcp", "MCP", "mcpCall", "mcpTool",
]);

const AGENT_TOOLS = new Set([
  "agent", "Agent", "dispatchAgent", "runAgent",
  "parallelAgents", "spawnAgent",
]);

const NMI_TOOLS = new Set([
  "nmi", "NMI", "charge", "Charge", "refund", "Refund",
  "vaultCreate", "vaultUpdate", "subscriptionCreate",
]);

const SLACK_TOOLS = new Set([
  "slack", "Slack", "postMessage", "postThread",
  "slackMessage", "channelHistory",
]);

/** Exact tool name → custom preview */
const EXACT_PREVIEWS: Record<string, PreviewFn> = {
  "base44Query": (_n, i) => {
    const entity = (i as Record<string, unknown>)?.entity ?? "records";
    return `Query ${entity}`;
  },
  "b44_query": (_n, i) => {
    const entity = (i as Record<string, unknown>)?.entity ?? "records";
    return `Query ${entity}`;
  },
  "b44_count": (_n, i) => {
    const entity = (i as Record<string, unknown>)?.entity ?? "records";
    return `Count ${entity}`;
  },
  "reportingHub": (_n, i) => {
    const action = (i as Record<string, unknown>)?.action ?? "report";
    return `${String(action)} report`;
  },
  "customer360": () => "Customer 360 lookup",
  "crossSystemLookup": () => "Cross-system lookup",
  "b44_customer_360": () => "Customer 360 dossier",
  "listV2Sessions": () => "List V2 sessions",
  "getV2Session": (_n, i) => {
    const id = (i as Record<string, unknown>)?.id ?? "?";
    return `V2 session ${truncStr(String(id), 12)}`;
  },
  "postV2Session": () => "Start V2 session",
  "streamV2Progress": () => "Stream V2 progress",
  "controlV2Session": () => "Control V2 session",
  "generateText": (_n, i) => {
    const prompt = (i as Record<string, unknown>)?.prompt;
    const s = typeof prompt === "string" ? prompt : "";
    return `Generate: ${truncStr(s, 50)}`;
  },
  "streamText": (_n, i) => {
    const msgs = (i as Record<string, unknown>)?.messages;
    const count = Array.isArray(msgs) ? msgs.length : "?";
    return `Stream chat (${count} msgs)`;
  },
  "toolLoopAgent": () => "Run agent loop",
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a compact preview string for a tool call.
 * Returns a string like "Read 12 entities", "Wrote +150 chars", "Bash: npm install".
 */
export function generateToolPreview(
  toolName: string,
  input?: PreviewInput,
  output?: PreviewOutput,
): string {
  // 1. Exact match
  const exact = EXACT_PREVIEWS[toolName];
  if (exact) return exact(toolName, input, output);

  // 2. Exact match without mcp__ prefix
  const base = toolName.replace(/^mcp__\w+__/, "");
  const exactBase = EXACT_PREVIEWS[base];
  if (exactBase) return exactBase(base, input, output);

  // 3. Pattern match by tool category
  if (READ_TOOLS.has(toolName) || READ_TOOLS.has(base)) {
    const keys = countKeys(output);
    if (keys > 0) return `Read ${keys} fields`;
    const arr = Array.isArray(output) ? output.length : 0;
    if (arr > 0) return `Read ${arr} records`;
    return "Read data";
  }

  if (WRITE_TOOLS.has(toolName) || WRITE_TOOLS.has(base)) {
    if (typeof input === "object" && input) {
      const content = (input as Record<string, unknown>)?.content ?? (input as Record<string, unknown>)?.data;
      if (typeof content === "string") return `Wrote +${content.length} chars`;
    }
    const keys = countKeys(input);
    return `Wrote ${keys} fields`;
  }

  if (BASH_TOOLS.has(toolName) || BASH_TOOLS.has(base)) {
    if (typeof input === "string") return `Bash: ${truncStr(input, 40)}`;
    const cmd = (input as Record<string, unknown>)?.command ?? (input as Record<string, unknown>)?.cmd;
    if (typeof cmd === "string") return `Bash: ${truncStr(cmd, 40)}`;
    return "Run command";
  }

  if (SEARCH_TOOLS.has(toolName) || SEARCH_TOOLS.has(base)) {
    const query = typeof input === "string" ? input : (input as Record<string, unknown>)?.query ?? (input as Record<string, unknown>)?.pattern;
    if (typeof query === "string") return `Search: ${truncStr(query, 40)}`;
    return "Search";
  }

  if (FETCH_TOOLS.has(toolName) || FETCH_TOOLS.has(base)) {
    const url = (input as Record<string, unknown>)?.url;
    if (typeof url === "string") return `Fetch: ${truncStr(url, 50)}`;
    return "Fetch URL";
  }

  if (MCP_TOOLS.has(toolName) || MCP_TOOLS.has(base)) {
    const action = (input as Record<string, unknown>)?.action;
    if (typeof action === "string") return `MCP: ${action}`;
    return "MCP call";
  }

  if (AGENT_TOOLS.has(toolName) || AGENT_TOOLS.has(base)) {
    return "Dispatch agent";
  }

  if (NMI_TOOLS.has(toolName) || NMI_TOOLS.has(base)) {
    const action = (input as Record<string, unknown>)?.action ?? "process";
    return `NMI: ${action}`;
  }

  if (SLACK_TOOLS.has(toolName) || SLACK_TOOLS.has(base)) {
    const action = (input as Record<string, unknown>)?.action ?? "message";
    return `Slack: ${action}`;
  }

  // 4. Fallback: inspect type prefix
  if (toolName.startsWith("mcp__")) {
    const server = toolName.match(/^mcp__(\w+)__/)?.[1] ?? "mcp";
    return `MCP/${server}`;
  }

  if (toolName.includes(".")) {
    const parts = toolName.split(".");
    const last = parts[parts.length - 1];
    return `${parts[0]}: ${last}`;
  }

  // 5. Generic
  const display = toolName
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
  const words = display.split(" ").filter(Boolean);
  if (words.length <= 3) return display;
  return words.slice(0, 3).join(" ") + "…";
}

/**
 * Generate a preview for the tool output/result.
 */
export function generateResultPreview(
  toolName: string,
  output?: PreviewOutput,
): string | null {
  if (!output) return null;

  if (typeof output === "string") {
    return firstLine(output);
  }

  if (Array.isArray(output)) {
    return `${output.length} results`;
  }

  if (typeof output === "object") {
    const keys = Object.keys(output as Record<string, unknown>);
    const topKeys = keys.slice(0, 3).join(", ");
    return keys.length > 3 ? `${topKeys}…` : topKeys || "{}";
  }

  return String(output).slice(0, 40);
}
