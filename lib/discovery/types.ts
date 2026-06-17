/**
 * lib/discovery/types.ts
 * Phase 38 Discovery Workflows Engine — Canonical Type Definitions
 * Enhanced v2 — 2026-06-17
 */

// ── Slack Scraping ──────────────────────────────────────────────

export type MessageType =
  | 'enrollment_submission'
  | 'billing_alert'
  | 'support_ticket'
  | 'recovery_action'
  | 'escalation'
  | 'agent_handoff'
  | 'general_discussion'
  | 'unknown';

export interface ExtractedCustomerMention {
  raw: string;
  type: 'phone' | 'email' | 'name' | 'customer_id';
  value: string;
  confidence: number; // 0.0–1.0
}

export interface ScrapedSlackMessage {
  channelId: string;
  channelName: string;
  userId: string;
  userName?: string;
  text: string;
  ts: string;
  threadTs?: string;
  replyCount?: number;
  reactions?: { name: string; count: number }[];
  messageType: MessageType;
  extractedCustomers: ExtractedCustomerMention[];
}

export interface SlackScrapeConfig {
  channels: string[];
  daysBack: number;             // 7 | 30 | 90
  maxMessagesPerChannel?: number; // default 1000
  includeThreads?: boolean;       // default false
  messageTypes?: ('message' | 'bot_message' | 'file_share')[];
}

export interface SlackChannelResult {
  name: string;
  id: string;
  messageCount: number;
  hasMore: boolean;
  oldestTs: string;
  newestTs: string;
}

export interface SlackScrapeResult {
  totalMessages: number;
  channels: Record<string, SlackChannelResult>;
  messages: ScrapedSlackMessage[];
  errors: { channel: string; error: string }[];
  scrapedAt: string;
}

// ── Customer Matching ───────────────────────────────────────────

export interface CustomerMatch {
  base44Id: string | null;
  confidence: number;           // 0.0–1.0
  matchTier: 1 | 2 | 3 | 4 | 5; // exact phone=1, exact email=2, name+phone fuzzy=3, name+email fuzzy=4, name-only=5
  matchedOn: string;            // e.g. "phone:+15551234567", "email:j@d.com"
  candidates: string[];          // other possible matches (for manual review)
}

// ── Multi-Source Pulling ────────────────────────────────────────

export interface PullRequest {
  customerIds: string[];
  includeNmi: boolean;
  includeBase44: boolean;
  includeComms: boolean;
  includeTickets: boolean;
  nmiTransactionDays?: number;   // default 30
}

export interface Base44Snapshot {
  profile: Record<string, unknown> | null;
  enrollmentStatus: string;
  billingStatus: string;
  paymentAmount: number;
  lastPayment: Record<string, unknown> | null;
  openTickets: Record<string, unknown>[];
  recentCalls: Record<string, unknown>[];
  adminNotifications: Record<string, unknown>[];
}

export interface NmiSnapshot {
  subscriptionId: string | null;
  subscriptionStatus: 'active' | 'cancelled' | 'declining' | 'none' | 'error';
  lastTransaction: Record<string, unknown> | null;
  recentTransactions: Record<string, unknown>[];
  nextChargeDate: string | null;
  cofCompliant: boolean;
  error?: string;
}

export interface CommsSnapshot {
  recentCalls: Record<string, unknown>[];
  recentEmails: Record<string, unknown>[];
  recentSms: Record<string, unknown>[];
  slackMentions: Record<string, unknown>[];
}

export interface TicketSnapshot {
  open: Record<string, unknown>[];
  resolved: Record<string, unknown>[];
  stale: Record<string, unknown>[];   // >48h without update
}

export interface PulledCustomerData {
  customerId: string;
  base44: Base44Snapshot | null;
  nmi: NmiSnapshot | null;
  comms: CommsSnapshot;
  tickets: TicketSnapshot;
  pulledAt: string;
}

// ── Customer Context (Composite) ─────────────────────────────────

export interface CustomerDiscoveryContext {
  customerId: string;
  name: string;
  phone: string;
  email: string;

