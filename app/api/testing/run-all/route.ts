/**
 * POST /api/testing/run-all — Execute all smoke/regression tests
 * Phase 40 API
 * @author abhiswami2121@gmail.com
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = body.type || 'smoke';

    const { getOrchestrator } = await import('@/lib/testing/orchestrator');
    const orch = getOrchestrator();

    let result;
    if (type === 'regression') {
      result = await orch.scheduledRegression();
    } else if (type === 'full') {
      result = await orch.scheduledWeeklyFull();
    } else {
      result = await orch.scheduledSmokeTest();
    }

    return NextResponse.json({
      totalPlaybooks: result.totalPlaybooks,
      completed: result.completed,
      failed: result.failed,
      aggregateSummary: result.aggregateSummary,
      durationMs: result.totalDurationMs,
      totalCost: result.totalCost,
      results: result.results.map(r => ({
        playbookName: r.playbook.name,
        success: r.success,
        passRate: r.run.summary.passRate,
        durationMs: r.totalDurationMs,
      })),
    });
  } catch (err) {
    console.error('[api/testing/run-all] Error:', err);
    return NextResponse.json(
      { error: 'Batch execution failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
