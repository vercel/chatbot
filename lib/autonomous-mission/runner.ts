/**
 * Autonomous Mission — Core Orchestrator
 *
 * State machine: PROPOSED → PARSING → PLANNING → EXECUTING → DEPLOYING → VERIFYING → COMPLETE
 * Supports 3 modes: LIVE (SSE), BACKGROUND (autonomous), HYBRID (pause on blockers)
 * Checkpoint-based rollback, intervention API, SSE event streaming.
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 compatible.
 * Phase 38: Autonomous Coding Platform
 */

import type { ExecutionPlan, ExecutionStep, StreamPlan, CardinalRule } from "./prd-parser";
import type { GitResult } from "./git-ops";
import * as GitOps from "./git-ops";

// ─── Types ────────────────────────────────────────────────────────────────

export type MissionStatus =
  | "PROPOSED"
  | "PARSING"
  | "PLANNING"
  | "EXECUTING"
  | "PAUSED"
  | "DEPLOYING"
  | "VERIFYING"
  | "COMPLETE"
  | "FAILED"
  | "ABORTED";

export type ExecutionMode = "LIVE" | "BACKGROUND" | "HYBRID";

export type MissionEventType =
  | "MISSION_STARTED"
  | "MISSION_FAILED"
  | "MISSION_COMPLETE"
  | "STREAM_STARTED"
  | "STREAM_COMPLETE"
  | "STREAM_FAILED"
  | "STEP_STARTED"
  | "STEP_COMPLETE"
  | "STEP_FAILED"
  | "FILE_CREATED"
  | "FILE_EDITED"
  | "BUILD_STARTED"
  | "BUILD_OUTPUT"
  | "BUILD_COMPLETE"
  | "COMMIT_CREATED"
  | "PUSH_COMPLETE"
  | "DEPLOY_TRIGGERED"
  | "DEPLOY_STATUS"
  | "DEPLOY_READY"
  | "URL_VERIFIED"
  | "SLACK_POSTED"
  | "CHECKPOINT_SAVED"
  | "CHECKPOINT_RESTORE"
  | "PAUSED"
  | "RESUMED"
  | "ABORTED"
  | "HEARTBEAT"
  | "BLOCKED"
  | "UNBLOCKED"
  | "COMMENT";

export interface MissionEvent {
  type: MissionEventType;
  missionId: string;
  timestamp: string;
  streamId?: string;
  stepId?: string;
  data?: Record<string, unknown>;
  message?: string;
}

export interface InterventionCommand {
  type: "pause" | "resume" | "inject" | "skip_stream" | "retry_stream" | "change_branch" | "abort";
  reason?: string;
  instruction?: string;
  streamId?: string;
  branchName?: string;
}

export interface Checkpoint {
  id: string;
  streamId: string;
  stepIndex: number;
  branch: string;
  commitSha: string;
  createdAt: string;
}

export interface MissionSummary {
  missionId: string;
  prdName: string;
  status: MissionStatus;
  mode: ExecutionMode;
  branch: string;
  streamsCompleted: number;
  totalStreams: number;
  stepsCompleted: number;
  totalSteps: number;
  deployUrl?: string;
  commitSha?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface MissionOptions {
  mode: ExecutionMode;
  autoCommit: boolean;
  autoPush: boolean;
  autoDeploy: boolean;
  autoSlack: boolean;
  maxBuildRetries: number;
  smokePaths: string[];
  createdBy: string;
}

export interface MissionContext {
  missionId: string;
  plan: ExecutionPlan;
  status: MissionStatus;
  mode: ExecutionMode;
  options: MissionOptions;
  currentStreamIndex: number;
  currentStepIndex: number;
  completedStreamIds: string[];
  checkpoints: Checkpoint[];
  events: MissionEvent[];
  deployUrl?: string;
  deployId?: string;
  commitSha?: string;
  branch: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
  pauseRequested: boolean;
  abortRequested: boolean;
  injectQueue: string[];
  blocked: boolean;
  blockReason?: string;
}

// ─── Callbacks ──────────────────────────────────────────────────────────────

export type EventCallback = (event: MissionEvent) => void;
export type StepExecutor = (
  step: ExecutionStep,
  ctx: MissionContext,
) => Promise<{ success: boolean; output?: string; error?: string }>;
export type BuildRunner = (ctx: MissionContext) => Promise<{ success: boolean; output: string }>;
export type DeployTrigger = (ctx: MissionContext) => Promise<{ deployId: string; url?: string }>;
export type DeployWatcher = (deployId: string, ctx: MissionContext) => Promise<{ ready: boolean; url?: string; error?: string }>;
export type SlackPoster = (message: string, ctx: MissionContext) => Promise<{ ts: string; channel: string }>;

// ─── Default Options ───────────────────────────────────────────────────────

const DEFAULT_OPTIONS: MissionOptions = {
  mode: "LIVE",
  autoCommit: true,
  autoPush: false,
  autoDeploy: false,
  autoSlack: false,
  maxBuildRetries: 3,
  smokePaths: ["/"],
  createdBy: "neptune-agent",
};

// ─── MissionRunner ──────────────────────────────────────────────────────────

export class MissionRunner {
  ctx: MissionContext;
  private eventCallbacks: EventCallback[] = [];
  private stepExecutor?: StepExecutor;
  private buildRunner?: BuildRunner;
  private deployTriggerFn?: DeployTrigger;
  private deployWatcherFn?: DeployWatcher;
  private slackPosterFn?: SlackPoster;
  private interventionHandlers: Map<string, () => void> = new Map();

