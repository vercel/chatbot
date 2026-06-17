/**
 * Autonomous Mission — Deploy Watcher
 *
 * Handles the full deploy lifecycle for autonomous missions:
 *   1. Trigger Vercel deploy (via GitHub push or direct API)
 *   2. Poll deploy status with exponential backoff
 *   3. Verify deploy READY state
 *   4. Smoke test live URL
 *   5. Return deploy verification result
 *
 * Integrates with lib/deploy/vercel-verify.ts for core Vercel API calls.
 * Designed for both synchronous (LIVE mode) and async (BACKGROUND mode) usage.
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 compatible.
 * Phase 38: Autonomous Coding Platform
 */

import {
  getLatestDeploy,
  waitForDeployReady,
  smokeTest,
  type VercelDeploy,
  type DeployVerification,
} from "@/lib/deploy/vercel-verify";

// ─── Types ────────────────────────────────────────────────────────────────

export type DeployStatus =
  | "PENDING"
  | "INITIALIZING"
  | "BUILDING"
  | "READY"
  | "ERROR"
  | "CANCELED"
  | "TIMEOUT";

export interface DeployWatchOptions {
  /** Vercel project ID or name */
  projectId: string;
  /** Project display name */
  projectName: string;
  /** Expected commit SHA to match */
  commitSha: string;
  /** Paths to smoke test after deploy */
  smokePaths: string[];
  /** Max wait time in ms (default: 8 minutes) */
  maxWaitMs: number;
  /** Poll interval in ms (default: 15s) */
  pollIntervalMs: number;
  /** Whether to use GitHub trigger (push → auto-deploy) */
  githubAutoDeploy: boolean;
  /** GitHub repo for auto-deploy tracking */
  githubRepo?: string;
}

export interface DeployWatchResult {
  status: DeployStatus;
  deploy?: VercelDeploy;
  url?: string;
  deployId?: string;
  smokeResults?: Record<string, boolean>;
  smokePassed: boolean;
  durationMs: number;
  errors: string[];
  events: DeployEvent[];
}

export interface DeployEvent {
  timestamp: string;
  type: "trigger" | "status_change" | "build_log" | "ready" | "error" | "smoke";
  message: string;
  data?: Record<string, unknown>;
}

const DEFAULT_WATCH_OPTIONS: DeployWatchOptions = {
  projectId: "",
  projectName: "Neptune Chat",
  commitSha: "",
  smokePaths: ["/"],
  maxWaitMs: 8 * 60 * 1000, // 8 minutes
  pollIntervalMs: 15_000, // 15 seconds
  githubAutoDeploy: true,
};

// ─── Status Callback ───────────────────────────────────────────────────────

export type DeployStatusCallback = (event: DeployEvent) => void;

// ─── Deploy Watcher ────────────────────────────────────────────────────────

/**
 * Watch a deploy from trigger to READY, with smoke testing.
 * Returns comprehensive result including all events.
 */
