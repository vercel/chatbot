/**
 * Phase 23B: Swarm Mode — Specialist
 *
 * Single sub-task execution via streamText.
 * Emits specialist:start and specialist:complete events.
 */

import { gateway, generateText } from "ai";
import type { PanelEvent } from "../types";
import { SWARM_SPECIALIST_PROMPT } from "./prompts";
import { estimateCost } from "./decompose";

export interface SpecialistInput {
  modelId: string;
  name: string;
  subTaskId: string;
  subTaskDescription: string;
  reasoning: string;
  userPrompt: string;
  onEvent?: (event: PanelEvent) => void;
}

export interface SpecialistOutput {
  modelId: string;
  name: string;
  subTaskId: string;
  response: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  success: boolean;
  error?: string;
}

export async function executeSpecialist(
  input: SpecialistInput
): Promise<SpecialistOutput> {
  const {
    modelId,
    name,
    subTaskId,
    subTaskDescription,
    reasoning,
    userPrompt,
    onEvent,
  } = input;
  const startTime = Date.now();

  onEvent?.({
    type: "specialist:start",
    modelId,
    subTask: subTaskId,
    description: subTaskDescription,
  } as PanelEvent);

  try {
    const model = gateway.languageModel(modelId);

    const prompt = SWARM_SPECIALIST_PROMPT.replace(
      "{userPrompt}",
      userPrompt
    )
      .replace("{subTaskDescription}", subTaskDescription)
      .replace("{reasoning}", reasoning);

    const result = await generateText({
      model,
      prompt,
      maxOutputTokens: 8192,
      temperature: 0.5,
    });

    const latencyMs = Date.now() - startTime;
    const tokensIn = result.usage?.inputTokens ?? 0;
    const tokensOut = result.usage?.outputTokens ?? 0;
    const costUsd = estimateCost(modelId, tokensIn, tokensOut);

    onEvent?.({
      type: "specialist:complete",
      modelId,
      subTask: subTaskId,
      latency: latencyMs,
      tokensIn,
      tokensOut,
      response: result.text,
      success: true,
    } as PanelEvent);

    return {
      modelId,
      name,
      subTaskId,
      response: result.text,
      latencyMs,
      tokensIn,
      tokensOut,
      costUsd,
      success: true,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = (err as Error).message;

    onEvent?.({
      type: "specialist:failed",
      modelId,
      subTask: subTaskId,
      error: errorMsg,
    } as PanelEvent);

    return {
      modelId,
      name,
      subTaskId,
      response: "",
      latencyMs,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      success: false,
      error: errorMsg,
    };
  }
}