  // Cardinal rule enforcement
  private cardinalViolations: string[] = [];

  constructor(
    plan: ExecutionPlan,
    options: Partial<MissionOptions> = {},
  ) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    this.ctx = {
      missionId: plan.missionId,
      plan,
      status: "PROPOSED",
      mode: opts.mode,
      options: opts,
      currentStreamIndex: 0,
      currentStepIndex: 0,
      completedStreamIds: [],
      checkpoints: [],
      events: [],
      branch: plan.targetBranch,
      startedAt: new Date().toISOString(),
      pauseRequested: false,
      abortRequested: false,
      injectQueue: [],
      blocked: false,
    };
  }

  // ─── Callback Registration ──────────────────────────────────────────────

  onEvent(cb: EventCallback): void {
    this.eventCallbacks.push(cb);
  }

  setStepExecutor(executor: StepExecutor): void {
    this.stepExecutor = executor;
  }

  setBuildRunner(runner: BuildRunner): void {
    this.buildRunner = runner;
  }

  setDeployTrigger(fn: DeployTrigger): void {
    this.deployTriggerFn = fn;
  }

  setDeployWatcher(fn: DeployWatcher): void {
    this.deployWatcherFn = fn;
  }

  setSlackPoster(fn: SlackPoster): void {
    this.slackPosterFn = fn;
  }

  // ─── Event Emission ────────────────────────────────────────────────────

  private emit(type: MissionEventType, data?: Record<string, unknown>, message?: string): void {
    const event: MissionEvent = {
      type,
      missionId: this.ctx.missionId,
      timestamp: new Date().toISOString(),
      streamId: this.ctx.plan.streams[this.ctx.currentStreamIndex]?.id,
      stepId: this.ctx.plan.streams[this.ctx.currentStreamIndex]
        ?.steps[this.ctx.currentStepIndex]?.id,
      data,
      message,
    };

    this.ctx.events.push(event);

    for (const cb of this.eventCallbacks) {
      try {
        cb(event);
      } catch {
        // Swallow callback errors — don't crash the mission
      }
    }
  }

  // ─── Cardinal Rule Enforcement ─────────────────────────────────────────

  private enforceCardinals(step: ExecutionStep): boolean {
    for (const cardinal of this.ctx.plan.cardinals) {
      // Security: NO force.push to main
      if (cardinal.category === "git" && /force.push|main/.test(cardinal.rule)) {
        if (step.description.toLowerCase().includes("force push") ||
            step.description.toLowerCase().includes("push to main")) {
          this.cardinalViolations.push(
            `Step "${step.description}" violates cardinal rule: ${cardinal.rule}`,
          );
          return false;
        }
      }

      // Security: NO secret/credential exposure
      if (cardinal.category === "security" && /secret|credential|\.env|token/i.test(cardinal.rule)) {
        if (step.description.toLowerCase().includes(".env") ||
            step.description.toLowerCase().includes("token") ||
            step.description.toLowerCase().includes("secret")) {
          // Allow .env.example but not .env
          if (!step.description.toLowerCase().includes(".env.example") &&
              !step.description.toLowerCase().includes("token_name")) {
            this.cardinalViolations.push(
              `Step "${step.description}" may violate security rule: ${cardinal.rule}`,
            );
            // Soft-block: log but don't abort (context-dependent)
          }
        }
      }

      // Deploy: NO deploy without build verification
      if (cardinal.category === "deploy" && /deploy|vercel/i.test(cardinal.rule)) {
        if (step.type === "deploy" && !this.ctx.events.some(e => e.type === "BUILD_COMPLETE")) {
          this.emit("COMMENT", undefined, "Cardinal rule: Build must pass before deploy");
        }
      }
    }

    return true;
  }

