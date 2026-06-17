/**
 * GET /api/testing/runs/[runId] — Get detailed test run results
 * Phase 40 API
 * @author abhiswami2121@gmail.com
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } },
) {
  try {
    const { runId } = params;

    const { getOrchestrator } = await import('@/lib/testing/orchestrator');
    const orch = getOrchestrator();

    // Search history for this run
    const history = orch.getHistory(100);
    const run = history.find(r => r.run.id === runId);

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({
      runId: run.run.id,
      playbookName: run.playbook.name,
      status: run.run.status,
      targetUrl: run.playbook.targetUrl,
      startedAt: run.run.startedAt,
      completedAt: run.run.completedAt,
      durationMs: run.totalDurationMs,
      estimatedCost: run.run.estimatedCost,
      summary: run.run.summary,
      scenarios: run.run.scenarios,
      screenshots: run.run.screenshots,
      errors: run.run.errors,
    });
  } catch (err) {
    console.error('[api/testing/runs/[runId]] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch run details', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
