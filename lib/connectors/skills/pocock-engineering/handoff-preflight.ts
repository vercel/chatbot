/**
 * Handoff Pre-Flight — Beautiful Handoff context compressor
 *
 * Performs a lightweight /grill before handing off to V2 or VPS:
 *   1. Compress goal to 1 sentence
 *   2. Classify quick-fix vs long-task
 *   3. Strip conversational filler
 *   4. Attach relevant artifact pointers
 *
 * Called before creating agent sessions to ensure clean context
 * no matter how the user phrased the request.
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface CompressedGoal {
  /** 1-sentence compressed goal */
  oneLiner: string;
  /** Detected lane */
  lane: "v2" | "vps";
  /** Task type */
  taskType: "quick_fix" | "investigation" | "modify_existing" | "new_project";
  /** Key context extracted */
  context: string;
  /** Detected repo(s) */
  repos: string[];
  /** Confidence in lane detection (0–1) */
  confidence: number;
  /** Warnings about the compression */
  warnings: string[];
}

// ── Compression ────────────────────────────────────────────────────────────

const MAX_ONE_LINER_CHARS = 200;
const FILLER_PATTERNS = [
  /^(can you|could you|please|hey|hi|ok so|so basically|i need you to)\s+/i,
  /^(i want|i need|i'd like)\s+(you\s+)?to\s+/i,
  /^(help me|help)\s+/i,
  /\b(please|just|basically|literally|like)\b/gi,
  /\b(um+|uh+|er+)\b/gi,
  /\s+/g,
];

function stripFiller(text: string): string {
  let cleaned = text;
  for (const pattern of FILLER_PATTERNS.slice(0, 5)) {
    cleaned = cleaned.replace(pattern, "");
  }
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

function compressToOneLine(text: string): string {
  const cleaned = stripFiller(text);

  // If already short, return as-is
  if (cleaned.length <= MAX_ONE_LINER_CHARS) return cleaned;

  // Truncate with smart boundary
  const truncated = cleaned.slice(0, MAX_ONE_LINER_CHARS);
  const lastSpace = truncated.lastIndexOf(" ");
  const final = lastSpace > MAX_ONE_LINER_CHARS * 0.7
    ? truncated.slice(0, lastSpace) + "..."
    : truncated + "...";

  return final;
}

// ── Lane Detection ─────────────────────────────────────────────────────────

const V2_KEYWORDS = [
  "refactor", "multi-file", "multi file", "pull request", "create pr",
  "scaffold", "bootstrap", "migration", "rewrite", "new project",
  "build a", "create a new", "set up", "deploy", "ui component",
  "design system", "database schema", "api endpoint", "test suite",
  "full feature", "entire", "codebase",
];

const VPS_KEYWORDS = [
  "fix", "check", "run", "query", "look up", "find", "analyze",
  "debug", "inspect", "show", "get", "read", "what is", "how many",
  "why is", "audit", "review", "list", "summarize", "quick",
  "report", "status", "health check",
];

function detectTaskType(text: string) {
  const lower = text.toLowerCase();

  for (const kw of ["new project", "scaffold", "bootstrap", "greenfield"]) {
    if (lower.includes(kw)) return "new_project" as const;
  }
  for (const kw of ["refactor", "modify", "change", "update", "fix"]) {
    if (lower.includes(kw)) return "modify_existing" as const;
  }
  for (const kw of ["investigate", "research", "audit", "analyze", "understand", "why"]) {
    if (lower.includes(kw)) return "investigation" as const;
  }

  return "quick_fix" as const;
}

// ── Main Pre-Flight ────────────────────────────────────────────────────────

export function preflightHandoff(
  goal: string,
  options: {
    preferredLane?: "v2" | "vps";
    repo?: string;
    context?: string;
  } = {}
): CompressedGoal {
  const oneLiner = compressToOneLine(goal);
  const lower = goal.toLowerCase();
  const taskType = detectTaskType(goal);
  const repos: string[] = options.repo ? [options.repo] : [];
  const warnings: string[] = [];

  // Auto-detect lane
  let lane: "v2" | "vps";
  let confidence = 0.5;

  if (options.preferredLane) {
    lane = options.preferredLane;
    confidence = 0.9;
  } else {
    const v2Score = V2_KEYWORDS.filter((kw) => lower.includes(kw)).length;
    const vpsScore = VPS_KEYWORDS.filter((kw) => lower.includes(kw)).length;

    if (v2Score > vpsScore) {
      lane = "v2";
      confidence = Math.min(0.5 + v2Score * 0.15, 0.95);
    } else if (vpsScore > v2Score) {
      lane = "vps";
      confidence = Math.min(0.5 + vpsScore * 0.15, 0.95);
    } else if (goal.length > 500) {
      lane = "v2";
      confidence = 0.6;
    } else {
      lane = "vps";
      confidence = 0.6;
    }
  }

  // Detect repos from text
  const repoMatch = goal.match(/(?:in|on|for)\s+(?:the\s+)?(\S+)\s+repo/i);
  if (repoMatch && !repos.length) {
    repos.push(repoMatch[1]);
  }

  // Warnings
  if (oneLiner.length > MAX_ONE_LINER_CHARS) {
    warnings.push("Goal truncated — may lose nuance. Consider using /grill first.");
  }
  if (goal.length < 20) {
    warnings.push("Goal is very short — context may be insufficient.");
  }
  if (confidence < 0.7) {
    warnings.push(`Low lane confidence (${(confidence * 100).toFixed(0)}%). Lane may be suboptimal.`);
  }

  return {
    oneLiner,
    lane,
    taskType,
    context: options.context || "",
    repos,
    confidence,
    warnings,
  };
}

/**
 * Compress context for agent session creation.
 * Used by both V2 and VPS handoff flows.
 */
export function compressForHandoff(goal: string, context?: string): {
  compressedGoal: string;
  compressedContext: string;
  maxChars: number;
} {
  const compressed = preflightHandoff(goal);
  const maxChars = 2000;
  let compressedContext = context || "";

  if (compressedContext.length > maxChars) {
    compressedContext = compressedContext.slice(0, maxChars - 100) + "\n\n[Context truncated for handoff — use full context in V2/VPS session]";
  }

  return {
    compressedGoal: compressed.oneLiner,
    compressedContext,
    maxChars,
  };
}
