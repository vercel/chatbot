/**
 * intent-classifier.ts — Keyword-based intent routing for Neptune Chat.
 *
 * Classifies user input into one of 5 modes per the PRD:
 *   A) chat          — greetings, conversation, simple Q&A
 *   B) reasoning     — analyze, why, compare, complex thinking
 *   C) tool_call     — find, search, show me, data retrieval
 *   D) code_handoff  — build, refactor, fix bug, long coding
 *   E) workflow      — every, for each, pipeline, batch, orchestrate
 *
 * This is a FAST pre-filter (runs client-side or edge). The model can override.
 * Designed to be imported in the chat route for model selection decisions.
 */

export type IntentMode = 'chat' | 'reasoning' | 'tool_call' | 'code_handoff' | 'workflow';

export interface IntentClassification {
  mode: IntentMode;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
}

// ── PATTERN DEFINITIONS ────────────────────────────────────────────────
// Ordered from most specific → least specific.
// First match wins (higher confidence).

const INTENT_PATTERNS: Array<{ mode: IntentMode; confidence: 'high' | 'medium'; patterns: RegExp[] }> = [
  // ── CODE HANDOFF (build, refactor, fix, add feature) ────────────────
  {
    mode: 'code_handoff',
    confidence: 'high',
    patterns: [
      /\b(build|create|make|generate|write)\s+(me\s+)?(a|an|the)\s+(app|application|component|page|site|website|feature|function|api|endpoint|route|landing\s*page|dashboard|form|widget)\b/i,
      /\b(refactor|rewrite|restructure|clean\s*up|organize)\s+(the|this|my|our)\s+(code|component|file|function|module|app)\b/i,
      /\b(fix|debug|resolve|patch)\s+(the|this|a|an)\s+(bug|issue|error|problem|crash|type\s*error|lint)\b/i,
      /\b(add|implement|integrate|wire\s*up)\s+(a|an|the)\s+(feature|endpoint|route|component|page|api|middleware|hook|test)\b/i,
    ],
  },
  {
    mode: 'code_handoff',
    confidence: 'medium',
    patterns: [
      /\b(deploy|ship|push)\s+(to|this|the)\s+(vercel|production|prod|staging)\b/i,
      /\b(optimize|improve|speed\s*up)\s+(the|this)\s+(performance|build|bundle|load\s*time)\b/i,
      /\b(run|execute|start)\s+(the|a)\s+(test|test\s*suite|build|type\s*check|lint)\b/i,
      /\b(upgrade|update|bump)\s+(the|this|to)\s+(v\d|version|@[\d.]+|dependency|package)\b/i,
    ],
  },

  // ── WORKFLOW (every, for each, pipeline, batch) ─────────────────────
  {
    mode: 'workflow',
    confidence: 'high',
    patterns: [
      /\b(every|each|all)\s+(customer|user|file|record|item|entry|client)\b/i,
      /\b(for\s+each|iterate|loop\s+through|process\s+all)\b/i,
      /\b(batch|bulk|mass)\s+(process|update|migrate|import|export|charge|bill)\b/i,
      /\b(pipeline|orchestrat|workflow|automation|chain)\b/i,
    ],
  },

  // ── TOOL CALL (find, search, show me, data retrieval) ───────────────
  {
    mode: 'tool_call',
    confidence: 'high',
    patterns: [
      /\b(find|search|look\s*(up|for)|grep|locate)\s+(the|a|all|my|for)\b/i,
      /\b(show|display|fetch|pull|get|retrieve)\s+(me\s+)?(the|a|all|my)\s+(data|info|file|record|log|customer|transaction)\b/i,
      /\b(check|verify|confirm|validate)\s+(the|if|whether|that)\b/i,
      /\b(what|which|who|where|when)\s+(is|are|was|were)\s+(the|my|our)\b/i,
    ],
  },
  {
    mode: 'tool_call',
    confidence: 'medium',
    patterns: [
      /\b(list|enumerate|catalog|audit)\s+(all|the|my|our)\b/i,
      /\b(what'?s|what\s+is)\s+(the|my|our)\s+(status|state|balance|count|total)\b/i,
      /\b(how\s+many|how\s+much)\b/i,
    ],
  },

  // ── REASONING (analyze, why, compare, complex thinking) ─────────────
  {
    mode: 'reasoning',
    confidence: 'high',
    patterns: [
      /\b(analy[sz]e|diagnose|investigate|troubleshoot|audit)\s+(the|this|why|how)\b/i,
      /\b(compare|contrast|diff|versus|vs\.?)\s+(the|this|a|an)\b/i,
      /\b(explain|elaborate|clarify|break\s*down)\s+(the|this|why|how)\b/i,
      /\b(what\s+would|what\s+if|what\s+happens|is\s+it\s+possible)\b/i,
      /\b(pros\s+and\s+cons|trade[\s-]offs|advantages|disadvantages)\b/i,
    ],
  },
  {
    mode: 'reasoning',
    confidence: 'medium',
    patterns: [
      /\b(why|how\s+(does|do|is|are|can|should|would))\b/i,
      /\b(is\s+it\s+(safe|possible|a\s+good\s+idea|worth))\b/i,
      /\b(should\s+(i|we)|recommend|advise|suggest)\b/i,
      /\b(what\s+(are|is)\s+the\s+(best|optimal|right|recommended|fastest))\b/i,
    ],
  },

  // ── CHAT (greetings, conversation, fallback) ────────────────────────
  {
    mode: 'chat',
    confidence: 'high',
    patterns: [
      /\b(hi|hey|hello|yo|sup|good\s+(morning|afternoon|evening))\b/i,
      /\b(thanks|thank\s+you|appreciate|got\s+it|ok|okay|cool)\b/i,
      /\b(how\s+are\s+you|what'?s\s+up|how'?s\s+it\s+going)\b/i,
    ],
  },
];

// ── CLASSIFIER ──────────────────────────────────────────────────────────

export function classifyIntent(text: string): IntentClassification {
  if (!text || text.trim().length === 0) {
    return { mode: 'chat', confidence: 'high', matchedPatterns: ['empty_input'] };
  }

  const matchedPatterns: string[] = [];

  for (const group of INTENT_PATTERNS) {
    for (const pattern of group.patterns) {
      if (pattern.test(text)) {
        matchedPatterns.push(pattern.source.substring(0, 60));
      }
    }
    if (matchedPatterns.length > 0) {
      return {
        mode: group.mode,
        confidence: group.confidence,
        matchedPatterns: matchedPatterns.slice(0, 3),
      };
    }
  }

  // Default: chat with low confidence (no patterns matched)
  return { mode: 'chat', confidence: 'low', matchedPatterns: [] };
}

// ── MODEL SELECTION BY INTENT ──────────────────────────────────────────

/** Maps an intent mode to the recommended model ID. */
export const INTENT_MODEL_MAP: Record<IntentMode, string> = {
  chat: 'deepseek-v4-pro',
  reasoning: 'deepseek-reasoner',
  tool_call: 'deepseek/deepseek-v3.2',
  code_handoff: 'anthropic/claude-sonnet-4-6',
  workflow: 'deepseek/deepseek-v3.2',
};

/** Human-readable labels for display in the UI. */
export const INTENT_LABELS: Record<IntentMode, string> = {
  chat: 'Chat',
  reasoning: 'Deep Reasoning',
  tool_call: 'Tool Discovery',
  code_handoff: 'Code Handoff',
  workflow: 'Workflow',
};

/** Descriptions for tooltips / agent info. */
export const INTENT_DESCRIPTIONS: Record<IntentMode, string> = {
  chat: 'Fast, conversational responses for greetings, Q&A, and general chat.',
  reasoning: 'Deep analysis with step-by-step thinking for complex questions.',
  tool_call: 'Searches data, reads files, and discovers information using available tools.',
  code_handoff: 'Hands off to Neptune Code for building, refactoring, and long coding sessions.',
  workflow: 'Orchestrates multi-step batch operations across many records.',
};

/**
 * Returns the recommended model for a given user message.
 * Use this in the chat route to auto-select models based on intent.
 */
export function getRecommendedModel(text: string, currentModel: string): {
  model: string;
  intent: IntentClassification;
  changed: boolean;
} {
  const intent = classifyIntent(text);

  // Don't override if the user explicitly chose a non-default model
  // (heuristic: only auto-switch if using the default chat model)
  if (currentModel !== DEFAULT_CHAT_MODEL_DETECT) {
    return { model: currentModel, intent, changed: false };
  }

  const recommended = INTENT_MODEL_MAP[intent.mode];

  // Only auto-switch on high-confidence non-chat intents
  if (intent.confidence === 'high' && intent.mode !== 'chat') {
    return { model: recommended, intent, changed: true };
  }

  return { model: currentModel, intent, changed: false };
}

// Re-export for convenience (avoids circular dep)
const DEFAULT_CHAT_MODEL_DETECT = 'deepseek-v4-pro';
