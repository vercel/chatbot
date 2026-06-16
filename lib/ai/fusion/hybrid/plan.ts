/**
 * Phase 23B: Hybrid Mode — Plan
 *
 * Coordinator analyzes task and splits into:
 *   - councilSubTasks: decisions that need multi-agent debate
 *   - swarmSubTasks: executions that need decomposition + parallel work
 *
 * Uses generateObject with Zod schema.
 */

import { gateway, generateObject } from "ai";
import { z } from "zod";
import type { PanelPreset } from "../types";
import { HYBRID_PLAN_PROMPT } from "./prompts";

// ── Zod Schema ─────────────────────────────────────────────────────────

export const CouncilSubTaskSchema = z.object({
  id: z.string(),
  question: z.string(),
  why: z.string(),
});

export const HybridSwarmSubTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  assignedTo: z.string(),
  dependsOn: z.array(z.string()).default([]),
});

export const HybridPlanSchema = z.object({
  strategy: z.string(),
  councilSubTasks: z.array(CouncilSubTaskSchema).default([]),
  swarmSubTasks: z.array(HybridSwarmSubTaskSchema).default([]),
});

export type CouncilSubTask = z.infer<typeof CouncilSubTaskSchema>;
export type HybridSwarmSubTask = z.infer<typeof HybridSwarmSubTaskSchema>;
export type HybridPlan = z.infer<typeof HybridPlanSchema>;

// ── Plan Function ───────────────────────────────────────────────────────

export interface PlanHybridInput {
  preset: PanelPreset;
  userPrompt: string;
}

export interface PlanHybridOutput {
  plan: HybridPlan;
  latencyMs: number;
  costUsd: number;
}

export async function planHybridExecution(
  input: PlanHybridInput
): Promise<PlanHybridOutput> {
  const { preset, userPrompt } = input;
  const coordinatorModelId = preset.agents[0].modelId;
  const startTime = Date.now();

  const agentList = preset.agents
    .map((a, i) => `${i + 1}. ${a.name} (${a.modelId})`)
    .join("\n");

  const prompt = HYBRID_PLAN_PROMPT.replace("{userPrompt}", userPrompt).replace(
    "{agentList}",
    agentList
  );

  const model = gateway.languageModel(coordinatorModelId);

  const result = await generateObject({
    model,
    schema: HybridPlanSchema,
    prompt,
    maxOutputTokens: 2048,
    temperature: 0.3,
  });

  const latencyMs = Date.now() - startTime;
  const tokensIn = result.usage?.inputTokens ?? 0;
  const tokensOut = result.usage?.outputTokens ?? 0;
  const costUsd =
    (tokensIn / 1_000_000) * 0.5 + (tokensOut / 1_000_000) * 2.0;

  return {
    plan: result.object,
    latencyMs,
    costUsd,
  };
}
