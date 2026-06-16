/**
 * Phase 23A: Mode Router
 *
 * Routes to the appropriate executor based on execution mode.
 * Phase 23A: Only handles 'council'. Swarm + Hybrid in Phase 23B.
 */

import { executeCouncil } from "./council/execute";
import { analyzeTask } from "./task-analyzer";
import type {
  AgentResponse,
  PanelEvent,
  PanelMode,
  PanelPreset,
  TaskAnalysis,
} from "./types";

export interface RouteInput {
  preset: PanelPreset;
  messages: Array<{ role: string; content: string }>;
  onEvent?: (event: PanelEvent) => void;
  modeOverride?: PanelMode | "auto";
}

export interface RouteOutput {
  mode: PanelMode;
  taskAnalysis: TaskAnalysis;
  judgeResponse: string;
  agentResponses: AgentResponse[];
  totalCost: number;
  totalLatency: number;
  totalTokensIn: number;
  totalTokensOut: number;
}

export async function routeAndExecute(input: RouteInput): Promise<RouteOutput> {
  const { preset, messages, onEvent, modeOverride } = input;

  // Extract user prompt from messages
  const userPrompt = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  // Determine execution mode
  let mode: PanelMode;
  let taskAnalysis: TaskAnalysis;

  if (modeOverride && modeOverride !== "auto") {
    mode = modeOverride;
    taskAnalysis = {
      ...analyzeTask(userPrompt),
      recommendedMode: mode,
      reasoning: `User forced ${mode} mode (override)`,
    };
  } else {
    taskAnalysis = analyzeTask(userPrompt);
    // Phase 23A: Always council
    mode = "council";
  }

  // Emit panel:start event
  onEvent?.({
    type: "panel:start",
    presetName: preset.name,
    mode,
    agents: preset.agents,
    judge: preset.judge,
    taskAnalysis,
  });

  // Route to executor
  switch (mode) {
    case "council":
      return executeCouncil({ preset, messages, onEvent, taskAnalysis });

    case "swarm":
      // Phase 23B
      onEvent?.({
        type: "panel:error",
        message: "Swarm mode not available in Phase 23A",
      });
      throw new Error("Swarm mode not implemented yet. Coming in Phase 23B.");

    case "hybrid":
      // Phase 23B
      onEvent?.({
        type: "panel:error",
        message: "Hybrid mode not available in Phase 23A",
      });
      throw new Error("Hybrid mode not implemented yet. Coming in Phase 23B.");
  }
}
