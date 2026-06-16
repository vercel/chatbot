/**
 * Phase 23B: Mode Router (FULL)
 *
 * Routes to the appropriate executor based on execution mode.
 * Council → executeCouncil | Swarm → executeSwarm | Hybrid → executeHybrid
 */

import { executeCouncil } from "./council/execute";
import { executeSwarm } from "./swarm/execute";
import { executeHybrid } from "./hybrid/execute";
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
    // Use recommended mode from analyzer (Phase 23B: full detection)
    mode = taskAnalysis.recommendedMode;

    // Fallback based on preset's defaultMode if analysis is ambiguous
    if (!mode || mode === "council") {
      // If task looks decomposable but analyzer recommended council,
      // fall back to preset's default mode
      if (
        taskAnalysis.requiresDecomposition &&
        preset.defaultMode !== "council"
      ) {
        mode = preset.defaultMode;
        taskAnalysis = {
          ...taskAnalysis,
          recommendedMode: mode,
          reasoning: `${taskAnalysis.reasoning} Overriding to preset default: ${mode}.`,
        };
      }
    }
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
    case "council": {
      const result = await executeCouncil({
        preset,
        messages,
        onEvent,
        taskAnalysis,
      });
      return { ...result, mode, taskAnalysis };
    }

    case "swarm": {
      const result = await executeSwarm({
        preset,
        messages,
        onEvent,
        taskAnalysis,
      });
      return { ...result, mode, taskAnalysis };
    }

    case "hybrid": {
      const result = await executeHybrid({
        preset,
        messages,
        onEvent,
        taskAnalysis,
      });
      return { ...result, mode, taskAnalysis };
    }

    default: {
      // Fallback to council
      const result = await executeCouncil({
        preset,
        messages,
        onEvent,
        taskAnalysis,
      });
      return { ...result, mode: "council", taskAnalysis };
    }
  }
}
