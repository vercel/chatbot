/**
 * Phase 23B: Hybrid Mode Executor
 *
 * Hybrid = council (decisions) + swarm (execution) + final judge.
 *
 * Flow:
 *   1. Coordinator maps council vs swarm sub-tasks
 *   2. Run council sub-tasks first (each via mini council)
 *   3. Swarm sub-tasks run next (some may depend on council decisions)
 *   4. Final judge integrates everything
 */

import { gateway, generateText } from "ai";
import type {
  PanelEvent,
  PanelPreset,
  TaskAnalysis,
  AgentResponse,
} from "../types";
import { planHybridExecution } from "./plan";
import { HYBRID_INTEGRATE_PROMPT } from "./prompts";
import { executeCouncil } from "../council/execute";
import { decomposeTask, estimateCost } from "../swarm/decompose";
import { executeSpecialist } from "../swarm/specialist";
import type { SpecialistOutput } from "../swarm/specialist";

export interface ExecuteHybridInput {
  preset: PanelPreset;
  messages: Array<{ role: string; content: string }>;
  onEvent?: (event: PanelEvent) => void;
  taskAnalysis: TaskAnalysis;
}

export interface ExecuteHybridOutput {
  judgeResponse: string;
  agentResponses: AgentResponse[];
  totalCost: number;
  totalLatency: number;
  totalTokensIn: number;
  totalTokensOut: number;
  mode: "hybrid";
  taskAnalysis: TaskAnalysis;
}

