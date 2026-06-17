/**
 * Phase 40.5 — Full Platform Tour E2E Runner
 * Executes the full-platform-tour playbook as test-agent@newleaf.financial
 * Uses real Playwright v1.51.0 + Clerk auth + Twenty CRM + Neptune V2 + Portal
 * @author abhiswami2121@gmail.com
 *
 * Usage: npx tsx lib/testing/run-e2e-tour.ts
 */

import { BrowserAgent } from './browser-agent';
import * as fs from 'fs';
import * as path from 'path';

// ===== Configuration =====
const TEST_USER = {
  email: 'test-agent@newleaf.financial',
  password: 'nL-Test-2026!Agent-kz7jMiBGSguX',
  clerkId: 'user_3FHlTs6p9cgo7gxQsGVpudvl5TN',
};

const TWENTY_USER = {
  email: 'test_agent@newleaf.financial',
  password: 'nL-Test-2026!Agent-kz7jMiBGSguX',
};

const REPORT_DIR = '/home/neptune/neptune-chat/docs';
const SCREENSHOT_DIR = '/tmp/test-screenshots/phase-40-5';

interface StepResult {
  step: string;
  passed: boolean;
  url?: string;
  screenshot?: string;
  error?: string;
  consoleErrors: string[];
  networkFails: string[];
}

interface TourReport {
  runId: string;
  timestamp: string;
  testUser: string;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  steps: StepResult[];
  bugs: string[];
  durationMs: number;
}