  // ─── State Transition ──────────────────────────────────────────────────

  private setStatus(status: MissionStatus): void {
    const prev = this.ctx.status;
    this.ctx.status = status;

    if (status === "COMPLETE" || status === "FAILED" || status === "ABORTED") {
      this.ctx.completedAt = new Date().toISOString();
    }

    // Log state transition
    this.emit("COMMENT", { prevStatus: prev, newStatus: status },
      `State: ${prev} → ${status}`);
  }

  // ─── Checkpoint Management ─────────────────────────────────────────────

  private async saveCheckpoint(): Promise<Checkpoint> {
    const stream = this.ctx.plan.streams[this.ctx.currentStreamIndex];
    const sha = GitOps.getHeadSha();

    const checkpoint: Checkpoint = {
      id: `ckpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      streamId: stream?.id ?? "unknown",
      stepIndex: this.ctx.currentStepIndex,
      branch: GitOps.getCurrentBranch(),
      commitSha: sha,
      createdAt: new Date().toISOString(),
    };

    this.ctx.checkpoints.push(checkpoint);
    this.emit("CHECKPOINT_SAVED", {
      checkpointId: checkpoint.id,
      streamId: checkpoint.streamId,
      commitSha: sha,
    });

    return checkpoint;
  }

  private async restoreCheckpoint(checkpointId?: string): Promise<boolean> {
    const ckpt = checkpointId
      ? this.ctx.checkpoints.find(c => c.id === checkpointId)
      : this.ctx.checkpoints[this.ctx.checkpoints.length - 1];

    if (!ckpt) return false;

    try {
      GitOps.rollback(ckpt.commitSha);
      this.emit("CHECKPOINT_RESTORE", {
        checkpointId: ckpt.id,
        commitSha: ckpt.commitSha,
      });
      return true;
    } catch {
      return false;
    }
  }

  // ─── Intervention API ──────────────────────────────────────────────────

  sendCommand(cmd: InterventionCommand): void {
    switch (cmd.type) {
      case "pause":
        this.ctx.pauseRequested = true;
        this.emit("COMMENT", { reason: cmd.reason }, "Pause requested");
        break;

      case "resume":
        this.ctx.pauseRequested = false;
        this.emit("RESUMED", { reason: cmd.reason });
        // Resume handler
        const resumeH = this.interventionHandlers.get("resume");
        if (resumeH) resumeH();
        break;

      case "inject":
        if (cmd.instruction) {
          this.ctx.injectQueue.push(cmd.instruction);
          this.emit("COMMENT", { instruction: cmd.instruction }, "Instruction injected");
        }
        break;

      case "skip_stream":
        if (cmd.streamId) {
          this.ctx.completedStreamIds.push(cmd.streamId);
          this.emit("COMMENT", { streamId: cmd.streamId }, "Stream skipped");
        }
        break;

      case "retry_stream":
        if (cmd.streamId) {
          this.ctx.completedStreamIds = this.ctx.completedStreamIds.filter(id => id !== cmd.streamId);
          this.ctx.currentStepIndex = 0;
          this.restoreCheckpoint();
          this.emit("COMMENT", { streamId: cmd.streamId }, "Stream retry requested");
        }
        break;

      case "change_branch":
        if (cmd.branchName) {
          this.ctx.branch = cmd.branchName;
          this.emit("COMMENT", { branch: cmd.branchName }, "Branch changed");
        }
        break;

      case "abort":
        this.ctx.abortRequested = true;
        this.emit("ABORTED", { reason: cmd.reason }, `Aborted: ${cmd.reason}`);
        this.setStatus("ABORTED");
        break;
    }
  }

  // ─── Check intervention ────────────────────────────────────────────────

  private async checkIntervention(): Promise<void> {
    if (this.ctx.abortRequested) {
      throw new MissionAbortedError(this.ctx.missionId);
    }

    if (this.ctx.pauseRequested) {
      this.setStatus("PAUSED");
      this.emit("PAUSED", { reason: "User requested pause" });

      // Wait for resume
      await new Promise<void>((resolve) => {
        this.interventionHandlers.set("resume", resolve);
      });

      this.ctx.pauseRequested = false;
      this.setStatus("EXECUTING");
    }
  }

  // ─── Execute Single Step ───────────────────────────────────────────────

  private async executeStep(
    stream: StreamPlan,
    step: ExecutionStep,
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    // Enforce cardinal rules
    if (!this.enforceCardinals(step)) {
      return { success: false, error: this.cardinalViolations.join("; ") };
    }

    this.emit("STEP_STARTED", {
      streamId: stream.id,
      streamName: stream.name,
      stepType: step.type,
      description: step.description,
      filePath: step.filePath,
    });

    // Check for injected instructions
    let augmentedStep = { ...step };
    if (this.ctx.injectQueue.length > 0) {
      const injection = this.ctx.injectQueue.shift()!;
      augmentedStep.description = `${step.description}\n// INJECTED: ${injection}`;
      this.emit("COMMENT", { injection }, "Step augmented with user instruction");
    }

    // Use custom executor if provided, otherwise default behavior
    let result: { success: boolean; output?: string; error?: string };

    if (this.stepExecutor) {
      result = await this.stepExecutor(augmentedStep, this.ctx);
    } else {
      result = await this.defaultStepExecutor(augmentedStep, stream);
    }

    if (result.success) {
      this.emit("STEP_COMPLETE", {
        streamId: stream.id,
        stepType: step.type,
        output: result.output,
      });
    } else {
      this.emit("STEP_FAILED", {
        streamId: stream.id,
        stepType: step.type,
        error: result.error,
      });
    }

    return result;
  }

