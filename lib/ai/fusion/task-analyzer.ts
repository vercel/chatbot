/**
 * Phase 23A: Task Analyzer
 *
 * Analyzes the user's message + conversation context to determine:
 *   - Task type (question/task/project/investigation)
 *   - Scope (single/multi-step/multi-faceted)
 *   - Whether council (accuracy) or swarm (efficiency) or hybrid is best
 *
 * Phase 23A: Always returns 'council' — full analyzer in Phase 23B.
 */

import type { PanelMode, TaskAnalysis, TaskScope, TaskType } from "./types";

// ── Heuristic Detection ──────────────────────────────────────────────

const COUNCIL_SIGNALS = [
  /should\s+(i|we)\b/i,
  /what('s|\s+is)\s+the\s+best/i,
  /how\s+do\s+(i|we)\s+choose/i,
  /compare\s+(X\s+)?and\s+Y/i,
  /which\s+(is|one)\s+(is\s+)?better/i,
  /review\s+(this|the|my)\s+(code|PRD|plan|architecture)/i,
  /verify\b/i,
  /validate\b/i,
  /assess\b/i,
  /evaluate\b/i,
  /analyze\s+(this|the)\b/i,
  /explain\b/i,
  /why\b/i,
  /strategy\b/i,
  /approach\b/i,
  /architecture\s+(decision|review)/i,
  /design\s+(review|decision)/i,
];

const SWARM_SIGNALS = [
  /build\b/i,
  /create\b/i,
  /generate\s+complete/i,
  /refactor\s+(entire|all|whole)/i,
  /implement\b/i,
  /scaffold\b/i,
  /write\s+(all|multiple|several)/i,
  /produce\b/i,
  /multi-?file/i,
  /multi-?step/i,
  /workflow\b/i,
  /pipeline\b/i,
  /end\s*-\s*to\s*-\s*end/i,
  /full\s+(stack|system|suite)/i,
  /complete\s+(package|report|suite)/i,
];

const HYBRID_SIGNALS = [
  /audit\s+and\s+(improve|fix|refactor)/i,
  /investigate\s+and\s+fix/i,
  /analyze\s+and\s+(implement|build|refactor)/i,
  /review\s+and\s+(improve|update)/i,
  /both\s+(design|plan|decide).*(?:and|&).*(?:build|implement|code)/i,
];

// ── Scope Detection ───────────────────────────────────────────────────

function detectScope(prompt: string): TaskScope {
  // Multi-faceted: hybrid signals
  if (HYBRID_SIGNALS.some((r) => r.test(prompt))) {
    return "multi-faceted";
  }

  // Multi-step: swarm signals + counts
  const swarmMatches = SWARM_SIGNALS.filter((r) => r.test(prompt)).length;
  if (swarmMatches >= 2) {
    return "multi-step";
  }

  // Check for multiple artifacts / files mentioned
  const artifacts = prompt.match(
    /(?:file|artifact|component|page|module|section)s?/gi
  );
  if (artifacts && artifacts.length >= 2) {
    return "multi-step";
  }

  return "single";
}

function detectType(prompt: string): TaskType {
  if (HYBRID_SIGNALS.some((r) => r.test(prompt))) {
    return "investigation";
  }
  if (SWARM_SIGNALS.some((r) => r.test(prompt))) {
    return "task";
  }
  if (/project/i.test(prompt) || /roadmap/i.test(prompt)) {
    return "project";
  }
  return "question";
}

// ── Main Analyzer ─────────────────────────────────────────────────────

const LAST_USER_MESSAGE_REGEX = /(?:^|\n)(?:User|Human):\s*(.+?)(?:\n|$)/i;

export function analyzeTask(
  prompt: string,
  _conversationContext?: Array<{ role: string; content: string }>
): TaskAnalysis {
  // Extract the last user message from conversation-like format
  const userMessage = extractLastUserMessage(prompt);

  const type = detectType(userMessage);
  const scope = detectScope(userMessage);

  // Phase 23A: Always recommend council
  // Phase 23B: Full analyzer with swarm/hybrid detection
  const recommendedMode: PanelMode = "council";

  const requiresAccuracy =
    COUNCIL_SIGNALS.some((r) => r.test(userMessage)) || scope === "single";

  const requiresDecomposition =
    SWARM_SIGNALS.some((r) => r.test(userMessage)) || scope === "multi-step";

  const estimatedSubTasks =
    scope === "multi-step" ? 3 : scope === "multi-faceted" ? 5 : 1;

  const reasoning = `Phase 23A: council mode for all tasks. Type=${type} Scope=${scope}. Accuracy={requiresAccuracy}, Decomposition={requiresDecomposition}`;

  return {
    type,
    scope,
    requiresAccuracy,
    requiresDecomposition,
    estimatedSubTasks,
    recommendedMode,
    reasoning,
  };
}

function extractLastUserMessage(text: string): string {
  const match = text.match(LAST_USER_MESSAGE_REGEX);
  return match ? match[1].trim() : text.trim().slice(0, 2000);
}

/**
 * Simple heuristic to detect if the message is a question (ends in ? or has question markers)
 */
export function isQuestion(prompt: string): boolean {
  return (
    prompt.trim().endsWith("?") ||
    /\b(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does|did)\b/i.test(
      prompt
    )
  );
}
