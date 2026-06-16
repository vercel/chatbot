/**
 * Phase 23A: Fusion Panel Orchestration — Main Entry Point
 *
 * executePanel({preset, messages, onEvent, modeOverride}):
 *   1. Analyzes task → recommends mode (council for Phase 23A)
 *   2. Routes to council executor
 *   3. Logs telemetry
 *
 * Usage:
 *   import { executePanel } from "@/lib/ai/fusion";
 *   const result = await executePanel({ preset, messages });
 */

export {
  estimatePresetRange,
  estimateRunCost,
  formatCost,
} from "./cost-estimator";
export { executePanel } from "./execute-panel";
export {
  DEFAULT_PRESET_NAME,
  getDefaultPreset,
  getPresetByName,
  SYSTEM_PRESETS,
} from "./presets";
export { analyzeTask, isQuestion } from "./task-analyzer";
export { logPanelRun } from "./telemetry";

// Types
export type {
  AgentModel,
  AgentResponse,
  DomainHint,
  ExecutePanelOptions,
  FusionUserPreferences,
  JudgeModel,
  ModeDecision,
  PanelCapability,
  PanelEvent,
  PanelMode,
  PanelPreset,
  PanelRun,
  SubModeBreakdown,
  SubTask,
  TaskAnalysis,
  TaskScope,
  TaskType,
} from "./types";
