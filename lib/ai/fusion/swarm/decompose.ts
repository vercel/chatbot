/**
 * Phase 23B: Swarm Mode — Decompose
 *
 * Coordinator uses generateObject with Zod schema to decompose the user
 * task into parallel sub-tasks, each assigned to a specialist from the
 * preset's agent pool.
 */

import { gateway, generateObject } from "ai";
import { z } from "zod";
import type { AgentModel, PanelPreset } from "../types";
import { SWARM_DECOMPOSE_PROMPT } from "./prompts";

// ── Zod Schema for Coordinator Output ──────────────────────────────────

export const SubTaskSchema = z.object({
  id: z.string().describe("Unique sub-task identifier"),
  description: z.string().describe("Specific, actionable sub-task"),
  assignedTo: z.string().describe("Model ID of the specialist assigned"),
  priority: z.number().min(1).max(10).describe("Priority (1 = highest)"),
  reasoning: z.string().describe("Why this specialist was chosen"),
});

export const DecompositionSchema = z.object({
  strategy: z.string().describe("Overall approach in 1-2 sentences"),
  subTasks: z
    .array(SubTaskSchema)
    .min(1)
    .max(8)
    .describe("Decomposed sub-tasks (2-6 recommended)"),
});

export type SubTaskDecomposition = z.infer<typeof SubTaskSchema>;
export type Decomposition = z.infer<typeof DecompositionSchema>;

// ── Decompose Function ─────────────────────────────────────────────────

export interface DecomposeInput {
  preset: PanelPreset;
  userPrompt: string;
  coordinatorModelId?: string; // defaults to first agent
}

export interface DecomposeOutput {
  decomposition: Decomposition;
  latencyMs: number;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
}

export async function decomposeTask(
  input: DecomposeInput
): Promise<DecomposeOutput> {
  const { preset, userPrompt } = input;
  const coordinatorModelId =
    input.coordinatorModelId || preset.agents[0].modelId;
  const startTime = Date.now();

  // Build specialist roster
  const specialistList = preset.agents
    .map(
      (a, i) =>
        `${i + 1}. **${a.name}** (${a.modelId}): ${
          a.role || "General specialist"
        }`
    )
    .join("\n");

  const prompt = SWARM_DECOMPOSE_PROMPT.replace(
    "{specialistList}",
    specialistList
  ).replace("{userPrompt}", userPrompt);

  const model = gateway.languageModel(coordinatorModelId);

  const result = await generateObject({
    model,
    schema: DecompositionSchema,
    prompt,
    maxOutputTokens: 2048,
    temperature: 0.3,
  });

  const latencyMs = Date.now() - startTime;
  const tokensIn = result.usage?.inputTokens ?? 0;
  const tokensOut = result.usage?.outputTokens ?? 0;
  const costUsd = estimateCost(coordinatorModelId, tokensIn, tokensOut);

  // Validate assignments — ensure each assignedTo is in the preset's agent pool
  const validModelIds = new Set(preset.agents.map((a) => a.modelId));
  const decomposition = result.object;

  // Filter sub-tasks to valid assignments only
  decomposition.subTasks = decomposition.subTasks.map((st) => ({
    ...st,
    assignedTo: validModelIds.has(st.assignedTo)
      ? st.assignedTo
      : preset.agents[0].modelId, // fallback to first agent
  }));

  return {
    decomposition,
    latencyMs,
    costUsd,
    tokensIn,
    tokensOut,
  };
}

// ── Cost Estimation ─────────────────────────────────────────────────────

const PRICING: Record<string, { input: number; output: number }> = {
  "deepseek/deepseek-v4-pro": { input: 0.55, output: 2.19 },
  "deepseek/deepseek-v4-flash": { input: 0.15, output: 0.6 },
  "deepseek/deepseek-r1": { input: 1.0, output: 4.0 },
  "moonshotai/kimi-k2.7-code": { input: 0.35, output: 1.05 },
  "moonshotai/kimi-k2.7-code-highspeed": { input: 0.2, output: 0.6 },
  "zai/glm-5.2": { input: 0.15, output: 0.5 },
  "zai/glm-5.1": { input: 0.15, output: 0.6 },
  "alibaba/qwen3-coder-next": { input: 0.3, output: 0.9 },
  "alibaba/qwen3-max": { input: 0.5, output: 2.0 },
  "alibaba/qwen3-max-thinking": { input: 1.0, output: 4.0 },
  "anthropic/claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "anthropic/claude-opus-4-8": { input: 15.0, output: 75.0 },
  "google/gemini-2.5-pro": { input: 1.25, output: 5.0 },
  "google/gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "minimax/minimax-m3": { input: 0.3, output: 0.9 },
  "minimax/minimax-m2.7": { input: 0.25, output: 0.75 },
  "stepfun/step-3.7-flash": { input: 0.1, output: 0.3 },
};

export function estimateCost(
  modelId: string,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing = PRICING[modelId] ?? { input: 0.5, output: 2.0 };
  return (
    (tokensIn / 1_000_000) * pricing.input +
    (tokensOut / 1_000_000) * pricing.output
  );
}
