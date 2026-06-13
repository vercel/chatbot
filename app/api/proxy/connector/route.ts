/**
 * app/api/proxy/connector/route.ts
 * Phase 9 — Connector proxy enabling Chat↔V2 round-trips.
 *
 * POST: Relay a connector action from Chat to V2 (or vice versa).
 * Used for skills_changed events and cross-agent communication.
 *
 * The proxy handles:
 *   - Connector action routing
 *   - Skills_changed event emission
 *   - Annotation feedback loop trigger
 */
import { NextResponse } from "next/server";
import { routeNeptuneAction } from "@/connectors/neptune/client";
import { recordUsage } from "@/connectors/neptune/functions/usage-telemetry";
import { collectAnnotation } from "@/connectors/neptune/functions/annotation-collector";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      action,         // e.g. "github.branch.list"
      payload,        // action-specific parameters
      source,         // "chat" | "v2" | "cron"
      annotation,     // optional annotation for feedback loop
    } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Missing required field: action (format: connector.skill)" },
        { status: 400 }
      );
    }

    const startMs = Date.now();
    let result: unknown;
    let error: string | undefined;

    try {
      result = await routeNeptuneAction(action, payload || {});
    } catch (e: any) {
      error = e?.message || "Unknown connector error";
    }

    const durationMs = Date.now() - startMs;

    // Record telemetry
    const [connector] = action.split(".");
    const domain = body.domain || "cross-cutting";
    recordUsage({
      skillOrFunction: action,
      connector,
      domain,
      durationMs,
      error,
    });

    // Record annotation for feedback loop (PB-D)
    const outcome = error ? "failure" : "success";
    const annotationRecord = collectAnnotation({
      domain,
      playbook: body.playbook || `playbooks/${domain}/playbook-${domain}.md`,
      skillOrWorkflow: action,
      outcome,
      durationMs,
      error,
      learning: body.annotation?.learning,
      toolsUsed: [connector, ...(body.annotation?.toolsUsed || [])],
    });

    // Emit skills_changed event if this was a mutation
    const mutationActions = ["create", "update", "delete", "submit", "push", "deploy", "merge"];
    const actionVerb = action.split(".").pop() || "";
    const isMutation = mutationActions.includes(actionVerb);

    const event = isMutation
      ? { type: "skills_changed", action, source: source || "unknown", timestamp: new Date().toISOString() }
      : null;

    return NextResponse.json({
      success: !error,
      result,
      error,
      durationMs,
      event,
      annotation: annotationRecord.id,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Proxy error", timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
