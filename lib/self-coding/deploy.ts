/**
 * lib/self-coding/deploy.ts — Direct Vercel Deployment
 *
 * M-N-SELF-CODING (2026-06-21): Neptune Chat triggers Vercel deployments
 * directly from the self-coding lane, using the Vercel REST API.
 *
 * Uses the existing Vercel connector infrastructure (secrets.vercel.token)
 * to trigger deployments and poll for status.
 *
 * Architecture:
 *   deployToVercel() → triggerDeploy() → pollDeployStatus() → return URL
 *
 * Works from Vercel serverless functions — uses REST API exclusively.
 */

import { secrets } from "@/secrets";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DeployInput {
  /** Vercel project ID (e.g., "prj_xxx") */
  projectId: string;
  /** Vercel team ID (optional) */
  teamId?: string;
  /** Git branch to deploy */
  branch?: string;
  /** Git commit SHA to deploy */
  sha?: string;
  /** Deployment target */
  target?: "production" | "preview";
  /** Max time to wait for deploy completion (ms) */
  timeoutMs?: number;
}

export interface DeployResult {
  success: boolean;
  /** Vercel deployment ID (dpl_xxx) */
  deploymentId?: string;
  /** Live URL of the deployment */
  url?: string;
  /** Vercel inspector URL */
  inspectorUrl?: string;
  /** Final deploy state */
  state?: "READY" | "ERROR" | "CANCELED" | "BUILDING" | "INITIALIZING" | "QUEUED";
  /** Error code from Vercel */
  errorCode?: string;
  /** Error message */
  error?: string;
  /** Build time in ms */
  buildTimeMs?: number;
}

