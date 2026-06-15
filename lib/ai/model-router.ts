/**
 * Model Router — Phase 20: Multi-Model Intelligent Routing
 *
 * Automatically selects the best model for each task type:
 *   - Planning/Architecture → Claude Sonnet 4.6
 *   - Coding/Technical      → Kimi K2.7
 *   - Long-context/Docs      → GLM 5.1
 *   - Multilingual           → Qwen 3 235B
 *   - Tool-heavy             → DeepSeek V4 Pro
 *   - General/Default        → DeepSeek V4 Pro
 *
 * Users can override with explicit model selection, or set per-task
 * preferences in /settings/models.
 */

import { DEFAULT_CHAT_MODEL, type ChatModel } from "./models";

// ── Types ───────────────────────────────────────────────────────────

export type TaskType =
  | "planning"       // Architecture, design, spec writing, PRD creation
  | "coding"         // Code generation, refactoring, bug fixes, implementation
  | "long_context"   // Large file analysis, multi-document synthesis, deep audit
  | "multilingual"   // Non-English queries, translation, multi-locale
  | "fast_chat"      // Quick Q&A, simple responses, greetings
  | "tool_heavy"     // Multi-tool orchestration, complex workflows
  | "reasoning"      // Complex logic, math, deep analysis, evaluation
  | "creative"       // Content creation, design ideas, writing, brainstorming
  | "analysis"       // Data analysis, pattern recognition, metrics
  | "general";       // Catch-all for unmatched intents

export interface RoutingRule {
  taskType: TaskType;
  primaryModel: string;
  fallbackModel: string;
  reasoning: string;
  /** Signal keywords that trigger this task type */
  signals: RegExp[];
}

export interface RoutingResult {
  modelId: string;
  taskType: TaskType;
  routed: boolean;
  rule: RoutingRule | null;
  reasoning: string;
}

// ── Routing Rules ───────────────────────────────────────────────────

