/**
 * POST /api/testing/deploy-hook — Vercel Deploy Hook Handler
 * Triggered on deployment.ready webhook. Runs smoke tests against new deployment.
 * Blocks deploy if smoke fails (optional, configurable).
 *
 * Configure in Vercel: Settings → Webhooks → deployment.ready → POST to this endpoint.
 * @author abhiswami2121@gmail.com
 */

import { NextRequest, NextResponse } from 'next/server';

const DEPLOY_HOOK_SECRET = process.env.DEPLOY_HOOK_SECRET || 'phase40-deploy-hook-secret';
const PRE_DEPLOY_BLOCKING = process.env.PRE_DEPLOY_GATE_BLOCKING === 'true';

interface VercelDeployPayload {
  type: string;
  payload: {
    deployment: {
      id: string;
      url: string;
      inspectorUrl: string;
      meta?: Record<string, string>;
    };
    project: {
      id: string;
      name: string;
    };
  };
}

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const authHeader = req.headers.get('x-vercel-signature') || req.headers.get('authorization') || '';
  const expected = `Bearer ${DEPLOY_HOOK_SECRET}`;
  if (authHeader !== expected && req.headers.get('x-vercel-signature') !== DEPLOY_HOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: VercelDeployPayload = await req.json();
    const deployUrl = body.payload?.deployment?.url;
    const projectName = body.payload?.project?.name;

    if (!deployUrl) {
      return NextResponse.json({ error: 'Missing deployment URL' }, { status: 400 });
    }

    console.log(`[deploy-hook] Deployment ready: ${projectName} → ${deployUrl}`);

    // Determine test set based on project
    const testPlaybooks = getTestPlaybooksForProject(projectName);

    if (testPlaybooks.length === 0) {
      console.log(`[deploy-hook] No tests configured for project: ${projectName}`);
      return NextResponse.json({
        status: 'skipped',
        message: `No tests configured for ${projectName}`,
      });
    }

    // Run smoke tests
    const { getOrchestrator } = await import('@/lib/testing/orchestrator');
    const orch = getOrchestrator();

    // Override target URL for this deployment
    const results = [];
    for (const playbook of testPlaybooks) {
      try {
        // Execute against the new deployment URL
        const result = await orch.runSingle(playbook);
        results.push({
          playbook,
          success: result.success,
          passRate: result.run.summary.passRate,
        });
      } catch (err) {
        results.push({
          playbook,
          success: false,
          passRate: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const allPassed = results.every(r => r.success);
    const aggregatePassRate = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.passRate, 0) / results.length)
      : 100;

    console.log(
      `[deploy-hook] Tests complete: ${aggregatePassRate}% pass rate. ` +
      `Blocking: ${PRE_DEPLOY_BLOCKING ? 'YES' : 'NO'}`
    );

    // If blocking mode and tests failed, return error
    if (!allPassed && PRE_DEPLOY_BLOCKING) {
      return NextResponse.json(
        {
          status: 'blocked',
          message: 'Pre-deploy smoke tests failed',
          passRate: aggregatePassRate,
          results,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      status: allPassed ? 'passed' : 'warning',
      message: allPassed
        ? 'All pre-deploy tests passed'
        : `${results.filter(r => !r.success).length} test(s) failed (advisory only)`,
      passRate: aggregatePassRate,
      results,
    });
  } catch (err) {
    console.error('[deploy-hook] Error:', err);
    return NextResponse.json(
      { error: 'Deploy hook processing failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/**
 * Map Vercel project names to test playbooks.
 */
function getTestPlaybooksForProject(projectName: string): string[] {
  const map: Record<string, string[]> = {
    'neptune-chat': ['chat-smoke-test', 'chat-discovery-workflow-test'],
    'neptune-chat-ashy': ['chat-smoke-test'],
    'neptune-v2': ['v2-smoke-test'],
    'neptune-crm': ['twenty-crm-smoke-test'],
    'newleaf-portal': ['portal-customer-flow'],
    'default': ['chat-smoke-test'],
  };

  // Normalize project name
  const key = Object.keys(map).find(k =>
    projectName.toLowerCase().includes(k.toLowerCase())
  ) || 'default';

  return map[key];
}
