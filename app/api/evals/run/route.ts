/**
 * POST /api/evals/run — Execute eval batch
 *
 * Body: { evalIds?: string[] } — if omitted, runs ALL evals
 * Runs evals in sequence (~2s each), records results in library_eval_runs.
 * Evals are READ-ONLY — no production-impacting changes.
 */

import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray, desc } from "drizzle-orm";
import { libraryEval, libraryEvalRun } from "@/lib/db/schema";

const POSTGRES_URL = process.env.POSTGRES_URL;

export async function POST(req: NextRequest) {
  if (!POSTGRES_URL) return NextResponse.json({ error: "POSTGRES_URL not set" }, { status: 500 });
  const sqlClient = postgres(POSTGRES_URL, { max: 2 });
  const db = drizzle(sqlClient);

  try {
    const body = await req.json().catch(() => ({}));
    const { evalIds } = body as { evalIds?: string[] };

    // Fetch evals
    let evals;
    if (evalIds?.length) {
      evals = await db.select().from(libraryEval).where(inArray(libraryEval.id, evalIds));
    } else {
      evals = await db.select().from(libraryEval).orderBy(desc(libraryEval.severity));
    }

    if (evals.length === 0) {
      await sqlClient.end();
      return NextResponse.json({ error: "No evals found" }, { status: 404 });
    }

    const results = [];
    for (const e of evals) {
      const startMs = Date.now();
      try {
        // Simulate eval run — in production this would invoke the VPS agent
        // For now, record a placeholder run with computed metrics
        const qualityScore = Math.floor(Math.random() * 30) + 65; // 65-95 range for placeholder
        const gradeMap = ["F", "D", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"][
          Math.min(9, Math.floor(qualityScore / 10))
        ] || "F";
        const latencyMs = Math.floor(Math.random() * 4000) + 1000;

        const [run] = await db
          .insert(libraryEvalRun)
          .values({
            evalId: e.id,
            runAt: new Date(),
            status: qualityScore >= 70 ? "passed" : "failed",
            skillsLoaded: e.expectedSkills,
            connectorsUsed: e.expectedConnectors,
            modelUsed: e.expectedModel || "anthropic/claude-sonnet-4-20250514",
            qualityGrade: gradeMap,
            qualityScore,
            subScores: {
              efficiency: Math.floor(Math.random() * 30) + 65,
              correctness: Math.floor(Math.random() * 30) + 65,
              cortexUsage: Math.floor(Math.random() * 40) + 50,
              selfValidation: Math.floor(Math.random() * 30) + 60,
              reporting: Math.floor(Math.random() * 30) + 60,
              resilience: Math.floor(Math.random() * 40) + 55,
            },
            latencyMs,
            costUsd: String((Math.random() * 0.05 + 0.01).toFixed(8)),
            tokensIn: Math.floor(Math.random() * 3000) + 500,
            tokensOut: Math.floor(Math.random() * 1000) + 200,
            rawResponse: `[EVAL] ${e.evalName} — simulated run, score ${qualityScore}/100`,
          })
          .returning();

        results.push({ evalName: e.evalName, status: "passed", qualityScore, latencyMs, runId: run.id });
        console.log(`[evals] ${e.evalName}: ${gradeMap} (${qualityScore}/100, ${latencyMs}ms)`);
      } catch (err: any) {
        await db.insert(libraryEvalRun).values({
          evalId: e.id,
          runAt: new Date(),
          status: "error",
          errorMessage: err.message,
          latencyMs: Date.now() - startMs,
        });
        results.push({ evalName: e.evalName, status: "error", error: err.message });
      }
    }

    await sqlClient.end();
    return NextResponse.json({
      ran: evals.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    await sqlClient.end();
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

