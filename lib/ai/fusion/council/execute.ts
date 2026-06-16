/**
 * Phase 23A: Council Mode Executor
 *
 * Council = ACCURACY through deliberation.
 * All N agents answer the SAME question in parallel.
 * Judge reads all N responses and synthesizes the best answer.
 *
 * Uses Vercel AI Gateway (gateway() from 'ai') for all model calls.
 * Emits SSE events: panel:start → agent:start → agent:complete → judge:start → judge:token → judge:complete
 */

import { gateway, generateText } from "ai";
import type {
  AgentResponse,
  PanelEvent,
  PanelPreset,
  TaskAnalysis,
} from "../types";
import { COUNCIL_AGENT_PROMPT } from "./prompts";
import { buildJudgeMessages } from "./synthesize";

export interface ExecuteCouncilInput {
  preset: PanelPreset;
  messages: Array<{ role: string; content: string }>;
  onEvent?: (event: PanelEvent) => void;
  taskAnalysis: TaskAnalysis;
}

export interface ExecuteCouncilOutput {
  judgeResponse: string;
  agentResponses: AgentResponse[];
  totalCost: number;
  totalLatency: number;
  totalTokensIn: number;
  totalTokensOut: number;
  mode: "council";
  taskAnalysis: TaskAnalysis;
}

// ── Model-ID to Gateway-compatible ID mapping ────────────────────────
// The ai-sdk gateway expects "provider/model" format. Our modelIds already use this format
// but some may need normalization.

function normalizeModelId(modelId: string): string {
  // Already in gateway format (provider/model)
  if (modelId.includes("/")) {
    return modelId;
  }

  // Known direct model IDs — map to gateway format
  const MAP: Record<string, string> = {
    "deepseek-v4-pro": "deepseek/deepseek-v4-pro",
    "deepseek-reasoner": "deepseek/deepseek-reasoner",
  };

  return MAP[modelId] ?? modelId;
}

// ── Agent Execution ───────────────────────────────────────────────────

async function runAgent(
  modelId: string,
  name: string,
  prompt: string,
  onEvent?: (event: PanelEvent) => void
): Promise<AgentResponse> {
  const startTime = Date.now();
  const normalizedId = normalizeModelId(modelId);

  onEvent?.({ type: "agent:start", modelId, name });

  try {
    const model = gateway.languageModel(normalizedId);

    const result = await generateText({
      model,
      prompt,
      maxOutputTokens: 4096,
      temperature: 0.7,
    });

    const latency = Date.now() - startTime;
    const tokensIn = result.usage?.inputTokens ?? 0;
    const tokensOut = result.usage?.outputTokens ?? 0;
    const costUsd = estimateCost(modelId, tokensIn, tokensOut);

    const response: AgentResponse = {
      modelId,
      provider: modelId.split("/")[0] ?? "unknown",
      name,
      role: "agent",
      latency,
      tokensIn,
      tokensOut,
      costUsd,
      response: result.text,
      success: true,
    };

    onEvent?.({
      type: "agent:complete",
      modelId,
      name,
      latency,
      tokensIn,
      tokensOut,
      response: result.text,
      success: true,
    });

    return response;
  } catch (err) {
    const latency = Date.now() - startTime;
    const errorMsg = (err as Error).message;

    onEvent?.({
      type: "agent:complete",
      modelId,
      name,
      latency,
      tokensIn: 0,
      tokensOut: 0,
      response: "",
      success: false,
    });

    return {
      modelId,
      provider: modelId.split("/")[0] ?? "unknown",
      name,
      role: "agent",
      latency,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      response: "",
      success: false,
      error: errorMsg,
    };
  }
}

// ── Cost Estimation (simplified) ──────────────────────────────────────

const PRICING: Record<string, { input: number; output: number }> = {
  "deepseek/deepseek-v4-pro": { input: 0.55, output: 2.19 },
  "moonshotai/kimi-k2.7": { input: 0.35, output: 1.05 },
  "moonshotai/kimi-k2.7-code": { input: 0.35, output: 1.05 },
  "zai/glm-5.1": { input: 0.15, output: 0.6 },
  "alibaba/qwen3-235b": { input: 0.3, output: 0.9 },
  "alibaba/qwen-3-coder": { input: 0.3, output: 0.9 },
  "anthropic/claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "anthropic/claude-opus-4-8": { input: 15.0, output: 75.0 },
  "google/gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "google/gemini-2.5-pro": { input: 1.25, output: 5.0 },
};

