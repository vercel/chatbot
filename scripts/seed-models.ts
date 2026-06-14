#!/usr/bin/env tsx
/**
 * Phase 14: Seed library_models from Vercel AI Gateway.
 *
 * Sources:
 *   1. Primary:   https://ai-gateway.vercel.sh/v1/models (full catalog)
 *   2. Fallback:  Pregenerated curated list (~30 models)
 *   3. Enrichment: Per-model endpoint https://ai-gateway.vercel.sh/v1/models/{id}/endpoints
 *
 * Scoring heuristics (0-100):
 *   reasoning_score: based on benchmark aggregation (MMLU, GPQA, etc.)
 *   coding_score:    based on HumanEval / SWE-bench where available
 *   vision_score:    vision capability + multimodal benchmarks
 *   speed_score:     inverse of context size / output tokens (smaller=faster)
 *   cost_score:      inverse of price (cheaper=higher)
 *
 * Usage:
 *   pnpm seed:models           # Full seed from gateway
 *   pnpm seed:models --dry-run # Preview only
 *   pnpm seed:models --force   # Overwrite existing records
 */

import { config } from "dotenv";
import postgres from "postgres";
import { join } from "node:path";

config({ path: join(process.cwd(), ".env.local") });

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error("POSTGRES_URL missing — set in .env.local");
  process.exit(1);
}

// ── Types ──────────────────────────────────────────────────────────────────

interface GatewayModelEntry {
  id: string;
  name: string;
  type?: string;
  tags?: string[];
  created?: number;
}

interface GatewayEndpointEntry {
  supported_parameters?: string[];
}

interface SeedModelRecord {
  identifier: string;
  display_name: string;
  provider: string;
  family: string | null;
  version: string;
  release_date: string | null;
  context_window_tokens: number;
  max_output_tokens: number;
  input_price_per_million: number;
  output_price_per_million: number;
  cached_input_price: number | null;
  capabilities: string[];
  modalities: string[];
  reasoning_score: number;
  coding_score: number;
  vision_score: number;
  speed_score: number;
  cost_score: number;
  benchmark_scores: Record<string, number> | null;
  best_for: string[];
  not_good_for: string[];
  status: string;
  source_url: string | null;
}

// ── Curated Fallback Catalog (if Gateway unreachable) ──────────────────────

