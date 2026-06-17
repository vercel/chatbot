/**
 * GET  /api/discovery/run — List all active/completed runs
 * POST /api/discovery/run — Start a new discovery run
 *
 * Uses the lib/discovery workflow orchestrator for execution.
 * SSE events are streamed through a separate endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  createRun,
  getAllRuns,
  getRun,
  executeWorkflow,
  type SseCallback,
  type RunResult,
} from "@/lib/discovery";
import { WORKFLOW_TEMPLATES } from "@/lib/discovery";
import { generateReport } from "@/lib/discovery/report-generator";

// In-memory SSE subscribers per run
const runSubscribers = new Map<string, Set<SseCallback>>();

export function subscribeToRun(runId: string, cb: SseCallback): () => void {
  if (!runSubscribers.has(runId)) {
    runSubscribers.set(runId, new Set());
  }
  runSubscribers.get(runId)!.add(cb);
  return () => {
    runSubscribers.get(runId)?.delete(cb);
  };
}

function createEmitter(runId: string): { emit: SseCallback; cleanup: () => void } {
  return {
    emit: (event) => {
      const subs = runSubscribers.get(runId);
      if (subs) {
        for (const cb of subs) cb(event);
      }
      // Also store last event for polling fallback
      lastEvents.set(runId, event);
    },
    cleanup: () => {
      runSubscribers.delete(runId);
      lastEvents.delete(runId);
    },
  };
}

const lastEvents = new Map<string, { type: string; data: Record<string, unknown>; timestamp: string }>();

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("id");

    if (runId) {
      const run = getRun(runId);
      if (!run) {
        return NextResponse.json({ error: "run not found" }, { status: 404 });
      }
      const lastEvent = lastEvents.get(runId);
      return NextResponse.json({ run, lastEvent });
    }

    const runs = getAllRuns();
    const templates = WORKFLOW_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      category: t.category,
      steps: t.steps.map((s) => ({ id: s.id, name: s.name, type: s.type })),
      estimatedDuration: t.estimatedDuration,
      outputs: t.outputs,
    }));

    return NextResponse.json({ runs, templates });
  } catch (err) {
    console.error("[GET /api/discovery/run]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { workflowId, config } = body;

    if (!workflowId) {
      return NextResponse.json({ error: "workflowId required" }, { status: 400 });
    }

    const template = WORKFLOW_TEMPLATES.find((t) => t.id === workflowId);
    if (!template) {
      return NextResponse.json({ error: `unknown workflow: ${workflowId}` }, { status: 400 });
    }

    // Create run
    const run = createRun(workflowId);

    // Set up SSE emitter
    const { emit, cleanup } = createEmitter(run.id);

    // Execute in background (non-blocking for API response)
    const runPromise = executeWorkflow(run.id, {
      onEvent: emit,
      emit: (runId: string, type: string, data: Record<string, unknown>) => {
        emit({ type: type as any, runId, data, timestamp: new Date().toISOString() });
      },
    } as any, config)
      .then(async (result: RunResult) => {
        // Auto-generate report on completion
        if (result.run.status === "completed" && result.contexts.length > 0) {
          try {
            await generateReport({
              runId: result.run.id,
              contexts: result.contexts,
              validations: result.validations,
              graph: result.graph,
            });
          } catch (err) {
            console.error(`Report generation failed for ${result.run.id}:`, err);
          }
        }
        cleanup();
        return result;
      })
      .catch((err) => {
        console.error(`Run ${run.id} failed:`, err);
        emit({ type: "run_error", runId: run.id, data: { error: err instanceof Error ? err.message : "Unknown error" }, timestamp: new Date().toISOString() });
        cleanup();
      });

    // Store promise for status checking (won't block the response)
    runPromises.set(run.id, runPromise);

    return NextResponse.json({
      runId: run.id,
      status: run.status,
      workflowName: template.name,
      estimatedDuration: template.estimatedDuration,
      message: `Discovery run ${run.id} started for "${template.name}"`,
    });
  } catch (err) {
    console.error("[POST /api/discovery/run]", err);
    return NextResponse.json({ error: "failed to start run" }, { status: 500 });
  }
}

// Track run promises for lifecycle
const runPromises = new Map<string, Promise<RunResult>>();

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("id");
    if (runId) {
      // Clean up subscribers
      runSubscribers.delete(runId);
      lastEvents.delete(runId);
      runPromises.delete(runId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
