/**
 * Autonomous Mission — Barrel Export
 *
 * Single import for all autonomous coding platform modules.
 *
 * import { MissionRunner, parsePrdToPlan, GitOps, Sandbox, DeployWatcher } from "@/lib/autonomous-mission";
 *
 * Phase 38: Autonomous Coding Platform
 */

export { MissionRunner, MissionAbortedError, MissionFailedError, createMissionRunner } from "./runner";
export type {
  MissionStatus,
  ExecutionMode,
  MissionEventType,
  MissionEvent,
  InterventionCommand,
  Checkpoint,
  MissionSummary,
  MissionOptions,
  MissionContext,
  EventCallback,
} from "./runner";

export { parsePrdToPlan, classifyStep, extractAcceptanceCriteria } from "./prd-parser";
export type {
  ExecutionPlan,
  ExecutionStep,
  StreamPlan,
  CardinalRule,
} from "./prd-parser";

export * as GitOps from "./git-ops";
export type { GitResult } from "./git-ops";

export * as Sandbox from "./sandbox-executor";
export type {
  SandboxOptions,
  SandboxResult,
  SandboxBackend,
  FileWriteSpec,
  FileReadResult,
} from "./sandbox-executor";

export * as DeployWatcher from "./deploy-watcher";
export type {
  DeployStatus,
  DeployWatchOptions,
  DeployWatchResult,
  DeployEvent,
  DeployStatusCallback,
} from "./deploy-watcher";
