/**
 * Phase 40 — Authenticated User-Testing Agent
 * Shared TypeScript types for the testing framework.
 * @author abhiswami2121@gmail.com
 */

// ===== Test Users =====
export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: TestUserRole;
  system: TargetSystem;
  permissions: Permission[];
}

export type TestUserRole = 'tester' | 'test_customer' | 'test_billing_readonly';

export type TargetSystem =
  | 'neptune-chat'
  | 'neptune-v2'
  | 'twenty-crm'
  | 'customer-portal'
  | 'billing';

export interface TestUserCredentials {
  neptuneChat: { email: string; password: string };
  neptuneV2: { email: string; password: string };
  twentyCrm: { email: string; password: string };
  customerPortal: { email: string; password: string };
  billingReadonly: { email: string; password: string };
}

// ===== RBAC =====
export interface Permission {
  resource: string;
  actions: PermissionAction[];
}

export type PermissionAction = 'read' | 'create' | 'modify' | 'delete';

export interface RbacMatrix {
  system: TargetSystem;
  canRead: string[];
  canCreate: string[];
  canModify: string[];
  canDelete: string[];
  cannot: string[]; // explicit deny list (e.g., NMI vault, Stripe)
}

// ===== Test Runs =====
export type TestRunStatus =
  | 'queued'
  | 'provisioning'
  | 'running'
  | 'completed'
  | 'failed'
  | 'aborted';

export type ScenarioResult = 'pass' | 'fail' | 'error' | 'skipped' | 'infra_error';

export interface TestRun {
  id: string;
  playbookId: string;
  playbookName: string;
  status: TestRunStatus;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  targetUrl: string;
  targetSystem: TargetSystem;
  testUser: string;
  scenarios: ScenarioResult2[];
  screenshots: ScreenshotRef[];
  summary: TestRunSummary;
  errors: TestError[];
  llmTokensUsed: number;
  estimatedCost: number;
  auditLog: TestAuditLogEntry[];
}

export interface ScenarioResult2 {
  name: string;
  stepNumber: number;
  result: ScenarioResult;
  durationMs: number;
  url?: string;
  screenshotIds: string[];
  error?: string;
  consoleErrors: string[];
  networkErrors: string[];
  assertions: AssertionResult[];
}

export interface AssertionResult {
  description: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export interface ScreenshotRef {
  id: string;
  path: string;
  url?: string;
  timestamp: Date;
  scenarioName: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface TestRunSummary {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
  passRate: number;
}

export interface TestError {
  scenario: string;
  type: 'browser_crash' | 'llm_timeout' | 'network_error' | 'assertion_failure' | 'auth_error' | 'timeout';
  message: string;
  stack?: string;
  screenshotId?: string;
}

// ===== Audit =====
export interface TestAuditLogEntry {
  id: string;
  runId: string;
  timestamp: Date;
  action: AuditAction;
  target: string;
  testUser: string;
  result: 'pass' | 'fail' | 'error' | 'skipped';
  screenshotPath?: string;
  durationMs: number;
  llmTokensUsed: number;
  errors?: string[];
}

export type AuditAction =
  | 'browser_launch'
  | 'navigate'
  | 'click'
  | 'fill'
  | 'type'
  | 'screenshot'
  | 'assert'
  | 'wait'
  | 'sign_in'
  | 'sign_out'
  | 'browser_close';

// ===== Playbook =====
export interface TestPlaybook {
  name: string;
  type: 'test-playbook';
  description: string;
  version: string;
  targetUrl: string;
  targetSystem: TargetSystem;
  user: TestUserRole;
  severity: 'critical' | 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  tags: string[];
  scenarios: PlaybookScenario[];
}

export interface PlaybookScenario {
  name: string;
  description: string;
  steps: PlaybookStep[];
  assertions: PlaybookAssertion[];
}

export interface PlaybookStep {
  action: 'navigate' | 'click' | 'fill' | 'type' | 'select' | 'wait' | 'screenshot' | 'assert' | 'sign_in' | 'sign_out';
  target?: string;      // URL, selector, or @ref
  value?: string;        // text to type/fill
  timeout?: number;      // ms
  description: string;
}

export interface PlaybookAssertion {
  type: 'visible' | 'text' | 'url' | 'title' | 'element_count' | 'console_clear' | 'network_idle' | 'performance';
  target?: string;
  expected: string;
  description: string;
}

// ===== Visual Diff =====
export interface VisualBaseline {
  route: string;
  screenshotPath: string;
  approved: boolean;
  approvedAt?: Date;
  approvedBy?: string;
  width: number;
  height: number;
  threshold: number; // 0-1, pixel difference ratio
}

export interface VisualDiffResult {
  route: string;
  baselineId: string;
  currentScreenshotPath: string;
  diffScreenshotPath?: string;
  diffPercentage: number;
  passed: boolean;
  threshold: number;
  highlightedRegions: DiffRegion[];
}

export interface DiffRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  diffPercentage: number;
}

// ===== Progress / SSE =====
export interface TestProgress {
  runId: string;
  status: TestRunStatus;
  currentScenario: string;
  progress: number; // 0-100
  stepsCompleted: number;
  stepsTotal: number;
  screenshots: ScreenshotRef[];
  lastAction: string;
  errors: string[];
}

// ===== Queue =====
export type TestPriority = 1 | 2 | 3; // 1=smoke(blocking), 2=regression, 3=manual

export interface QueuedTest {
  runId: string;
  playbookId: string;
  priority: TestPriority;
  queuedAt: Date;
  startedAt?: Date;
  status: 'queued' | 'running';
}
