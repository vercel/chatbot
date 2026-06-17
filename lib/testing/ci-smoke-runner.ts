/**
 * Phase 40 — CI Smoke Test Runner
 * Runs smoke tests in GitHub Actions, outputs JSON results.
 * Called from .github/workflows/agent-test.yml
 * @author abhiswami2121@gmail.com
 */

import { executePlaybook } from './playbook-executor';
import { writeFileSync } from 'fs';

interface CIResult {
  passRate: number;
  passed: number;
  total: number;
  failed: number;
  duration: number;
  cost: number;
  failures: { scenario: string; error: string }[];
  playbookResults: { name: string; success: boolean; passRate: number }[];
}

async function main() {
  const startTime = Date.now();
  const smokePlaybooks = ['chat-smoke-test'];
  const results: CIResult = {
    passRate: 0,
    passed: 0,
    total: 0,
    failed: 0,
    duration: 0,
    cost: 0,
    failures: [],
    playbookResults: [],
  };

  let totalScenarios = 0;
  let passedScenarios = 0;

  for (const playbookName of smokePlaybooks) {
    try {
      console.log(`\n=== Running: ${playbookName} ===`);
      const result = await executePlaybook(playbookName, {
        screenshotOnFail: true,
      });

      results.playbookResults.push({
        name: playbookName,
        success: result.success,
        passRate: result.run.summary.passRate,
      });

      totalScenarios += result.run.summary.total;
      passedScenarios += result.run.summary.passed;
      results.cost += result.run.estimatedCost || 0;

      // Collect failures
      for (const scenario of result.run.scenarios) {
        if (scenario.result === 'fail' || scenario.result === 'error') {
          results.failures.push({
            scenario: `${playbookName} > ${scenario.name}`,
            error: scenario.error || `Failed with status: ${scenario.result}`,
          });
        }
      }

      console.log(`  Pass: ${result.run.summary.passed}/${result.run.summary.total} (${result.run.summary.passRate}%)`);
    } catch (err) {
      console.error(`  FAILED to execute ${playbookName}:`, err);
      results.failures.push({
        scenario: playbookName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  results.total = totalScenarios;
  results.passed = passedScenarios;
  results.failed = results.failures.length;
  results.passRate = totalScenarios > 0
    ? Math.round((passedScenarios / totalScenarios) * 100)
    : 0;
  results.duration = Math.round((Date.now() - startTime) / 1000);

  // Write JSON for GitHub Actions comment
  writeFileSync('/tmp/test-results.json', JSON.stringify(results, null, 2));

  console.log(`\n=== CI Smoke Test Complete ===`);
  console.log(`Pass Rate: ${results.passRate}% (${results.passed}/${results.total})`);
  console.log(`Duration: ${results.duration}s`);
  console.log(`Cost: $${results.cost.toFixed(4)}`);

  // Exit with failure code if tests failed
  if (results.passRate < 90) {
    console.error('❌ Smoke test pass rate below 90% threshold');
    process.exit(1);
  }

  console.log('✅ All smoke tests passed');
  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
