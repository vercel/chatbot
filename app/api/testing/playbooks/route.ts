/**
 * GET /api/testing/playbooks — List available test playbooks
 * Phase 40 API
 * @author abhiswami2121@gmail.com
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Dynamic import to avoid bundling server-only modules on client
    const { listPlaybooks } = await import('@/lib/testing/playbook-executor');
    const playbooks = listPlaybooks();

    return NextResponse.json({
      playbooks,
      total: playbooks.length,
      framework: 'Phase 40 — Playwright v1.51 + agent-browser v0.28.0',
    });
  } catch (err) {
    console.error('[api/testing/playbooks] Error:', err);
    return NextResponse.json(
      { error: 'Failed to list playbooks', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
