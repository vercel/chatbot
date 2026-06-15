/**
 * Phase 14 — Playbook Model Router
 *
 * Reads playbook frontmatter `model_routing` blocks and selects the best model
 * for a given task type / domain. Falls back to progressive disclosure defaults.
 *
 * Frontmatter format (per playbook .md):
 *   model_routing:
 *     default: "deepseek/deepseek-v4-pro"
 *     reasoning_heavy: "anthropic/claude-opus-4-6"
 *     fast_iteration: "deepseek/deepseek-v4-flash"
 *     coding: "deepseek/deepseek-v4-pro"
 *     vision: "google/gemini-2-flash"
 *     cheap: "groq/llama-4-maverick"
 *     long_context: "google/gemini-2-pro"
 *
 * Priority tiers when no frontmatter routing is defined:
 *   1. Playbook-specific model stored in library_playbooks metadata
 *   2. Domain-based heuristics (coding → deepseek, vision → gemini, etc.)
 *   3. Global default: deepseek/deepseek-v4-pro
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { DEFAULT_CHAT_MODEL } from "./models";

// ── Types ──────────────────────────────────────────────────────────────────

export type ModelRoutingTier =
  | "default"
  | "reasoning_heavy"
  | "fast_iteration"
  | "coding"
  | "vision"
  | "cheap"
  | "long_context"
  | "streaming"
  | "json_output";

export interface ModelRoutingConfig {
  default: string;
  reasoning_heavy?: string;
  fast_iteration?: string;
  coding?: string;
  vision?: string;
  cheap?: string;
  long_context?: string;
  streaming?: string;
  json_output?: string;
}

export interface ModelRoutingResult {
  modelId: string;
  tier: ModelRoutingTier;
  source: "playbook_frontmatter" | "domain_heuristic" | "global_default";
  playbookName?: string;
  reasoning: string;
}

// ── Domain-Based Heuristics ────────────────────────────────────────────────

const DOMAIN_DEFAULT_MODELS: Record<string, string> = {
  "billing-flow": "deepseek/deepseek-v4-pro",
  "credit-disputes": "anthropic/claude-sonnet-4-6",
  "customer-enrollment": "deepseek/deepseek-v4-pro",
  "compliance-audit": "anthropic/claude-sonnet-4-6",
  "support-triage": "deepseek/deepseek-v4-flash",
  "agent-payments": "deepseek/deepseek-v4-pro",
  reporting: "deepseek/deepseek-v4-pro",
  "customer-comms": "deepseek/deepseek-v4-flash",
  "lead-flow": "moonshotai/kimi-k2.5",
  "mcp-edits": "deepseek/deepseek-v4-pro",
  "deploy-vercel-github": "deepseek/deepseek-v4-pro",
  engineering: "deepseek/deepseek-v4-pro",
  "vps-ops": "deepseek/deepseek-v4-flash",
  "code-review": "deepseek/deepseek-v4-pro",
  "debugging-incident": "anthropic/claude-sonnet-4-6",
  "feature-build": "deepseek/deepseek-v4-pro",
  "system-audit": "anthropic/claude-sonnet-4-6",
  "planning-research": "anthropic/claude-sonnet-4-6",
};

const DOMAIN_TIER_MODELS: Record<string, Partial<ModelRoutingConfig>> = {
  "billing-flow": {
    reasoning_heavy: "anthropic/claude-sonnet-4-6",
    fast_iteration: "deepseek/deepseek-v4-flash",
  },
  engineering: {
    coding: "deepseek/deepseek-v4-pro",
    reasoning_heavy: "anthropic/claude-opus-4-6",
    fast_iteration: "deepseek/deepseek-v4-flash",
  },
  "code-review": {
    coding: "deepseek/deepseek-v4-pro",
    reasoning_heavy: "anthropic/claude-sonnet-4-6",
  },
  "debugging-incident": {
    reasoning_heavy: "anthropic/claude-opus-4-6",
    coding: "deepseek/deepseek-v4-pro",
  },
};

// ── Playbook Frontmatter Parsing ───────────────────────────────────────────

function parseFrontmatter(rawContent: string): Record<string, unknown> {
  const match = rawContent.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const lines = match[1].split("\n");
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;
  const currentArray: unknown[] = [];

  for (const line of lines) {
    // Array item
    const arrayMatch = line.match(/^\s+-\s+(.+)/);
    if (arrayMatch && currentKey) {
      currentArray.push(arrayMatch[1].trim().replace(/^["']|["']$/g, ""));
      result[currentKey] = [...currentArray];
      continue;
    }

    // Key-value pair
    const kvMatch = line.match(/^(\w[\w_]*):\s*(.*)/);
    if (kvMatch) {
      // Flush previous array
      if (currentKey && currentArray.length > 0) {
        result[currentKey] = [...currentArray];
      }
      currentKey = kvMatch[1];
      const value = kvMatch[2].trim();
      if (value === "") {
        currentArray.length = 0; // start new array
        result[currentKey] = [];
      } else if (value === "true") {
        result[currentKey] = true;
      } else if (value === "false") {
        result[currentKey] = false;
      } else if (/^\d+$/.test(value)) {
        result[currentKey] = parseInt(value, 10);
      } else if (/^\d+\.\d+$/.test(value)) {
        result[currentKey] = parseFloat(value);
      } else {
        result[currentKey] = value.replace(/^["']|["']$/g, "");
      }
    }
    // Nested object key
    const nestedMatch = line.match(/^\s{2}(\w[\w_]*):\s*(.*)/);
    if (nestedMatch && currentKey) {
      const nestedKey = nestedMatch[1];
      const nestedValue = nestedMatch[2].trim().replace(/^["']|["']$/g, "");
      const existing = result[currentKey];
      if (typeof existing === "object" && existing !== null && !Array.isArray(existing)) {
        (existing as Record<string, unknown>)[nestedKey] = nestedValue;
      } else {
        result[currentKey] = { [nestedKey]: nestedValue };
      }
    }
  }

  return result;
}

function findPlaybookFile(domain: string): string | null {
  const cwd = process.cwd();

  // Phase 21 V3: Try fractal library canonical paths first
  const fractalPlaybooksDir = join(cwd, "connectors/neptune/skills/custom-skills/playbook-skills/playbooks");
  if (existsSync(fractalPlaybooksDir)) {
    for (const name of [
      `playbook-${domain}.md`,
      `playbook-${domain.replace(/-/g, "")}.md`,
      `${domain}.md`,
    ]) {
      const p = join(fractalPlaybooksDir, name);
      if (existsSync(p)) return p;
    }
  }

  // Legacy paths (adapter pattern — backward compat)
  const playbooksRoot = join(cwd, "playbooks");
  const domainPath = join(playbooksRoot, domain);
  if (existsSync(domainPath)) {
    for (const name of ["playbook.md", "PLAYBOOK.md", `playbook-${domain}.md`]) {
      const p = join(domainPath, name);
      if (existsSync(p)) return p;
    }
  }

  for (const name of ["playbook.md", "PLAYBOOK.md", `playbook-${domain}.md`]) {
    const p = join(playbooksRoot, name);
    if (existsSync(p)) return p;
  }

  return null;
}

function readModelRoutingFromFile(filePath: string): ModelRoutingConfig | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const fm = parseFrontmatter(content);
    const routing = fm.model_routing as ModelRoutingConfig | undefined;
    return routing || null;
  } catch {
    return null;
  }
}

// ── Tier Detection from Intent ─────────────────────────────────────────────

function detectTier(intentTags: string[], messageContent: string): ModelRoutingTier {
  const text = [messageContent, ...intentTags].join(" ").toLowerCase();

  const tierSignals: [RegExp, ModelRoutingTier][] = [
    [/debug|trace|investigate|why is|what caused|root cause/, "reasoning_heavy"],
    [/code|refactor|implement|build|write|function|component|class/, "coding"],
    [/quick|fast|summarize|tl;dr|brief/, "fast_iteration"],
    [/image|photo|picture|screenshot|vision|ocr|describe this/, "vision"],
    [/cheap|bulk|batch|scale|many|thousands|classify/, "cheap"],
    [/long doc|context|memory|remember|full conversation|all messages/, "long_context"],
    [/json|schema|structured|format|parse|extract/, "json_output"],
    [/stream|realtime|live|continuous/, "streaming"],
  ];

  for (const [regex, tier] of tierSignals) {
    if (regex.test(text)) return tier;
  }

  return "default";
}

// ── Main Router ────────────────────────────────────────────────────────────

export function routeModelForPlaybook(params: {
  domain: string;
  intentTags?: string[];
  messageContent?: string;
  forceTier?: ModelRoutingTier;
}): ModelRoutingResult {
  const { domain, intentTags = [], messageContent = "", forceTier } = params;

  const tier: ModelRoutingTier = forceTier ?? detectTier(intentTags, messageContent);

  // 1. Try playbook frontmatter
  const filePath = findPlaybookFile(domain);
  if (filePath) {
    const routing = readModelRoutingFromFile(filePath);
    if (routing) {
      const tierModel = routing[tier];
      const modelId = tierModel || routing.default;
      if (modelId) {
        return {
          modelId,
          tier,
          source: "playbook_frontmatter",
          playbookName: domain,
          reasoning: tierModel
            ? `Matched tier "${tier}" in playbook ${domain} frontmatter model_routing`
            : `Using playbook ${domain} default model`,
        };
      }
    }
  }

  // 2. Domain heuristics
  const domainTier = DOMAIN_TIER_MODELS[domain];
  if (domainTier) {
    const tierModel = domainTier[tier];
    const domainDefault = DOMAIN_DEFAULT_MODELS[domain];
    const modelId = tierModel || domainDefault || DEFAULT_CHAT_MODEL;
    if (modelId) {
      return {
        modelId,
        tier,
        source: "domain_heuristic",
        playbookName: domain,
        reasoning: tierModel
          ? `Domain "${domain}" heuristic for tier "${tier}" → ${modelId}`
          : `Domain "${domain}" default heuristic → ${modelId}`,
      };
    }
  }

  // 3. Global fallback
  return {
    modelId: DEFAULT_CHAT_MODEL,
    tier,
    source: "global_default",
    reasoning: `No routing config found for domain "${domain}" or tier "${tier}". Falling back to global default.`,
  };
}

/**
 * Resolve model routing for a playbook + task combination, with DB fallback.
 * Used during progressive disclosure loading.
 */
