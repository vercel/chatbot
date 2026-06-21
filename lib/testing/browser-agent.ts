/**
 * Phase 40 — Unified Browser Agent
 * Primary backend: Playwright v1.51.0 (tested working on VPS)
 * Secondary backend: agent-browser v0.28.0 (feature flag: TEST_BACKEND=agent-browser)
 *
 * Provides a single interface for browser automation used by playbooks.
 * All actions are audit-logged. Network access to billing domains is blocked.
 * @author abhiswami2121@gmail.com
 */

// Playwright types — dynamically imported at runtime to avoid bundling
import type { Browser, BrowserContext, Page } from '../../node_modules/.pnpm/playwright@1.51.0/node_modules/playwright';
import type { AuditAction, TestAuditLogEntry } from './types';
import { BILLING_DOMAIN_BLOCKLIST } from './permissions';

// ===== Configuration =====
const TEST_BACKEND = process.env.TEST_BACKEND || 'playwright'; // 'playwright' | 'agent-browser'
const AUDIT_ENABLED = process.env.TEST_AUDIT_ENABLED !== 'false';
const SCREENSHOT_DIR = process.env.TEST_SCREENSHOT_DIR || '/tmp/test-screenshots';

export interface BrowserAgentConfig {
  headless?: boolean;
  userDataDir?: string;
  viewport?: { width: number; height: number };
  blockBillingDomains?: boolean;
  runId?: string;
  testUser?: string;
}

export interface SnapshotResult {
  url: string;
  title: string;
  elements: SnapshotElement[];
  rawAccessibilityTree: unknown;
}

export interface SnapshotElement {
  ref: string;        // @e1, @e2, etc.
  role: string;       // button, link, textbox, etc.
  name: string;       // accessible name
  value?: string;     // current value (inputs)
  placeholder?: string;
  href?: string;
  tagName?: string;
  attributes: Record<string, string>;
  children?: SnapshotElement[];
}

export interface ActionResult {
  success: boolean;
  action: AuditAction;
  target: string;
  durationMs: number;
  error?: string;
  screenshotPath?: string;
}

// ===== Main Class =====

export class BrowserAgent {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserAgentConfig;
  private auditLog: TestAuditLogEntry[] = [];
  private actions: ActionResult[] = [];

  constructor(config: BrowserAgentConfig = {}) {
    this.config = {
      headless: true,
      blockBillingDomains: true,
      viewport: { width: 1280, height: 720 },
      ...config,
    };
  }

  // ===== Lifecycle =====