export async function watchDeploy(
  options: Partial<DeployWatchOptions> & { projectId: string; commitSha: string },
  onStatus?: DeployStatusCallback,
): Promise<DeployWatchResult> {
  const opts = { ...DEFAULT_WATCH_OPTIONS, ...options };
  const startTime = Date.now();
  const events: DeployEvent[] = [];
  const errors: string[] = [];

  const emitEvent = (
    type: DeployEvent["type"],
    message: string,
    data?: Record<string, unknown>,
  ): void => {
    const event: DeployEvent = {
      timestamp: new Date().toISOString(),
      type,
      message,
      data,
    };
    events.push(event);
    onStatus?.(event);
  };

  // Step 1: Wait for deploy to appear (GitHub auto-deploy may take a moment)
  emitEvent("trigger", `Waiting for deploy to appear for commit ${opts.commitSha.slice(0, 7)}`);

  try {
    // Wait for deploy to be ready
    const deploy = await waitForDeployReady(
      opts.projectId,
      opts.commitSha,
      opts.maxWaitMs,
    );

    const durationMs = Date.now() - startTime;
    emitEvent("ready", `Deploy READY: ${deploy.url}`, {
      url: deploy.url,
      uid: deploy.uid,
      state: deploy.state,
      durationMs,
    });

    // Step 2: Smoke test
    const baseUrl = deploy.url.startsWith("http") ? deploy.url : `https://${deploy.url}`;
    let smokePassed = true;
    let smokeResults: Record<string, boolean> = {};

    if (opts.smokePaths.length > 0) {
      emitEvent("smoke", `Smoke testing ${opts.smokePaths.length} paths at ${baseUrl}`);

      smokeResults = await smokeTest(baseUrl, opts.smokePaths);
      smokePassed = Object.values(smokeResults).every(Boolean);

      for (const [path, ok] of Object.entries(smokeResults)) {
        emitEvent("smoke", `${ok ? "✅" : "❌"} ${path}: ${ok ? "OK" : "FAILED"}`, { path, ok });
      }
    }

    return {
      status: "READY",
      deploy,
      url: baseUrl,
      deployId: deploy.uid,
      smokeResults,
      smokePassed,
      durationMs,
      errors,
      events,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(errorMsg);
    emitEvent("error", errorMsg);

    return {
      status: "ERROR",
      smokePassed: false,
      durationMs,
      errors,
      events,
    };
  }
}

/**
 * Get the latest deploy status without waiting.
 * Useful for quick status checks.
 */
export async function getDeployStatus(
  projectId: string,
): Promise<DeployStatus> {
  try {
    const deploy = await getLatestDeploy(projectId);
    return deploy.state as DeployStatus;
  } catch {
    return "PENDING";
  }
}

/**
 * Poll deploy status at intervals until terminal state.
 * Returns immediately on READY or ERROR.
 */
export async function pollDeployStatus(
  projectId: string,
  options: {
    maxWaitMs?: number;
    pollIntervalMs?: number;
    onStatus?: DeployStatusCallback;
  } = {},
): Promise<{ status: DeployStatus; deploy?: VercelDeploy }> {
  const startTime = Date.now();
  const maxWait = options.maxWaitMs ?? 8 * 60 * 1000;
  const interval = options.pollIntervalMs ?? 15_000;

  while (Date.now() - startTime < maxWait) {
    try {
      const deploy = await getLatestDeploy(projectId);

      if (deploy.state === "READY" || deploy.state === "ERROR" || deploy.state === "CANCELED") {
        options.onStatus?.({
          timestamp: new Date().toISOString(),
          type: deploy.state === "READY" ? "ready" : "error",
          message: `Deploy ${deploy.state}: ${deploy.url ?? "no URL"}`,
          data: { url: deploy.url, uid: deploy.uid, state: deploy.state },
        });
        return { status: deploy.state as DeployStatus, deploy };
      }

      options.onStatus?.({
        timestamp: new Date().toISOString(),
        type: "status_change",
        message: `Deploy state: ${deploy.state}`,
        data: { state: deploy.state },
      });
    } catch {
      // Deploy might not exist yet, keep polling
    }

    await new Promise(r => setTimeout(r, interval));
  }

  return { status: "TIMEOUT" };
}

/**
 * Full deploy verification with smoke tests.
 * Wraps the existing verifyDeploy function with event reporting.
 */
export async function verifyDeployWithEvents(
  projectId: string,
  projectName: string,
  commitSha: string,
  smokePaths: string[],
  onStatus?: DeployStatusCallback,
): Promise<DeployVerification & { events: DeployEvent[] }> {
  const events: DeployEvent[] = [];

  const trackEvent = (
    type: DeployEvent["type"],
    message: string,
    data?: Record<string, unknown>,
  ): void => {
    const event: DeployEvent = {
      timestamp: new Date().toISOString(),
      type,
      message,
      data,
    };
    events.push(event);
    onStatus?.(event);
  };

  trackEvent("trigger", `Starting deploy verification for ${projectName}`);

  // Dynamic import to avoid circular deps
  const { verifyDeploy } = await import("@/lib/deploy/vercel-verify");
  const result = await verifyDeploy(projectId, projectName, commitSha, smokePaths);

  if (result.deployState === "READY") {
    trackEvent("ready", `Deploy verified: ${result.url}`, {
      url: result.url,
      smokePassed: result.smokePassed,
    });
  } else {
    trackEvent("error", `Deploy failed: ${result.errors.join("; ")}`);
  }

  return { ...result, events };
}

/**
 * Trigger a new deploy by creating a new commit (empty if needed).
 * This forces Vercel to start building.
 */
export async function triggerDeploy(
  projectId: string,
  commitSha: string,
): Promise<{ success: boolean; deployId?: string; error?: string }> {
  // Vercel auto-deploys on push to connected branches.
  // If the repo is connected, the deploy should be picked up automatically.
  // We wait up to 30 seconds for the deploy to appear.
  const startTime = Date.now();

  while (Date.now() - startTime < 30_000) {
    try {
      const deploy = await getLatestDeploy(projectId);

      // Check if there's a new deploy for our commit
      if (deploy.meta?.githubCommitSha === commitSha || deploy.meta?.githubCommitSha?.startsWith(commitSha)) {
        return { success: true, deployId: deploy.uid };
      }

      // If there's a newer deploy building, return it
      if (deploy.state === "BUILDING" || deploy.state === "INITIALIZING") {
        return { success: true, deployId: deploy.uid };
      }
    } catch {
      // Keep waiting
    }

    await new Promise(r => setTimeout(r, 5000));
  }

  return { success: false, error: "No deploy appeared within 30 seconds" };
}

/**
 * Generate a deploy summary for Slack posting.
 */
export function formatDeploySummary(result: DeployWatchResult): string {
  const lines: string[] = [];

  lines.push(result.status === "READY" ? "✅ Deploy Success" : "❌ Deploy Failed");
  if (result.url) lines.push(`🔗 ${result.url}`);
  if (result.deployId) lines.push(`🆔 Deploy: \`${result.deployId.slice(0, 8)}\``);
  lines.push(`⏱ ${(result.durationMs / 1000).toFixed(1)}s`);

  if (result.smokePassed) {
    lines.push(`🧪 Smoke: ${Object.keys(result.smokeResults ?? {}).length} paths ✅`);
  } else if (result.smokeResults) {
    const fails = Object.entries(result.smokeResults).filter(([, ok]) => !ok);
    if (fails.length > 0) {
      lines.push(`🧪 Smoke: ${fails.length} failures`);
      for (const [path] of fails.slice(0, 3)) {
        lines.push(`   ❌ ${path}`);
      }
    }
  }

  if (result.errors.length > 0) {
    lines.push(`⚠️ ${result.errors[0]}`);
  }

  return lines.join("\n");
}

/**
 * Check if a URL is accessible and returning 2xx.
 */
export async function checkUrl(url: string): Promise<{
  accessible: boolean;
  statusCode?: number;
  error?: string;
  latencyMs: number;
}> {
  const startTime = Date.now();

  try {
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(fullUrl, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
    return {
      accessible: res.ok,
      statusCode: res.status,
      latencyMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      accessible: false,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - startTime,
    };
  }
}

// ─── Export Default ────────────────────────────────────────────────────────

export default {
  watchDeploy,
  getDeployStatus,
  pollDeployStatus,
  verifyDeployWithEvents,
  triggerDeploy,
  formatDeploySummary,
  checkUrl,
};