  base44: {
    profile: Record<string, unknown> | null;
    enrollmentStatus: string;
    billingStatus: string;
    paymentAmount: number;
    lastPayment: Record<string, unknown> | null;
    openTickets: Record<string, unknown>[];
    recentCalls: Record<string, unknown>[];
  };

  nmi: {
    subscriptionId: string | null;
    subscriptionStatus: 'active' | 'cancelled' | 'declining' | 'none' | 'error';
    lastTransaction: Record<string, unknown> | null;
    nextChargeDate: string | null;
    cofCompliant: boolean;
  };

  slack: {
    mentions: ScrapedSlackMessage[];
    latestMention: ScrapedSlackMessage | null;
    agentsWhoMentioned: string[];
    inferredActionRequested: string;
  };

  alignment: {
    base44_vs_nmi: 'aligned' | 'misaligned' | 'unknown' | 'error';
    slack_vs_base44: 'aligned' | 'misaligned' | 'unknown' | 'error';
    slack_vs_nmi: 'aligned' | 'misaligned' | 'unknown' | 'error';
    flags: AlignmentFlag[];
  };
}

export interface AlignmentFlag {
  dimension: 'billing' | 'enrollment' | 'agent_promise' | 'documentation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  evidence: string;
  recommendation: string;
}

// ── Dependency Graph ─────────────────────────────────────────────

