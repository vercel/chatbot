/**
 * /api/workflows/smoke-test — Automated smoke test workflow
 *
 * WorkflowAgent that runs all connector health checks, verifies endpoints,
 * and reports results. Designed to run on every deploy and/or daily via cron.
 *
 * GET: triggers a smoke test run
 * POST { targets?: string[] }: runs smoke test against specified targets
 */
import { WorkflowAgent } from "@ai-sdk/workflow";
import { getLanguageModel } from "@/lib/ai/providers";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { requireAllowlist } from "@/lib/auth/require-allowlist";
import { z } from "zod";
import type { ModelMessage } from "ai";

export const maxDuration = 300;

interface HealthResult {
  endpoint: string;
  status: number;
  ok: boolean;
  latencyMs: number;
  body?: string;
  error?: string;
}

async function checkEndpoint(
  baseUrl: string,
  path: string,
  timeout = 10_000
): Promise<HealthResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      signal: AbortSignal.timeout(timeout),
    });
    const body = await res.text().catch(() => "");
    return {
      endpoint: path,
      status: res.status,
      ok: res.ok,
      latencyMs: Date.now() - start,
      body: body.slice(0, 1000),
    };
  } catch (err) {
    return {
      endpoint: path,
      status: 0,
      ok: false,
      latencyMs: Date.now() - start,
      error: String(err),
    };
  }
}

export const GET = requireAllowlist(async (_req: Request) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (d: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`));

      try {
        send({
          type: "status",
          status: "starting-smoke-test",
          timestamp: Date.now(),
        });

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        // Phase 1: HTTP endpoint checks
        const endpoints = [
          { path: "/api/diagnostics", label: "diagnostics" },
          { path: "/api/health", label: "health" },
          { path: "/api/knowledge/graph", label: "knowledge-graph" },
          { path: "/.well-known/agent.json", label: "agent-card" },
        ];

        send({ type: "phase", phase: "http-checks", timestamp: Date.now() });

        const results: HealthResult[] = [];
        for (const ep of endpoints) {
          const result = await checkEndpoint(baseUrl, ep.path);
          results.push(result);
          send({
            type: "check",
            label: ep.label,
            ok: result.ok,
            status: result.status,
            latencyMs: result.latencyMs,
            timestamp: Date.now(),
          });
        }

        const httpPass = results.every((r) => r.ok);

        // Phase 2: Connector health via diagnostics
        send({ type: "phase", phase: "connector-health", timestamp: Date.now() });

        const diagResult = await checkEndpoint(baseUrl, "/api/diagnostics");
        let connectorStatus: Record<string, unknown> = {};
        try {
          if (diagResult.body) {
            const diag = JSON.parse(diagResult.body);
            const connectorSection = diag.sections?.find(
              (s: { name: string }) => s.name === "connector-health"
            );
            connectorStatus = connectorSection?.details || {};
          }
        } catch {
          connectorStatus = { error: "Failed to parse diagnostics" };
        }

        send({
          type: "connector-status",
          connectors: connectorStatus,
          timestamp: Date.now(),
        });

        // Phase 3: Summary
        const allConnectorsConfigured =
          Object.values(connectorStatus).filter((v) => v === "configured").length;
        const totalConnectors = Object.keys(connectorStatus).length;

        const summary = {
          httpEndpoints: {
            passed: results.filter((r) => r.ok).length,
            total: results.length,
            results: results.map((r) => ({
              endpoint: r.endpoint,
              ok: r.ok,
              status: r.status,
              latencyMs: r.latencyMs,
            })),
          },
          connectors: {
            configured: allConnectorsConfigured,
            total: totalConnectors,
            details: connectorStatus,
          },
          overall: httpPass && allConnectorsConfigured > 0 ? "healthy" : "degraded",
        };

        send({
          type: "done",
          summary,
          timestamp: Date.now(),
        });
        controller.close();
      } catch (err) {
        send({
          type: "error",
          error: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

export const POST = requireAllowlist(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const targets = (body as { targets?: string[] }).targets || [
    "/api/diagnostics",
    "/api/health",
    "/.well-known/agent.json",
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (d: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`));

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const results: HealthResult[] = [];

      send({ type: "status", status: "testing", timestamp: Date.now() });

      for (const path of targets) {
        const result = await checkEndpoint(baseUrl, path);
        results.push(result);
        send({
          type: "check",
          endpoint: path,
          ok: result.ok,
          status: result.status,
          latencyMs: result.latencyMs,
          timestamp: Date.now(),
        });
      }

      send({
        type: "done",
        passed: results.filter((r) => r.ok).length,
        total: results.length,
        results,
        timestamp: Date.now(),
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
