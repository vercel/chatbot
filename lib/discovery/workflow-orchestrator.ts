/**
 * lib/discovery/workflow-orchestrator.ts
 * Phase 38 Stream 3 — Discovery Workflow Orchestrator
 *
 * Core engine that:
 * 1. Loads workflow template
 * 2. Executes steps in dependency order
 * 3. Emits SSE events for real-time progress
 * 4. Checkpoints after each step (crash recovery)
 * 5. Manages run lifecycle (pending → running → completed/failed)
 */

import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import type {
  DiscoveryWorkflow,
  DiscoveryRun,
  DiscoveryStepResult,
  DiscoveryCheckpoint,
  SseEvent,
  ScrapedSlackMessage,
  PulledCustomerData,
  CustomerDiscoveryContext,
  DiscoveryReport,
  AlignmentResult,
  DependencyGraph,
} from "./types";
import { WORKFLOW_TEMPLATES } from "./types";
import { scrapeSlackChannels, getUniqueCustomersFromScrape } from "./slack-scraper";
import { pullCustomerData } from "./multi-source-puller";
import { crossReference, extractProfilesFromPulled } from "./cross-reference";
import { buildDependencyGraph } from "./dependency-graph";
import { validateAll, summarizeValidations } from "./alignment-validators";
import type { CustomerProfileRecord } from "./customer-matcher";
import { clearAllCaches } from "./caching";

// ── Configuration ────────────────────────────────────────────────

const CHECKPOINT_DIR = path.join(process.cwd(), "lib/discovery/.checkpoints");
const REPORT_DIR = path.join(process.cwd(), "lib/discovery/.reports");

// In-memory run store (for active runs)
const activeRuns = new Map<string, DiscoveryRun>();

// ── SSE Event Emitter ────────────────────────────────────────────

export type SseCallback = (event: SseEvent) => void;

class SseEmitter {
  private listeners: SseCallback[] = [];

  onEvent(cb: SseCallback): void {
    this.listeners.push(cb);
  }

  emit(runId: string, type: SseEvent["type"], data: Record<string, unknown>, stepId?: string): void {
    const event: SseEvent = {
      type,
      runId,
      stepId,
      data,
      timestamp: new Date().toISOString(),
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener error shouldn't crash run
      }
    }
  }
}

// ── Checkpoint Manager ───────────────────────────────────────────

async function saveCheckpoint(checkpoint: DiscoveryCheckpoint): Promise<void> {
  await fs.mkdir(CHECKPOINT_DIR, { recursive: true });
  const filePath = path.join(CHECKPOINT_DIR, `${checkpoint.runId}.json`);
  await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2));
}

async function loadCheckpoint(runId: string): Promise<DiscoveryCheckpoint | null> {
  try {
    const filePath = path.join(CHECKPOINT_DIR, `${runId}.json`);
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as DiscoveryCheckpoint;
  } catch {
    return null;
  }
}

async function deleteCheckpoint(runId: string): Promise<void> {
  try {
    await fs.unlink(path.join(CHECKPOINT_DIR, `${runId}.json`));
  } catch {
    // Already deleted
  }
}

// ── Run Manager ──────────────────────────────────────────────────

export function createRun(workflowId: string): DiscoveryRun {
  const workflow = WORKFLOW_TEMPLATES.find((w) => w.id === workflowId);
  if (!workflow) {
    throw new Error(`Unknown workflow: ${workflowId}`);
  }

  const run: DiscoveryRun = {
    id: `run-${randomUUID().slice(0, 8)}`,
    workflowId,
    status: "pending",
    startedAt: new Date().toISOString(),
    steps: workflow.steps.map((s) => ({
      stepId: s.id,
      status: "pending" as const,
    })),
  };

  activeRuns.set(run.id, run);
  return run;
}

export function getRun(runId: string): DiscoveryRun | null {
  return activeRuns.get(runId) || null;
}