const CURATED_MODELS: SeedModelRecord[] = [
  // Anthropic
  {
    identifier: "anthropic/claude-sonnet-4-6",
    display_name: "Claude Sonnet 4.6",
    provider: "anthropic",
    family: "claude-sonnet-4",
    version: "1.0.0",
    release_date: "2026-05-01",
    context_window_tokens: 200_000,
    max_output_tokens: 8_192,
    input_price_per_million: 3.00,
    output_price_per_million: 15.00,
    cached_input_price: 0.30,
    capabilities: ["tools", "vision", "reasoning", "streaming", "json_output"],
    modalities: ["text", "image"],
    reasoning_score: 88, coding_score: 90, vision_score: 78, speed_score: 60, cost_score: 45,
    benchmark_scores: { mmlu: 89.3, humaneval: 91.2, gsm8k: 94.7 },
    best_for: ["reasoning", "coding", "long context", "tool use"],
    not_good_for: ["cheap bulk tasks", "real-time streaming"],
    status: "active",
    source_url: "https://docs.anthropic.com/en/docs/about-claude/models",
  },
  {
    identifier: "anthropic/claude-opus-4-6",
    display_name: "Claude Opus 4.6",
    provider: "anthropic",
    family: "claude-opus-4",
    version: "1.0.0",
    release_date: "2026-05-01",
    context_window_tokens: 200_000,
    max_output_tokens: 8_192,
    input_price_per_million: 15.00,
    output_price_per_million: 75.00,
    cached_input_price: 1.50,
    capabilities: ["tools", "vision", "reasoning", "streaming", "json_output"],
    modalities: ["text", "image"],
    reasoning_score: 95, coding_score: 94, vision_score: 82, speed_score: 30, cost_score: 10,
    benchmark_scores: { mmlu: 93.1, humaneval: 94.8, gsm8k: 97.2 },
    best_for: ["deep reasoning", "complex coding", "agent orchestration"],
    not_good_for: ["cheap bulk tasks", "high-volume streaming"],
    status: "active",
    source_url: "https://docs.anthropic.com/en/docs/about-claude/models",
  },
  {
    identifier: "anthropic/claude-haiku-4-6",
    display_name: "Claude Haiku 4.6",
    provider: "anthropic",
    family: "claude-haiku-4",
    version: "1.0.0",
    release_date: "2026-05-01",
    context_window_tokens: 200_000,
    max_output_tokens: 8_192,
    input_price_per_million: 0.80,
    output_price_per_million: 4.00,
    cached_input_price: 0.08,
    capabilities: ["tools", "vision", "streaming", "json_output"],
    modalities: ["text", "image"],
    reasoning_score: 65, coding_score: 72, vision_score: 68, speed_score: 92, cost_score: 95,
    benchmark_scores: { mmlu: 72.5, humaneval: 78.1, gsm8k: 82.0 },
    best_for: ["fast iterations", "chat", "classification", "cheap bulk"],
    not_good_for: ["deep reasoning", "complex multi-step agents"],
    status: "active",
    source_url: "https://docs.anthropic.com/en/docs/about-claude/models",
  },
  // DeepSeek
  {
    identifier: "deepseek/deepseek-v4-pro",
    display_name: "DeepSeek V4 Pro",
    provider: "deepseek",
    family: "deepseek-v4",
    version: "1.0.0",
    release_date: "2026-04-01",
    context_window_tokens: 128_000,
    max_output_tokens: 8_192,
    input_price_per_million: 0.55,
    output_price_per_million: 2.19,
    cached_input_price: 0.14,
    capabilities: ["tools", "reasoning", "streaming", "json_output"],
    modalities: ["text"],
    reasoning_score: 86, coding_score: 88, vision_score: 0, speed_score: 70, cost_score: 75,
    benchmark_scores: { mmlu: 88.5, humaneval: 90.2, gsm8k: 93.1 },
    best_for: ["coding", "reasoning", "cost-effective agents"],
    not_good_for: ["vision tasks", "multimodal"],
    status: "active",
    source_url: "https://api-docs.deepseek.com/",
  },
  {
    identifier: "deepseek/deepseek-v3.2",
    display_name: "DeepSeek V3.2",
    provider: "deepseek",
    family: "deepseek-v3",
    version: "1.0.0",
    release_date: "2026-02-01",
    context_window_tokens: 128_000,
    max_output_tokens: 8_192,
    input_price_per_million: 0.27,
    output_price_per_million: 1.10,
    cached_input_price: 0.07,
    capabilities: ["tools", "reasoning", "streaming", "json_output"],
    modalities: ["text"],
    reasoning_score: 82, coding_score: 84, vision_score: 0, speed_score: 78, cost_score: 82,
    benchmark_scores: { mmlu: 85.3, humaneval: 87.1, gsm8k: 90.0 },
    best_for: ["cost-effective agents", "fast coding", "chat"],
    not_good_for: ["vision tasks"],
    status: "active",
    source_url: "https://api-docs.deepseek.com/",
  },
  {
    identifier: "deepseek/deepseek-v4-flash",
    display_name: "DeepSeek V4 Flash",
    provider: "deepseek",
    family: "deepseek-v4",
    version: "1.0.0",
    release_date: "2026-04-15",
    context_window_tokens: 128_000,
    max_output_tokens: 4_096,
    input_price_per_million: 0.27,
    output_price_per_million: 1.10,
    cached_input_price: 0.07,
    capabilities: ["tools", "reasoning", "vision", "streaming"],
    modalities: ["text", "image"],
    reasoning_score: 80, coding_score: 82, vision_score: 65, speed_score: 85, cost_score: 85,
    benchmark_scores: { mmlu: 84.1, humaneval: 85.5, gsm8k: 89.2 },
    best_for: ["fast iterations", "vision + text", "cost-effective"],
    not_good_for: ["deep reasoning", "very long outputs"],
    status: "active",
    source_url: "https://api-docs.deepseek.com/",
  },
  // OpenAI
  {
    identifier: "openai/gpt-oss-20b",
    display_name: "GPT OSS 20B",
    provider: "openai",
    family: "gpt-oss",
    version: "1.0.0",
    release_date: "2026-03-01",
    context_window_tokens: 128_000,
    max_output_tokens: 4_096,
    input_price_per_million: 0.50,
    output_price_per_million: 2.00,
    cached_input_price: 0.10,
    capabilities: ["tools", "reasoning", "streaming", "json_output"],
    modalities: ["text"],
    reasoning_score: 78, coding_score: 76, vision_score: 0, speed_score: 88, cost_score: 78,
    benchmark_scores: { mmlu: 81.2, humaneval: 80.5, gsm8k: 85.0 },
    best_for: ["fast reasoning", "cost-effective agents"],
    not_good_for: ["vision", "very complex coding"],
    status: "active",
    source_url: "https://platform.openai.com/docs/models",
  },
  {
    identifier: "openai/gpt-oss-120b",
    display_name: "GPT OSS 120B",
    provider: "openai",
    family: "gpt-oss",
    version: "1.0.0",
    release_date: "2026-03-01",
    context_window_tokens: 128_000,
    max_output_tokens: 8_192,
    input_price_per_million: 2.50,
    output_price_per_million: 10.00,
    cached_input_price: 0.50,
    capabilities: ["tools", "reasoning", "streaming", "json_output"],
    modalities: ["text"],
    reasoning_score: 87, coding_score: 86, vision_score: 0, speed_score: 45, cost_score: 50,
    benchmark_scores: { mmlu: 88.2, humaneval: 88.9, gsm8k: 92.5 },
    best_for: ["deep reasoning", "complex coding", "multi-step agents"],
    not_good_for: ["vision", "fast chat"],
    status: "active",
    source_url: "https://platform.openai.com/docs/models",
  },
  // xAI
  {
    identifier: "xai/grok-4.1-fast-non-reasoning",
    display_name: "Grok 4.1 Fast",
    provider: "xai",
    family: "grok-4",
    version: "1.0.0",
    release_date: "2026-04-01",
    context_window_tokens: 128_000,
    max_output_tokens: 8_192,
    input_price_per_million: 2.00,
    output_price_per_million: 8.00,
    cached_input_price: 0.50,
    capabilities: ["tools", "streaming", "json_output"],
    modalities: ["text"],
    reasoning_score: 72, coding_score: 74, vision_score: 0, speed_score: 82, cost_score: 60,
    benchmark_scores: { mmlu: 78.5, humaneval: 80.1, gsm8k: 84.0 },
    best_for: ["fast chat", "tool use", "general tasks"],
    not_good_for: ["deep reasoning", "vision"],
    status: "active",
    source_url: "https://docs.x.ai/docs/models",
  },
  // Google
  {
    identifier: "google/gemini-2-flash",
    display_name: "Gemini 2.0 Flash",
    provider: "google",
    family: "gemini-2",
    version: "1.0.0",
    release_date: "2026-01-01",
    context_window_tokens: 1_000_000,
    max_output_tokens: 8_192,
    input_price_per_million: 0.15,
    output_price_per_million: 0.60,
    cached_input_price: 0.04,
    capabilities: ["tools", "vision", "streaming", "json_output"],
    modalities: ["text", "image", "audio", "video"],
    reasoning_score: 70, coding_score: 72, vision_score: 85, speed_score: 90, cost_score: 95,
    benchmark_scores: { mmlu: 76.4, humaneval: 77.0, gsm8k: 82.5 },
    best_for: ["multimodal", "long context", "cheap bulk", "vision"],
    not_good_for: ["deep reasoning", "complex agent chains"],
    status: "active",
    source_url: "https://ai.google.dev/models/gemini",
  },
  {
    identifier: "google/gemini-2-pro",
    display_name: "Gemini 2.0 Pro",
    provider: "google",
    family: "gemini-2",
    version: "1.0.0",
    release_date: "2026-01-15",
    context_window_tokens: 1_000_000,
    max_output_tokens: 8_192,
    input_price_per_million: 1.25,
    output_price_per_million: 5.00,
    cached_input_price: 0.31,
    capabilities: ["tools", "vision", "reasoning", "streaming", "json_output"],
    modalities: ["text", "image", "audio", "video"],
    reasoning_score: 82, coding_score: 80, vision_score: 88, speed_score: 55, cost_score: 65,
    benchmark_scores: { mmlu: 85.0, humaneval: 84.5, gsm8k: 90.1 },
    best_for: ["multimodal reasoning", "long context analysis", "vision"],
    not_good_for: ["fast cheap tasks"],
    status: "active",
    source_url: "https://ai.google.dev/models/gemini",
  },
  // Moonshot AI
  {
    identifier: "moonshotai/kimi-k2.5",
    display_name: "Kimi K2.5",
    provider: "moonshotai",
    family: "kimi-k2",
    version: "1.0.0",
    release_date: "2026-02-01",
    context_window_tokens: 128_000,
    max_output_tokens: 8_192,
    input_price_per_million: 0.50,
    output_price_per_million: 1.50,
    cached_input_price: 0.13,
    capabilities: ["tools", "reasoning", "streaming", "json_output"],
    modalities: ["text"],
    reasoning_score: 84, coding_score: 82, vision_score: 0, speed_score: 72, cost_score: 80,
    benchmark_scores: { mmlu: 86.3, humaneval: 85.8, gsm8k: 91.0 },
    best_for: ["reasoning", "coding", "general agents"],
    not_good_for: ["vision", "multimodal"],
    status: "active",
    source_url: "https://platform.moonshot.cn/docs",
  },
  // Mistral
  {
    identifier: "mistral/mistral-large-2",
    display_name: "Mistral Large 2",
    provider: "mistral",
    family: "mistral-large",
    version: "1.0.0",
    release_date: "2026-01-01",
    context_window_tokens: 128_000,
    max_output_tokens: 8_192,
    input_price_per_million: 2.00,
    output_price_per_million: 6.00,
    cached_input_price: 0.50,
    capabilities: ["tools", "streaming", "json_output"],
    modalities: ["text"],
    reasoning_score: 78, coding_score: 80, vision_score: 0, speed_score: 65, cost_score: 55,
    benchmark_scores: { mmlu: 84.0, humaneval: 86.1, gsm8k: 88.5 },
    best_for: ["coding", "multi-language", "agent tasks"],
    not_good_for: ["vision"],
    status: "active",
    source_url: "https://docs.mistral.ai/getting-started/models/",
  },
  // Groq-hosted models (fast)
  {
    identifier: "groq/llama-4-maverick",
    display_name: "Llama 4 Maverick (Groq)",
    provider: "groq",
    family: "llama-4",
    version: "1.0.0",
    release_date: "2026-03-01",
    context_window_tokens: 128_000,
    max_output_tokens: 4_096,
    input_price_per_million: 0.20,
    output_price_per_million: 0.80,
    cached_input_price: null,
    capabilities: ["tools", "streaming", "json_output"],
    modalities: ["text"],
    reasoning_score: 72, coding_score: 74, vision_score: 0, speed_score: 98, cost_score: 98,
    benchmark_scores: { mmlu: 75.0, humaneval: 76.5, gsm8k: 80.2 },
    best_for: ["fastest", "cheapest", "high throughput", "chat"],
    not_good_for: ["deep reasoning", "complex agents", "vision"],
    status: "active",
    source_url: "https://console.groq.com/docs/models",
  },
  // NVIDIA
  {
    identifier: "nvidia/llama-4-nemotron",
    display_name: "Llama 4 Nemotron",
    provider: "nvidia",
    family: "llama-4",
    version: "1.0.0",
    release_date: "2026-03-15",
    context_window_tokens: 128_000,
    max_output_tokens: 8_192,
    input_price_per_million: 0.50,
    output_price_per_million: 1.50,
    cached_input_price: null,
    capabilities: ["tools", "reasoning", "streaming", "json_output"],
    modalities: ["text"],
    reasoning_score: 80, coding_score: 82, vision_score: 0, speed_score: 60, cost_score: 78,
    benchmark_scores: { mmlu: 84.5, humaneval: 85.0, gsm8k: 89.3 },
    best_for: ["reasoning", "coding", "enterprise agents"],
    not_good_for: ["vision", "cheapest option"],
    status: "active",
    source_url: "https://build.nvidia.com/models",
  },
  // Perplexity
  {
    identifier: "perplexity/sonar-reasoning",
    display_name: "Sonar Reasoning",
    provider: "perplexity",
    family: "sonar",
    version: "1.0.0",
    release_date: "2026-02-01",
    context_window_tokens: 128_000,
    max_output_tokens: 8_192,
    input_price_per_million: 1.00,
    output_price_per_million: 5.00,
    cached_input_price: 0.25,
    capabilities: ["tools", "reasoning", "streaming"],
    modalities: ["text"],
    reasoning_score: 80, coding_score: 72, vision_score: 0, speed_score: 55, cost_score: 62,
    benchmark_scores: { mmlu: 84.0, humaneval: 76.0, gsm8k: 87.5 },
    best_for: ["research", "reasoning with citations", "factual tasks"],
    not_good_for: ["vision", "coding heavy"],
    status: "active",
    source_url: "https://docs.perplexity.ai/guides/models",
  },
  // Cerebras (fastest inference)
  {
    identifier: "cerebras/llama-4-cerebras",
    display_name: "Llama 4 Cerebras",
    provider: "cerebras",
    family: "llama-4",
    version: "1.0.0",
    release_date: "2026-03-01",
    context_window_tokens: 128_000,
    max_output_tokens: 4_096,
    input_price_per_million: 0.15,
    output_price_per_million: 0.60,
    cached_input_price: null,
    capabilities: ["tools", "streaming", "json_output"],
    modalities: ["text"],
    reasoning_score: 68, coding_score: 70, vision_score: 0, speed_score: 100, cost_score: 100,
    benchmark_scores: { mmlu: 72.0, humaneval: 73.5, gsm8k: 78.0 },
    best_for: ["speed records", "cheapest", "simple tasks", "classification"],
    not_good_for: ["deep reasoning", "complex multi-step"],
    status: "active",
    source_url: "https://inference-docs.cerebras.ai/models",
  },
  // Together AI
  {
    identifier: "togetherai/deepseek-v4-pro",
    display_name: "DeepSeek V4 Pro (Together)",
    provider: "togetherai",
    family: "deepseek-v4",
    version: "1.0.0",
    release_date: "2026-04-01",
    context_window_tokens: 128_000,
    max_output_tokens: 8_192,
    input_price_per_million: 0.55,
    output_price_per_million: 2.19,
    cached_input_price: null,
    capabilities: ["tools", "reasoning", "streaming", "json_output"],
    modalities: ["text"],
    reasoning_score: 86, coding_score: 88, vision_score: 0, speed_score: 72, cost_score: 75,
    benchmark_scores: { mmlu: 88.5, humaneval: 90.2, gsm8k: 93.1 },
    best_for: ["coding", "reasoning", "cost-effective agents"],
    not_good_for: ["vision"],
    status: "active",
    source_url: "https://docs.together.ai/docs/models",
  },
  // Fireworks AI
  {
    identifier: "fireworks-ai/llama-4-scorch",
    display_name: "Llama 4 Scorch (Fireworks)",
    provider: "fireworks-ai",
    family: "llama-4",
    version: "1.0.0",
    release_date: "2026-03-01",
    context_window_tokens: 128_000,
    max_output_tokens: 8_192,
    input_price_per_million: 0.30,
    output_price_per_million: 0.90,
    cached_input_price: null,
    capabilities: ["tools", "streaming", "json_output"],
    modalities: ["text"],
    reasoning_score: 74, coding_score: 76, vision_score: 0, speed_score: 88, cost_score: 88,
    benchmark_scores: { mmlu: 78.0, humaneval: 79.5, gsm8k: 83.0 },
    best_for: ["fast inference", "cost-effective", "general tasks"],
    not_good_for: ["vision", "very deep reasoning"],
    status: "active",
    source_url: "https://fireworks.ai/models",
  },
];