export interface DeployStatus {
  deploymentId: string;
  state: "BUILDING" | "READY" | "ERROR" | "CANCELED" | "QUEUED" | "INITIALIZING";
  url?: string;
  inspectorUrl?: string;
  ready: boolean;
  error?: string;
  createdAt: number;
  /** Progress 0–100 */
  progress?: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const VERCEL_API = "https://api.vercel.com";
const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes
const POLL_INTERVAL_MS = 3_000; // 3 seconds

function vercelHeaders(): Record<string, string> {
  const token = secrets.vercel?.token || "";
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ── Vercel API Helpers ─────────────────────────────────────────────────────

async function vercelApi(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  const token = secrets.vercel?.token;
  if (!token) {
    return { ok: false, status: 401, error: "VERCEL_TOKEN not configured" };
  }

  try {
    const res = await fetch(`${VERCEL_API}${path}`, {
      method,
      headers: vercelHeaders(),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      const errMsg = typeof data === "object" && data !== null
        ? String(((data as Record<string, unknown>).error as Record<string, unknown>)?.message || text)
        : String(text);
      return { ok: false, status: res.status, error: errMsg };
    }

    return { ok: true, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Vercel API unreachable",
    };
  }
}

// ── Deploy Operations ──────────────────────────────────────────────────────

/**
 * Get the latest deployments for a project.
 */
async function getLatestDeployment(
  projectId: string,
  branch?: string,
  teamId?: string
): Promise<DeployStatus | null> {
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  params.set("limit", "1");
  if (branch) params.set("meta", `githubCommitRef=${branch}`);
  if (teamId) params.set("teamId", teamId);

  const res = await vercelApi(`/v6/deployments?${params.toString()}`);
  if (!res.ok || !res.data) return null;

  const data = res.data as Record<string, unknown>;
  const deployments = (data.deployments as Array<Record<string, unknown>>) || [];

  if (deployments.length === 0) return null;

  const d = deployments[0];
  return {
    deploymentId: d.uid as string,
    state: (d.state as DeployStatus["state"]) || "BUILDING",
    url: `https://${d.url}` as string,
    inspectorUrl: d.inspectorUrl as string,
    ready: d.state === "READY",
    createdAt: d.createdAt as number,
  };
}

/**
 * Trigger a new Vercel deployment.
 */
async function triggerDeploy(
  projectId: string,
  options: {
    target?: "production" | "preview";
    branch?: string;
    sha?: string;
    teamId?: string;
  } = {}
): Promise<{ deploymentId?: string; error?: string }> {
  const params = new URLSearchParams();
  params.set("forceNew", "1");
  if (options.teamId) params.set("teamId", options.teamId);

  const body: Record<string, unknown> = {
    name: projectId,
    target: options.target || "production",
  };

  if (options.branch || options.sha) {
    body.gitSource = {
      type: "github",
      repoId: projectId,
      ...(options.branch ? { ref: options.branch } : {}),
      ...(options.sha ? { sha: options.sha } : {}),
    };
  }

  const res = await vercelApi(
    `/v13/deployments?${params.toString()}`,
    "POST",
    body
  );

  if (res.ok && res.data) {
    const data = res.data as Record<string, unknown>;
    if (data.error) {
      return { error: String((data.error as Record<string, unknown>)?.message || data.error) };
    }
    return {
      deploymentId: (data.id || data.uid) as string,
    };
  }

  return { error: res.error };
}

/**
 * Poll a deployment until it reaches a terminal state.
 */
async function pollDeployment(
  deploymentId: string,
  teamId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<DeployStatus> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const params = new URLSearchParams();
    if (teamId) params.set("teamId", teamId);

    const res = await vercelApi(
      `/v13/deployments/${deploymentId}?${params.toString()}`
    );

    if (res.ok && res.data) {
      const data = res.data as Record<string, unknown>;
      const state = (data.readyState || data.state) as DeployStatus["state"];

      const status: DeployStatus = {
        deploymentId,
        state: state || "BUILDING",
        url: data.url ? `https://${data.url}` : undefined,
        inspectorUrl: data.inspectorUrl as string,
        ready: state === "READY",
        createdAt: data.createdAt as number,
        error: (data.error as Record<string, unknown>)?.message as string,
        progress: data.ready
          ? 100
          : state === "BUILDING"
            ? Math.min(90, Math.round((Date.now() - startTime) / 1000))
            : 0,
      };

      // Terminal states
      if (["READY", "ERROR", "CANCELED"].includes(status.state)) {
        return status;
      }

      // Non-terminal — wait and poll again
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      continue;
    }

    // API error — wait and retry
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // Timeout
  return {
    deploymentId,
    state: "BUILDING",
    ready: false,
    createdAt: Date.now(),
    error: `Deploy timed out after ${timeoutMs}ms`,
  };
}

// ── Main Deploy Function ───────────────────────────────────────────────────

/**
 * Deploy a project to Vercel and wait for completion.
 *
 * Flow:
 *   1. Trigger a new deployment (forceNew)
 *   2. Poll every 3s until READY, ERROR, or timeout
 *   3. Return the live URL
 *
 * @param input - DeployInput with projectId and optional branch/sha
 * @returns DeployResult with live URL
 */
export async function deployToVercel(input: DeployInput): Promise<DeployResult> {
  const startTime = Date.now();

  // Validate
  if (!secrets.vercel?.token) {
    return {
      success: false,
      error: "VERCEL_TOKEN not configured — cannot deploy directly",
    };
  }

  if (!input.projectId) {
    return {
      success: false,
      error: "projectId is required for deployment",
    };
  }

  console.log(`[deploy] Triggering deploy for project: ${input.projectId}`);

  // ── Step 1: Trigger deploy ──
  const triggerResult = await triggerDeploy(input.projectId, {
    target: input.target || "production",
    branch: input.branch,
    sha: input.sha,
    teamId: input.teamId,
  });

  if (!triggerResult.deploymentId) {
    return {
      success: false,
      error: triggerResult.error || "Failed to trigger deployment",
    };
  }

  console.log(`[deploy] Deployment started: ${triggerResult.deploymentId}`);

  // ── Step 2: Poll for completion ──
  const timeout = input.timeoutMs || DEFAULT_TIMEOUT_MS;
  const status = await pollDeployment(triggerResult.deploymentId, input.teamId, timeout);

  const buildTimeMs = Date.now() - startTime;

  if (status.ready) {
    console.log(`[deploy] ✅ Deploy complete: ${status.url} (${buildTimeMs}ms)`);
    return {
      success: true,
      deploymentId: status.deploymentId,
      url: status.url,
      inspectorUrl: status.inspectorUrl,
      state: "READY",
      buildTimeMs,
    };
  }

  if (status.error) {
    console.error(`[deploy] ❌ Deploy failed: ${status.error}`);
    return {
      success: false,
      deploymentId: status.deploymentId,
      url: status.url,
      inspectorUrl: status.inspectorUrl,
      state: "ERROR",
      error: status.error,
      buildTimeMs,
    };
  }

  return {
    success: false,
    deploymentId: status.deploymentId,
    state: status.state,
    error: `Deploy did not complete within timeout`,
    buildTimeMs,
  };
}

/**
 * Check deployment status without triggering a new deploy.
 */
export async function checkDeployStatus(
  projectId: string,
  teamId?: string
): Promise<DeployStatus | null> {
  return getLatestDeployment(projectId, undefined, teamId);
}

// ── Neptune Chat-specific helpers ──────────────────────────────────────────

/** Neptune Chat Vercel project ID */
export const NEPTUNE_CHAT_PROJECT_ID = "prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl";

/**
 * Deploy the Neptune Chat project.
 * Convenience wrapper that pre-fills the projectId.
 */
export async function deployNeptuneChat(
  options?: {
    branch?: string;
    sha?: string;
    target?: "production" | "preview";
    teamId?: string;
    timeoutMs?: number;
  }
): Promise<DeployResult> {
  return deployToVercel({
    projectId: NEPTUNE_CHAT_PROJECT_ID,
    ...options,
  });
}
