/**
 * GET /api/testing/runs — List recent test runs
 * Phase 40 API
 * @author abhiswami2121@gmail.com
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { getOrchestrator } = await import('@/lib/testing/orchestrator');
    const orch = getOrchestrator();

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');
    const history = orch.getHistory(limit);

    const runs = history.map(r => ({
      runId: r.run.id,
      playbookName: r.playbook.name,
      status: r.run.status,
      passRate: r.run.summary.passRate,
      duration: `${(r.totalDurationMs / 1000).toFixed(1)}s`,
      timestamp: r.run.startedAt,
      cost: r.run.estimatedCost,
    }));

    return NextResponse.json({ runs, total: runs.length });
  } catch (err) {
    console.error('[api/testing/runs] Error:', err);
    return NextResponse.json({ runs: [], total: 0 });
  }
}
