/**
 * Phase 40 — Test Orchestrator
 * Manages test queue, concurrency semaphore (max 2 browsers), priority scheduling,
 * failure recovery, SSE progress reporting, and report generation.
 *
 * Integrates with Phase 38 Discovery and Phase 38.5 Chat Integration.
 * @author abhiswami2121@gmail.com
 */

import { executePlaybook, type PlaybookExecutionResult } from './playbook-executor';
import { listPlaybooks } from './playbook-executor';
import { scheduledCleanup, checkScreenshotStorage } from './data-cleanup';
import { checkRotation } from './credentials';
import type { QueuedTest, TestPriority, TestProgress, TestRunSummary } from './types';
import type { TestPlaybook } from './types';

// ===== Configuration =====
const MAX_CONCURRENT_BROWSERS = 2;
const QUEUE_POLL_INTERVAL_MS = 1000;
const SMOKE_TEST_PRIORITY: TestPriority = 1;
const REGRESSION_PRIORITY: TestPriority = 2;
const MANUAL_PRIORITY: TestPriority = 3;

// ===== Types =====

export interface OrchestratorConfig {
  maxConcurrentBrowsers?: number;
  screenshotOnFail?: boolean;
  notifyOnComplete?: boolean;
  slackWebhookUrl?: string;
}

export interface OrchestratorState {
  queueSize: number;
  activeRuns: number;
  completedToday: number;
  failedToday: number;
  avgDurationMs: number;
  isRunning: boolean;
}

export interface BatchRunResult {
  totalPlaybooks: number;
  completed: number;
  failed: number;
  results: PlaybookExecutionResult[];
  aggregateSummary: TestRunSummary;
  totalDurationMs: number;
  totalCost: number;
}

// ===== Main Orchestrator =====

