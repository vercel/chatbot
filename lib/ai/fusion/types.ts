/**
 * Phase 23A: Fusion Panel Types
 *
 * A PANEL is a smart CONTAINER that holds agents + judge + capabilities.
 * At runtime, the panel analyzes the task and picks mode:
 *   Council (same task → accuracy) | Swarm (decompose → efficiency) | Hybrid (mix)
 */

// ── Model Identity ──────────────────────────────────────────────────────────

export interface AgentModel {
  modelId: string;
  provider: string;
  name: string;
  role?: string; // Optional specialization label for swarm mode
}

export interface JudgeModel {
  modelId: string;
  provider: string;
  name: string;
  role: "judge";
}

// ── Panel Preset ────────────────────────────────────────────────────────────

export type PanelMode = "council" | "swarm" | "hybrid";
export type PanelCapability = PanelMode;
export type DomainHint = "general" | "coding" | "research" | "reasoning";

export interface PanelPreset {
  id: string;
  name: string;
  description: string;
  agents: AgentModel[];
  judge: JudgeModel;
  capabilities: PanelCapability[];
  domainHint: DomainHint;
  defaultMode: PanelMode;
  estCostMin: number;
  estCostMax: number;
  isSystem: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdBy: string | null;
}

// ── Task Analysis ───────────────────────────────────────────────────────────

export type TaskType = "question" | "task" | "project" | "investigation";
export type TaskScope = "single" | "multi-step" | "multi-faceted";

export interface TaskAnalysis {
  type: TaskType;
  scope: TaskScope;
  requiresAccuracy: boolean;
  requiresDecomposition: boolean;
  estimatedSubTasks: number;
  recommendedMode: PanelMode;
  reasoning: string;
}

// ── Agent Response ──────────────────────────────────────────────────────────

export interface AgentResponse {
  modelId: string;
  provider: string;
  name: string;
  role: "agent" | "judge";
  latency: number; // ms
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  response: string;
  success: boolean;
  error?: string;
}

// ── Panel Run ──────────────────────────────────────────────────────────────

export type ModeDecision = "auto" | "user-forced";

export interface SubTask {
  id: string;
  description: string;
  assignedTo: string; // modelId
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
}

export interface SubModeBreakdown {
  subTaskId: string;
  mode: PanelMode;
  reasoning: string;
}

export interface PanelRun {
  id: string;
  presetId: string;
  presetName: string;
  sessionId?: string;
  userId?: string;
  executionMode: PanelMode;
  modeDecision: ModeDecision;
  modeOverride?: PanelMode;
  taskAnalysis: TaskAnalysis;
  agentResponses: AgentResponse[];
  judgeResponse?: string;
  // Swarm mode
  subTaskDecomposition?: SubTask[];
  // Hybrid mode
  subModeBreakdown?: SubModeBreakdown[];
  agentContributionScores?: Record<string, number>;
  totalCost: number;
  totalLatency: number;
  totalTokensIn: number;
  totalTokensOut: number;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  errorMessage?: string;
  userRating?: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

// ── Panel Execution Options ─────────────────────────────────────────────────

export interface ExecutePanelOptions {
  preset: PanelPreset;
  messages: Array<{ role: string; content: string }>;
  onEvent?: (event: PanelEvent) => void;
  modeOverride?: PanelMode | "auto";
  sessionId?: string;
  userId?: string;
}

// ── Panel Events (SSE) ──────────────────────────────────────────────────────

export type PanelEvent =
  | {
      type: "panel:start";
      presetName: string;
      mode: PanelMode;
      agents: AgentModel[];
      judge: JudgeModel;
      taskAnalysis: TaskAnalysis;
    }
  | { type: "panel:cancelled"; reason: string }
  | { type: "panel:error"; message: string }
  | { type: "agent:start"; modelId: string; name: string }
  | { type: "agent:token"; modelId: string; token: string }
  | {
      type: "agent:complete";
      modelId: string;
      name: string;
      latency: number;
      tokensIn: number;
      tokensOut: number;
      response: string;
      success: boolean;
    }
  | { type: "judge:start"; modelId: string; name: string }
  | { type: "judge:token"; token: string }
  | {
      type: "judge:complete";
      fullResponse: string;
      totalCost: number;
      totalLatency: number;
    }
  | { type: "cost:update"; runningCost: number; runningLatency: number };

// ── Panel Chooser UI ────────────────────────────────────────────────────────

export interface PanelPresetCardData {
  preset: PanelPreset;
  agentAvatars: string[]; // provider logo filenames
  judgeAvatar: string;
  capabilityLabels: string[];
  costLabel: string;
}

// ── User Preferences ────────────────────────────────────────────────────────

export interface FusionUserPreferences {
  mode: "model" | "panel";
  selectedPresetId: string;
  modeOverride: PanelMode | "auto";
}