  // ─── Default Step Executor ─────────────────────────────────────────────

  private async defaultStepExecutor(
    step: ExecutionStep,
    _stream: StreamPlan,
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    switch (step.type) {
      case "create_file":
        if (step.filePath && step.content) {
          try {
            const { writeFile } = await import("node:fs/promises");
            const fullPath = `${process.cwd()}/${step.filePath}`;
            const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
            const { mkdir } = await import("node:fs/promises");
            await mkdir(dir, { recursive: true }).catch(() => {});
            await writeFile(fullPath, step.content, "utf-8");
            this.emit("FILE_CREATED", { filePath: step.filePath, content: step.content });
            return { success: true, output: `Created ${step.filePath}` };
          } catch (err) {
            return { success: false, error: String(err) };
          }
        }
        return { success: true, output: "No file to create" };

      case "edit_file":
        return { success: true, output: "Edit handled by step executor" };

      case "run_build":
        if (step.command) {
          try {
            const { execSync } = await import("node:child_process");
            this.emit("BUILD_STARTED");
            const output = execSync(step.command, {
              cwd: process.cwd(),
              encoding: "utf-8",
              timeout: 120_000,
            });
            this.emit("BUILD_COMPLETE", { success: true, output });
            return { success: true, output };
          } catch (err) {
            const output = (err as { stdout?: string; stderr?: string; message?: string }).stderr ||
                          (err as { message?: string }).message || String(err);
            this.emit("BUILD_COMPLETE", { success: false, output });
            return { success: false, output, error: "Build failed" };
          }
        }
        return { success: true, output: "No build command" };

      case "commit":
        if (this.ctx.options.autoCommit) {
          const result = GitOps.commit(step.description);
          if (result.success && result.commitSha) {
            this.ctx.commitSha = result.commitSha;
            this.emit("COMMIT_CREATED", {
              sha: result.commitSha,
              message: step.description,
            });
            return { success: true, output: `Commit: ${result.commitSha}` };
          }
          return { success: false, error: result.error };
        }
        return { success: true, output: "Auto-commit disabled" };

      case "run_test":
        if (step.command) {
          try {
            const { execSync } = await import("node:child_process");
            const output = execSync(step.command, {
              cwd: process.cwd(),
              encoding: "utf-8",
              timeout: 120_000,
            });
            return { success: true, output };
          } catch (err) {
            const output = (err as { stdout?: string; stderr?: string }).stderr || String(err);
            return { success: false, output, error: "Test failed" };
          }
        }
        return { success: true, output: "No test command" };

      default:
        return { success: true, output: `Step type ${step.type} acknowledged` };
    }
  }

