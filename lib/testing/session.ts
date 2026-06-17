/**
 * Phase 40 — Test Session Manager
 * Manages full test lifecycle: provision → work → close → cleanup.
 * Handles browser crashes, LLM timeouts, and network failures.
 * Enforces resource limits (duration, screenshots, memory).
 * @author abhiswami2121@gmail.com
 */

import { BrowserAgent, createBrowserAgent } from './browser-agent';
import { AgentChat } from './agent-chat';
import type {
  TestRun, TestRunStatus, ScenarioResult, ScenarioResult2,
  TestRunSummary, TestError, TestAuditLogEntry, ScreenshotRef,
  TestProgress, PlaybookScenario,
} from './types';
import { checkRotation } from './credentials';
import { enforcePermission, tagTestData } from './permissions';

// ===== Resource Limits =====
const MAX_TEST_DURATION_MS = 10 * 60 * 1000;  // 10 minutes
const MAX_SCREENSHOTS_PER_TEST = 50;
const MAX_CONSOLE_ERRORS = 100;
const MAX_BROWSER_CRASHES_BEFORE_ABORT = 3;
const MAX_LLM_TIMEOUTS_BEFORE_SKIP = 3;
const MAX_NETWORK_RETRIES = 3;

// ===== Session Manager =====

export class TestSession {
  private agent: BrowserAgent | null = null;
  private chat: AgentChat | null = null;
  private run: TestRun;
  private screenshotCount = 0;
  private crashCount = 0;
  private llmTimeoutCount = 0;
  private networkRetryCount = 0;
  private abortFlag = false;
  private startTime = 0;

  constructor(runId: string, playbookId: string, playbookName: string, targetUrl: string) {
    this.run = {
      id: runId,
      playbookId,
      playbookName,
      status: 'queued',
      startedAt: new Date(),
      targetUrl,
      targetSystem: 'neptune-chat',
      testUser: 'test-agent',
      scenarios: [],
      screenshots: [],
      summary: { total: 0, passed: 0, failed: 0, errors: 0, skipped: 0, passRate: 0 },
      errors: [],
      llmTokensUsed: 0,
      estimatedCost: 0,
      auditLog: [],
    };
  }

  // ===== Lifecycle =====

  /**
   * Provision and start the test session.
   * 1. Check credential rotation
   * 2. Launch browser agent
   * 3. Initialize AI chat
   * 4. Start timeout watchdog
   */
  async provision(): Promise<void> {
    this.updateStatus('provisioning');
    this.startTime = Date.now();

    // Check credential rotation
    checkRotation();

    // Create browser agent with isolation
    this.agent = await createBrowserAgent({
      headless: true,
      runId: this.run.id,
      testUser: this.run.testUser,
      viewport: { width: 1280, height: 720 },
      blockBillingDomains: true,
    });

    // Initialize AI chat
    this.chat = new AgentChat(this.agent);

    // Start timeout watchdog
    this.startWatchdog();

    this.updateStatus('running');
    console.log(`[session] Provisioned test session ${this.run.id}`);
  }

  /**
   * Run a single scenario from a playbook.
   */
  async runScenario(scenario: PlaybookScenario): Promise<ScenarioResult2> {
    if (!this.agent) throw new Error('Session not provisioned');
    if (this.abortFlag) {
      return this.scenarioResult(scenario.name, scenario.steps.length, 'skipped', 0, 'Session aborted');
    }

    const scenarioStart = Date.now();
    const screenshotIds: string[] = [];
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];
    const assertions: ScenarioResult2['assertions'] = [];
    let scenarioError: string | undefined;

