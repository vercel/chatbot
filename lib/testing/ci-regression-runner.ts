/**
 * Phase 40 — CI Regression Test Runner
 * Runs full regression suite in CI.
 * @author abhiswami2121@gmail.com
 */

import { getOrchestrator } from './orchestrator';
import { writeFileSync } from 'fs';

async function main() {
  const startTime = Date.now();

  console.log('=== CI Regression Test Suite ===');
  const orch = getOrchestrator();

  const result = await orch.scheduledRegression();

  // Write JSON results
  writeFileSync('/tmp/test-results.json', JSON.stringify({
    passRate: result.aggregateSummary.passRate,
    passed: result.aggregateSummary.passed,
    total: result.aggregateSummary.total,
    failed: result.failed,
    duration: Math.round((Date.now() - startTime) / 1000),
    cost: result.totalCost,
    failures: result.results
      .filter(r => !r.success)
      .map(r => ({
        scenario: r.playbook.name,
        error: `${r.run.summary.failed} scenarios failed`,
      })),
  }, null, 2));

  console.log(`\n=== Regression Complete ===`);
  console.log(`Pass Rate: ${result.aggregateSummary.passRate}%`);
  console.log(`Duration: ${Math.round((Date.now() - startTime) / 1000)}s`);

  if (result.failed > 0) {
    console.error(`❌ ${result.failed} playbooks failed`);
    process.exit(1);
  }

  console.log('✅ All regression tests passed');
  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