const ROUTING_RULES: RoutingRule[] = [
  {
    taskType: "planning",
    primaryModel: "anthropic/claude-sonnet-4-6",
    fallbackModel: "deepseek/deepseek-v4-pro",
    reasoning: "Claude Sonnet 4.6 excels at structured planning with clear reasoning chains, architecture design, and specification writing",
    signals: [
      /plan/i, /design/i, /architecture/i, /spec/i, /roadmap/i,
      /structure/i, /system\s*design/i, /blueprint/i, /prd/i,
      /requirements/i, /proposal/i, /approach/i, /strategy/i,
    ],
  },
  {
    taskType: "coding",
    primaryModel: "moonshotai/kimi-k2.7",
    fallbackModel: "deepseek/deepseek-v4-pro",
    reasoning: "Kimi K2.7 is purpose-built for code generation, technical tasks, refactoring, and bug fixes",
    signals: [
      /code/i, /build/i, /implement/i, /scaffold/i, /component/i,
      /function/i, /api/i, /route/i, /fix/i, /debug/i, /refactor/i,
      /bug/i, /error/i, /compile/i, /type.*error/i, /import/i,
      /create.*component/i, /add.*page/i, /edit.*file/i,
    ],
  },
  {
    taskType: "long_context",
    primaryModel: "zai/glm-5.1",
    fallbackModel: "deepseek/deepseek-v4-pro",
    reasoning: "GLM 5.1 handles 202K tokens natively with vision, long-horizon autonomous tasks, and strong long-document synthesis",
    signals: [
      /analyze.*file/i, /review.*codebase/i, /audit/i, /comprehensive/i,
      /entire/i, /whole.*repo/i, /full.*audit/i, /deep.*dive/i,
      /across.*all/i, /every.*file/i, /bulk/i, /large.*document/i,
    ],
  },
  {
    taskType: "multilingual",
    primaryModel: "alibaba/qwen3-235b",
    fallbackModel: "deepseek/deepseek-v4-pro",
    reasoning: "Qwen 3 235B is trained on multilingual data across 100+ languages with strong cross-lingual reasoning",
    signals: [
      /[^\x00-\x7F]/, // Non-ASCII characters (Unicode)
      /spanish/i, /español/i, /french/i, /français/i,
      /chinese/i, /中文/i, /arabic/i, /عربي/i, /hindi/i,
      /translate/i, /multi.*language/i, /locale/i, /i18n/i,
    ],
  },
  {
    taskType: "fast_chat",
    primaryModel: "deepseek/deepseek-v4-flash",
    fallbackModel: "deepseek/deepseek-v3.2",
    reasoning: "Fastest response times for simple queries, greetings, and quick answers",
    signals: [
      /^(hi|hey|hello|yo|sup)\b/i,
      /what.*is/i, /how.*are.*you/i, /thanks/i, /thank/i,
      /simple.*question/i, /quick/i, /fast/i,
    ],
  },
  {
    taskType: "tool_heavy",
    primaryModel: "deepseek/deepseek-v4-pro",
    fallbackModel: "anthropic/claude-sonnet-4-6",
    reasoning: "DeepSeek V4 Pro has strong tool-use capabilities with lower cost per call",
    signals: [
      /using.*tools/i, /with.*tool/i, /orchestrat/i, /workflow/i,
      /pipeline/i, /multi.*step/i, /chain.*tool/i, /dispatch/i,
      /connector/i, /integration/i, /mcp/i,
    ],
  },
  {
    taskType: "reasoning",
    primaryModel: "deepseek/deepseek-v4-pro",
    fallbackModel: "alibaba/qwen3-235b",
    reasoning: "DeepSeek V4 Pro with reasoning effort for complex logical problems and analysis",
    signals: [
      /why/i, /explain/i, /analyze/i, /reason/i, /logic/i,
      /math/i, /calculate/i, /compare/i, /evaluate/i, /prove/i,
      /verify/i, /validate/i, /assess/i, /determine/i,
    ],
  },
  {
    taskType: "creative",
    primaryModel: "anthropic/claude-sonnet-4-6",
    fallbackModel: "alibaba/qwen3-235b",
    reasoning: "Claude excels at creative content, nuanced writing, and design ideation",
    signals: [
      /write/i, /create/i, /story/i, /blog/i, /article/i,
      /content/i, /design.*idea/i, /brainstorm/i, /draft/i,
      /creative/i, /copy.*write/i, /headline/i, /slogan/i,
    ],
  },
  {
    taskType: "analysis",
    primaryModel: "deepseek/deepseek-v4-pro",
    fallbackModel: "zai/glm-5.1",
    reasoning: "DeepSeek V4 Pro for structured analysis, GLM 5.1 for very large datasets",
    signals: [
      /data/i, /analytics/i, /metrics/i, /statistics/i,
      /pattern/i, /insight/i, /trend/i, /report/i,
      /benchmark/i, /score/i, /measure/i, /track/i,
    ],
  },
];

// ── Fallback rule (matched when nothing else matches) ──────────────

const FALLBACK_RULE: RoutingRule = {
  taskType: "general",
  primaryModel: DEFAULT_CHAT_MODEL,
  fallbackModel: "deepseek/deepseek-v3.2",
  reasoning: "Default to DeepSeek V4 Pro — best overall cost/performance ratio for general tasks",
  signals: [],
};

// ── Model validation ───────────────────────────────────────────────

const VALID_MODELS = new Set([
  // Direct models
  "deepseek-v4-pro",
  "deepseek-reasoner",
  // Gateway models
  "deepseek/deepseek-v4-pro",
  "deepseek/deepseek-v3.2",
  "deepseek/deepseek-v4-flash",
  "moonshotai/kimi-k2.5",
  "moonshotai/kimi-k2.7-code",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "xai/grok-4.1-fast-non-reasoning",
  "anthropic/claude-sonnet-4-6",
  "google/gemini-2-flash",
  "zai/glm-5",
  "zai/glm-5.1",
  "alibaba/qwen-3-235b",
]);

// ── User preferences (can be overridden at /settings/models) ───────

type UserModelPreferences = Partial<Record<TaskType, string>>;