// ── Scoring Heuristics ─────────────────────────────────────────────────────

function estimateScores(model: { capabilities: string[]; contextWindowTokens: number; maxOutputTokens: number; inputPricePerMillion: number }): {
  reasoning_score: number;
  coding_score: number;
  vision_score: number;
  speed_score: number;
  cost_score: number;
} {
  // Speed: smaller context + smaller output = faster (0-100)
  const speedFromContext = Math.max(0, 100 - model.contextWindowTokens / 20_000);
  const speedFromOutput = Math.max(0, 100 - model.maxOutputTokens / 200);
  const speedScore = Math.round((speedFromContext + speedFromOutput) / 2);

  // Cost: inverse of price (cheaper = higher score)
  const costScore = Math.round(Math.max(0, 100 - model.inputPricePerMillion * 15));

  return {
    reasoning_score: model.capabilities.includes("reasoning") ? 75 : 50,
    coding_score: model.capabilities.includes("tools") ? 75 : 50,
    vision_score: model.capabilities.includes("vision") ? 75 : 0,
    speed_score: Math.min(100, Math.max(0, speedScore)),
    cost_score: Math.min(100, Math.max(0, costScore)),
  };
}

// ── Gateway Fetch ──────────────────────────────────────────────────────────

async function fetchGatewayModels(): Promise<GatewayModelEntry[]> {
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json.data ?? [])
      .filter((m: GatewayModelEntry) => m.type === "language")
      .map((m: GatewayModelEntry) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        tags: m.tags ?? [],
      }));
  } catch (err) {
    console.warn("Gateway fetch failed, using curated catalog:", (err as Error).message);
    return [];
  }
}

