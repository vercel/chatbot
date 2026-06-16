/**
 * Phase 23B: Swarm Mode Executor
 *
 * Main orchestrator:
 *   1. Decompose via coordinator (generateObject with Zod schema)
 *   2. Run specialists in parallel (Promise.allSettled)
 *   3. Integrate via judge (combines outputs)
 *
 * Emits all SSE events for live UI updates.
 */

import type {
  PanelEvent,
  PanelPreset,
  TaskAnalysis,
  AgentResponse,
} from "../types";
import { decomposeTask } from "./decompose";
import { executeSpecialist } from "./specialist";
import { integrateSpecialistOutputs } from "./integrate";
import type { SpecialistOutput } from "./specialist";

export interface ExecuteSwarmInput {
  preset: PanelPreset;
  messages: Array<{ role: string; content: string }>;
  onEvent?: (event: PanelEvent) => void;
  taskAnalysis: TaskAnalysis;
}

export interface ExecuteSwarmOutput {
  judgeResponse: string;
  agentResponses: AgentResponse[];
  contributionScores: Record<string, number>;
  totalCost: number;
  totalLatency: number;
  totalTokensIn: number;
  totalTokensOut: number;
  mode: "swarm";
  taskAnalysis: TaskAnalysis;
}

export async function executeSwarm(
  input: ExecuteSwarmInput
): Promise<ExecuteSwarmOutput> {
  const { preset, messages, onEvent, taskAnalysis } = input;
  const startTime = Date.now();

  // Extract user prompt
  const userPrompt = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n");

  // ── Phase 1: Decompose (Coordinator) ──────────────────────────────────
  onEvent?.({
    type: "coordinator:start",
    modelId: preset.agents[0].modelId,
  } as PanelEvent);

  const decomposition = await decomposeTask({
    preset,
    userPrompt,
    coordinatorModelId: preset.agents[0].modelId,
  });

  onEvent?.({
    type: "coordinator:complete",
    decomposition: decomposition.decomposition,
    latency: decomposition.latencyMs,
    cost: decomposition.costUsd,
  } as PanelEvent);

  // ── Phase 2: Parallel Specialist Execution ────────────────────────────
  const specialistPromises = decomposition.decomposition.subTasks.map(
    (subTask) => {
      const agent = preset.agents.find((a) => a.modelId === subTask.assignedTo);
      const agentName = agent?.name ?? subTask.assignedTo;

      return executeSpecialist({
        modelId: subTask.assignedTo,
        name: agentName,
        subTaskId: subTask.id,
        subTaskDescription: subTask.description,
        reasoning: subTask.reasoning,
        userPrompt,
        onEvent,
      });
    }
  );

  const specialistResults = await Promise.allSettled(specialistPromises);

  // Unwrap results
  const specialistOutputs: SpecialistOutput[] = specialistResults.map((r) => {
    if (r.status === "fulfilled") {
      return r.value;
    }
    return {
      modelId: "unknown",
      name: "Unknown",
      subTaskId: "error",
      response: "",
      latencyMs: 0,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      success: false,
      error: "Specialist execution failed unexpectedly",
    };
  });

  // ── Phase 3: Integrate (Judge) ────────────────────────────────────────
  const integration = await integrateSpecialistOutputs({
    judgeModelId: preset.judge.modelId,
    judgeName: preset.judge.name,
    userPrompt,
    strategy: decomposition.decomposition.strategy,
    specialistOutputs,
    onEvent,
  });

  const totalLatency = Date.now() - startTime;

  return {
    judgeResponse: integration.finalResponse,
    agentResponses: integration.agentResponses,
    contributionScores: integration.contributionScores,
    totalCost: integration.totalCost,
    totalLatency,
    totalTokensIn: integration.totalTokensIn,
    totalTokensOut: integration.totalTokensOut,
    mode: "swarm",
    taskAnalysis,
  };
}
