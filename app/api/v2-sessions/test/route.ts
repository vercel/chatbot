/**
 * Phase 28: /api/v2-sessions/test — V2 Handoff Diagnostic Endpoint
 *
 * POST with { goal } triggers a test handoff to V2 and returns the full diagnostic trace.
 * GET returns the diagnostic collector status.
 *
 * Auth: Bearer NEPTUNE_INTERNAL_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const NEPTUNE_INTERNAL_TOKEN = process.env.NEPTUNE_INTERNAL_TOKEN || "";
const V2_BASE_URL = process.env.NEPTUNE_V2_API_BASE || "https://neptune-v2.vercel.app";
const WEBHOOK_SECRET = process.env.V2_WEBHOOK_SECRET || "";

// ─── Test history (in-memory, last 10 runs) ─────────────────────────────────
const testHistory: DiagnosticTrace[] = [];
const MAX_HISTORY = 10;

interface DiagnosticStep {
  step: number;
  name: string;
  status: "pass" | "fail" | "skip" | "pending";
  durationMs: number;
  detail?: string;
  error?: string;
}

interface DiagnosticTrace {
  id: string;
  timestamp: string;
  goal?: string;
  steps: DiagnosticStep[];
  result: "success" | "partial" | "failure";
  totalDurationMs: number;
}

// ─── Auth ───────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  if (!NEPTUNE_INTERNAL_TOKEN) return false;
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  return auth.slice(7) === NEPTUNE_INTERNAL_TOKEN;
}

// ─── POST: Run diagnostic test ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const debug = new URL(req.url).searchParams.get("debug") === "true";

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const trace: DiagnosticTrace = {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    steps: [],
    result: "failure",
    totalDurationMs: 0,
  };

  const addStep = (name: string, status: DiagnosticStep["status"], detail?: string, error?: string) => {
    trace.steps.push({
      step: trace.steps.length + 1,
      name,
      status,
      durationMs: Date.now() - startTime - trace.steps.reduce((s, st) => s + st.durationMs, 0),
      detail,
      error,
    });
  };

  try {
    let body: { goal?: string } = {};
    try {
      body = await req.json();
    } catch { /* use defaults */ }

    const goal = body.goal || "diagnostic-test-hello-world";
    trace.goal = goal;

    // Step 1: Token present
    addStep("Token configured", NEPTUNE_INTERNAL_TOKEN ? "pass" : "fail",
      NEPTUNE_INTERNAL_TOKEN ? `Token length: ${NEPTUNE_INTERNAL_TOKEN.length}` : "No token set");

    // Step 2: V2 connectivity
    const v2Health = await fetch(`${V2_BASE_URL}/api/agent-sessions`, {
      method: "GET",
      headers: { Authorization: `Bearer ${NEPTUNE_INTERNAL_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    }).then(r => ({ ok: r.ok, status: r.status })).catch(e => ({ ok: false, status: 0, error: (e as Error).message }));
    addStep("V2 connectivity", v2Health.ok ? "pass" : "fail",
      v2Health.ok ? "V2 reachable" : `V2 status: ${v2Health.status}`,
      !v2Health.ok ? `V2 health check failed: HTTP ${v2Health.status}` : undefined);

    // Step 3: V2_WEBHOOK_SECRET configured
    addStep("Webhook secret configured", WEBHOOK_SECRET ? "pass" : "fail",
      WEBHOOK_SECRET ? `Secret length: ${WEBHOOK_SECRET.length}` : "V2_WEBHOOK_SECRET not set");

    // Step 4: Spawn test session on V2
    let sessionId = "";
    try {
      const res = await fetch(`${V2_BASE_URL}/api/agent-sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${NEPTUNE_INTERNAL_TOKEN}`,
        },
        body: JSON.stringify({
          goal,
          mode: "sandbox",
          chatId: trace.id,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        sessionId = data.id || data.sessionId;
        addStep("Spawn V2 session", "pass",
          `Session ID: ${sessionId}, Status: ${res.status}`);
      } else {
        const errBody = await res.text().slice(0, 300);
        addStep("Spawn V2 session", "fail",
          `HTTP ${res.status}`, errBody);
      }
    } catch (err) {
      addStep("Spawn V2 session", "fail",
        "Exception", (err as Error).message);
    }

    // Step 5: V2 session created
    if (sessionId) {
      addStep("V2 session exists", "pass", `Session: ${sessionId}`);
    } else {
      addStep("V2 session exists", "fail", "No session created");
    }

    // Step 6: HMAC signing test
    if (WEBHOOK_SECRET && sessionId) {
      try {
        const testPayload = { sessionId, status: "started", eventId: trace.id };
        const hmac = createHmac("sha256", WEBHOOK_SECRET);
        const signature = `sha256=${hmac.update(JSON.stringify(testPayload)).digest("hex")}`;
        addStep("HMAC signing", "pass", `Signature: sha256=...${signature.slice(-8)}`);
      } catch (err) {
        addStep("HMAC signing", "fail", "HMAC generation failed", (err as Error).message);
      }
    } else {
      addStep("HMAC signing", "skip", "No webhook secret or session");
    }

    // Determine result
    const failedSteps = trace.steps.filter(s => s.status === "fail").length;
    trace.result = failedSteps === 0 ? "success" : failedSteps < trace.steps.filter(s => s.status !== "skip").length ? "partial" : "failure";

  } catch (err) {
    addStep("Diagnostic", "fail", "Fatal error", (err as Error).message);
  }

  trace.totalDurationMs = Date.now() - startTime;

  // Store in history
  testHistory.unshift(trace);
  if (testHistory.length > MAX_HISTORY) testHistory.pop();

  // Return sanitized or full based on debug flag
  return NextResponse.json(
    debug ? trace : { ...trace, steps: trace.steps.map(s => ({ ...s, detail: s.detail?.slice(0, 200) })) },
    { status: trace.result === "success" ? 200 : trace.result === "partial" ? 207 : 500 }
  );
}

// ─── GET: Diagnostic collector status ───────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const format = new URL(req.url).searchParams.get("format") || "summary";

  if (format === "full") {
    return NextResponse.json({ history: testHistory, count: testHistory.length });
  }

  // Summary
  const lastTest = testHistory[0];
  return NextResponse.json({
    ready: true,
    webhookSecretConfigured: !!WEBHOOK_SECRET,
    v2BaseUrl: V2_BASE_URL,
    lastTest: lastTest ? {
      id: lastTest.id,
      timestamp: lastTest.timestamp,
      result: lastTest.result,
      totalDurationMs: lastTest.totalDurationMs,
      stepCount: lastTest.steps.length,
    } : null,
    historyCount: testHistory.length,
  });
}
