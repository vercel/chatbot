/**
 * app/api/annotations/route.ts
 * PB-D — Annotation loop API endpoint.
 * GET: retrieve execution annotations with optional filters.
 * POST: record a new annotation after skill/workflow execution.
 */
import { NextResponse } from "next/server";
import {
  collectAnnotation,
  getAnnotations,
  getAnnotationSummary,
  clearAnnotations,
  type Annotation,
} from "@/connectors/neptune/functions/annotation-collector";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain") || undefined;
  const since = searchParams.get("since") || undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;

  const annotations = getAnnotations({ domain, since, limit });
  const summaries = getAnnotationSummary(domain);

  return NextResponse.json({
    annotations,
    summaries,
    total: annotations.length,
    timestamp: new Date().toISOString(),
    filters: { domain, since, limit },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      domain,
      playbook,
      skillOrWorkflow,
      outcome,
      durationMs,
      error,
      learning,
      toolsUsed,
    } = body;

    if (!domain || !playbook || !skillOrWorkflow || !outcome || typeof durationMs !== "number") {
      return NextResponse.json(
        {
          error:
            "Missing required fields: domain, playbook, skillOrWorkflow, outcome, durationMs",
        },
        { status: 400 }
      );
    }

    if (!["success", "partial", "failure"].includes(outcome)) {
      return NextResponse.json(
        { error: "outcome must be one of: success, partial, failure" },
        { status: 400 }
      );
    }

    const annotation = collectAnnotation({
      domain,
      playbook,
      skillOrWorkflow,
      outcome,
      durationMs,
      error,
      learning,
      toolsUsed: toolsUsed || [],
    });

    return NextResponse.json({ recorded: annotation, timestamp: new Date().toISOString() }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to record annotation" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  clearAnnotations();
  return NextResponse.json({ cleared: true, timestamp: new Date().toISOString() });
}