  // ─── Execute Stream ────────────────────────────────────────────────────

  private async executeStream(stream: StreamPlan): Promise<boolean> {
    this.emit("STREAM_STARTED", {
      streamId: stream.id,
      streamName: stream.name,
      stepCount: stream.steps.length,
      budget: stream.budget,
    });

    // Save checkpoint at stream start
    await this.saveCheckpoint();

    for (let i = 0; i < stream.steps.length; i++) {
      await this.checkIntervention();

      if (this.ctx.abortRequested) return false;

      const step = stream.steps[i];
      this.ctx.currentStepIndex = i;

      // Check if this stream was already completed (for resume support)
      if (this.ctx.completedStreamIds.includes(stream.id)) {
        this.emit("COMMENT", undefined, `Stream ${stream.id} already completed, skipping`);
        return true;
      }

      // Check for injected instructions
      while (this.ctx.injectQueue.length > 0) {
        const injection = this.ctx.injectQueue.shift()!;
        // Append injection as an extra step
        stream.steps.splice(i + 1, 0, {
          id: `inj-${Date.now()}`,
          type: "edit_file",
          description: `[USER INJECTION] ${injection}`,
        });
      }

      const result = await this.executeStep(stream, step);

      if (!result.success) {
        // HYBRID mode: pause on failure
        if (this.ctx.mode === "HYBRID") {
          this.ctx.blocked = true;
          this.ctx.blockReason = result.error;
          this.emit("BLOCKED", {
            streamId: stream.id,
            stepId: step.id,
            error: result.error,
          });

          // Wait for user to unblock via intervention
          await new Promise<void>((resolve) => {
            this.interventionHandlers.set("resume", () => {
              this.ctx.blocked = false;
              this.emit("UNBLOCKED");
              resolve();
            });
          });
        } else {
          // Try rollback + retry once
          this.emit("COMMENT", undefined, `Step failed, attempting rollback`);
          const restored = await this.restoreCheckpoint();

          if (!restored) {
            this.emit("STREAM_FAILED", {
              streamId: stream.id,
              error: result.error,
            });
            return false;
          }

          // Retry the step
          this.emit("COMMENT", undefined, `Retrying step: ${step.description}`);
          const retryResult = await this.executeStep(stream, step);
          if (!retryResult.success) {
            this.emit("STREAM_FAILED", {
              streamId: stream.id,
              error: retryResult.error,
            });
            return false;
          }
        }
      }

      // Save checkpoint after successful step
      if (step.type === "commit" || i % 3 === 2) {
        await this.saveCheckpoint();
      }
    }

    // Auto-commit after stream if enabled and no commit step was in the stream
    if (this.ctx.options.autoCommit && !stream.steps.some(s => s.type === "commit")) {
      const result = GitOps.commit(`feat: ${stream.name} complete`);
      if (result.success && result.commitSha) {
        this.ctx.commitSha = result.commitSha;
        this.emit("COMMIT_CREATED", {
          sha: result.commitSha,
          message: `Stream ${stream.name} complete`,
        });
      }
    }

    this.ctx.completedStreamIds.push(stream.id);
    this.emit("STREAM_COMPLETE", { streamId: stream.id, streamName: stream.name });

    return true;
  }

  // ─── Build + Push ──────────────────────────────────────────────────────