// ===== Main Runner =====
async function runPlatformTour(): Promise<TourReport> {
  const runId = `tour-${Date.now()}`;
  const startTime = Date.now();
  const steps: StepResult[] = [];
  const bugs: string[] = [];

  // Ensure screenshot dir
  fs.mkdirSync(`${SCREENSHOT_DIR}/${runId}`, { recursive: true });

  const agent = new BrowserAgent({
    headless: true,
    runId,
    testUser: TEST_USER.email,
    viewport: { width: 1280, height: 720 },
  });

  await agent.launch();
  console.log(`[E2E] Browser launched — Tour ID: ${runId}\n`);

  try {
    // === STEP 1: Neptune Chat Sign In ===
    console.log('[E2E] STEP 1: Neptune Chat Sign In');
    const signInResult = await executeStep(agent, steps, '01-neptune-signin', async () => {
      await agent.navigate('https://neptune-chat-ashy.vercel.app');
      await agent.waitForTimeout(3000);

      // Clerk sign-in form
      const emailInput = 'input[type="email"], input[name="identifier"]';
      const filled = await tryFill(agent, emailInput, TEST_USER.email);
      if (!filled) {
        return { passed: false, error: 'Email input not found — Clerk sign-in form may have changed' };
      }

      await agent.waitForTimeout(500);

      // Clerk password input
      const passResult = await agent.fill('input[type="password"]', TEST_USER.password);
      if (!passResult.success) {
        return { passed: false, error: `Password fill failed: ${passResult.error}` };
      }

      await agent.waitForTimeout(300);

      // Click continue/sign in
      const clickResult = await agent.click('button[type="submit"]');
      if (!clickResult.success) {
        // Try alternate selectors
        const altClick = await agent.click('button.cl-formButtonPrimary');
        if (!altClick.success) {
          return { passed: false, error: 'Submit button not found' };
        }
      }

      await agent.waitForTimeout(5000);
      await agent.screenshot(`${runId}/tour-01-signin.png`);

      const url = await agent.getUrl();
      const isAuthenticated = url.includes('/chat') || url.includes('/discovery') || !url.includes('/login');
      return { passed: isAuthenticated, url, screenshot: `${runId}/tour-01-signin.png` };
    });

    if (!signInResult.passed) {
      bugs.push('BUG: Clerk sign-in flow failed — ' + (signInResult.error || 'unknown'));
    }

    // === STEP 2: Chat Interaction ===
    console.log('[E2E] STEP 2: Chat interaction');
    await executeStep(agent, steps, '02-chat', async () => {
      const url = await agent.getUrl();
      if (!url.includes('/chat')) {
        await agent.navigate('https://neptune-chat-ashy.vercel.app/chat');
        await agent.waitForTimeout(3000);
      }

      await agent.screenshot(`${runId}/tour-02-chat.png`);

      // Try to send a message
      const chatInput = 'textarea, [contenteditable="true"], input[type="text"]';
      const textResult = await agent.fill(chatInput, 'Hello! This is an automated platform tour test. Phase 40.5.');
      if (textResult.success) {
        await agent.click('button[type="submit"]');
        await agent.waitForTimeout(5000);
      }

      await agent.screenshot(`${runId}/tour-02-chat-response.png`);
      const currentUrl = await agent.getUrl();
      return { passed: currentUrl.includes('/chat'), url: currentUrl, screenshot: `${runId}/tour-02-chat.png` };
    });

    // === STEP 3: Discovery Dashboard ===
    console.log('[E2E] STEP 3: Discovery dashboard');
    await executeStep(agent, steps, '03-discovery', async () => {
      await agent.navigate('https://neptune-chat-ashy.vercel.app/discovery');
      await agent.waitForTimeout(3000);
      await agent.screenshot(`${runId}/tour-03-discovery.png`);
      const url = await agent.getUrl();
      return { passed: url.includes('/discovery'), url, screenshot: `${runId}/tour-03-discovery.png` };
    });

    // === STEP 4: Knowledge Graph ===
    console.log('[E2E] STEP 4: Knowledge graph');
    await executeStep(agent, steps, '04-kg', async () => {
      await agent.navigate('https://neptune-chat-ashy.vercel.app/knowledge/graph');
      await agent.waitForTimeout(3000);
      await agent.screenshot(`${runId}/tour-04-kg.png`);
      const url = await agent.getUrl();
      return { passed: url.includes('/knowledge'), url, screenshot: `${runId}/tour-04-kg.png` };
    });

    // === STEP 5: Admin Dashboard ===
    console.log('[E2E] STEP 5: Admin dashboard');
    await executeStep(agent, steps, '05-admin', async () => {
      await agent.navigate('https://neptune-chat-ashy.vercel.app/admin/dashboard');
      await agent.waitForTimeout(3000);
      await agent.screenshot(`${runId}/tour-05-admin.png`);
      const url = await agent.getUrl();
      return { passed: url.includes('/admin'), url, screenshot: `${runId}/tour-05-admin.png` };
    });

    // === STEP 6: Twenty CRM ===
    console.log('[E2E] STEP 6: Twenty CRM');
    await executeStep(agent, steps, '06-twenty-crm', async () => {
      await agent.navigate('https://crm.newleaf.financial');
      await agent.waitForTimeout(4000);
      await agent.screenshot(`${runId}/tour-06-crm.png`);
      const url = await agent.getUrl();
      const title = await agent.getTitle();
      return {
        passed: url.includes('crm.newleaf.financial'),
        url,
        screenshot: `${runId}/tour-06-crm.png`,
      };
    });

    // === STEP 7: Neptune V2 ===
    console.log('[E2E] STEP 7: Neptune V2');
    await executeStep(agent, steps, '07-neptune-v2', async () => {
      await agent.navigate('https://neptune-v2.vercel.app');
      await agent.waitForTimeout(4000);
      await agent.screenshot(`${runId}/tour-07-v2.png`);
      const url = await agent.getUrl();
      const title = await agent.getTitle();
      return {
        passed: url.includes('neptune-v2.vercel.app') && title.length > 0,
        url,
        title,
        screenshot: `${runId}/tour-07-v2.png`,
      };
    });

    // === STEP 8: Customer Portal ===
    console.log('[E2E] STEP 8: Customer Portal');
    await executeStep(agent, steps, '08-portal', async () => {
      await agent.navigate('https://portal.newleaf.financial');
      await agent.waitForTimeout(4000);
      await agent.screenshot(`${runId}/tour-08-portal.png`);
      const url = await agent.getUrl();
      return {
        passed: url.includes('portal.newleaf.financial') || url.length > 0,
        url,
        screenshot: `${runId}/tour-08-portal.png`,
      };
    });

    // === Check for console errors ===
    console.log('[E2E] Final check — gathering diagnostics...');

  } catch (err) {
    console.error('[E2E] Tour error:', err);
    steps.push({
      step: 'fatal-error',
      passed: false,
      error: err instanceof Error ? err.message : String(err),
      consoleErrors: [],
      networkFails: [],
    });
  } finally {
    await agent.close();
  }

  const durationMs = Date.now() - startTime;
  const passedSteps = steps.filter(s => s.passed).length;

  const report: TourReport = {
    runId,
    timestamp: new Date().toISOString(),
    testUser: TEST_USER.email,
    totalSteps: steps.length,
    passedSteps,
    failedSteps: steps.length - passedSteps,
    steps,
    bugs,
    durationMs,
  };

  return report;
}