export async function executeHybrid(
  input: ExecuteHybridInput
): Promise<ExecuteHybridOutput> {
  const { preset, messages, onEvent, taskAnalysis } = input;
  const startTime = Date.now();
  const allAgentResponses: AgentResponse[] = [];

  const userPrompt = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n");

  // ── Phase 1: Plan (Coordinator) ───────────────────────────────────────
  const { plan } = await planHybridExecution({ preset, userPrompt });

  onEvent?.({
    type: "hybrid:plan",
    councilSubTasks: plan.councilSubTasks,
    swarmSubTasks: plan.swarmSubTasks,
  } as PanelEvent);

  // ── Phase 2: Council Group (decisions first) ─────────────────────────
  let councilOutputs = "";

  if (plan.councilSubTasks.length > 0) {
    for (const decision of plan.councilSubTasks) {
      // Mini-council: all agents debate this specific decision
      const decisionMessages = [
        { role: "user" as const, content: decision.question },
      ];

      try {
        const councilResult = await executeCouncil({
          preset,
          messages: decisionMessages,
          onEvent,
          taskAnalysis,
        });

        councilOutputs += `\n\n## Decision: ${decision.question}\n**Why council**: ${decision.why}\n**Resolution**: ${councilResult.judgeResponse}\n`;
        allAgentResponses.push(...councilResult.agentResponses);
      } catch (err) {
        councilOutputs += `\n\n## Decision: ${decision.question}\n**Error**: ${(err as Error).message}`;
      }
    }
  }

  // ── Phase 3: Swarm Group (execution) ──────────────────────────────────
  let swarmOutputs = "";

  if (plan.swarmSubTasks.length > 0) {
    // Separate independent vs dependent tasks
    const independentTasks = plan.swarmSubTasks.filter(
      (st) => !st.dependsOn || st.dependsOn.length === 0
    );
    const dependentTasks = plan.swarmSubTasks.filter(
      (st) => st.dependsOn && st.dependsOn.length > 0
    );

    // Run independent tasks in parallel first
    if (independentTasks.length > 0) {
      const specialistPromises = independentTasks.map((st) => {
        const agent = preset.agents.find((a) => a.modelId === st.assignedTo);
        return executeSpecialist({
          modelId: st.assignedTo,
          name: agent?.name ?? st.assignedTo,
          subTaskId: st.id,
          subTaskDescription: st.description,
          reasoning: "Hybrid swarm execution",
          userPrompt: `${userPrompt}\n\nCouncil decisions:\n${councilOutputs}`,
          onEvent,
        });
      });

      const results = await Promise.allSettled(specialistPromises);
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.success) {
          swarmOutputs += `\n\n### ${r.value.subTaskId}\n${r.value.response}\n`;
          allAgentResponses.push({
            modelId: r.value.modelId,
            provider: r.value.modelId.split("/")[0] ?? "unknown",
            name: r.value.name,
            role: "agent",
            latency: r.value.latencyMs,
            tokensIn: r.value.tokensIn,
            tokensOut: r.value.tokensOut,
            costUsd: r.value.costUsd,
            response: r.value.response,
            success: true,
          });
        }
      }
    }

    // Run dependent tasks (after council + independent swarm complete)
    for (const st of dependentTasks) {
      const agent = preset.agents.find((a) => a.modelId === st.assignedTo);
      const result = await executeSpecialist({
        modelId: st.assignedTo,
        name: agent?.name ?? st.assignedTo,
        subTaskId: st.id,
        subTaskDescription: st.description,
        reasoning: `Depends on: ${(st.dependsOn || []).join(", ")}`,
        userPrompt: `${userPrompt}\n\nCouncil decisions:\n${councilOutputs}\n\nEarlier results:\n${swarmOutputs}`,
        onEvent,
      });

      if (result.success) {
        swarmOutputs += `\n\n### ${result.subTaskId}\n${result.response}\n`;
        allAgentResponses.push({
          modelId: result.modelId,
          provider: result.modelId.split("/")[0] ?? "unknown",
          name: result.name,
          role: "agent",
          latency: result.latencyMs,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          costUsd: result.costUsd,
          response: result.response,
          success: true,
        });
      }
    }
  }

  // ── Phase 4: Final Judge ──────────────────────────────────────────────
  const judgeStart = Date.now();
  let judgeResponse = "";

  onEvent?.({
    type: "final-judge:start",
    modelId: preset.judge.modelId,
  } as PanelEvent);

  try {
    const judgePrompt = HYBRID_INTEGRATE_PROMPT.replace(
      "{userPrompt}",
      userPrompt
    )
      .replace("{councilOutputs}", councilOutputs || "(no council needed)")
      .replace("{swarmOutputs}", swarmOutputs || "(no swarm needed)");

    const judgeModel = gateway.languageModel(preset.judge.modelId);

    const result = await generateText({
      model: judgeModel,
      prompt: judgePrompt,
      maxOutputTokens: 8192,
      temperature: 0.4,
    });

    judgeResponse = result.text;
    const judgeLatency = Date.now() - judgeStart;
    const judgeTokensIn = result.usage?.inputTokens ?? 0;
    const judgeTokensOut = result.usage?.outputTokens ?? 0;
    const judgeCost = estimateCost(
      preset.judge.modelId,
      judgeTokensIn,
      judgeTokensOut
    );

    allAgentResponses.push({
      modelId: preset.judge.modelId,
      provider: preset.judge.provider,
      name: preset.judge.name,
      role: "judge",
      latency: judgeLatency,
      tokensIn: judgeTokensIn,
      tokensOut: judgeTokensOut,
      costUsd: judgeCost,
      response: judgeResponse,
      success: true,
    });
  } catch (err) {
    judgeResponse = `[Hybrid final judge failed: ${(err as Error).message}]`;
    allAgentResponses.push({
      modelId: preset.judge.modelId,
      provider: preset.judge.provider,
      name: preset.judge.name,
      role: "judge",
      latency: Date.now() - judgeStart,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      response: "",
      success: false,
      error: (err as Error).message,
    });
  }

  onEvent?.({
    type: "final-judge:complete",
    fullResponse: judgeResponse,
    totalCost: allAgentResponses.reduce((s, a) => s + a.costUsd, 0),
    totalLatency: Date.now() - startTime,
  } as PanelEvent);

  const totalCost = allAgentResponses.reduce((s, a) => s + a.costUsd, 0);
  const totalLatency = Date.now() - startTime;
  const totalTokensIn = allAgentResponses.reduce((s, a) => s + a.tokensIn, 0);
  const totalTokensOut = allAgentResponses.reduce(
    (s, a) => s + a.tokensOut,
    0
  );

  return {
    judgeResponse,
    agentResponses: allAgentResponses,
    totalCost,
    totalLatency,
    totalTokensIn,
    totalTokensOut,
    mode: "hybrid",
    taskAnalysis,
  };
}