export class TestOrchestrator {
  private queue: QueuedTest[] = [];
  private activeSessions: Set<string> = new Set();
  private config: Required<OrchestratorConfig>;
  private runHistory: PlaybookExecutionResult[] = [];
  private progressListeners: Set<(progress: TestProgress) => void> = new Set();

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      maxConcurrentBrowsers: MAX_CONCURRENT_BROWSERS,
      screenshotOnFail: true,
      notifyOnComplete: false,
      slackWebhookUrl: process.env.SLACK_TEST_WEBHOOK || '',
      ...config,
    };
  }

  // ===== Queue Management =====

  /**
   * Enqueue a playbook for execution.
   */
  enqueue(playbookName: string, priority: TestPriority = MANUAL_PRIORITY): string {
    const runId = `run-${Date.now()}-${playbookName}`;
    this.queue.push({
      runId,
      playbookId: playbookName,
      priority,
      queuedAt: new Date(),
      status: 'queued',
    });
    // Sort: higher priority (lower number) first
    this.queue.sort((a, b) => a.priority - b.priority);
    console.log(`[orchestrator] Enqueued: ${playbookName} [${runId}] priority=${priority}`);
    return runId;
  }

  /**
   * Enqueue multiple playbooks.
   */
  enqueueBatch(playbooks: { name: string; priority: TestPriority }[]): string[] {
    return playbooks.map(p => this.enqueue(p.name, p.priority));
  }

  /**
   * Enqueue all smoke test playbooks (PRI=1).
   */
  enqueueAllSmokeTests(): string[] {
    const smokePlaybooks = ['chat-smoke-test', 'twenty-crm-smoke-test', 'portal-customer-flow'];
    return this.enqueueBatch(smokePlaybooks.map(name => ({ name, priority: SMOKE_TEST_PRIORITY })));
  }

  /**
   * Enqueue all regression playbooks (PRI=2).
   */
  enqueueAllRegressionTests(): string[] {
    const regressionPlaybooks = [
      'chat-discovery-workflow-test',
      'v2-smoke-test',
      'cross-app-billing-flow',
    ];
    return this.enqueueBatch(regressionPlaybooks.map(name => ({ name, priority: REGRESSION_PRIORITY })));
  }

  // ===== Execution =====

  /**
   * Run all queued tests with concurrency control.
   */
  async runQueue(): Promise<BatchRunResult> {
    const startTime = Date.now();
    const results: PlaybookExecutionResult[] = [];

    console.log(`[orchestrator] Starting queue execution. ${this.queue.length} tests queued.`);

    // Check credential rotation before starting
    checkRotation();

    // Process queue
    while (this.queue.length > 0) {
      // Wait for concurrency slot
      while (this.activeSessions.size >= this.config.maxConcurrentBrowsers) {
        await this.delay(QUEUE_POLL_INTERVAL_MS);
      }

      const item = this.queue.shift()!;
      this.activeSessions.add(item.runId);

      // Execute (non-blocking for concurrent runs)
      this.executeQueuedItem(item, results).finally(() => {
        this.activeSessions.delete(item.runId);
      });
    }

    // Wait for all active sessions to complete
    while (this.activeSessions.size > 0) {
      await this.delay(500);
    }

    const totalDurationMs = Date.now() - startTime;
    const totalCost = results.reduce((sum, r) => sum + (r.run.estimatedCost || 0), 0);

    // Compute aggregate summary
    const aggregateSummary: TestRunSummary = {
      total: results.reduce((sum, r) => sum + r.run.summary.total, 0),
      passed: results.reduce((sum, r) => sum + r.run.summary.passed, 0),
      failed: results.reduce((sum, r) => sum + r.run.summary.failed, 0),
      errors: results.reduce((sum, r) => sum + r.run.summary.errors, 0),
      skipped: results.reduce((sum, r) => sum + r.run.summary.skipped, 0),
      passRate: 0,
    };
    aggregateSummary.passRate = aggregateSummary.total > 0
      ? Math.round((aggregateSummary.passed / aggregateSummary.total) * 100)
      : 0;

    const batchResult: BatchRunResult = {
      totalPlaybooks: results.length,
      completed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      aggregateSummary,
      totalDurationMs,
      totalCost,
    };

    // Store in history
    this.runHistory.push(...results);

    // Notify
    if (this.config.notifyOnComplete) {
      await this.notifySlack(batchResult);
    }

    console.log(
      `[orchestrator] Queue complete: ${batchResult.completed}/${batchResult.totalPlaybooks} ` +
      `playbooks passed (${aggregateSummary.passRate}%). ` +
      `Duration: ${(totalDurationMs / 1000).toFixed(1)}s. Cost: $${totalCost.toFixed(4)}`
    );

    return batchResult;
  }

  /**
   * Run a single playbook immediately (bypasses queue).
   */
  async runSingle(playbookName: string): Promise<PlaybookExecutionResult> {
    console.log(`[orchestrator] Running single playbook: ${playbookName}`);
    const result = await executePlaybook(playbookName, {
      screenshotOnFail: this.config.screenshotOnFail,
    });
    this.runHistory.push(result);
    return result;
  }

  /**
   * Run smoke tests (PRI=1) — used for pre-deploy gates.
   */
  async runSmokeGate(): Promise<{ passed: boolean; results: PlaybookExecutionResult[] }> {
    const smokePlaybooks = ['chat-smoke-test'];
    const results: PlaybookExecutionResult[] = [];

    for (const name of smokePlaybooks) {
      const result = await executePlaybook(name, {
        screenshotOnFail: true,
      });
      results.push(result);
    }

    const allPassed = results.every(r => r.success);
    return { passed: allPassed, results };
  }

  // ===== Private =====

  private async executeQueuedItem(
    item: QueuedTest,
    results: PlaybookExecutionResult[],
  ): Promise<void> {
    try {
      item.status = 'running';
      item.startedAt = new Date();

      const result = await executePlaybook(item.playbookId, {
        runId: item.runId,
        screenshotOnFail: this.config.screenshotOnFail,
      });

      results.push(result);

      // Emit progress
      for (const listener of this.progressListeners) {
        listener({
          runId: item.runId,
          status: result.success ? 'completed' : 'failed',
          currentScenario: result.playbook.scenarios[result.playbook.scenarios.length - 1]?.name || 'done',
          progress: 100,
          stepsCompleted: result.run.scenarios.length,
          stepsTotal: result.playbook.scenarios.length,
          screenshots: result.run.screenshots,
          lastAction: 'completed',
          errors: result.run.errors.map(e => e.message),
        });
      }
    } catch (err) {
      console.error(`[orchestrator] Failed to execute ${item.playbookId}:`, err);
    }
  }

  // ===== Scheduling =====

  /**
   * Schedule recurring smoke tests via Vercel cron.
   * Call this from a Vercel cron route handler.
   */
  async scheduledSmokeTest(): Promise<BatchRunResult> {
    console.log('[orchestrator] Scheduled smoke test triggered');
    this.enqueueAllSmokeTests();
    return this.runQueue();
  }

  /**
   * Schedule daily regression suite.
   */
  async scheduledRegression(): Promise<BatchRunResult> {
    console.log('[orchestrator] Scheduled regression triggered');

    // Run cleanup first
    await scheduledCleanup();

    // Run all smoke + regression
    this.enqueueAllSmokeTests();
    this.enqueueAllRegressionTests();
    return this.runQueue();
  }

  /**
   * Weekly full test suite with cleanup.
   */
  async scheduledWeeklyFull(): Promise<BatchRunResult> {
    console.log('[orchestrator] Weekly full test triggered');

    // Full cleanup
    const cleanupResult = await scheduledCleanup();

    // Storage check
    const storage = await checkScreenshotStorage();
    if (storage.warning) {
      console.warn(`[orchestrator] Storage warning: ${storage.usagePercent.toFixed(1)}%`);
    }

    // Run all available playbooks
    const allPlaybooks = listPlaybooks();
    for (const pb of allPlaybooks) {
      this.enqueue(pb.name, REGRESSION_PRIORITY);
    }

    return this.runQueue();
  }

  // ===== Discovery Integration (Phase 38) =====

  /**
   * Bridge: Phase 38 Discovery → Phase 40 UI Verification
   * Accepts a discovery finding and creates a targeted UI test.
   */
  async verifyDiscoveryFinding(finding: {
    title: string;
    url: string;
    element: string;
    expectedValue: string;
  }): Promise<{ verified: boolean; screenshotPath?: string; error?: string }> {
    console.log(`[orchestrator] Verifying discovery finding: ${finding.title}`);

    const { BrowserAgent } = await import('./browser-agent');
    const agent = new BrowserAgent({
      headless: true,
      runId: `discovery-verify-${Date.now()}`,
      testUser: 'test-agent',
    });

    try {
      await agent.launch();
      await agent.navigate(finding.url);
      await agent.waitForNavigation();

      // Check if the element exists
      const visible = await agent.isVisible(finding.element);
      if (!visible) {
        return { verified: false, error: `Element "${finding.element}" not visible` };
      }

      // Get element text
      const text = await agent.getText(finding.element);
      const screenshotPath = await agent.screenshot(`discovery-verify-${finding.title.replace(/\s+/g, '-')}.png`);

      const verified = text.includes(finding.expectedValue);
      return { verified, screenshotPath };
    } catch (err) {
      return {
        verified: false,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      await agent.close();
    }
  }

  // ===== Progress & Notifications =====

  /**
   * Subscribe to test progress events (SSE).
   */
  onProgress(listener: (progress: TestProgress) => void): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  /**
   * Get orchestrator state for dashboards.
   */
  getState(): OrchestratorState {
    const now = Date.now();
    const todayResults = this.runHistory.filter(
      r => r.run.startedAt && new Date(r.run.startedAt).toDateString() === new Date().toDateString()
    );

    return {
      queueSize: this.queue.length,
      activeRuns: this.activeSessions.size,
      completedToday: todayResults.filter(r => r.success).length,
      failedToday: todayResults.filter(r => !r.success).length,
      avgDurationMs: todayResults.length > 0
        ? todayResults.reduce((sum, r) => sum + (r.run.durationMs || 0), 0) / todayResults.length
        : 0,
      isRunning: this.activeSessions.size > 0,
    };
  }

  /**
   * Get recent run history.
   */
  getHistory(limit = 20): PlaybookExecutionResult[] {
    return this.runHistory.slice(-limit).reverse();
  }

  // ===== Slack Notifications =====

  private async notifySlack(result: BatchRunResult): Promise<void> {
    if (!this.config.slackWebhookUrl) return;

    const emoji = result.aggregateSummary.passRate >= 95 ? '🟢' :
      result.aggregateSummary.passRate >= 80 ? '🟡' : '🔴';

    const message = {
      text: `${emoji} Phase 40 Test Run Complete\n` +
        `*Pass Rate:* ${result.aggregateSummary.passRate}% ` +
        `(${result.aggregateSummary.passed}/${result.aggregateSummary.total})\n` +
        `*Failed:* ${result.failed} playbook(s)\n` +
        `*Duration:* ${(result.totalDurationMs / 1000).toFixed(1)}s\n` +
        `*Cost:* $${result.totalCost.toFixed(4)}`,
    };

    try {
      await fetch(this.config.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    } catch (err) {
      console.error('[orchestrator] Slack notification failed:', err);
    }
  }

  // ===== Utilities =====

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===== Singleton =====

let defaultOrchestrator: TestOrchestrator | null = null;

export function getOrchestrator(config?: OrchestratorConfig): TestOrchestrator {
  if (!defaultOrchestrator) {
    defaultOrchestrator = new TestOrchestrator(config);
  }
  return defaultOrchestrator;
}

export function resetOrchestrator(): void {
  defaultOrchestrator = null;
}