let userPreferences: UserModelPreferences = {};

export function setUserModelPreferences(prefs: UserModelPreferences): void {
  userPreferences = { ...prefs };
}

export function getUserModelPreferences(): UserModelPreferences {
  return { ...userPreferences };
}

// ── Core Router ─────────────────────────────────────────────────────

/**
 * Detect the task type from the user's message content.
 * Checks signals in priority order — first match wins.
 * Non-ASCII detection is a special case: any non-ASCII char → multilingual.
 */
export function detectTaskType(userMessage: string): TaskType {
  // Special case: non-ASCII characters → multilingual
  if (/[^\x00-\x7F]/.test(userMessage)) {
    return "multilingual";
  }

  // Check all routing rules' signals in order
  for (const rule of ROUTING_RULES) {
    if (rule.taskType === "multilingual") continue; // Already checked above
    for (const signal of rule.signals) {
      if (signal.test(userMessage)) {
        return rule.taskType;
      }
    }
  }

  return "general";
}

/**
 * Find the routing rule for a given task type.
 */
export function getRoutingRule(taskType: TaskType): RoutingRule {
  const rule = ROUTING_RULES.find((r) => r.taskType === taskType);
  return rule ?? FALLBACK_RULE;
}

/**
 * Main router: determines the best model for the given input.
 *
 * @param userMessage - The user's message text
 * @param preferredModel - User's explicitly selected model (if any)
 * @returns RoutingResult with model ID, task type, and reasoning
 */
export function routeModel(
  userMessage: string,
  preferredModel?: string | null,
): RoutingResult {
  // User explicitly selected a model → honor it
  if (preferredModel) {
    // Validate the model ID
    if (VALID_MODELS.has(preferredModel)) {
      return {
        modelId: preferredModel,
        taskType: "general",
        routed: false,
        rule: null,
        reasoning: "User selected this model explicitly — honoring their choice",
      };
    }
    // Invalid model → fall back to default
    console.warn(
      `[model-router] Unknown model "${preferredModel}" — falling back to ${DEFAULT_CHAT_MODEL}`,
    );
  }

  // Detect task type from message
  const taskType = detectTaskType(userMessage);
  const rule = getRoutingRule(taskType);

  // Check for user preference override
  const userOverride = userPreferences[taskType];
  const modelId = userOverride ?? rule.primaryModel;

  return {
    modelId,
    taskType,
    routed: true,
    rule,
    reasoning: userOverride
      ? `User preference override for ${taskType} → ${modelId} (overriding default: ${rule.primaryModel})`
      : `${taskType} → ${modelId}: ${rule.reasoning}`,
  };
}

/**
 * Get the display name for a task type (used in UI badges).
 */
export function getTaskTypeLabel(taskType: TaskType): string {
  const labels: Record<TaskType, string> = {
    planning: "Planning",
    coding: "Coding",
    long_context: "Long Context",
    multilingual: "Multilingual",
    fast_chat: "Quick Chat",
    tool_heavy: "Tool Orchestration",
    reasoning: "Reasoning",
    creative: "Creative",
    analysis: "Analysis",
    general: "General",
  };
  return labels[taskType] ?? "General";
}

/**
 * Get the emoji icon for a task type (used in UI badges).
 */
export function getTaskTypeIcon(taskType: TaskType): string {
  const icons: Record<TaskType, string> = {
    planning: "🗺️",
    coding: "💻",
    long_context: "📚",
    multilingual: "🌐",
    fast_chat: "⚡",
    tool_heavy: "🔧",
    reasoning: "🧠",
    creative: "🎨",
    analysis: "📊",
    general: "🤖",
  };
  return icons[taskType] ?? "🤖";
}

/**
 * Get all routing rules (for settings page display).
 */
export function getAllRoutingRules(): RoutingRule[] {
  return [...ROUTING_RULES, FALLBACK_RULE];
}

/**
 * Validate that a model ID is in the known set.
 */
export function isValidModel(modelId: string): boolean {
  return VALID_MODELS.has(modelId);
}
