/**
 * Phase 23A: Council Synthesis
 *
 * Builds the judge prompt from all agent responses and synthesizes
 * a unified final answer.
 */

import type { AgentResponse, JudgeModel, PanelEvent } from "../types";
import { COUNCIL_SYNTHESIS_PROMPT, JUDGE_SYSTEM_PROMPT } from "./prompts";

export interface SynthesizeInput {
  task: string;
  agentResponses: AgentResponse[];
  judge: JudgeModel;
  onEvent?: (event: PanelEvent) => void;
}

function buildSynthesisPrompt(
  task: string,
  agentResponses: AgentResponse[]
): string {
  let prompt = COUNCIL_SYNTHESIS_PROMPT.replace(
    "{{agentCount}}",
    String(agentResponses.length)
  );
  prompt = prompt.replace("{{task}}", task);

  // Build agent responses section
  const agentSection = agentResponses
    .map(
      (ar) =>
        `## Analysis from ${ar.name} (${ar.modelId})\n${ar.response}\n\n---`
    )
    .join("\n\n");

  prompt = prompt.replace(
    /{{#agentResponses}}[\s\S]*?{{\/agentResponses}}/,
    agentSection
  );

  return prompt;
}

export function buildCouncilSynthesisPrompt(
  task: string,
  agentResponses: AgentResponse[]
): string {
  return buildSynthesisPrompt(task, agentResponses);
}

export function buildJudgeMessages(
  task: string,
  agentResponses: AgentResponse[]
): Array<{ role: "system" | "user"; content: string }> {
  return [
    { role: "system", content: JUDGE_SYSTEM_PROMPT },
    { role: "user", content: buildSynthesisPrompt(task, agentResponses) },
  ];
}