export async function resolveModelForPlaybook(params: {
  domain: string;
  intentTags?: string[];
  messageContent?: string;
  forceTier?: ModelRoutingTier;
  preferredModel?: string;
}): Promise<ModelRoutingResult> {
  // If user explicitly selected a model, honor it
  if (params.preferredModel) {
    return {
      modelId: params.preferredModel,
      tier: "default",
      source: "global_default",
      reasoning: "User explicitly selected this model",
    };
  }

  return routeModelForPlaybook(params);
}

/**
 * Get all available routing tiers with their recommended models for a domain.
 */
export function getAllTierRecommendations(domain: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Start with global defaults
  result.default = DEFAULT_CHAT_MODEL;

  // Override with domain heuristics
  const domainDefaults = DOMAIN_DEFAULT_MODELS[domain];
  if (domainDefaults) result.default = domainDefaults;

  const domainTiers = DOMAIN_TIER_MODELS[domain];
  if (domainTiers) {
    for (const [tier, model] of Object.entries(domainTiers)) {
      if (model) result[tier] = model;
    }
  }

  // Override with playbook frontmatter if available
  const filePath = findPlaybookFile(domain);
  if (filePath) {
    const routing = readModelRoutingFromFile(filePath);
    if (routing) {
      if (routing.default) result.default = routing.default;
      for (const tier of [
        "reasoning_heavy",
        "fast_iteration",
        "coding",
        "vision",
        "cheap",
        "long_context",
        "streaming",
        "json_output",
      ] as ModelRoutingTier[]) {
        if (routing[tier]) result[tier] = routing[tier]!;
      }
    }
  }

  return result;
}
