/**
 * POST /api/testing/run — Execute a single test playbook
 * Phase 40 API
 * @author abhiswami2121@gmail.com
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const playbookName = body.playbook;

    if (!playbookName) {
      return NextResponse.json({ error: 'Missing "playbook" field' }, { status: 400 });
    }

    const { executePlaybook } = await import('@/lib/testing/playbook-executor');
    const result = await executePlaybook(playbookName, {
      screenshotOnFail: true,
    });

    return NextResponse.json({
      runId: result.run.id,
      playbookName: result.playbook.name,
      success: result.success,
      summary: result.run.summary,
      durationMs: result.totalDurationMs,
      cost: result.run.estimatedCost,
      scenarios: result.run.scenarios.length,
      errors: result.run.errors,
    });
  } catch (err) {
    console.error('[api/testing/run] Error:', err);
    return NextResponse.json(
      { error: 'Test execution failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