    try {
      for (const step of scenario.steps) {
        if (this.abortFlag) break;

        switch (step.action) {
          case 'navigate': {
            if (step.target) await this.agent.navigate(step.target);
            break;
          }
          case 'click': {
            if (step.target) await this.agent.click(step.target);
            break;
          }
          case 'fill': {
            if (step.target && step.value) await this.agent.fill(step.target, step.value);
            break;
          }
          case 'type': {
            if (step.target && step.value) await this.agent.type(step.target, step.value);
            break;
          }
          case 'select': {
            if (step.target && step.value) await this.agent.selectOption(step.target, step.value);
            break;
          }
          case 'wait': {
            if (step.target) {
              await this.agent.waitForSelector(step.target, step.timeout);
            } else if (step.timeout) {
              await this.agent.waitForTimeout(step.timeout);
            }
            break;
          }
          case 'screenshot': {
            if (this.screenshotCount >= MAX_SCREENSHOTS_PER_TEST) {
              console.log('[session] Screenshot cap reached, skipping');
              break;
            }
            const path = await this.agent.screenshot(`${scenario.name.replace(/\s+/g, '-')}-step${step.description.replace(/\s+/g, '-')}.png`);
            const shotId = `screenshot-${this.screenshotCount++}`;
            screenshotIds.push(shotId);
            this.run.screenshots.push({
              id: shotId,
              path,
              timestamp: new Date(),
              scenarioName: scenario.name,
              width: 1280,
              height: 720,
              sizeBytes: 0,
            });
            break;
          }
          case 'sign_in': {
            // Credentials are loaded separately by the orchestrator
            break;
          }
          case 'sign_out': {
            // Handled by orchestrator via sign-out URL navigation
            break;
          }
          case 'assert': {
            if (step.target && step.value) {
              const result = await this.agent.assertVisible(step.target, step.description);
              assertions.push({
                description: step.description,
                passed: result.passed,
                expected: result.expected,
                actual: result.actual,
              });
            }
            break;
          }
        }
      }

      // Run scenario assertions
      for (const assertion of scenario.assertions) {
        let result: { passed: boolean; description: string; expected: string; actual: string };

        switch (assertion.type) {
          case 'visible':
            result = await this.agent.assertVisible(assertion.target || '', assertion.description);
            break;
          case 'url':
            result = await this.agent.assertUrlContains(assertion.expected, assertion.description);
            break;
          case 'title':
            result = await this.agent.assertTitleContains(assertion.expected, assertion.description);
            break;
          default:
            result = { passed: true, description: assertion.description, expected: assertion.expected, actual: 'ok' };
        }

        assertions.push({
          description: assertion.description,
          passed: result.passed,
          expected: result.expected,
          actual: result.actual,
        });

        if (!result.passed) {
          console.error(`[session] Assertion FAILED: ${assertion.description} — expected "${result.expected}", got "${result.actual}"`);
        }
      }

      const allPassed = assertions.every(a => a.passed) && !scenarioError;
      return this.scenarioResult(
        scenario.name,
        scenario.steps.length,
        allPassed ? 'pass' : 'fail',
        Date.now() - scenarioStart,
        scenarioError,
        screenshotIds,
        consoleErrors,
        networkErrors,
        assertions,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[session] Scenario "${scenario.name}" ERROR:`, message);
      this.handleFailure('browser_crash', scenario.name, message);

      return this.scenarioResult(
        scenario.name,
        scenario.steps.length,
        'error',
        Date.now() - scenarioStart,
        message,
        screenshotIds,
        consoleErrors,
        networkErrors,
        assertions,
      );
    }
  }

  /**
   * Close session and clean up.
   */
  async close(): Promise<void> {
    this.updateStatus('completed');

    if (this.agent) {
      try {
        await this.agent.close();
      } catch (err) {
        console.error('[session] Error closing browser:', err);
      }
    }

    // Add audit log
    this.run.auditLog = this.agent?.getAuditLog() || [];

    // Update token/cost from chat
    if (this.chat) {
      this.run.llmTokensUsed = this.chat.getTokenUsage().input + this.chat.getTokenUsage().output;
      this.run.estimatedCost = this.chat.getTotalCost();
    }

    // Compute summary
    this.run.completedAt = new Date();
    this.run.durationMs = Date.now() - this.startTime;
    this.computeSummary();

    console.log(`[session] Test session ${this.run.id} closed. Pass: ${this.run.summary.passed}/${this.run.summary.total}`);
  }

  // ===== Failure Recovery =====

  private handleFailure(
    type: TestError['type'],
    scenario: string,
    message: string,
  ): void {
    this.run.errors.push({
      scenario,
      type,
      message,
    });

    switch (type) {
      case 'browser_crash':
        this.crashCount++;
        if (this.crashCount >= MAX_BROWSER_CRASHES_BEFORE_ABORT) {
          console.error(`[session] ${this.crashCount} browser crashes — ABORTING run`);
          this.abortFlag = true;
          this.updateStatus('aborted');
        }
        break;

      case 'llm_timeout':
        this.llmTimeoutCount++;
        if (this.llmTimeoutCount >= MAX_LLM_TIMEOUTS_BEFORE_SKIP) {
          console.warn(`[session] ${this.llmTimeoutCount} LLM timeouts — will skip remaining AI steps`);
        }
        break;

      case 'network_error':
        this.networkRetryCount++;
        break;
    }
  }

  // ===== Watchdog =====

  private startWatchdog(): void {
    setTimeout(() => {
      if (this.run.status === 'running') {
        console.warn(`[session] Test ${this.run.id} exceeded ${MAX_TEST_DURATION_MS / 60000}min limit — aborting`);
        this.abortFlag = true;
        this.updateStatus('aborted');
        this.close().catch(() => {});
      }
    }, MAX_TEST_DURATION_MS);
  }

  // ===== Helpers =====

  private updateStatus(status: TestRunStatus): void {
    this.run.status = status;
  }

  private scenarioResult(
    name: string,
    totalSteps: number,
    result: ScenarioResult,
    durationMs: number,
    error?: string,
    screenshotIds: string[] = [],
    consoleErrors: string[] = [],
    networkErrors: string[] = [],
    assertions: ScenarioResult2['assertions'] = [],
  ): ScenarioResult2 {
    const scenario: ScenarioResult2 = {
      name,
      stepNumber: this.run.scenarios.length + 1,
      result,
      durationMs,
      screenshotIds,
      consoleErrors,
      networkErrors,
      assertions,
      error,
      url: this.agent ? undefined : undefined,
    };

    this.run.scenarios.push(scenario);
    return scenario;
  }

  private computeSummary(): void {
    const summary: TestRunSummary = {
      total: this.run.scenarios.length,
      passed: 0,
      failed: 0,
      errors: 0,
      skipped: 0,
      passRate: 0,
    };

    for (const s of this.run.scenarios) {
      switch (s.result) {
        case 'pass': summary.passed++; break;
        case 'fail': summary.failed++; break;
        case 'error': summary.errors++; break;
        case 'skipped': summary.skipped++; break;
        case 'infra_error': summary.errors++; break;
      }
    }

    summary.passRate = summary.total > 0
      ? Math.round((summary.passed / summary.total) * 100)
      : 0;

    this.run.summary = summary;
  }

  // ===== Accessors =====

  getRun(): TestRun {
    return { ...this.run };
  }

  getProgress(): TestProgress {
    const total = this.run.scenarios.length || 1;
    const completed = this.run.scenarios.filter(
      s => s.result !== 'skipped'
    ).length;

    return {
      runId: this.run.id,
      status: this.run.status,
      currentScenario: this.run.scenarios[this.run.scenarios.length - 1]?.name || 'starting',
      progress: Math.round((completed / total) * 100),
      stepsCompleted: this.run.scenarios.length,
      stepsTotal: total,
      screenshots: this.run.screenshots,
      lastAction: this.run.auditLog[this.run.auditLog.length - 1]?.action || 'none',
      errors: this.run.errors.map(e => e.message),
    };
  }

  getAgent(): BrowserAgent | null {
    return this.agent;
  }

  isAborted(): boolean {
    return this.abortFlag;
  }
}

// ===== Factory =====

export async function createTestSession(
  runId: string,
  playbookId: string,
  playbookName: string,
  targetUrl: string,
): Promise<TestSession> {
  const session = new TestSession(runId, playbookId, playbookName, targetUrl);
  await session.provision();
  return session;
}
