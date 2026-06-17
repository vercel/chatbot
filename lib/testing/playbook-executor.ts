/**
 * Phase 40 — Playbook Executor
 * Reads NKS playbook .md files, parses them, and executes scenarios
 * via TestSession. Records pass/fail per scenario.
 * @author abhiswami2121@gmail.com
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parsePlaybook, validatePlaybook } from './playbook-parser';
import { TestSession, createTestSession } from './session';
import { getCredentialsForSystem } from './credentials';
import type { TestPlaybook, TestRun, PlaybookScenario } from './types';

// ===== Playbook Loader =====

const PLAYBOOKS_DIR = join(process.cwd(), 'cortex/playbooks/testing');

/**
 * Load a playbook by filename (without .md extension).
 */
export function loadPlaybook(name: string): TestPlaybook {
  const path = join(PLAYBOOKS_DIR, `${name}.md`);
  if (!existsSync(path)) {
    throw new Error(`Playbook not found: ${name} (looked at ${path})`);
  }

  const markdown = readFileSync(path, 'utf-8');
  const playbook = parsePlaybook(markdown);

  // Validate
  const validation = validatePlaybook(playbook);
  if (!validation.valid) {
    throw new Error(`Invalid playbook "${name}": ${validation.errors.join(', ')}`);
  }

  return playbook;
}

/**
 * List all available playbooks.
 */
export function listPlaybooks(): { name: string; path: string; description: string }[] {
  const { readdirSync } = require('fs');
  try {
    return readdirSync(PLAYBOOKS_DIR)
      .filter((f: string) => f.endsWith('.md'))
      .map((f: string) => {
        try {
          const playbook = loadPlaybook(f.replace('.md', ''));
          return { name: playbook.name, path: f, description: playbook.description };
        } catch {
          return { name: f, path: f, description: 'Failed to parse' };
        }
      });
  } catch {
    return [];
  }
}

// ===== Executor =====

export interface PlaybookExecutionResult {
  playbook: TestPlaybook;
  run: TestRun;
  success: boolean;
  totalDurationMs: number;
}

/**
 * Execute a full playbook against a real target.
 * 1. Load playbook
 * 2. Get credentials for target system
 * 3. Create session → sign in → run scenarios → sign out → close
 * 4. Return structured results
 */
export async function executePlaybook(
  playbookName: string,
  options?: {
    runId?: string;
    signIn?: boolean;
    maxScenarios?: number;
    screenshotOnFail?: boolean;
  },
): Promise<PlaybookExecutionResult> {
  const startTime = Date.now();
  const runId = options?.runId || `run-${Date.now()}-${playbookName}`;

  // 1. Load playbook
  const playbook = loadPlaybook(playbookName);
  console.log(`[executor] Loaded playbook: ${playbook.name} v${playbook.version}`);

  // 2. Credentials
  const creds = getCredentialsForSystem(playbook.targetSystem);

  // 3. Create session
  const session = await createTestSession(
    runId,
    playbook.name,
    playbook.name,
    playbook.targetUrl,
  );

  try {
    // 4. Navigate to target
    await session.getAgent()?.navigate(playbook.targetUrl);
    await session.getAgent()?.waitForNavigation();

    // 5. Sign in if needed
    if (options?.signIn !== false && creds.email && creds.password) {
      const signInResult = await session.getAgent()?.signIn(creds.email, creds.password, {
        waitAfterSubmit: 3000,
      });
      if (signInResult && !signInResult.success) {
        console.warn(`[executor] Sign in failed: ${signInResult.error}. Continuing unauthenticated.`);
      }
    }

    // 6. Run scenarios
    const scenarioCount = options?.maxScenarios
      ? Math.min(playbook.scenarios.length, options.maxScenarios)
      : playbook.scenarios.length;

    for (let i = 0; i < scenarioCount; i++) {
      const scenario = playbook.scenarios[i];
      console.log(`[executor] Running scenario ${i + 1}/${scenarioCount}: ${scenario.name}`);

      await session.runScenario(scenario);

      if (session.isAborted()) {
        console.warn(`[executor] Playbook aborted after ${i + 1} scenarios`);
        break;
      }
    }

    // 7. Close session
    await session.close();

    const run = session.getRun();
    const durationMs = Date.now() - startTime;

    console.log(
      `[executor] Playbook complete: ${run.summary.passed}/${run.summary.total} passed ` +
      `(${run.summary.passRate}%) in ${(durationMs / 1000).toFixed(1)}s ` +
      `Cost: $${run.estimatedCost.toFixed(4)}`
    );

    return {
      playbook,
      run,
      success: run.summary.passRate >= 90, // 90% pass threshold
      totalDurationMs: durationMs,
    };
  } catch (err) {
    console.error(`[executor] Playbook execution failed:`, err);
    await session.close().catch(() => {});

    const run = session.getRun();
    return {
      playbook,
      run,
      success: false,
      totalDurationMs: Date.now() - startTime,
    };
  }
}

/**
 * Generate a markdown report from a playbook execution.
 */
export function generateReport(result: PlaybookExecutionResult): string {
  const { playbook, run } = result;
  const lines: string[] = [];

  lines.push(`# Test Report: ${playbook.name}`);
  lines.push(`**Version:** ${playbook.version} | **Target:** ${playbook.targetUrl}`);
  lines.push(`**Run ID:** ${run.id} | **Status:** ${run.status}`);
  lines.push(`**Duration:** ${((run.durationMs || 0) / 1000).toFixed(1)}s | **Cost:** $${run.estimatedCost.toFixed(4)}`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`| Total | Passed | Failed | Errors | Skipped | Pass Rate |`);
  lines.push(`|-------|--------|--------|--------|---------|-----------|`);
  lines.push(`| ${run.summary.total} | ${run.summary.passed} | ${run.summary.failed} | ${run.summary.errors} | ${run.summary.skipped} | ${run.summary.passRate}% |`);
  lines.push('');

  lines.push('## Scenarios');
  for (const scenario of run.scenarios) {
    const emoji = scenario.result === 'pass' ? '✅' :
      scenario.result === 'fail' ? '❌' :
      scenario.result === 'error' ? '💥' : '⏭️';
    lines.push(`### ${emoji} ${scenario.name}`);
    lines.push(`- **Result:** ${scenario.result}`);
    lines.push(`- **Duration:** ${(scenario.durationMs / 1000).toFixed(1)}s`);
    if (scenario.error) lines.push(`- **Error:** ${scenario.error}`);
    if (scenario.consoleErrors.length > 0) {
      lines.push(`- **Console Errors:** ${scenario.consoleErrors.length}`);
    }
    if (scenario.assertions.length > 0) {
      lines.push('- **Assertions:**');
      for (const a of scenario.assertions) {
        lines.push(`  - ${a.passed ? '✅' : '❌'} ${a.description}`);
      }
    }
    lines.push('');
  }

  if (run.errors.length > 0) {
    lines.push('## Errors');
    for (const err of run.errors) {
      lines.push(`- **[${err.type}]** ${err.scenario}: ${err.message}`);
    }
    lines.push('');
  }

  lines.push('## Screenshots');
  for (const shot of run.screenshots) {
    lines.push(`- ${shot.timestamp.toISOString()}: ${shot.scenarioName} — \`${shot.path}\``);
  }
  lines.push('');

  lines.push('---');
  lines.push(`*Generated by Phase 40 Testing Agent at ${new Date().toISOString()}*`);

  return lines.join('\n');
}
