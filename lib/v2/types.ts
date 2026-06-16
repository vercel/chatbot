/**
 * Phase 23B: V2 Handoff Types
 *
 * Types for chat-to-V2 handoff communication.
 */

export type V2HandoffMode = "new_project" | "modify_existing" | "investigation";

export type V2HandoffStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface V2HandoffSession {
  id: string;
  userId: string | null;
  chatId: string | null;
  v2SessionId: string;
  handoffMode: V2HandoffMode;
  targetRepo: string | null;
  goal: string;
  status: V2HandoffStatus;
  streamUrl: string | null;
  resultUrl: string | null;
  errorMessage: string | null;
  eventCount: number;
  startedAt: string;
  endedAt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface V2SpawnRequest {
  goal: string;
  mode: V2HandoffMode;
  targetRepo?: string;
  context?: object;
}

export interface V2SpawnResponse {
  v2SessionId: string;
  streamUrl: string;
  v2Url: string;
  status: string;
}

export interface V2HandoffEvent {
  type: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface V2HandoffListResponse {
  handoffs: V2HandoffSession[];
  aggregates: {
    running: number;
    completed: number;
    failed: number;
  };
}

// V2 backend env configuration
export const V2_BASE_URL = process.env.V2_BASE_URL || "https://neptune-v2.vercel.app";
export const V2_AGENT_TOKEN = process.env.V2_AGENT_TOKEN || "";
export const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || "team_NXlYvSlpN5mMinKXi0emQkFT";
