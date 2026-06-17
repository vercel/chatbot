/**
 * Phase 28: /api/handoff-health — Chat-side Handoff Monitoring
 *
 * Returns: last success, last failure, retry stats, V2 connectivity.
 * GET:  Summary (public-readable)
 * POST: Reset failure counters (requires NEPTUNE_INTERNAL_TOKEN)
 */

import { NextRequest, NextResponse } from "next/server";

const NEPTUNE_INTERNAL_TOKEN = process.env.NEPTUNE_INTERNAL_TOKEN || "";
const V2_BASE_URL = process.env.NEPTUNE_V2_API_BASE || "https://neptune-v2.vercel.app";
const V2_WEBHOOK_SECRET = process.env.V2_WEBHOOK_SECRET || "";

// ─── In-memory health state ────────────────────────────────────────────────

interface HandoffEvent {
  type: "success" | "failure";
  timestamp: string;
  sessionId?: string;
  error?: string;
  durationMs?: number;
}

const healthState = {
  lastSuccess: null as HandoffEvent | null,
  lastFailure: null as HandoffEvent | null,
  recentEvents: [] as HandoffEvent[],
  consecutiveFailures: 0,
  totalSuccesses: 0,
  totalFailures: 0,
  lastV2Check: null as { ok: boolean; latencyMs: number; timestamp: string } | null,
};

const MAX_RECENT_EVENTS = 50;
const ALERT_THRESHOLD = 3; // Slack alert after 3 consecutive failures

export function recordHandoffSuccess(sessionId: string, durationMs?: number): void {
  const event: HandoffEvent = {
    type: "success",
    timestamp: new Date().toISOString(),
    sessionId,
    durationMs,
  };
  healthState.lastSuccess = event;
  healthState.recentEvents.unshift(event);
  healthState.totalSuccesses++;
  healthState.consecutiveFailures = 0;
  if (healthState.recentEvents.length > MAX_RECENT_EVENTS) healthState.recentEvents.pop();
}

export function recordHandoffFailure(error: string, sessionId?: string): void {
  const event: HandoffEvent = {
    type: "failure",
    timestamp: new Date().toISOString(),
    sessionId,
    error,
  };
  healthState.lastFailure = event;
  healthState.recentEvents.unshift(event);
  healthState.totalFailures++;
  healthState.consecutiveFailures++;

  // Slack alert if threshold hit
  if (healthState.consecutiveFailures >= ALERT_THRESHOLD) {
    console.error(
      `[handoff-health] 🚨 ALERT: ${healthState.consecutiveFailures} consecutive handoff failures! Latest: ${error}`
    );
    // Slack alert would go here via Slack MCP bridge
  }

  if (healthState.recentEvents.length > MAX_RECENT_EVENTS) healthState.recentEvents.pop();
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function GET() {
  // V2 connectivity check (lazy, avoid on every request)
  const now = Date.now();
  const shouldCheckV2 = !healthState.lastV2Check || (now - new Date(healthState.lastV2Check.timestamp).getTime()) > 30_000;

  if (shouldCheckV2) {
    const v2Start = Date.now();
    try {
      const res = await fetch(`${V2_BASE_URL}/api/health`, {
        signal: AbortSignal.timeout(5000),
      });
      healthState.lastV2Check = {
        ok: res.ok,
        latencyMs: Date.now() - v2Start,
        timestamp: new Date().toISOString(),
      };
    } catch {
      healthState.lastV2Check = {
        ok: false,
        latencyMs: Date.now() - v2Start,
        timestamp: new Date().toISOString(),
      };
    }
  }

  const retryStats = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxTotalMs: 40_000,
    webhookMaxRetries: 5,
    webhookMaxTotalMs: 30_000,
  };

  return NextResponse.json({
    status: healthState.consecutiveFailures >= ALERT_THRESHOLD ? "degraded" : "ok",
    v2Connectivity: healthState.lastV2Check,
    lastSuccess: healthState.lastSuccess,
    lastFailure: healthState.lastFailure,
    consecutiveFailures: healthState.consecutiveFailures,
    totals: {
      successes: healthState.totalSuccesses,
      failures: healthState.totalFailures,
    },
    retryStats,
    config: {
      v2BaseUrl: V2_BASE_URL,
      webhookSecretConfigured: !!V2_WEBHOOK_SECRET,
      slackAlertThreshold: ALERT_THRESHOLD,
    },
    recentEvents: healthState.recentEvents.slice(0, 10),
  });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.slice(7) !== NEPTUNE_INTERNAL_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reset counters
  healthState.consecutiveFailures = 0;
  healthState.lastFailure = null;

  return NextResponse.json({
    reset: true,
    message: "Failure counters reset",
  });
}
