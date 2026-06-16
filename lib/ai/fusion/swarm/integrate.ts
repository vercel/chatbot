/**
 * Phase 23B: Swarm Mode — Integrate
 *
 * Judge combines all specialist outputs into final deliverable.
 * Extracts hidden contribution scores from response for telemetry.
 */

import { gateway, generateText } from "ai";
import type { PanelEvent, AgentResponse } from "../types";
import { SWARM_INTEGRATE_PROMPT } from "./prompts";
import { estimateCost } from "./decompose";
import type { SpecialistOutput } from "./specialist";

export interface IntegrateInput {
  judgeModelId: string;
  judgeName: string;
  userPrompt: string;
  strategy: string;
  specialistOutputs: SpecialistOutput[];
  onEvent?: (event: PanelEvent) => void;
}

export interface IntegrateOutput {
  finalResponse: string;
  contributionScores: Record<string, number>;
  agentResponses: AgentResponse[];
  totalCost: number;
  totalLatency: number;
  totalTokensIn: number;
  totalTokensOut: number;
}

export async function integrateSpecialistOutputs(
  input: IntegrateInput
): Promise<IntegrateOutput> {
  const {
    judgeModelId,
    judgeName,
    userPrompt,
    strategy,
    specialistOutputs,
    onEvent,
  } = input;
  const startTime = Date.now();

  // Build specialist outputs text
  const specialistOutputsText = specialistOutputs
    .map(
      (so, i) =>
        `### Sub-Task ${i + 1}: ${so.subTaskId}\n**Specialist**: ${so.name} (${so.modelId})\n**Output**:\n${so.response}\n`
    )
    .join("\n---\n\n");

  const prompt = SWARM_INTEGRATE_PROMPT.replace("{userPrompt}", userPrompt)
    .replace("{strategy}", strategy)
    .replace("{specialistOutputs}", specialistOutputsText);

  onEvent?.({
    type: "integrator:start",
    modelId: judgeModelId,
  } as PanelEvent);

  try {
    const model = gateway.languageModel(judgeModelId);

    const result = await generateText({
      model,
      prompt,
      maxOutputTokens: 8192,
      temperature: 0.4,
    });

    const finalResponse = result.text;
    const latencyMs = Date.now() - startTime;
    const tokensIn = result.usage?.inputTokens ?? 0;
    const tokensOut = result.usage?.outputTokens ?? 0;
    const costUsd = estimateCost(judgeModelId, tokensIn, tokensOut);

    // Extract hidden contribution scores from response
    const contributionScores = extractContributionScores(
      finalResponse,
      specialistOutputs
    );

    // Build agent response for judge
    const judgeAgentResponse: AgentResponse = {
      modelId: judgeModelId,
      provider: judgeModelId.split("/")[0] ?? "unknown",
      name: judgeName,
      role: "judge",
      latency: latencyMs,
      tokensIn,
      tokensOut,
      costUsd,
      response: finalResponse,
      success: true,
    };

    // Build agent responses from all specialist outputs
    const agentResponses: AgentResponse[] = specialistOutputs.map((so) => ({
      modelId: so.modelId,
      provider: so.modelId.split("/")[0] ?? "unknown",
      name: so.name,
      role: "agent",
      latency: so.latencyMs,
      tokensIn: so.tokensIn,
      tokensOut: so.tokensOut,
      costUsd: so.costUsd,
      response: so.response,
      success: so.success,
      error: so.error,
    }));

    // Add judge response
    agentResponses.push(judgeAgentResponse);

    const totalCost =
      agentResponses.reduce((sum, ar) => sum + ar.costUsd, 0) + costUsd;
    const totalLatency = Date.now() - startTime;
    const totalTokensIn =
      agentResponses.reduce((sum, ar) => sum + ar.tokensIn, 0) + tokensIn;
    const totalTokensOut =
      agentResponses.reduce((sum, ar) => sum + ar.tokensOut, 0) + tokensOut;

    onEvent?.({
      type: "integrator:complete",
      fullResponse: finalResponse,
      totalCost,
      totalLatency,
    } as PanelEvent);

    return {
      finalResponse,
      contributionScores,
      agentResponses,
      totalCost,
      totalLatency,
      totalTokensIn,
      totalTokensOut,
    };
  } catch (err) {
    const errorMsg = (err as Error).message;

    onEvent?.({
      type: "panel:error",
      message: `Integration failed: ${errorMsg}`,
    });

    const agentResponses: AgentResponse[] = [
      {
        modelId: judgeModelId,
        provider: judgeModelId.split("/")[0] ?? "unknown",
        name: judgeName,
        role: "judge",
        latency: Date.now() - startTime,
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        response: "",
        success: false,
        error: errorMsg,
      },
    ];

    return {
      finalResponse: `[Integration failed: ${errorMsg}]`,
      contributionScores: {},
      agentResponses,
      totalCost: 0,
      totalLatency: Date.now() - startTime,
      totalTokensIn: 0,
      totalTokensOut: 0,
    };
  }
}

/**
 * Extract hidden contribution scores from the integrator's response.
 * Looks for a JSON block at the end matching {"contributions":[...]}.
 */
function extractContributionScores(
  response: string,
  specialistOutputs: SpecialistOutput[]
): Record<string, number> {
  const scores: Record<string, number> = {};

  // Try to find hidden JSON in the last 2000 characters
  const tail = response.slice(-2000);
  const jsonMatch = tail.match(/\{"contributions"\s*:\s*\[([\s\S]*?)\]\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      for (const c of parsed.contributions || []) {
        if (c.modelId && typeof c.score === "number") {
          scores[c.modelId] = c.score;
        }
      }
    } catch {
      // JSON parse failed — fall through to heuristic scoring
    }
  }

  // Heuristic fallback: score based on response length and success
  if (Object.keys(scores).length === 0) {
    const successful = specialistOutputs.filter((s) => s.success);
    for (const so of successful) {
      // Simple heuristic: longer responses + success = higher contribution
      scores[so.modelId] = Math.min(
        1.0,
        0.5 + (so.response.length / (so.response.length + 2000)) * 0.5
      );
    }
  }

  return scores;
}
