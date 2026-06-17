/**
 * Mission OTel Tracing — Eve Pattern 6 Adoption
 *
 * Wraps autonomous mission lifecycle with OpenTelemetry span trees:
 *  - Session spans (full mission lifecycle)
 *  - Stream spans (per-stream execution)
 *  - Step spans (per-step execution)
 *  - Tool spans (tool invocations)
 *  - Model spans (model calls)
 *  - Sandbox spans (sandbox operations)
 *
 * Exports to Vercel Observability via @vercel/otel.
 * Falls back gracefully if OTel is not configured.
 *
 * Eve Pattern 6: OpenTelemetry Tracing
 * Phase 38: Autonomous Coding Platform
 */

import { trace, Span, SpanStatusCode, context, propagation } from "@opentelemetry/api";

// ─── Tracer Name ──────────────────────────────────────────────────────────────

const TRACER_NAME = "neptune-autonomous-mission";
const TRACER_VERSION = "1.0.0";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTracer() {
  try {
    return trace.getTracer(TRACER_NAME, TRACER_VERSION);
  } catch {
    return null;
  }
}

function safeEndSpan(span: Span | null): void {
  if (!span) return;
  try { span.end(); } catch { /* swallow */ }
}

function safeSetAttribute(span: Span | null, key: string, value: string | number | boolean): void {
  if (!span) return;
  try { span.setAttribute(key, value); } catch { /* swallow */ }
}

function safeSetStatus(span: Span | null, ok: boolean, message?: string): void {
  if (!span) return;
  try {
    span.setStatus({
      code: ok ? SpanStatusCode.OK : SpanStatusCode.ERROR,
      message: message || (ok ? "OK" : "ERROR"),
    });
  } catch { /* swallow */ }
}

// ─── Span Wrapper Types ───────────────────────────────────────────────────────

export interface SpanContext {
  span: Span | null;
  traceId: string;
  spanId: string;
}

export interface MissionTraceOptions {
  missionId: string;
  prdName: string;
  totalStreams: number;
  totalSteps: number;
  estimatedTokens: number;
}

export interface StreamTraceOptions {
  streamId: string;
  streamName: string;
  stepCount: number;
  budget: number;
}

export interface StepTraceOptions {
  stepId: string;
  stepType: string;
  description: string;
  filePath?: string;
}

export interface ToolTraceOptions {
  toolName: string;
  toolType: string;
  input?: Record<string, unknown>;
}

export interface SandboxTraceOptions {
  sandboxId: string;
  operation: string;
  backend: string;
}

// ─── Mission Session Span ─────────────────────────────────────────────────────

/**
 * Creates a top-level session span for the full mission lifecycle.
 * Call endMissionSession() when the mission completes or fails.
 */
export function startMissionSession(options: MissionTraceOptions): SpanContext {
  const tracer = getTracer();
  if (!tracer) {
    return { span: null, traceId: "no-tracer", spanId: "no-tracer" };
  }

  const span = tracer.startSpan("mission-session", {
    attributes: {
      "mission.id": options.missionId,
      "mission.prd_name": options.prdName,
      "mission.total_streams": options.totalStreams,
      "mission.total_steps": options.totalSteps,
      "mission.estimated_tokens": options.estimatedTokens,
      "mission.started_at": new Date().toISOString(),
    },
  });

  return {
    span,
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
  };
}

export function endMissionSession(
  session: SpanContext,
  result: {
    success: boolean;
    streamsCompleted: number;
    totalStreams: number;
    stepsCompleted: number;
    totalSteps: number;
    durationMs?: number;
    error?: string;
    deployUrl?: string;
  },
): void {
  const { span } = session;
  if (!span) return;

  safeSetAttribute(span, "mission.streams_completed", result.streamsCompleted);
  safeSetAttribute(span, "mission.steps_completed", result.stepsCompleted);
  safeSetAttribute(span, "mission.duration_ms", result.durationMs ?? 0);
  safeSetAttribute(span, "mission.deploy_url", result.deployUrl ?? "none");
  safeSetAttribute(span, "mission.completed_at", new Date().toISOString());
  safeSetStatus(span, result.success, result.error);

  safeEndSpan(span);
}

// ─── Stream Span ──────────────────────────────────────────────────────────────

export function startStreamSpan(
  session: SpanContext,
  options: StreamTraceOptions,
): SpanContext {
  const tracer = getTracer();
  if (!tracer || !session.span) {
    return { span: null, traceId: session.traceId, spanId: "no-tracer" };
  }

  const ctx = trace.setSpan(context.active(), session.span);
  const span = tracer.startSpan(
    `stream-${options.streamName}`,
    {
      attributes: {
        "stream.id": options.streamId,
        "stream.name": options.streamName,
        "stream.step_count": options.stepCount,
        "stream.budget": options.budget,
      },
    },
    ctx,
  );

  return {
    span,
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
  };
}