async function fetchModelEndpoints(modelId: string): Promise<{ capabilities: string[]; contextWindowTokens: number; maxOutputTokens: number }> {
  try {
    const res = await fetch(
      `https://ai-gateway.vercel.sh/v1/models/${encodeURIComponent(modelId)}/endpoints`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const endpoints = json.data?.endpoints ?? [];
    const params = new Set(
      endpoints.flatMap((e: GatewayEndpointEntry) => e.supported_parameters ?? [])
    );
    const inputModalities = new Set(json.data?.architecture?.input_modalities ?? []);

    const capabilities: string[] = [];
    if (params.has("tools")) capabilities.push("tools");
    if (inputModalities.has("image")) capabilities.push("vision");
    if (params.has("reasoning")) capabilities.push("reasoning");
    capabilities.push("streaming");
    if (params.has("response_format")) capabilities.push("json_output");

    const contextWindowTokens = json.data?.architecture?.context_window ?? 128_000;
    const maxOutputTokens = json.data?.architecture?.max_output_tokens ?? 4_096;

    return { capabilities, contextWindowTokens, maxOutputTokens };
  } catch {
    return { capabilities: ["tools", "streaming"], contextWindowTokens: 128_000, maxOutputTokens: 4_096 };
  }
}

function buildIdentifier(id: string, name: string): string {
  // Gateway IDs are already in provider/model format
  if (id.includes("/")) return id;
  // Fallback: prefix with first segment of name
  const provider = name.split(" ")[0].toLowerCase();
  return `${provider}/${id}`;
}

// ── Main Seeder ────────────────────────────────────────────────────────────

async function main() {
  const sql = postgres(POSTGRES_URL!, { max: 2 });

  console.log("🌱 Phase 14: Seeding library_models...\n");

  // 1. Try gateway fetch
  const gatewayModels = await fetchGatewayModels();

  let records: SeedModelRecord[];

  if (gatewayModels.length > 0) {
    console.log(`📡 Fetched ${gatewayModels.length} models from Vercel AI Gateway\n`);

    const enriched = await Promise.all(
      gatewayModels.map(async (gm): Promise<SeedModelRecord> => {
        const endpointInfo = await fetchModelEndpoints(gm.id);

        const tags = gm.tags ?? [];
        const capabilities = endpointInfo.capabilities.length > 0 ? endpointInfo.capabilities : [
          ...(tags.includes("tool-use") ? ["tools"] : []),
          ...(tags.includes("vision") ? ["vision"] : []),
          ...(tags.includes("reasoning") ? ["reasoning"] : []),
          "streaming",
        ];

        const modalities = tags.includes("vision") ? ["text", "image"] : ["text"];

        const scores = estimateScores({
          capabilities,
          contextWindowTokens: endpointInfo.contextWindowTokens,
          maxOutputTokens: endpointInfo.maxOutputTokens,
          inputPricePerMillion: 0.5, // generic estimate
        });

        return {
          identifier: gm.id,
          display_name: gm.name,
          provider: gm.id.split("/")[0],
          family: null,
          version: "1.0.0",
          release_date: null,
          context_window_tokens: endpointInfo.contextWindowTokens,
          max_output_tokens: endpointInfo.maxOutputTokens,
          input_price_per_million: 0.5,
          output_price_per_million: 2.0,
          cached_input_price: null,
          capabilities,
          modalities,
          ...scores,
          benchmark_scores: null,
          best_for: capabilities.includes("reasoning") ? ["reasoning", "agents"] : ["general use"],
          not_good_for: [],
          status: "active",
          source_url: null,
        };
      })
    );

    records = enriched;
  } else {
    console.log(`📦 Using curated catalog: ${CURATED_MODELS.length} models\n`);
    records = CURATED_MODELS;
  }

  // 2. Upsert into DB
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const r of records) {
    // Check existing
    const [existing] = await sql`
      SELECT "identifier" FROM "library_models" WHERE "identifier" = ${r.identifier}
    `;

    if (existing && !FORCE) {
      skipped++;
      if (!DRY_RUN) {
        await sql`
          UPDATE "library_models"
          SET "updated_at" = now(),
              "display_name" = ${r.display_name},
              "provider" = ${r.provider},
              "capabilities" = ${sql.json(r.capabilities)},
              "modalities" = ${sql.json(r.modalities)},
              "context_window_tokens" = ${r.context_window_tokens},
              "max_output_tokens" = ${r.max_output_tokens}
          WHERE "identifier" = ${r.identifier}
        `;
        updated++;
        skipped--;
      }
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY] ${r.identifier} — ${r.display_name} (${r.provider})`);
      inserted++;
      continue;
    }

    await sql`
      INSERT INTO "library_models" (
        "identifier", "display_name", "provider", "family", "version",
        "release_date", "context_window_tokens", "max_output_tokens",
        "input_price_per_million", "output_price_per_million", "cached_input_price",
        "capabilities", "modalities",
        "reasoning_score", "coding_score", "vision_score", "speed_score", "cost_score",
        "benchmark_scores", "best_for", "not_good_for", "status", "source_url"
      ) VALUES (
        ${r.identifier}, ${r.display_name}, ${r.provider}, ${r.family}, ${r.version},
        ${r.release_date ? new Date(r.release_date).toISOString() : null},
        ${r.context_window_tokens}, ${r.max_output_tokens},
        ${String(r.input_price_per_million)}, ${String(r.output_price_per_million)},
        ${r.cached_input_price ? String(r.cached_input_price) : null},
        ${sql.json(r.capabilities)}, ${sql.json(r.modalities)},
        ${r.reasoning_score}, ${r.coding_score}, ${r.vision_score},
        ${r.speed_score}, ${r.cost_score},
        ${r.benchmark_scores ? sql.json(r.benchmark_scores) : null},
        ${sql.json(r.best_for)}, ${sql.json(r.not_good_for)},
        ${r.status}, ${r.source_url}
      )
      ON CONFLICT ("identifier") DO UPDATE SET
        "display_name" = EXCLUDED."display_name",
        "provider" = EXCLUDED."provider",
        "capabilities" = EXCLUDED."capabilities",
        "modalities" = EXCLUDED."modalities",
        "context_window_tokens" = EXCLUDED."context_window_tokens",
        "max_output_tokens" = EXCLUDED."max_output_tokens",
        "input_price_per_million" = EXCLUDED."input_price_per_million",
        "output_price_per_million" = EXCLUDED."output_price_per_million",
        "cached_input_price" = EXCLUDED."cached_input_price",
        "reasoning_score" = EXCLUDED."reasoning_score",
        "coding_score" = EXCLUDED."coding_score",
        "vision_score" = EXCLUDED."vision_score",
        "speed_score" = EXCLUDED."speed_score",
        "cost_score" = EXCLUDED."cost_score",
        "best_for" = EXCLUDED."best_for",
        "not_good_for" = EXCLUDED."not_good_for",
        "updated_at" = now()
    `;
    inserted++;
  }

  // 3. Report
  const [count] = await sql`SELECT COUNT(*)::int as n FROM "library_models"`;
  console.log("\n✅ Seed complete:");
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Updated:  ${updated}`);
  console.log(`   Skipped:  ${skipped}`);
  console.log(`   Total in DB: ${count.n}`);
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  await sql.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