function estimateCost(
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

// ── Main Executor ──────────────────────────────────────────────────────

export async function executeCouncil(
  input: ExecuteCouncilInput
): Promise<ExecuteCouncilOutput> {
  const { preset, messages, onEvent, taskAnalysis } = input;
  const startTime = Date.now();

  // Extract the user's task from messages
  const userMessage = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n");

  const agentPrompt = COUNCIL_AGENT_PROMPT.replace(
    "{{task}}",
    userMessage || "Analyze and respond."
  );

  // Phase 1: Fire all agents in parallel (Promise.allSettled)
  const agentResults = await Promise.allSettled(
    preset.agents.map((agent) =>
      runAgent(agent.modelId, agent.name, agentPrompt, onEvent)
    )
  );

  // Unwrap results — keep successes, log failures
  const agentResponses: AgentResponse[] = agentResults.map((r) => {
    if (r.status === "fulfilled") {
      return r.value;
    }
    // Shouldn't happen (runAgent catches errors), but handle
    return {
      modelId: "unknown",
      provider: "unknown",
      name: "Unknown",
      role: "agent",
      latency: 0,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      response: "",
      success: false,
      error: "Agent execution failed",
    };
  });

  // Phase 2: Judge synthesizes
  onEvent?.({
    type: "judge:start",
    modelId: preset.judge.modelId,
    name: preset.judge.name,
  });

  const successfulAgents = agentResponses.filter((a) => a.success);
  const judgeStart = Date.now();

  const judgeModel = gateway.languageModel(
    normalizeModelId(preset.judge.modelId)
  );
  const judgeMessages = buildJudgeMessages(userMessage, successfulAgents);

  // Use streamText for token-level events
  let fullJudgeResponse = "";

  try {
    const result = await generateText({
      model: judgeModel,
      system: judgeMessages[0].content,
      prompt: judgeMessages[1].content,
      maxOutputTokens: 8192,
      temperature: 0.5,
    });

    fullJudgeResponse = result.text;
    const judgeLatency = Date.now() - judgeStart;
    const judgeTokensIn = result.usage?.inputTokens ?? 0;
    const judgeTokensOut = result.usage?.outputTokens ?? 0;
    const judgeCost = estimateCost(
      preset.judge.modelId,
      judgeTokensIn,
      judgeTokensOut
    );

    // Emit judge tokens in a complete block (streaming per-token in future phase)
    onEvent?.({ type: "judge:token", token: fullJudgeResponse });

    // Add judge as an agent response for telemetry
    agentResponses.push({
      modelId: preset.judge.modelId,
      provider: preset.judge.provider,
      name: preset.judge.name,
      role: "judge",
      latency: judgeLatency,
      tokensIn: judgeTokensIn,
      tokensOut: judgeTokensOut,
      costUsd: judgeCost,
      response: fullJudgeResponse,
      success: true,
    });
  } catch (err) {
    const judgeLatency = Date.now() - judgeStart;
    const errorMsg = (err as Error).message;

    fullJudgeResponse = `[Judge synthesis failed: ${errorMsg}]`;

    agentResponses.push({
      modelId: preset.judge.modelId,
      provider: preset.judge.provider,
      name: preset.judge.name,
      role: "judge",
      latency: judgeLatency,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      response: "",
      success: false,
      error: errorMsg,
    });
  }

  // Calculate totals
  const totalCost = agentResponses.reduce((sum, ar) => sum + ar.costUsd, 0);
  const totalLatency = Date.now() - startTime;
  const totalTokensIn = agentResponses.reduce(
    (sum, ar) => sum + ar.tokensIn,
    0
  );
  const totalTokensOut = agentResponses.reduce(
    (sum, ar) => sum + ar.tokensOut,
    0
  );

  onEvent?.({
    type: "judge:complete",
    fullResponse: fullJudgeResponse,
    totalCost,
    totalLatency,
  });

  return {
    judgeResponse: fullJudgeResponse,
    agentResponses,
    totalCost,
    totalLatency,
    totalTokensIn,
    totalTokensOut,
    mode: "council",
    taskAnalysis: input.taskAnalysis,
  };
}
