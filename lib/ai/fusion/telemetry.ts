/**
 * Phase 23A: Panel Telemetry
 *
 * Logs every panel run to library_panel_runs + library_panel_telemetry.
 * ALWAYS logs executionMode + taskAnalysis.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { libraryPanelRun, libraryPanelTelemetry } from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils";
import type { AgentResponse, PanelRun, TaskAnalysis } from "./types";

// ── Lazy DB connection ───────────────────────────────────────────────

let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!_db) {
    const url = process.env.POSTGRES_URL;
    if (!url) {
      console.warn(
        "[fusion-telemetry] POSTGRES_URL not set — telemetry disabled"
      );
      return null;
    }
    const connection = postgres(url, { max: 1 });
    _db = drizzle(connection);
  }
  return _db;
}

// ── Telemetry Writer ──────────────────────────────────────────────────

export interface TelemetryInput {
  presetId: string;
  presetName: string;
  sessionId?: string;
  userId?: string;
  executionMode: PanelRun["executionMode"];
  modeDecision: PanelRun["modeDecision"];
  modeOverride?: PanelRun["modeOverride"];
  taskAnalysis: TaskAnalysis;
  agentResponses: AgentResponse[];
  judgeResponse?: string;
  totalCost: number;
  totalLatency: number;
  totalTokensIn: number;
  totalTokensOut: number;
  status: PanelRun["status"];
  errorMessage?: string;
}

export async function logPanelRun(
  input: TelemetryInput
): Promise<string | null> {
  const db = getDb();
  if (!db) {
    return null;
  }

  const runId = generateUUID();

  try {
    // Insert panel run
    await db.insert(libraryPanelRun).values({
      id: runId,
      presetId: input.presetId,
      presetName: input.presetName,
      sessionId: input.sessionId ?? null,
      userId: input.userId ?? null,
      executionMode: input.executionMode,
      modeDecision: input.modeDecision,
      modeOverride: input.modeOverride ?? null,
      taskAnalysis: input.taskAnalysis as unknown as Record<string, unknown>,
      agentResponses: input.agentResponses,
      judgeResponse: input.judgeResponse ?? null,
      totalCost: String(input.totalCost),
      totalLatencyMs: input.totalLatency,
      totalTokensIn: input.totalTokensIn,
      totalTokensOut: input.totalTokensOut,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      startedAt: new Date(),
      completedAt:
        input.status === "completed" || input.status === "failed"
          ? new Date()
          : null,
      createdAt: new Date(),
    });

    // Insert per-agent telemetry
    for (const ar of input.agentResponses) {
      await db.insert(libraryPanelTelemetry).values({
        panelRunId: runId,
        agentModelId: ar.modelId,
        agentRole: ar.role,
        latencyMs: ar.latency,
        tokensIn: ar.tokensIn,
        tokensOut: ar.tokensOut,
        costUsd: String(ar.costUsd),
        success: ar.success,
        errorMessage: ar.error ?? null,
        responsePreview: ar.response.slice(0, 500),
        createdAt: new Date(),
      });
    }

    return runId;
  } catch (err) {
    console.error(
      "[fusion-telemetry] Failed to log panel run:",
      (err as Error).message
    );
    return null;
  }
}