  private async buildPhase(): Promise<boolean> {
    this.emit("BUILD_STARTED");

    if (this.buildRunner) {
      const result = await this.buildRunner(this.ctx);
      this.emit("BUILD_COMPLETE", { success: result.success, output: result.output });
      return result.success;
    }

    // Default: run `pnpm build`
    const maxRetries = this.ctx.options.maxBuildRetries;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { execSync } = await import("node:child_process");
        const output = execSync("pnpm build", {
          cwd: process.cwd(),
          encoding: "utf-8",
          timeout: 300_000,
        });
        this.emit("BUILD_COMPLETE", { success: true, output });
        return true;
      } catch (err) {
        const output = (err as { stdout?: string; stderr?: string }).stderr || String(err);
        this.emit("BUILD_OUTPUT", { attempt, output });

        if (attempt === maxRetries - 1) {
          this.emit("BUILD_COMPLETE", { success: false, output });
          return false;
        }

        // Wait before retry
        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
      }
    }

    return false;
  }

  // ─── Deploy Phase ──────────────────────────────────────────────────────

  private async deployPhase(): Promise<boolean> {
    this.setStatus("DEPLOYING");

    // Trigger deploy
    if (!this.deployTriggerFn) {
      this.emit("COMMENT", undefined, "No deploy trigger configured, skipping deploy");
      return true;
    }

    try {
      const { deployId, url: previewUrl } = await this.deployTriggerFn(this.ctx);
      this.ctx.deployId = deployId;
      this.emit("DEPLOY_TRIGGERED", { deployId, url: previewUrl });

      // Watch deploy
      if (this.deployWatcherFn) {
        const watchResult = await this.deployWatcherFn(deployId, this.ctx);

        if (!watchResult.ready) {
          this.emit("DEPLOY_STATUS", { status: "FAILED", error: watchResult.error });
          return false;
        }

        if (watchResult.url) {
          this.ctx.deployUrl = watchResult.url;
          this.emit("DEPLOY_READY", { url: watchResult.url });
        }
      }

      return true;
    } catch (err) {
      this.emit("DEPLOY_STATUS", { status: "ERROR", error: String(err) });
      return false;
    }
  }

  // ─── Verify Phase ──────────────────────────────────────────────────────

  private async verifyPhase(): Promise<boolean> {
    this.setStatus("VERIFYING");

    if (!this.ctx.deployUrl) {
      this.emit("COMMENT", undefined, "No deploy URL, skipping verification");
      return true;
    }

    const url = this.ctx.deployUrl.startsWith("http")
      ? this.ctx.deployUrl
      : `https://${this.ctx.deployUrl}`;

    try {
      const res = await fetch(url, { redirect: "follow" });
      this.emit("URL_VERIFIED", { url, statusCode: res.status });

      if (!res.ok) {
        this.emit("COMMENT", undefined, `URL returned ${res.status}`);
        return false;
      }

      // Smoke test additional paths
      for (const p of this.ctx.options.smokePaths) {
        const pathUrl = p.startsWith("http") ? p : `${url}${p}`;
        try {
          const pathRes = await fetch(pathUrl, { redirect: "follow" });
          this.emit("URL_VERIFIED", {
            url: pathUrl,
            statusCode: pathRes.status,
            smoke: true,
          });
        } catch {
          this.emit("COMMENT", undefined, `Smoke path ${p} unreachable`);
        }
      }

      return true;
    } catch (err) {
      this.emit("COMMENT", undefined, `URL verification failed: ${err}`);
      return false;
    }
  }

  // ─── Slack Landing ─────────────────────────────────────────────────────

  private async slackLanding(): Promise<void> {
    if (!this.ctx.options.autoSlack || !this.slackPosterFn) return;

    const duration = this.ctx.completedAt
      ? (new Date(this.ctx.completedAt).getTime() - new Date(this.ctx.startedAt).getTime()) / 1000
      : 0;

    const summary = this.getSummary();
    const message = [
      `🚀 *Autonomous Mission Complete*`,
      `📋 *PRD:* ${summary.prdName}`,
      `✅ ${summary.streamsCompleted}/${summary.totalStreams} streams · ${summary.stepsCompleted}/${summary.totalSteps} steps · ${Math.round(duration)}s`,
      summary.deployUrl ? `🔗 Deploy: ${summary.deployUrl}` : "",
      summary.commitSha ? `📝 Commit: \`${summary.commitSha.slice(0, 7)}\`` : "",
      summary.error ? `⚠️ Error: ${summary.error}` : "",
    ].filter(Boolean).join("\n");

    try {
      const result = await this.slackPosterFn(message, this.ctx);
      this.emit("SLACK_POSTED", { ts: result.ts, channel: result.channel });
    } catch (err) {
      this.emit("COMMENT", undefined, `Slack post failed: ${err}`);
    }
  }

  // ─── Get Summary ────────────────────────────────────────────────────────

  getSummary(): MissionSummary {
    const totalStreams = this.ctx.plan.streams.length;
    const totalSteps = this.ctx.plan.streams.reduce((sum, s) => sum + s.steps.length, 0);
    const stepsCompleted = this.ctx.events.filter(e => e.type === "STEP_COMPLETE").length;

    return {
      missionId: this.ctx.missionId,
      prdName: this.ctx.plan.prdName,
      status: this.ctx.status,
      mode: this.ctx.mode,
      branch: this.ctx.branch,
      streamsCompleted: this.ctx.completedStreamIds.length,
      totalStreams,
      stepsCompleted,
      totalSteps,
      deployUrl: this.ctx.deployUrl,
      commitSha: this.ctx.commitSha,
      error: this.ctx.error,
      startedAt: this.ctx.startedAt,
      completedAt: this.ctx.completedAt,
      durationMs: this.ctx.completedAt
        ? new Date(this.ctx.completedAt).getTime() - new Date(this.ctx.startedAt).getTime()
        : undefined,
    };
  }

  // ─── Run Mission ────────────────────────────────────────────────────────

  async run(): Promise<MissionSummary> {
    try {
      // Phase 1: Parsing
      this.setStatus("PARSING");
      this.emit("MISSION_STARTED", {
        plan: {
          missionId: this.ctx.plan.missionId,
          prdName: this.ctx.plan.prdName,
          streams: this.ctx.plan.streams.map(s => ({
            id: s.id,
            name: s.name,
            steps: s.steps.length,
            budget: s.budget,
          })),
          estimatedTotalTokens: this.ctx.plan.estimatedTotalTokens,
        },
      });

      // Phase 2: Git branch
      this.setStatus("PLANNING");
      const branchResult = GitOps.createBranch(this.ctx.branch);
      if (!branchResult.success) {
        throw new Error(`Branch creation failed: ${branchResult.error}`);
      }
      this.ctx.branch = branchResult.branch || this.ctx.branch;
      this.emit("COMMENT", { branch: this.ctx.branch }, `Branch: ${this.ctx.branch}`);

      // Phase 3: Execute streams sequentially
      this.setStatus("EXECUTING");

      const streams = this.ctx.plan.streams;
      for (let i = 0; i < streams.length; i++) {
        await this.checkIntervention();
        if (this.ctx.abortRequested) throw new MissionAbortedError(this.ctx.missionId);

        this.ctx.currentStreamIndex = i;
        this.ctx.currentStepIndex = 0;

        // Skip already completed streams (for resume)
        if (this.ctx.completedStreamIds.includes(streams[i].id)) {
          this.emit("COMMENT", undefined, `Stream ${streams[i].id} previously completed, skipping`);
          continue;
        }

        const streamSuccess = await this.executeStream(streams[i]);

        if (!streamSuccess) {
          if (this.ctx.mode === "HYBRID" && this.ctx.blocked) {
            // HYBRID: wait for user
            await new Promise<void>((resolve) => {
              this.interventionHandlers.set("resume", resolve);
            });
            // Retry the stream
            this.ctx.currentStepIndex = 0;
            const retrySuccess = await this.executeStream(streams[i]);
            if (!retrySuccess) {
              throw new Error(`Stream ${streams[i].id} failed after retry`);
            }
          } else {
            throw new Error(`Stream ${streams[i].id} failed`);
          }
        }
      }

      // Phase 4: Build verification
      const buildSuccess = await this.buildPhase();
      if (!buildSuccess) {
        throw new Error("Build failed after max retries");
      }

      // Phase 5: Push to origin
      if (this.ctx.options.autoPush) {
        const pushResult = GitOps.push(this.ctx.branch);
        if (pushResult.success) {
          this.emit("PUSH_COMPLETE", { branch: this.ctx.branch, sha: pushResult.commitSha });
        } else {
          this.emit("COMMENT", undefined, `Push failed: ${pushResult.error}`);
        }
      }

      // Phase 6: Deploy
      if (this.ctx.options.autoDeploy) {
        await this.deployPhase();
      }

      // Phase 7: Verify
      await this.verifyPhase();

      // Phase 8: Slack
      await this.slackLanding();

      // Mission complete
      this.setStatus("COMPLETE");
      const summary = this.getSummary();
      this.emit("MISSION_COMPLETE", { summary });

      return summary;

    } catch (err) {
      if (err instanceof MissionAbortedError) {
        this.setStatus("ABORTED");
        const summary = this.getSummary();
        this.emit("MISSION_FAILED", { error: "Aborted", summary });
        return summary;
      }

      this.ctx.error = err instanceof Error ? err.message : String(err);
      this.setStatus("FAILED");
      const summary = this.getSummary();
      this.emit("MISSION_FAILED", { error: this.ctx.error, summary });

      // Attempt Slack notification on failure
      if (this.ctx.options.autoSlack && this.slackPosterFn) {
        try {
          await this.slackPosterFn(
            `❌ *Mission Failed*\n📋 ${this.ctx.plan.prdName}\n⚠️ ${this.ctx.error}`,
            this.ctx,
          );
        } catch {
          // Swallow
        }
      }

      return summary;
    }
  }

  // ─── Get Event History ──────────────────────────────────────────────────

  getEvents(): MissionEvent[] {
    return [...this.ctx.events];
  }

  // ─── Serialize State (for persistence) ──────────────────────────────────

  serialize(): string {
    return JSON.stringify({
      missionId: this.ctx.missionId,
      plan: this.ctx.plan,
      status: this.ctx.status,
      mode: this.ctx.mode,
      options: this.ctx.options,
      currentStreamIndex: this.ctx.currentStreamIndex,
      currentStepIndex: this.ctx.currentStepIndex,
      completedStreamIds: this.ctx.completedStreamIds,
      checkpoints: this.ctx.checkpoints,
      events: this.ctx.events,
      deployUrl: this.ctx.deployUrl,
      deployId: this.ctx.deployId,
      commitSha: this.ctx.commitSha,
      branch: this.ctx.branch,
      error: this.ctx.error,
      startedAt: this.ctx.startedAt,
      completedAt: this.ctx.completedAt,
      pauseRequested: this.ctx.pauseRequested,
      abortRequested: this.ctx.abortRequested,
      injectQueue: this.ctx.injectQueue,
      blocked: this.ctx.blocked,
      blockReason: this.ctx.blockReason,
    });
  }

  // ─── Deserialize State (resume from persistence) ────────────────────────

  static deserialize(json: string): MissionRunner {
    const data = JSON.parse(json);
    const runner = new MissionRunner(data.plan, data.options);

    // Restore all state
    runner.ctx.status = data.status;
    runner.ctx.mode = data.mode;
    runner.ctx.currentStreamIndex = data.currentStreamIndex;
    runner.ctx.currentStepIndex = data.currentStepIndex;
    runner.ctx.completedStreamIds = data.completedStreamIds;
    runner.ctx.checkpoints = data.checkpoints;
    runner.ctx.events = data.events;
    runner.ctx.deployUrl = data.deployUrl;
    runner.ctx.deployId = data.deployId;
    runner.ctx.commitSha = data.commitSha;
    runner.ctx.branch = data.branch;
    runner.ctx.error = data.error;
    runner.ctx.startedAt = data.startedAt;
    runner.ctx.completedAt = data.completedAt;
    runner.ctx.pauseRequested = data.pauseRequested;
    runner.ctx.abortRequested = data.abortRequested;
    runner.ctx.injectQueue = data.injectQueue;
    runner.ctx.blocked = data.blocked;
    runner.ctx.blockReason = data.blockReason;
    runner.ctx.missionId = data.missionId;

    return runner;
  }
}

// ─── Errors ─────────────────────────────────────────────────────────────────

export class MissionAbortedError extends Error {
  constructor(missionId: string) {
    super(`Mission ${missionId} was aborted`);
    this.name = "MissionAbortedError";
  }
}

export class MissionFailedError extends Error {
  constructor(
    public missionId: string,
    public streamId?: string,
    public stepId?: string,
    cause?: string,
  ) {
    super(`Mission ${missionId} failed${streamId ? ` at stream ${streamId}` : ""}: ${cause ?? "unknown"}`);
    this.name = "MissionFailedError";
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createMissionRunner(
  plan: ExecutionPlan,
  options?: Partial<MissionOptions>,
): MissionRunner {
  return new MissionRunner(plan, options);
}