export function getAllRuns(): DiscoveryRun[] {
  return [...activeRuns.values()].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

// ── Workflow Executor ────────────────────────────────────────────

export interface RunResult {
  run: DiscoveryRun;
  report?: DiscoveryReport;
  contexts: CustomerDiscoveryContext[];
  graph: DependencyGraph;
  validations: Map<string, AlignmentResult[]>;
  error?: string;
}

export async function executeWorkflow(
  runId: string,
  emitter: SseEmitter,
  config?: Record<string, unknown>
): Promise<RunResult> {
  const run = activeRuns.get(runId);
  if (!run) throw new Error(`Run not found: ${runId}`);

  const workflow = WORKFLOW_TEMPLATES.find((w) => w.id === run.workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${run.workflowId}`);

  // Clear caches for fresh run
  clearAllCaches();

  run.status = "running";
  const contexts: CustomerDiscoveryContext[] = [];
  const validations = new Map<string, AlignmentResult[]>();
  let graph: DependencyGraph = { nodes: new Map(), edges: [], cycles: [], chains: [] };
  let report: DiscoveryReport | undefined;

  // Check for existing checkpoint (resume)
  const checkpoint = await loadCheckpoint(runId);
  const completedStepIds = new Set(checkpoint?.completedStepIds || []);
  let scrapedMessages: ScrapedSlackMessage[] = checkpoint?.scrapedMessages || [];
  let pulledCustomers: Map<string, PulledCustomerData> = new Map(
    Object.entries(checkpoint?.pulledCustomers || {})
  );

  for (const step of workflow.steps) {
    // Skip completed steps (from checkpoint)
    if (completedStepIds.has(step.id)) {
      const stepResult = run.steps.find((s) => s.stepId === step.id);
      if (stepResult) {
        stepResult.status = "completed";
        stepResult.completedAt = new Date().toISOString();
      }
      emitter.emit(runId, "step_skip", { stepId: step.id, reason: "already completed" }, step.id);
      continue;
    }

    // Check dependencies
    if (step.dependsOn) {
      const allDepsSatisfied = step.dependsOn.every((depId) =>
        run.steps.find((s) => s.stepId === depId)?.status === "completed"
      );
      if (!allDepsSatisfied) {
        emitter.emit(runId, "step_error", { stepId: step.id, error: "Dependencies not met" }, step.id);
        continue;
      }
    }

    // Execute step
    const stepResult = run.steps.find((s) => s.stepId === step.id)!;
    stepResult.status = "running";
    stepResult.startedAt = new Date().toISOString();

    emitter.emit(runId, "step_start", {
      stepId: step.id,
      name: step.name,
      totalSteps: workflow.steps.length,
      currentStep: run.steps.indexOf(stepResult) + 1,
    }, step.id);

    try {
      const result = await executeStep(step.type, step.config, {
        scrapedMessages,
        pulledCustomers,
        contexts,
        emitter,
        runId,
      });

      // Update state with step results
      if (result.scrapedMessages) scrapedMessages = result.scrapedMessages;
      if (result.pulledCustomers && result.pulledCustomers.size > 0) {
        pulledCustomers = new Map([...pulledCustomers, ...result.pulledCustomers]);
      }
      if (result.contexts) contexts.push(...result.contexts);
      if (result.graph) graph = result.graph;
      if (result.validations) {
        for (const [id, vals] of result.validations) {
          validations.set(id, vals);
        }
      }
      if (result.report) report = result.report;

      stepResult.status = "completed";
      stepResult.result = { messageCount: result.scrapedMessages?.length, customerCount: contexts.length };
      stepResult.completedAt = new Date().toISOString();

      emitter.emit(runId, "step_complete", {
        stepId: step.id,
        result: { messageCount: result.scrapedMessages?.length, customerCount: contexts.length },
        duration: stepResult.startedAt
          ? `${Math.round((Date.now() - new Date(stepResult.startedAt).getTime()) / 1000)}s`
          : "0s",
      }, step.id);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      stepResult.status = "failed";
      stepResult.error = errorMsg;

      emitter.emit(runId, "step_error", {
        stepId: step.id,
        error: errorMsg,
        recoverable: step.onError !== "fail_run",
      }, step.id);

      if (step.onError === "fail_run") {
        run.status = "failed";
        run.error = errorMsg;
        run.completedAt = new Date().toISOString();
        emitter.emit(runId, "run_error", { error: errorMsg });
        return { run, contexts, graph, validations, error: errorMsg };
      }
      // continue_with_partial or skip_step — move to next step
      if (step.onError === "skip_step") {
        stepResult.status = "skipped";
      }
    }

    // Save checkpoint after each step
    await saveCheckpoint({
      runId,
      completedStepIds: [...completedStepIds, step.id],
      scrapedMessages,
      pulledCustomers: Object.fromEntries(pulledCustomers),
      cachedAt: new Date().toISOString(),
    });
    completedStepIds.add(step.id);
  }

  // Run completed successfully
  run.status = "completed";
  run.completedAt = new Date().toISOString();
  run.checkpoint = {
    runId,
    completedStepIds: [...completedStepIds],
    scrapedMessages,
    pulledCustomers: Object.fromEntries(pulledCustomers),
    cachedAt: new Date().toISOString(),
  };

  // Delete checkpoint on successful completion
  await deleteCheckpoint(runId);

  emitter.emit(runId, "run_complete", {
    totalDuration: `${Math.round((Date.now() - new Date(run.startedAt).getTime()) / 1000)}s`,
    messageCount: scrapedMessages.length,
    customerCount: contexts.length,
    reportGenerated: !!report,
  });

  return { run, report, contexts, graph, validations };
}

// ── Step Executor ────────────────────────────────────────────────

interface StepContext {
  scrapedMessages: ScrapedSlackMessage[];
  pulledCustomers: Map<string, PulledCustomerData>;
  contexts: CustomerDiscoveryContext[];
  emitter: SseEmitter;
  runId: string;
}

interface StepResult {
  scrapedMessages?: ScrapedSlackMessage[];
  pulledCustomers?: Map<string, PulledCustomerData>;
  contexts?: CustomerDiscoveryContext[];
  graph?: DependencyGraph;
  validations?: Map<string, AlignmentResult[]>;
  report?: DiscoveryReport;
}

async function executeStep(
  type: string,
  config: Record<string, unknown>,
  ctx: StepContext
): Promise<StepResult> {
  switch (type) {
    case "scrape":
      return executeScrapeStep(config, ctx);
    case "pull":
      return executePullStep(config, ctx);
    case "cross_reference":
      return executeCrossRefStep(config, ctx);
    case "validate":
      return executeValidateStep(config, ctx);
    case "analyze":
      return executeAnalyzeStep(config, ctx);
    case "report":
      return executeReportStep(config, ctx);
    default:
      throw new Error(`Unknown step type: ${type}`);
  }
}

async function executeScrapeStep(
  config: Record<string, unknown>,
  ctx: StepContext
): Promise<StepResult> {
  const channels = (config.channels as string[]) || ["newleaf-admin"];
  const daysBack = (config.daysBack as number) || 7;
  const maxPerChannel = (config.maxMessagesPerChannel as number) || 500;

  ctx.emitter.emit(ctx.runId, "step_progress", {
    message: `Scraping ${channels.length} channel(s)...`,
  });

  const result = await scrapeSlackChannels({
    channels,
    daysBack,
    maxMessagesPerChannel: maxPerChannel,
  });

  ctx.emitter.emit(ctx.runId, "step_progress", {
    message: `Scraped ${result.totalMessages} messages from ${Object.keys(result.channels).length} channel(s)`,
    current: result.totalMessages,
    total: result.totalMessages,
    percent: 100,
  });

  return { scrapedMessages: result.messages };
}

async function executePullStep(
  config: Record<string, unknown>,
  ctx: StepContext
): Promise<StepResult> {
  // Extract unique customer mentions from scraped messages
  const mentions = getUniqueCustomersFromScrape({
    totalMessages: ctx.scrapedMessages.length,
    channels: {},
    messages: ctx.scrapedMessages,
    errors: [],
    scrapedAt: new Date().toISOString(),
  });

  const customerIds = [...new Set(
    mentions
      .filter((m) => m.type === "customer_id")
      .map((m) => m.value)
  )];

  if (customerIds.length === 0 && config.customerIds) {
    customerIds.push(...(config.customerIds as string[]));
  }

  const pulledCount = customerIds.length;
  ctx.emitter.emit(ctx.runId, "step_progress", {
    message: `Pulling data for ${pulledCount} customer(s)...`,
    current: 0,
    total: pulledCount,
    percent: 0,
  });

  const pulled = await pullCustomerData({
    customerIds,
    includeNmi: config.includeNmi !== false,
    includeBase44: config.includeBase44 !== false,
    includeComms: config.includeComms === true,
    includeTickets: config.includeTickets !== false,
    nmiTransactionDays: config.nmiTransactionDays as number || 30,
  });

  ctx.emitter.emit(ctx.runId, "step_progress", {
    message: `Pulled data for ${pulled.size} customer(s)`,
    current: pulled.size,
    total: pulledCount,
    percent: 100,
  });

  return { pulledCustomers: pulled };
}

async function executeCrossRefStep(
  _config: Record<string, unknown>,
  ctx: StepContext
): Promise<StepResult> {
  const allMentions = getUniqueCustomersFromScrape({
    totalMessages: ctx.scrapedMessages.length,
    channels: {},
    messages: ctx.scrapedMessages,
    errors: [],
    scrapedAt: new Date().toISOString(),
  });

  const profiles = extractProfilesFromPulled(ctx.pulledCustomers);

  const result = crossReference(
    allMentions,
    profiles,
    ctx.pulledCustomers,
    ctx.scrapedMessages
  );

  return { contexts: [...result.matchedCustomers.values()] };
}

async function executeValidateStep(
  config: Record<string, unknown>,
  ctx: StepContext
): Promise<StepResult> {
  const validators = (config.validators as string[]) || ["billing", "enrollment", "agent_promise", "documentation"];
  const validations = new Map<string, AlignmentResult[]>();

  for (const c of ctx.contexts) {
    const results = validateAll(c);
    validations.set(c.customerId, results);
  }

  return { validations };
}

async function executeAnalyzeStep(
  _config: Record<string, unknown>,
  ctx: StepContext
): Promise<StepResult> {
  const graph = buildDependencyGraph(ctx.contexts, ctx.scrapedMessages);
  return { graph };
}

async function executeReportStep(
  config: Record<string, unknown>,
  ctx: StepContext
): Promise<StepResult> {
  const { generateReport } = await import("./report-generator");

  ctx.emitter.emit(ctx.runId, "step_progress", {
    message: `Generating report for ${ctx.contexts.length} customers...`,
    current: 0,
    total: ctx.contexts.length,
    percent: 0,
  });

  // Build validations map from contexts (they should already be validated)
  const validations = new Map<string, import("./types").AlignmentResult[]>();
  for (const c of ctx.contexts) {
    const { validateAll } = await import("./alignment-validators");
    validations.set(c.customerId, validateAll(c));
  }

  // Determine graph — if analyze step already ran, it's stored
  let graph = ctx.contexts.length > 0 ? ctx.contexts[0] as unknown as import("./types").DependencyGraph : undefined;
  if (!graph || !(graph as any).nodes) {
    const { buildDependencyGraph } = await import("./dependency-graph");
    graph = buildDependencyGraph(ctx.contexts, ctx.scrapedMessages);
  }

  const reportFormats = (config.formats as string[]) || ["markdown", "csv", "json"];
  const reportConfig = {
    format: reportFormats as ("markdown" | "csv" | "json" | "pdf")[],
    includeCustomerDetails: config.includeCustomerDetails !== false,
    includeRawData: config.includeRawData === true,
    maxCustomersInReport: config.maxCustomersInReport as number || 500,
  };

  const generated = await generateReport({
    runId: ctx.runId,
    contexts: ctx.contexts,
    validations,
    graph,
    config: reportConfig,
  });

  ctx.emitter.emit(ctx.runId, "step_progress", {
    message: `Report generated: ${generated.artifacts.length} format(s)`,
    current: ctx.contexts.length,
    total: ctx.contexts.length,
    percent: 100,
  });

  return { report: generated.report };
}

// ── Resume from Checkpoint ───────────────────────────────────────

export async function resumeRun(runId: string): Promise<DiscoveryRun | null> {
  const checkpoint = await loadCheckpoint(runId);
  if (!checkpoint) return null;

  const existingRun = activeRuns.get(runId);
  if (existingRun) return existingRun;

  // Reconstruct run from checkpoint
  const workflow = WORKFLOW_TEMPLATES.find((w) => w.id === runId.split("-").slice(0, -1).join("-"));
  if (!workflow) return null;

  const run: DiscoveryRun = {
    id: runId,
    workflowId: workflow.id,
    status: "pending",
    startedAt: checkpoint.cachedAt,
    steps: workflow.steps.map((s) => ({
      stepId: s.id,
      status: checkpoint.completedStepIds.includes(s.id) ? "completed" as const : "pending" as const,
    })),
    checkpoint,
  };

  activeRuns.set(runId, run);
  return run;
}

// ── SSE Serialization ────────────────────────────────────────────

export function serializeSseEvent(event: SseEvent): string {
  const data = JSON.stringify(event);
  return `event: ${event.type}\ndata: ${data}\n\n`;
}

export function sseEventStream(
  emitter: SseEmitter
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      emitter.onEvent((event) => {
        const serialized = serializeSseEvent(event);
        controller.enqueue(encoder.encode(serialized));
      });
    },
  });
}
