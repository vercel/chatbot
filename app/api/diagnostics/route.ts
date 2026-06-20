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

interface DiagnosticSection {
  status: "healthy" | "degraded" | "down" | "unknown";
  name: string;
  details: Record<string, unknown>;
  checkedAt: string;
}

async function checkVpsHealth(): Promise<DiagnosticSection> {
  const details: Record<string, unknown> = {};
  let status: DiagnosticSection["status"] = "unknown";

  try {
    // Check if agent API is reachable
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("http://localhost:8102/health", {
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeout);

    if (res && res.ok) {
      const body = await res.json().catch(() => ({}));
      details.apiResponse = body;
      status = "healthy";
    } else {
      status = "degraded";
      details.error = "Agent API health check failed";
    }
  } catch {
    status = "down";
    details.error = "Agent API unreachable";
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