export interface GraphNode {
  id: string;
  type: 'customer' | 'agent' | 'ticket' | 'payment' | 'subscription' | 'action' | 'call';
  label: string;
  data: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'ACTIVE_SUBSCRIPTION' | 'HAS_OPEN_TICKET' | 'REQUESTED_BY' |
        'REQUIRES_ACTION' | 'LAST_CALL' | 'SHOULD_BE_CHARGED' |
        'PROMISED_TO' | 'ESCALATED_TO' | 'MENTIONED_IN';
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphCycle {
  path: string[];
  type: 'churn_risk' | 'stale_action' | 'billing_loop' | 'escalation_loop';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

export interface ActionChain {
  steps: string[];
  startNode: string;
  endNode: string;
  status: 'completed' | 'in_progress' | 'stalled';
  stalledReason?: string;
}

export interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  cycles: GraphCycle[];
  chains: ActionChain[];
}

// ── Alignment Validators ─────────────────────────────────────────

export interface AlignmentDetail {
  field: string;
  expected: string;
  actual: string;
  source: 'slack' | 'base44' | 'nmi' | 'agent_log' | 'call_log';
  discrepancy: string;
}

export interface AlignmentResult {
  dimension: 'billing' | 'enrollment' | 'agent_promise' | 'documentation';
  status: 'aligned' | 'misaligned' | 'unknown' | 'error';
  score: number;            // 0.0–1.0
  details: AlignmentDetail[];
  recommendation: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

// ── Workflow Orchestrator ────────────────────────────────────────

export interface DiscoveryWorkflow {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'audit' | 'billing' | 'recovery' | 'customer_360' | 'agent_tracking' | 'custom';
  steps: DiscoveryStep[];
  outputs: ('markdown' | 'csv' | 'json' | 'pdf')[];
  defaultConfig: Record<string, unknown>;
  estimatedDuration: string;
}

export interface DiscoveryStep {
  id: string;
  name: string;
  type: 'scrape' | 'pull' | 'cross_reference' | 'validate' | 'analyze' | 'report' | 'action';
  config: Record<string, unknown>;
  dependsOn?: string[];
  timeoutMs?: number;
  onError?: 'fail_run' | 'skip_step' | 'continue_with_partial';
}

export interface StepProgress {
  current: number;
  total: number;
  message: string;
  percent: number;
}

export interface DiscoveryStepResult {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  progress?: StepProgress;
  result?: unknown;
  error?: string;
}

export interface DiscoveryCheckpoint {
  runId: string;
  completedStepIds: string[];
  scrapedMessages: ScrapedSlackMessage[];
  pulledCustomers: Record<string, PulledCustomerData>;
  cachedAt: string;
}

export interface DiscoveryRun {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  steps: DiscoveryStepResult[];
  checkpoint?: DiscoveryCheckpoint;
  error?: string;
}

// ── SSE Events ───────────────────────────────────────────────────

export type SseEventType =
  | 'step_start'
  | 'step_progress'
  | 'step_complete'
  | 'step_error'
  | 'step_skip'
  | 'run_complete'
  | 'run_error';

export interface SseEvent {
  type: SseEventType;
  runId: string;
  stepId?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ── Report Types ─────────────────────────────────────────────────

export interface ReportConfig {
  format: ('markdown' | 'csv' | 'json' | 'pdf')[];
  includeCustomerDetails: boolean;
  includeRawData: boolean;
  maxCustomersInReport?: number;
}

export interface ReportSummary {
  totalCustomers: number;
  totalMisalignments: number;
  criticalMisalignments: number;
  highMisalignments: number;
  mediumMisalignments: number;
  customersWithIssues: number;
  healthyCustomers: number;
}

export interface FindingCard {
  id: string;
  customerId: string;
  customerName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'billing' | 'enrollment' | 'agent_promise' | 'documentation';
  title: string;
  description: string;
  evidence: string[];
  recommendation: string;
  suggestedAction: SuggestedAction;
}

export interface CustomerReport {
  customerId: string;
  name: string;
  phone: string;
  email: string;
  slackMentions: number;
  slackActionRequested: string;
  base44Status: string;
  nmiStatus: string;
  billingState: string;
  alignmentSummary: string;
  flags: string[];
  recommendedAction: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface AggregateStats {
  enrollmentBreakdown: Record<string, number>;
  billingStateBreakdown: Record<string, number>;
  alignmentByCategory: Record<string, { aligned: number; misaligned: number; unknown: number }>;
  topAgents: { name: string; promisesMade: number; promisesKept: number }[];
  timeDistribution: Record<string, number>;
}

export interface Recommendation {
  priority: number;
  action: string;
  affectedCustomerCount: number;
  estimatedImpact: string;
  suggestedAssignee: string;
}

export interface SuggestedAction {
  type: 'update_base44' | 'sync_nmi' | 'close_ticket' | 'follow_up' | 'email' | 'escalate';
  entityId: string;
  description: string;
  payload: Record<string, unknown>;
}

export interface DiscoveryReport {
  runId: string;
  generatedAt: string;
  summary: ReportSummary;
  findings: FindingCard[];
  customerReports: CustomerReport[];
  aggregateStats: AggregateStats;
  recommendations: Recommendation[];
}

// ── Action Dispatcher ────────────────────────────────────────────

export type ActionType =
  | 'update_base44_status'
  | 'sync_nmi_to_base44'
  | 'close_stale_ticket'
  | 'follow_up_with_customer'
  | 'dispatch_recovery_email'
  | 'escalate_to_manager'
  | 'update_customer_profile'
  | 'cancel_nmi_subscription'
  | 'create_support_ticket';

export interface DiscoveryAction {
  id: string;
  runId: string;
  customerId: string;
  type: ActionType;
  status: 'pending' | 'approved' | 'rejected' | 'dispatched' | 'completed' | 'failed';
  description: string;
  payload: Record<string, unknown>;
  suggestedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  dispatchedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
  dependsOn?: string[];
}

// ── Caching ──────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

// ── Workflow Templates ───────────────────────────────────────────

export const WORKFLOW_TEMPLATES: DiscoveryWorkflow[] = [
  {
    id: 'audit-slack-tickets-last-7d',
    name: 'Audit Slack Tickets (7d)',
    description: 'Scrape Slack channels from last 7 days, cross-reference with CRM and billing, flag misalignments.',
    icon: '🔍',
    category: 'audit',
    steps: [
      { id: 'scrape_slack', name: 'Scrape Slack', type: 'scrape', config: { channels: ['newleaf-admin', 'newleaf-panda-submissions', 'all-billing'], daysBack: 7, maxMessagesPerChannel: 500 }, timeoutMs: 120000, onError: 'fail_run' },
      { id: 'pull_customers', name: 'Pull Customer Data', type: 'pull', config: { includeNmi: true, includeBase44: true, includeComms: true, includeTickets: true }, dependsOn: ['scrape_slack'], timeoutMs: 180000, onError: 'continue_with_partial' },
      { id: 'cross_reference', name: 'Cross-Reference', type: 'cross_reference', config: {}, dependsOn: ['pull_customers'], timeoutMs: 60000, onError: 'continue_with_partial' },
      { id: 'validate', name: 'Validate Alignment', type: 'validate', config: { validators: ['billing', 'enrollment', 'agent_promise', 'documentation'] }, dependsOn: ['cross_reference'], timeoutMs: 60000, onError: 'continue_with_partial' },
      { id: 'analyze', name: 'Analyze Patterns', type: 'analyze', config: {}, dependsOn: ['validate'], timeoutMs: 60000, onError: 'skip_step' },
      { id: 'report', name: 'Generate Report', type: 'report', config: { formats: ['markdown', 'csv', 'json', 'pdf'], includeCustomerDetails: true, includeRawData: true }, dependsOn: ['analyze'], timeoutMs: 120000, onError: 'fail_run' },
    ],
    outputs: ['markdown', 'csv', 'json', 'pdf'],
    defaultConfig: { channels: ['newleaf-admin', 'newleaf-panda-submissions', 'all-billing'], daysBack: 7 },
    estimatedDuration: '2-3 min',
  },
  {
    id: 'find-misaligned-billing',
    name: 'Find Misaligned Billing',
    description: 'Cross-reference Base44 enrollment status against NMI subscription state for all active customers.',
    icon: '💳',
    category: 'billing',
    steps: [
      { id: 'pull_customers', name: 'Pull Customer Data', type: 'pull', config: { includeNmi: true, includeBase44: true }, timeoutMs: 300000, onError: 'continue_with_partial' },
      { id: 'validate', name: 'Validate Billing', type: 'validate', config: { validators: ['billing'] }, dependsOn: ['pull_customers'], timeoutMs: 60000, onError: 'continue_with_partial' },
      { id: 'report', name: 'Generate Report', type: 'report', config: { formats: ['csv', 'markdown'] }, dependsOn: ['validate'], timeoutMs: 60000, onError: 'fail_run' },
    ],
    outputs: ['csv', 'markdown'],
    defaultConfig: { maxCustomers: 200 },
    estimatedDuration: '3-5 min',
  },
  {
    id: 'recovery-stale-tasks-audit',
    name: 'Recovery Stale Tasks Audit',
    description: 'Find declined payments with stale recovery tasks (>48h no action).',
    icon: '🔄',
    category: 'recovery',
    steps: [
      { id: 'pull_customers', name: 'Pull Recovery Data', type: 'pull', config: { includeNmi: true, includeBase44: true, includeTickets: true }, timeoutMs: 180000, onError: 'continue_with_partial' },
      { id: 'validate', name: 'Validate Recovery State', type: 'validate', config: { validators: ['billing', 'agent_promise'] }, dependsOn: ['pull_customers'], timeoutMs: 60000, onError: 'continue_with_partial' },
      { id: 'report', name: 'Generate Recovery Report', type: 'report', config: { formats: ['csv', 'markdown'] }, dependsOn: ['validate'], timeoutMs: 60000, onError: 'fail_run' },
    ],
    outputs: ['csv', 'markdown'],
    defaultConfig: { staleHours: 48 },
    estimatedDuration: '2-3 min',
  },
  {
    id: 'customer-360-deep-pull',
    name: 'Customer 360 Deep Pull',
    description: 'Comprehensive single-customer deep dive across all systems.',
    icon: '👤',
    category: 'customer_360',
    steps: [
      { id: 'scrape_slack', name: 'Scrape Slack Mentions', type: 'scrape', config: { channels: ['newleaf-admin', 'newleaf-panda-submissions', 'all-billing', 'jarvis-admin'], daysBack: 90, maxMessagesPerChannel: 200 }, timeoutMs: 180000, onError: 'continue_with_partial' },
      { id: 'pull_customers', name: 'Pull Full Customer Data', type: 'pull', config: { includeNmi: true, includeBase44: true, includeComms: true, includeTickets: true, nmiTransactionDays: 90 }, dependsOn: ['scrape_slack'], timeoutMs: 120000, onError: 'fail_run' },
      { id: 'cross_reference', name: 'Cross-Reference', type: 'cross_reference', config: {}, dependsOn: ['pull_customers'], timeoutMs: 30000, onError: 'continue_with_partial' },
      { id: 'validate', name: 'Validate All Dimensions', type: 'validate', config: { validators: ['billing', 'enrollment', 'agent_promise', 'documentation'] }, dependsOn: ['cross_reference'], timeoutMs: 60000, onError: 'continue_with_partial' },
      { id: 'report', name: 'Generate Customer 360 Report', type: 'report', config: { formats: ['markdown', 'json', 'pdf'] }, dependsOn: ['validate'], timeoutMs: 60000, onError: 'fail_run' },
    ],
    outputs: ['markdown', 'json', 'pdf'],
    defaultConfig: { customerId: '', daysBack: 90 },
    estimatedDuration: '1-2 min',
  },
  {
    id: 'agent-promise-tracker',
    name: 'Agent Promise Tracker',
    description: 'Track agent promises made in Slack and verify follow-through.',
    icon: '🤝',
    category: 'agent_tracking',
    steps: [
      { id: 'scrape_slack', name: 'Scrape Agent Promises', type: 'scrape', config: { channels: ['newleaf-admin', 'jarvis-admin'], daysBack: 14, maxMessagesPerChannel: 1000 }, timeoutMs: 180000, onError: 'fail_run' },
      { id: 'pull_customers', name: 'Pull Customer + Ticket Data', type: 'pull', config: { includeNmi: false, includeBase44: true, includeComms: true, includeTickets: true }, dependsOn: ['scrape_slack'], timeoutMs: 120000, onError: 'continue_with_partial' },
      { id: 'validate', name: 'Validate Agent Promises', type: 'validate', config: { validators: ['agent_promise'] }, dependsOn: ['pull_customers'], timeoutMs: 60000, onError: 'continue_with_partial' },
      { id: 'report', name: 'Generate Agent Report', type: 'report', config: { formats: ['markdown', 'csv'] }, dependsOn: ['validate'], timeoutMs: 60000, onError: 'fail_run' },
    ],
    outputs: ['markdown', 'csv'],
    defaultConfig: { daysBack: 14 },
    estimatedDuration: '2-3 min',
  },
  {
    id: 'churn-risk-analysis',
    name: 'Churn Risk Analysis',
    description: 'Identify customers at risk of churning based on declines, cancellations, and sentiment.',
    icon: '⚠️',
    category: 'audit',
    steps: [
      { id: 'pull_customers', name: 'Pull At-Risk Customers', type: 'pull', config: { includeNmi: true, includeBase44: true, includeTickets: true }, timeoutMs: 300000, onError: 'continue_with_partial' },
      { id: 'cross_reference', name: 'Cross-Reference Sentiment', type: 'cross_reference', config: {}, dependsOn: ['pull_customers'], timeoutMs: 60000, onError: 'skip_step' },
      { id: 'analyze', name: 'Analyze Churn Patterns', type: 'analyze', config: {}, dependsOn: ['cross_reference'], timeoutMs: 60000, onError: 'skip_step' },
      { id: 'report', name: 'Generate Churn Report', type: 'report', config: { formats: ['markdown', 'csv'] }, dependsOn: ['analyze'], timeoutMs: 60000, onError: 'fail_run' },
    ],
    outputs: ['markdown', 'csv'],
    defaultConfig: {},
    estimatedDuration: '2-4 min',
  },
];
