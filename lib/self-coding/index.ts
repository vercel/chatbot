/**
 * lib/self-coding — Barrel Export
 *
 * M-N-SELF-CODING (2026-06-21): Self-coding workflow engine for Neptune Chat.
 *
 * Architecture:
 *   workflow.ts  — Orchestration: classify, route, health-check, fallback chain
 *   code-apply.ts — Direct GitHub code application (branch, commit, PR)
 *   deploy.ts    — Direct Vercel deployment (trigger, poll, URL)
 *
 * Provides:
 *   - 3-lane coding dispatch (V2 / VPS / SELF)
 *   - Automatic health-aware fallback (V2 → VPS → SELF)
 *   - GitHub REST API code application
 *   - Vercel REST API deployment
 *   - SSE event formatting
 */

export {
  classifyTask,
  checkLaneHealth,
  routeTask,
  routeAndDispatch,
  createSelfCodingEvent,
  formatSseEvent,
} from "./workflow";

export type {
  CodingLane,
  TaskClassification,
  LaneHealth,
  SelfCodingSession,
  SelfCodingEvent,
  SelfCodingEventType,
  RoutingDecision,
} from "./workflow";

export { codeApply, quickCodeApply } from "./code-apply";
export type { CodeApplyInput, CodeApplyResult, FileChangeInput, BranchInfo } from "./code-apply";

export {
  deployToVercel,
  checkDeployStatus,
  deployNeptuneChat,
  NEPTUNE_CHAT_PROJECT_ID,
} from "./deploy";
export type { DeployInput, DeployResult, DeployStatus } from "./deploy";

export {
  formatSelfCodeSse,
  isSelfCodeEventType,
  SELF_CODE_EVENT_TYPES,
} from "./sse-events";
export type {
  SelfCodeEventMap,
  PlanGeneratedPayload,
  ApplyingDiffPayload,
  TestsRunningPayload,
  PrOpenedPayload,
  DeployStartedPayload,
  DeployCompletePayload,
} from "./sse-events";
