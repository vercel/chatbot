/**
 * Phase 23B: Task Analyzer (FULL)
 *
 * Analyzes the user's message + conversation context to determine:
 *   - Task type (question/task/project/investigation)
 *   - Scope (single/multi-step/multi-faceted)
 *   - Recommended mode: council / swarm / hybrid
 *
 * Uses heuristic pattern matching + keyword signals.
 */

import type {
  ConsensusInfo,
  PanelMode,
  TaskAnalysis,
  TaskScope,
  TaskType,
} from "./types";

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
  /create\s+complete/i,
  /generate\s+full/i,
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
  /choose\s+and\s+implement/i,
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

// ── Mode Recommendation (Phase 23B: FULL) ─────────────────────────────

function recommendMode(prompt: string, scope: TaskScope, type: TaskType): PanelMode {
  // Hybrid: decision AND execution both needed
  if (scope === "multi-faceted" || type === "investigation") {
    return "hybrid";
  }

  // Swarm: decomposition needed (multi-step, multi-file, build/create)
  if (
    scope === "multi-step" ||
    type === "task" ||
    type === "project" ||
    SWARM_SIGNALS.filter((r) => r.test(prompt)).length >= 2
  ) {
    return "swarm";
  }

  // Default: council for accuracy (single questions, reviews, decisions)
  return "council";
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

  // Phase 23B: Full analyzer — recommend council/swarm/hybrid
  const recommendedMode: PanelMode = recommendMode(userMessage, scope, type);

  const requiresAccuracy =
    COUNCIL_SIGNALS.some((r) => r.test(userMessage)) ||
    scope === "single" ||
    recommendedMode === "council";

  const requiresDecomposition =
    SWARM_SIGNALS.some((r) => r.test(userMessage)) ||
    scope === "multi-step" ||
    recommendedMode === "swarm" ||
    recommendedMode === "hybrid";

  const estimatedSubTasks =
    scope === "multi-faceted" ? 5 : scope === "multi-step" ? 3 : 1;

  const reasoning = `Detected: type=${type} scope=${scope} → recommended ${recommendedMode}. Accuracy needed: ${requiresAccuracy}. Decomposition needed: ${requiresDecomposition}. Estimated sub-tasks: ${estimatedSubTasks}.`;

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

// ── Phase 24: 3-Source Consensus Task Analysis ───────────────────────────

/**
 * Phase 24: 3-Source Consensus Task Analysis
 *
 * Source 1: Heuristic regex (existing analyzeTask)
 * Source 2: KG router query (routeIntent)
 * Source 3: LLM classifier (optional, cheap model via gateway)
 *
 * Returns consensus with confidence weighted by source agreement.
 */
export async function analyzeTaskWithKG(
  message: string,
  sessionId?: string,
  options?: { useLLM?: boolean }
): Promise<TaskAnalysis & { consensus: ConsensusInfo }> {
  // Source 1: Heuristic
  const heuristicResult = analyzeTask(message);

  // Source 2: KG router
  let kgResult: { primaryMode?: PanelMode; confidence: number } = {
    confidence: 0,
  };
  try {
    const { routeIntent } = await import("@/lib/ai/routing/kg-router");
    const routing = await routeIntent(message, sessionId);
    // Map playbook to mode based on playbook type
    if (routing.primary) {
      const slug = routing.primary.slug;
      // Execution-heavy playbooks -> swarm, analysis-heavy -> council, mixed -> hybrid
      if (["engineering", "deploy", "vps-ops", "billing"].includes(slug)) {
        kgResult.primaryMode = "swarm";
      } else if (
        ["planning", "reporting", "research"].includes(slug)
      ) {
        kgResult.primaryMode = "council";
      } else if (
        ["disputes", "customer-support"].includes(slug)
      ) {
        kgResult.primaryMode = "hybrid";
      }
      kgResult.confidence = routing.primary.confidence;
    }
  } catch (err) {
    console.warn(
      "[task-analyzer] KG routing failed, using heuristic only:",
      (err as Error).message
    );
  }

  // Consensus: if KG agrees with heuristic, boost confidence
  let consensusMode = heuristicResult.recommendedMode;
  let consensusConfidence = heuristicResult.confidence ?? 0.7;

  if (
    kgResult.primaryMode &&
    kgResult.primaryMode === heuristicResult.recommendedMode
  ) {
    // Agreement: boost confidence
    consensusConfidence = Math.min(
      (consensusConfidence + kgResult.confidence) / 2 + 0.1,
      1.0
    );
  } else if (kgResult.primaryMode && kgResult.confidence > 0.6) {
    // KG overrides heuristic with high confidence
    consensusMode = kgResult.primaryMode;
    consensusConfidence = kgResult.confidence;
  }

  const agreement: "full" | "partial" | "none" =
    kgResult.primaryMode === heuristicResult.recommendedMode
      ? "full"
      : kgResult.primaryMode
        ? "partial"
        : "none";

  return {
    ...heuristicResult,
    recommendedMode: consensusMode,
    confidence: consensusConfidence,
    consensus: {
      sources: {
        heuristic: {
          mode: heuristicResult.recommendedMode,
          confidence: heuristicResult.confidence ?? 0.7,
        },
        kg: {
          mode: kgResult.primaryMode || null,
          confidence: kgResult.confidence,
        },
        llm: null, // LLM classifier deferred (expensive)
      },
      agreement,
      reasoning:
        agreement === "full"
          ? "KG and heuristic agree on mode"
          : kgResult.confidence > 0.6
            ? "KG routing overrides heuristic with higher confidence"
            : "Heuristic used (KG confidence too low)",
    },
  };
}