export function endStreamSpan(
  stream: SpanContext,
  result: { success: boolean; error?: string },
): void {
  const { span } = stream;
  if (!span) return;

  safeSetAttribute(span, "stream.success", result.success);
  safeSetStatus(span, result.success, result.error);
  safeEndSpan(span);
}

// ─── Step Span ────────────────────────────────────────────────────────────────

export function startStepSpan(
  parent: SpanContext,
  options: StepTraceOptions,
): SpanContext {
  const tracer = getTracer();
  if (!tracer || !parent.span) {
    return { span: null, traceId: parent.traceId, spanId: "no-tracer" };
  }

  const ctx = trace.setSpan(context.active(), parent.span);
  const span = tracer.startSpan(
    `step-${options.stepType}`,
    {
      attributes: {
        "step.id": options.stepId,
        "step.type": options.stepType,
        "step.description": options.description,
        "step.file_path": options.filePath ?? "none",
      },
    },
    ctx,
  );

  return {
    span,
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
  };
}

export function endStepSpan(
  step: SpanContext,
  result: { success: boolean; output?: string; error?: string; durationMs?: number },
): void {
  const { span } = step;
  if (!span) return;

  safeSetAttribute(span, "step.success", result.success);
  safeSetAttribute(span, "step.duration_ms", result.durationMs ?? 0);
  if (result.output) safeSetAttribute(span, "step.output_preview", result.output.slice(0, 200));
  safeSetStatus(span, result.success, result.error);
  safeEndSpan(span);
}

// ─── Tool Span ────────────────────────────────────────────────────────────────

/**
 * Wraps a tool invocation with an OTel span.
 * Use this for MCP tool calls, file operations, git operations.
 */
export async function tracedTool<T>(
  parent: SpanContext,
  options: ToolTraceOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  const spanStart = Date.now();

  if (!tracer || !parent.span) {
    // No tracer available — just execute the function
    try {
      return await fn();
    } catch (err) {
      throw err;
    }
  }

  const ctx = trace.setSpan(context.active(), parent.span);
  const span = tracer.startSpan(
    `tool-${options.toolName}`,
    {
      attributes: {
        "tool.name": options.toolName,
        "tool.type": options.toolType,
        "tool.input": JSON.stringify(options.input ?? {}).slice(0, 500),
      },
    },
    ctx,
  );

  try {
    const result = await fn();
    const durationMs = Date.now() - spanStart;

    safeSetAttribute(span, "tool.success", true);
    safeSetAttribute(span, "tool.duration_ms", durationMs);
    safeSetStatus(span, true);
    safeEndSpan(span);

    return result;
  } catch (err) {
    const durationMs = Date.now() - spanStart;
    const errorMsg = err instanceof Error ? err.message : String(err);

    safeSetAttribute(span, "tool.success", false);
    safeSetAttribute(span, "tool.duration_ms", durationMs);
    safeSetAttribute(span, "tool.error", errorMsg.slice(0, 200));
    safeSetStatus(span, false, errorMsg);
    safeEndSpan(span);

    throw err;
  }
}

// ─── Model Call Span ──────────────────────────────────────────────────────────

export interface ModelTraceResult {
  tokens: number;
  latencyMs: number;
  model: string;
}

export function startModelSpan(
  parent: SpanContext,
  model: string,
): SpanContext {
  const tracer = getTracer();
  if (!tracer || !parent.span) {
    return { span: null, traceId: parent.traceId, spanId: "no-tracer" };
  }

  const ctx = trace.setSpan(context.active(), parent.span);
  const span = tracer.startSpan(
    `model-${model.split("/").pop() || model}`,
    {
      attributes: {
        "model.name": model,
        "model.provider": model.split("/")[0] || "unknown",
      },
    },
    ctx,
  );

  return {
    span,
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
  };
}

export function endModelSpan(
  modelSpan: SpanContext,
  result: ModelTraceResult,
  success: boolean,
  error?: string,
): void {
  const { span } = modelSpan;
  if (!span) return;

  safeSetAttribute(span, "model.tokens", result.tokens);
  safeSetAttribute(span, "model.latency_ms", result.latencyMs);
  safeSetAttribute(span, "model.name", result.model);
  safeSetAttribute(span, "model.success", success);
  safeSetStatus(span, success, error);
  safeEndSpan(span);
}

// ─── Sandbox Span ─────────────────────────────────────────────────────────────

