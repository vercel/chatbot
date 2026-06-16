/**
 * Phase 23A: Cost Estimator for Fusion Panels
 *
 * Estimates per-run cost based on preset composition (agents + judge),
 * estimated token counts, and provider pricing.
 */

import type { PanelPreset } from "./types";

// ── Approximate per-1M-token pricing (USD, input/output) ────────────

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Chinese Frontier
  "deepseek/deepseek-v4-pro": { input: 0.55, output: 2.19 },
  "moonshotai/kimi-k2.7": { input: 0.35, output: 1.05 },
  "moonshotai/kimi-k2.7-code": { input: 0.35, output: 1.05 },
  "zai/glm-5.1": { input: 0.15, output: 0.6 },
  "alibaba/qwen3-235b": { input: 0.3, output: 0.9 },
  "alibaba/qwen-3-coder": { input: 0.3, output: 0.9 },
  // American Frontier (only as judge)
  "anthropic/claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "anthropic/claude-opus-4-8": { input: 15.0, output: 75.0 },
  "google/gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "google/gemini-2.5-pro": { input: 1.25, output: 5.0 },
};

const DEFAULT_PRICING = { input: 0.5, output: 2.0 };

function getPricing(modelId: string) {
  return MODEL_PRICING[modelId] ?? DEFAULT_PRICING;
}

// ── Token Estimation ─────────────────────────────────────────────────

const EST_INPUT_TOKENS = 8000; // Typical context per agent call
const EST_OUTPUT_TOKENS = 2000; // Typical output per agent
const EST_JUDGE_INPUT_MULTIPLIER = 2; // Judge reads all agent outputs
const EST_JUDGE_OUTPUT_TOKENS = 3000;

export interface CostEstimate {
  min: number;
  max: number;
  likely: number;
  breakdown: Array<{
    modelId: string;
    role: "agent" | "judge";
    inputCost: number;
    outputCost: number;
    total: number;
  }>;
}

export function estimateRunCost(
  preset: PanelPreset,
  inputTokensOverride?: number
): CostEstimate {
  const inputTokens = inputTokensOverride ?? EST_INPUT_TOKENS;
  const breakdown: CostEstimate["breakdown"] = [];
  let totalMin = 0;
  let totalMax = 0;

  // Agent costs
  for (const agent of preset.agents) {
    const pricing = getPricing(agent.modelId);
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (EST_OUTPUT_TOKENS / 1_000_000) * pricing.output;
    const total = inputCost + outputCost;

    breakdown.push({
      modelId: agent.modelId,
      role: "agent",
      inputCost,
      outputCost,
      total,
    });

    totalMin += total;
    totalMax += total * 1.5; // Upper bound: models may generate more
  }

  // Judge cost
  const judgePricing = getPricing(preset.judge.modelId);
  const judgeInputTokens =
    inputTokens * preset.agents.length * EST_JUDGE_INPUT_MULTIPLIER;
  const judgeInputCost = (judgeInputTokens / 1_000_000) * judgePricing.input;
  const judgeOutputCost =
    (EST_JUDGE_OUTPUT_TOKENS / 1_000_000) * judgePricing.output;
  const judgeTotal = judgeInputCost + judgeOutputCost;

  breakdown.push({
    modelId: preset.judge.modelId,
    role: "judge",
    inputCost: judgeInputCost,
    outputCost: judgeOutputCost,
    total: judgeTotal,
  });

  totalMin += judgeTotal;
  totalMax += judgeTotal * 1.3;

  // Calculate "likely" cost (average of min/max, rounded to reasonable precision)
  const likely = Math.round(((totalMin + totalMax) / 2) * 1e4) / 1e4;

  return {
    min: Math.round(totalMin * 1e4) / 1e4,
    max: Math.round(totalMax * 1e4) / 1e4,
    likely,
    breakdown,
  };
}

export function formatCost(amount: number): string {
  if (amount < 0.01) {
    return "<$0.01";
  }
  return `$${amount.toFixed(2)}`;
}

export function estimatePresetRange(preset: PanelPreset): {
  min: number;
  max: number;
} {
  const est = estimateRunCost(preset);
  return { min: est.likely * 0.5, max: est.likely * 2 };
}