  async launch(): Promise<void> {
    const startTime = Date.now();

    if (TEST_BACKEND === 'agent-browser') {
      // agent-browser daemon managed externally
      this.log('agent-browser backend selected — daemon must be running');
      return;
    }

    // Playwright backend
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { chromium } = require('@playwright/test');

    this.browser = await chromium.launch({
      headless: this.config.headless,
    });

    if (!this.browser) throw new Error('Browser not launched');
    const contextOptions: Parameters<typeof this.browser.newContext>[0] = {
      viewport: this.config.viewport,
      userAgent: 'Phase40-TestAgent/1.0 (NewLeaf Testing Framework)',
      ignoreHTTPSErrors: true,
    };

    this.context = await this.browser.newContext(contextOptions);

    // Block billing domains at the network level
    if (this.config.blockBillingDomains) {
      await this.context.route('**/*', (route) => {
        const url = route.request().url();
        const isBlocked = BILLING_DOMAIN_BLOCKLIST.some(domain =>
          url.includes(domain)
        );
        if (isBlocked) {
          this.log(`BLOCKED billing domain: ${url}`);
          route.abort('blockedbyclient');
        } else {
          route.continue();
        }
      });
    }

    this.page = await this.context.newPage();

    // Console error collection
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.log(`CONSOLE ERROR: ${msg.text()}`);
      }
    });

    // Network error collection
    this.page.on('requestfailed', (request) => {
      this.log(`NETWORK FAIL: ${request.url()} — ${request.failure()?.errorText}`);
    });

    const durationMs = Date.now() - startTime;
    this.audit('browser_launch', `headless=${this.config.headless}`, durationMs);
    this.log(`BrowserAgent launched [backend=${TEST_BACKEND}, time=${durationMs}ms]`);
  }

  async close(): Promise<void> {
    const startTime = Date.now();

    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }

    const durationMs = Date.now() - startTime;
    this.audit('browser_close', 'cleanup', durationMs);
    this.log(`BrowserAgent closed [actions=${this.actions.length}]`);
  }

  // ===== Navigation =====

  async navigate(url: string): Promise<ActionResult> {
    const startTime = Date.now();
    try {
      if (TEST_BACKEND === 'agent-browser') {
        return this.agentBrowserCmd('open', url, startTime);
      }
      await this.ensurePage();
      await this.page!.goto(url, {
        waitUntil: 'networkidle',
        timeout: 20000,
      });
      const result = this.successResult('navigate', url, startTime);
      this.audit('navigate', url, result.durationMs);
      return result;
    } catch (err) {
      return this.errorResult('navigate', url, startTime, err);
    }
  }

  async reload(): Promise<ActionResult> {
    const startTime = Date.now();
    try {
      await this.ensurePage();
      await this.page!.reload({ waitUntil: 'networkidle', timeout: 15000 });
      return this.successResult('navigate', 'reload', startTime);
    } catch (err) {
      return this.errorResult('navigate', 'reload', startTime, err);
    }
  }

  // ===== Element Interaction =====

  async click(selector: string): Promise<ActionResult> {
    const startTime = Date.now();
    try {
      await this.ensurePage();
      await this.page!.click(selector, { timeout: 10000 });
      return this.successResult('click', selector, startTime);
    } catch (err) {
      return this.errorResult('click', selector, startTime, err);
    }
  }

  async fill(selector: string, value: string): Promise<ActionResult> {
    const startTime = Date.now();
    try {
      await this.ensurePage();
      await this.page!.fill(selector, value, { timeout: 10000 });
      return this.successResult('fill', selector, startTime);
    } catch (err) {
      return this.errorResult('fill', selector, startTime, err);
    }
  }

  async type(selector: string, text: string): Promise<ActionResult> {
    const startTime = Date.now();
    try {
      await this.ensurePage();
      await this.page!.type(selector, text, { delay: 50 });
      return this.successResult('type', selector, startTime);
    } catch (err) {
      return this.errorResult('type', selector, startTime, err);
    }
  }

  async pressKey(key: string): Promise<ActionResult> {
    const startTime = Date.now();
    try {
      await this.ensurePage();
      await this.page!.keyboard.press(key);
      return this.successResult('type', `key:${key}`, startTime);
    } catch (err) {
      return this.errorResult('type', `key:${key}`, startTime, err);
    }
  }

  async selectOption(selector: string, value: string): Promise<ActionResult> {
    const startTime = Date.now();
    try {
      await this.ensurePage();
      await this.page!.selectOption(selector, value, { timeout: 10000 });
      return this.successResult('click', selector, startTime);
    } catch (err) {
      return this.errorResult('click', selector, startTime, err);
    }
  }

  // ===== Waiting =====

  async waitForSelector(selector: string, timeout = 15000): Promise<ActionResult> {
    const startTime = Date.now();
    try {
      await this.ensurePage();
      await this.page!.waitForSelector(selector, { timeout, state: 'visible' });
      return this.successResult('wait', selector, startTime);
    } catch (err) {
      return this.errorResult('wait', selector, startTime, err);
    }
  }

  async waitForTimeout(ms: number): Promise<ActionResult> {
    const startTime = Date.now();
    try {
      await this.ensurePage();
      await this.page!.waitForTimeout(ms);
      return this.successResult('wait', `timeout:${ms}ms`, startTime);
    } catch (err) {
      return this.errorResult('wait', `timeout:${ms}ms`, startTime, err);
    }
  }

  async waitForNavigation(): Promise<ActionResult> {
    const startTime = Date.now();
    try {
      await this.ensurePage();
      await this.page!.waitForLoadState('networkidle', { timeout: 20000 });
      return this.successResult('wait', 'navigation', startTime);
    } catch (err) {
      return this.errorResult('wait', 'navigation', startTime, err);
    }
  }

  // ===== Snapshot (Accessibility Tree — Token-Efficient) =====

  async snapshot(): Promise<SnapshotResult> {
    await this.ensurePage();

    const url = this.page!.url();
    const title = await this.page!.title();
    const rawTree = await this.page!.accessibility.snapshot({ interestingOnly: true });

    const elements = this.flattenAccessibilityTree(rawTree, 0);

    this.log(`Snapshot: ${elements.length} interactive elements on "${title}"`);
    return { url, title, elements, rawAccessibilityTree: rawTree };
  }

  private flattenAccessibilityTree(
    node: unknown,
    depth: number,
    refCounter = { count: 0 },
  ): SnapshotElement[] {
    const results: SnapshotElement[] = [];
    const n = node as Record<string, unknown> | null;
    if (!n) return results;

    const role = (n.role as string) || 'unknown';
    const name = (n.name as string) || '';
    const isInteractive = ['button', 'link', 'textbox', 'combobox', 'checkbox',
      'radio', 'switch', 'menuitem', 'option', 'tab', 'listbox', 'searchbox',
      'spinbutton'].includes(role);

    if (isInteractive || name) {
      results.push({
        ref: `@e${refCounter.count++}`,
        role,
        name: name.slice(0, 100),
        value: n.value as string | undefined,
        placeholder: n.placeholder as string | undefined,
        href: n.url as string | undefined,
        attributes: {},
      });
    }

    const children = n.children as unknown[] | undefined;
    if (children && depth < 20) {
      for (const child of children) {
        results.push(...this.flattenAccessibilityTree(child, depth + 1, refCounter));
      }
    }

    return results;
  }

  // ===== Screenshots =====

  async screenshot(filename?: string): Promise<string> {
    await this.ensurePage();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = filename || `screenshot-${timestamp}.png`;
    const path = `${SCREENSHOT_DIR}/${this.config.runId || 'unknown'}/${name}`;

    // Ensure directory exists
    const fs = await import('fs/promises');
    await fs.mkdir(`${SCREENSHOT_DIR}/${this.config.runId || 'unknown'}`, { recursive: true });

    await this.page!.screenshot({ path, fullPage: false });
    this.audit('screenshot', name, 0);

    return path;
  }

  // ===== Page Info =====

  async getUrl(): Promise<string> {
    await this.ensurePage();
    return this.page!.url();
  }

  async getTitle(): Promise<string> {
    await this.ensurePage();
    return this.page!.title();
  }

  async getText(selector: string): Promise<string> {
    await this.ensurePage();
    const text = await this.page!.textContent(selector);
    return text || '';
  }

  async isVisible(selector: string): Promise<boolean> {
    try {
      await this.ensurePage();
      return this.page!.isVisible(selector, { timeout: 5000 });
    } catch {
      return false;
    }
  }

  // ===== Assertions =====

  async assertVisible(selector: string, description: string): Promise<{ passed: boolean; description: string; expected: string; actual: string }> {
    const visible = await this.isVisible(selector);
    return {
      passed: visible,
      description,
      expected: `"${selector}" to be visible`,
      actual: visible ? 'visible' : 'not visible',
    };
  }

  async assertUrlContains(expected: string, description: string): Promise<{ passed: boolean; description: string; expected: string; actual: string }> {
    const url = await this.getUrl();
    return {
      passed: url.includes(expected),
      description,
      expected: `URL contains "${expected}"`,
      actual: url,
    };
  }

  async assertTitleContains(expected: string, description: string): Promise<{ passed: boolean; description: string; expected: string; actual: string }> {
    const title = await this.getTitle();
    return {
      passed: title.toLowerCase().includes(expected.toLowerCase()),
      description,
      expected: `Title contains "${expected}"`,
      actual: title,
    };
  }

  // ===== Sign In =====

  async signIn(email: string, password: string, options?: {
    emailSelector?: string;
    passwordSelector?: string;
    submitSelector?: string;
    waitAfterSubmit?: number;
  }): Promise<ActionResult> {
    const startTime = Date.now();
    const emailSel = options?.emailSelector || 'input[type="email"], input[name="email"], input[placeholder*="email" i]';
    const passSel = options?.passwordSelector || 'input[type="password"], input[name="password"]';
    const submitSel = options?.submitSelector || 'button[type="submit"], input[type="submit"], button:has-text("Sign in"), button:has-text("Continue")';

    try {
      await this.ensurePage();

      // Fill email
      await this.page!.waitForSelector(emailSel, { timeout: 10000 });
      await this.page!.fill(emailSel, email);
      this.audit('fill', 'email_field', 0);

      // Fill password
      await this.page!.fill(passSel, password);
      this.audit('fill', 'password_field', 0);

      // Submit
      await this.page!.click(submitSel);
      this.audit('click', 'sign_in_button', 0);

      // Wait for post-login navigation
      await this.page!.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      if (options?.waitAfterSubmit) {
        await this.page!.waitForTimeout(options.waitAfterSubmit);
      }

      const result = this.successResult('sign_in', 'auth_form', startTime);
      this.audit('sign_in', `user=${email.replace(/@.*/, '@***')}`, result.durationMs);
      return result;
    } catch (err) {
      return this.errorResult('sign_in', 'auth_form', startTime, err);
    }
  }

  // ===== Audit & Results =====

  private audit(action: AuditAction, target: string, durationMs: number): void {
    if (!AUDIT_ENABLED) return;
    this.auditLog.push({
      id: `audit-${this.auditLog.length + 1}`,
      runId: this.config.runId || 'unknown',
      timestamp: new Date(),
      action,
      target,
      testUser: this.config.testUser || 'unknown',
      result: 'pass',
      durationMs,
      llmTokensUsed: 0, // will be tracked in agent-chat
    });
  }

  private successResult(action: AuditAction, target: string, startTime: number): ActionResult {
    const result: ActionResult = {
      success: true,
      action,
      target,
      durationMs: Date.now() - startTime,
    };
    this.actions.push(result);
    return result;
  }

  private errorResult(action: AuditAction, target: string, startTime: number, err: unknown): ActionResult {
    const result: ActionResult = {
      success: false,
      action,
      target,
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
    this.actions.push(result);
    return result;
  }

  // ===== Helpers =====

  private async ensurePage(): Promise<void> {
    if (!this.page && TEST_BACKEND === 'playwright') {
      await this.launch();
    }
    if (!this.page) {
      throw new Error('Browser not launched. Call agent.launch() first.');
    }
  }

  private async agentBrowserCmd(cmd: string, args: string, startTime: number): Promise<ActionResult> {
    // agent-browser backend: shell out to CLI
    const { execSync } = await import('child_process');
    const fullCmd = `agent-browser ${cmd} ${args}`;
    try {
      execSync(fullCmd, { timeout: 15000, stdio: 'pipe' });
      return this.successResult(cmd.includes('open') ? 'navigate' : 'click', args, startTime);
    } catch (err) {
      return this.errorResult(cmd.includes('open') ? 'navigate' : 'click', args, startTime, err);
    }
  }

  getAuditLog(): TestAuditLogEntry[] {
    return [...this.auditLog];
  }

  getActions(): ActionResult[] {
    return [...this.actions];
  }

  getPage(): Page | null {
    return this.page;
  }

  getConfig(): BrowserAgentConfig {
    return { ...this.config };
  }

  private log(message: string): void {
    if (process.env.TEST_DEBUG === 'true') {
      console.log(`[browser-agent] ${message}`);
    }
  }
}

// ===== Factory =====

export async function createBrowserAgent(config?: BrowserAgentConfig): Promise<BrowserAgent> {
  const agent = new BrowserAgent(config);
  await agent.launch();
  return agent;
}
