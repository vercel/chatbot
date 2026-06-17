/**
 * GET  /api/discovery/actions?runId=xxx — List actions for a run
 * POST /api/discovery/actions — Approve/reject/dispatch actions
 *
 * Body: { action: "approve"|"reject"|"dispatch", actionIds: string[], runId?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  getActionsForRun,
  approveAction,
  rejectAction,
  approveAll,
  rejectAll,
  dispatchAction,
  dispatchAll,
  getActionStats,
  summarizeActions,
} from "@/lib/discovery/action-dispatcher";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");
    const actionId = searchParams.get("actionId");

    if (actionId) {
      const { getAction } = await import("@/lib/discovery/action-dispatcher");
      const action = getAction(actionId);
      if (!action) {
        return NextResponse.json({ error: "action not found" }, { status: 404 });
      }
      return NextResponse.json({ action });
    }

    if (!runId) {
      return NextResponse.json({ error: "runId or actionId required" }, { status: 400 });
    }

    const actions = getActionsForRun(runId);
    const stats = getActionStats(runId);

    return NextResponse.json({ actions, stats });
  } catch (err) {
    console.error("[GET /api/discovery/actions]", err);
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
    const { action, actionIds, runId } = body;

    if (!action) {
      return NextResponse.json({ error: "action field required (approve|reject|dispatch)" }, { status: 400 });
    }

    const operator = session.user.email || session.user.name || "operator";

    switch (action) {
      case "approve": {
        if (runId && !actionIds) {
          const results = approveAll(runId, operator);
          return NextResponse.json({ approved: results.length, results });
        }
        if (!actionIds || !Array.isArray(actionIds)) {
          return NextResponse.json({ error: "actionIds array required" }, { status: 400 });
        }
        const results = actionIds.map((id: string) => {
          try {
            return approveAction(id, operator);
          } catch (err) {
            return { id, error: err instanceof Error ? err.message : "Failed" };
          }
        });
        return NextResponse.json({ approved: results.length, results });
      }

      case "reject": {
        if (runId && !actionIds) {
          const results = rejectAll(runId, body.reason);
          return NextResponse.json({ rejected: results.length, results });
        }
        if (!actionIds || !Array.isArray(actionIds)) {
          return NextResponse.json({ error: "actionIds array required" }, { status: 400 });
        }
        const results = actionIds.map((id: string) => {
          try {
            return rejectAction(id, body.reason);
          } catch (err) {
            return { id, error: err instanceof Error ? err.message : "Failed" };
          }
        });
        return NextResponse.json({ rejected: results.length, results });
      }

      case "dispatch": {
        if (runId && !actionIds) {
          const results = await dispatchAll(runId);
          return NextResponse.json(results);
        }
        if (!actionIds || !Array.isArray(actionIds)) {
          return NextResponse.json({ error: "actionIds array required" }, { status: 400 });
        }
        const results = await Promise.all(
          actionIds.map((id: string) =>
            dispatchAction(id).catch((err) => ({
              actionId: id,
              success: false,
              status: "failed",
              error: err instanceof Error ? err.message : "Failed",
              durationMs: 0,
            }))
          )
        );
        const succeeded = results.filter((r) => r.success).length;
        return NextResponse.json({
          total: results.length,
          succeeded,
          failed: results.length - succeeded,
          results,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}. Use approve|reject|dispatch` }, { status: 400 });
    }
  } catch (err) {
    console.error("[POST /api/discovery/actions]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