export function startSandboxSpan(
  parent: SpanContext,
  options: SandboxTraceOptions,
): SpanContext {
  const tracer = getTracer();
  if (!tracer || !parent.span) {
    return { span: null, traceId: parent.traceId, spanId: "no-tracer" };
  }

  const ctx = trace.setSpan(context.active(), parent.span);
  const span = tracer.startSpan(
    `sandbox-${options.operation}`,
    {
      attributes: {
        "sandbox.id": options.sandboxId,
        "sandbox.operation": options.operation,
        "sandbox.backend": options.backend,
      },
    },
    ctx,
  );

  return {
    span,
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
  };
}

export function endSandboxSpan(
  sandbox: SpanContext,
  result: { success: boolean; durationMs: number; error?: string },
): void {
  const { span } = sandbox;
  if (!span) return;

  safeSetAttribute(span, "sandbox.success", result.success);
  safeSetAttribute(span, "sandbox.duration_ms", result.durationMs);
  safeSetStatus(span, result.success, result.error);
  safeEndSpan(span);
}

// ─── Build Span ───────────────────────────────────────────────────────────────

export function startBuildSpan(parent: SpanContext): SpanContext {
  const tracer = getTracer();
  if (!tracer || !parent.span) {
    return { span: null, traceId: parent.traceId, spanId: "no-tracer" };
  }

  const ctx = trace.setSpan(context.active(), parent.span);
  const span = tracer.startSpan("build-verification", {}, ctx);

  return {
    span,
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
  };
}

export function endBuildSpan(
  build: SpanContext,
  result: { success: boolean; attempts: number; durationMs: number; error?: string },
): void {
  const { span } = build;
  if (!span) return;

  safeSetAttribute(span, "build.success", result.success);
  safeSetAttribute(span, "build.attempts", result.attempts);
  safeSetAttribute(span, "build.duration_ms", result.durationMs);
  safeSetStatus(span, result.success, result.error);
  safeEndSpan(span);
}

// ─── Deploy Span ──────────────────────────────────────────────────────────────

export function startDeploySpan(parent: SpanContext): SpanContext {
  const tracer = getTracer();
  if (!tracer || !parent.span) {
    return { span: null, traceId: parent.traceId, spanId: "no-tracer" };
  }

  const ctx = trace.setSpan(context.active(), parent.span);
  const span = tracer.startSpan("deploy-vercel", {}, ctx);

  return {
    span,
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
  };
}

export function endDeploySpan(
  deploy: SpanContext,
  result: { success: boolean; url?: string; durationMs: number; error?: string },
): void {
  const { span } = deploy;
  if (!span) return;

  safeSetAttribute(span, "deploy.success", result.success);
  safeSetAttribute(span, "deploy.url", result.url ?? "none");
  safeSetAttribute(span, "deploy.duration_ms", result.durationMs);
  safeSetStatus(span, result.success, result.error);
  safeEndSpan(span);
}

// ─── Traced Mission Runner ────────────────────────────────────────────────────

/**
 * Wraps the MissionRunner.run() method with a full OTel session span.
 * Use this as a drop-in replacement for calling run() directly.
 */
export async function runWithTracing(
  missionId: string,
  prdName: string,
  totalStreams: number,
  totalSteps: number,
  estimatedTokens: number,
  runnerFn: () => Promise<{
    success: boolean;
    streamsCompleted: number;
    stepsCompleted: number;
    durationMs?: number;
    error?: string;
    deployUrl?: string;
  }>,
): Promise<{
  success: boolean;
  streamsCompleted: number;
  stepsCompleted: number;
  durationMs?: number;
  error?: string;
  deployUrl?: string;
}> {
  const missionSpan = startMissionSession({
    missionId,
    prdName,
    totalStreams,
    totalSteps,
    estimatedTokens,
  });

  const startTime = Date.now();

  try {
    const result = await runnerFn();
    const durationMs = Date.now() - startTime;

    endMissionSession(missionSpan, {
      ...result,
      totalStreams,
      totalSteps,
      streamsCompleted: result.streamsCompleted,
      stepsCompleted: result.stepsCompleted,
      durationMs: result.durationMs ?? durationMs,
      deployUrl: result.deployUrl,
    });

    return { ...result, durationMs: result.durationMs ?? durationMs };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    endMissionSession(missionSpan, {
      success: false,
      streamsCompleted: 0,
      totalStreams,
      stepsCompleted: 0,
      totalSteps,
      durationMs,
      error: errorMsg,
    });

    throw err;
  }
}

// ─── Export for Vercel Observability ──────────────────────────────────────────

/**
 * Re-exports the OTel registration helper.
 * Import this in instrumentation.ts or app layout to activate tracing.
 */
export { trace, propagation, context } from "@opentelemetry/api";
export type { Span } from "@opentelemetry/api";