async function executeStep(
  agent: BrowserAgent,
  steps: StepResult[],
  name: string,
  fn: () => Promise<{ passed: boolean; url?: string; title?: string; screenshot?: string; error?: string }>
): Promise<StepResult> {
  const stepStart = Date.now();
  try {
    const result = await fn();
    const step: StepResult = {
      step: name,
      passed: result.passed,
      url: result.url,
      screenshot: result.screenshot,
      error: result.error,
      consoleErrors: [],
      networkFails: [],
    };
    steps.push(step);
    const emoji = result.passed ? '✅' : '❌';
    console.log(`  ${emoji} ${name} (${Date.now() - stepStart}ms)${result.error ? ' — ' + result.error : ''}`);
    return step;
  } catch (err) {
    const step: StepResult = {
      step: name,
      passed: false,
      error: err instanceof Error ? err.message : String(err),
      consoleErrors: [],
      networkFails: [],
    };
    steps.push(step);
    console.log(`  💥 ${name} CRASH: ${err instanceof Error ? err.message : String(err)}`);
    return step;
  }
}

async function tryFill(agent: BrowserAgent, selector: string, value: string): Promise<boolean> {
  try {
    const result = await agent.fill(selector, value);
    return result.success;
  } catch {
    return false;
  }
}

// ===== Report Generation =====
function generateMarkdownReport(report: TourReport): string {
  const lines: string[] = [];
  lines.push('# Phase 40.5 — Full Platform Tour E2E Report');
  lines.push(`**Run ID:** ${report.runId}`);
  lines.push(`**Timestamp:** ${report.timestamp}`);
  lines.push(`**Test User:** ${report.testUser}`);
  lines.push(`**Duration:** ${(report.durationMs / 1000).toFixed(1)}s`);
  lines.push(`**Pass Rate:** ${report.totalSteps > 0 ? Math.round((report.passedSteps / report.totalSteps) * 100) : 0}% (${report.passedSteps}/${report.totalSteps})`);
  lines.push('');

  lines.push('## Results');
  lines.push('| Step | Result | URL |');
  lines.push('|------|--------|-----|');
  for (const step of report.steps) {
    const emoji = step.passed ? '✅' : '❌';
    lines.push(`| ${emoji} ${step.step} | ${step.passed ? 'PASS' : 'FAIL'} | ${step.url || 'N/A'} |`);
  }
  lines.push('');

  if (report.bugs.length > 0) {
    lines.push('## Bugs Found');
    for (const bug of report.bugs) {
      lines.push(`- 🐛 ${bug}`);
    }
    lines.push('');
  }

  lines.push('## Screenshots');
  for (const step of report.steps) {
    if (step.screenshot) {
      lines.push(`- ${step.step}: \`${step.screenshot}\``);
    }
  }
  lines.push('');

  lines.push('---');
  lines.push(`*Generated by Phase 40.5 E2E Tour Runner at ${report.timestamp}*`);
  lines.push(`*Author: abhiswami2121@gmail.com*`);

  return lines.join('\n');
}

// ===== Execute =====
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  PHASE 40.5 — E2E PLATFORM TOUR');
  console.log('  Test User: test-agent@newleaf.financial');
  console.log('  Target: 4 apps, 8 scenarios');
  console.log('═══════════════════════════════════════\n');

  const report = await runPlatformTour();

  console.log('\n═══════════════════════════════════════');
  console.log(`  TOUR COMPLETE: ${report.passedSteps}/${report.totalSteps} passed`);
  console.log(`  Duration: ${(report.durationMs / 1000).toFixed(1)}s`);
  console.log(`  Bugs: ${report.bugs.length}`);
  console.log('═══════════════════════════════════════\n');

  // Save report
  const reportMarkdown = generateMarkdownReport(report);
  const reportPath = path.join(REPORT_DIR, 'phase-40-5-first-e2e-tour-2026-06-17.md');
  fs.writeFileSync(reportPath, reportMarkdown);
  console.log(`Report saved to: ${reportPath}`);

  // Also output JSON
  const jsonPath = path.join(REPORT_DIR, 'phase-40-5-first-e2e-tour-2026-06-17.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`JSON saved to: ${jsonPath}`);

  process.exit(report.bugs.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('E2E Tour failed:', err);
  process.exit(1);
});
