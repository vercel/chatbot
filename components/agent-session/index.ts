/**
 * components/agent-session — Barrel Export
 *
 * Multi-lane agent session card ecosystem.
 *
 * Components:
 *   AgentSessionCard    — Main routing card (routes between V2 and VPS lanes)
 *   V2SessionCardBody   — V2-specific UI (Opus 4.6, PR, deploy, file diffs)
 *   VpsSessionCardBody  — VPS-specific UI (DeepSeek, steps, tool calls, Slack)
 *   SessionProgressBar  — Shared progress indicator
 *   FileDiffPreview     — Diff viewer with syntax highlighting
 *   BuildLogStream      — Auto-following log viewer
 *   DeployStatus        — Vercel deploy state + URL
 *   SessionActions      — Action button row (open, share, cancel, retry)
 *   SessionCardExpanded — Full-screen overlay with tabs
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

export { AgentSessionCard } from "./AgentSessionCard";
export type { AgentSessionCardProps, CardStatus } from "./AgentSessionCard";

export { V2SessionCardBody } from "./V2SessionCardBody";
export type { V2SessionCardBodyProps } from "./V2SessionCardBody";

export { VpsSessionCardBody } from "./VpsSessionCardBody";
export type { VpsSessionCardBodyProps, VpsStep, ToolCallEntry } from "./VpsSessionCardBody";

export { SessionProgressBar } from "./SessionProgressBar";
export type { SessionProgressBarProps } from "./SessionProgressBar";

export { FileDiffPreview } from "./FileDiffPreview";
export type { FileDiffPreviewProps, FileChange } from "./FileDiffPreview";

export { BuildLogStream } from "./BuildLogStream";
export type { BuildLogStreamProps, LogLine } from "./BuildLogStream";

export { DeployStatus } from "./DeployStatus";
export type { DeployStatusProps, DeployState } from "./DeployStatus";

export { SessionActions } from "./SessionActions";
export type { SessionActionsProps } from "./SessionActions";

export { SessionCardExpanded } from "./SessionCardExpanded";
export type { SessionCardExpandedProps } from "./SessionCardExpanded";
