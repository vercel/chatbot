/**
 * app/api/diagnostics/route.ts
 * Phase 9 — System diagnostics endpoint.
 * GET: returns VPS health, active sessions, build status, connector health.
 */
import { NextResponse } from "next/server";
import { getTelemetrySummary } from "@/connectors/neptune/functions/usage-telemetry";
import { SKILL_REGISTRY } from "@/connectors/neptune/client";
import { checkConnectorEnv } from "@/lib/connectors/registry";
import { initConnectors, manifests } from "@/lib/connectors/init";
import { secrets } from "@/secrets";

interface DiagnosticSection {
  status: "healthy" | "degraded" | "down" | "unknown";
  name: string;
  details: Record<string, unknown>;
  checkedAt: string;
}

/**
 * Check VPS health using the VPS bridge (not localhost).
 *
 * M-N-SELF-CODING FIX (2026-06-21):
 * Previous code tried http://localhost:8102/health which ALWAYS fails on Vercel
 * because localhost resolves to the serverless container, not the VPS.
 *
 * New approach (3 fallbacks):
 *   1. VPS Bridge health check (POST /health on port 8400 of public IP)
 *   2. Base44 proxy health check (if VPS_BRIDGE_URL not available)
 *   3. Direct agent API if HERMES_VPS_HEALTH_URL env var is set
 *
 * Root cause documented in diagnostics output for transparency.
 */
async function checkVpsHealth(): Promise<DiagnosticSection> {
  const details: Record<string, unknown> = {
    executionEnvironment: process.env.VERCEL ? "vercel" : "local",
    checkMethod: "vps-bridge",
  };
  let status: DiagnosticSection["status"] = "unknown";

  const vpsBridgeUrl = secrets.vps?.bridgeUrl || process.env.VPS_BRIDGE_URL;
  const vpsHealthUrl = process.env.HERMES_VPS_HEALTH_URL;
  const base44FunctionsUrl = secrets.base44?.functionsUrl || process.env.BASE44_FUNCTIONS_URL;

  // ── Fallback 1: VPS Bridge health check ──
  if (vpsBridgeUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${vpsBridgeUrl}/health`, {
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(secrets.vps?.internalToken
            ? { Authorization: `Bearer ${secrets.vps.internalToken}` }
            : {}),
        },
      }).catch(() => null);
      clearTimeout(timeout);

      if (res && res.ok) {
        const body = await res.json().catch(() => ({}));
        details.apiResponse = body;
        details.bridgeUrl = vpsBridgeUrl;
        details.checkMethod = "vps-bridge-direct";
        status = "healthy";
      } else if (res) {
        details.error = `VPS bridge returned ${res.status}`;
        details.bridgeUrl = vpsBridgeUrl;
        status = "degraded";
      }
    } catch (err) {
      details.bridgeError = err instanceof Error ? err.message : "Unknown";
    }
  }

  // ── Fallback 2: Direct agent API health check (if URL configured) ──
  if (status !== "healthy" && vpsHealthUrl) {
    details.checkMethod = "direct-health-url";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(vpsHealthUrl, {
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeout);

      if (res && res.ok) {
        const body = await res.json().catch(() => ({}));
        details.apiResponse = body;
        details.healthUrl = vpsHealthUrl;
        status = "healthy";
      } else if (res) {
        details.error = `Agent API returned ${res.status}`;
        status = "degraded";
      }
    } catch (err) {
      details.directError = err instanceof Error ? err.message : "Unknown";
    }
  }

  // ── Fallback 3: Base44 proxy (health check through Base44 functions) ──
  if (status !== "healthy" && base44FunctionsUrl) {
    details.checkMethod = "base44-proxy";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      // Ping through Base44 function relay
      const base44Token = secrets.base44?.apiKey || process.env.BASE44_API_KEY || "";
      const diagKey = process.env.DIAGNOSTICS_API_KEY || secrets.vps?.internalToken || "";

      const res = await fetch(`${base44FunctionsUrl}/ping`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(base44Token ? { "x-api-key": base44Token } : {}),
          ...(diagKey ? { "x-diag-key": diagKey } : {}),
        },
        body: JSON.stringify({ target: "vps-health" }),
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeout);

      if (res && res.ok) {
        const body = await res.json().catch(() => ({}));
        details.proxyResponse = body;
        details.proxyUrl = base44FunctionsUrl;
        status = "healthy";
      } else if (res) {
        details.error = `Base44 proxy returned ${res.status}`;
        status = "degraded";
      }
    } catch (err) {
      details.proxyError = err instanceof Error ? err.message : "Unknown";
    }
  }

  // ── Final fallback: document the issue ──
  if (status === "unknown" || status === "degraded") {
    if (!vpsBridgeUrl && !vpsHealthUrl && !base44FunctionsUrl) {
      details.error = "VPS health unreachable — no bridge URL, health URL, or Base44 proxy configured. localhost:8102 cannot be reached from Vercel serverless functions. Set VPS_BRIDGE_URL or HERMES_VPS_HEALTH_URL env var on Vercel.";
      details.rootCause = "Vercel serverless functions cannot access localhost:8102. The VPS agent API at port 8102 is not publicly exposed. Health check requires a bridge (VPS_BRIDGE_URL on port 8400) or Base44 proxy relay.";
    }
    status = details.bridgeError && details.proxyError ? "down" : "degraded";
  }

  return { status, name: "vps-health", details, checkedAt: new Date().toISOString() };
}

function checkConnectorHealth(): DiagnosticSection {
  const details: Record<string, unknown> = {};

  // Derive connector list from SKILL_REGISTRY (no hardcoded list)
  const connectors = Object.keys(SKILL_REGISTRY);

  // Build env key map from manifest imports
  let manifestsMap: Map<string, string[]> = new Map();
  try {
    initConnectors();
    for (const m of manifests) {
      if (m.id) manifestsMap.set(m.id, m.envKeys || []);
    }
  } catch {
    // non-fatal, env key check will be skipped
  }

  for (const c of connectors) {
    const hasNeptuneSkills = c in (SKILL_REGISTRY || {});
    const envKeys = manifestsMap.get(c) || [];
    const hasEnvKeys = envKeys.length > 0 && checkConnectorEnv(envKeys).ok;
    details[c] = hasNeptuneSkills
      ? "configured"
      : hasEnvKeys
        ? "env-ready"
        : "not-configured";
  }

  return {
    status: "healthy",
    name: "connector-health",
    details,
    checkedAt: new Date().toISOString(),
  };
}

function checkTelemetryHealth(): DiagnosticSection {
  const summary = getTelemetrySummary();
  return {
    status: "healthy",
    name: "telemetry-health",
    details: {
      totalInvocations: summary.totalInvocations,
      uniqueSkills: summary.uniqueSkills,
      errorRate: summary.errorRate,
      topSkill: summary.topSkill,
    },
    checkedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const [vps, connectors, telemetry] = await Promise.all([
    checkVpsHealth(),
    Promise.resolve(checkConnectorHealth()),
    Promise.resolve(checkTelemetryHealth()),
  ]);

  const sections = [vps, connectors, telemetry];
  const overallStatus: DiagnosticSection["status"] = sections.some((s) => s.status === "down")
    ? "down"
    : sections.some((s) => s.status === "degraded")
      ? "degraded"
      : "healthy";

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    sections,
    summary: {
      healthy: sections.filter((s) => s.status === "healthy").length,
      degraded: sections.filter((s) => s.status === "degraded").length,
      down: sections.filter((s) => s.status === "down").length,
    },
  });
}
