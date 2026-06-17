/**
 * schedules/drift-detection.ts — Nightly Drift Detection (Eve Pattern 3)
 *
 * Checks for drift between deployed codebase and expected state.
 * Runs nightly at 03:00 UTC.
 * Posts findings to Slack #jarvis-admin.
 *
 * Pattern 3: Schedules/ directory
 * Phase 38: Autonomous Coding Platform
 *
 * Eve pattern:
 *   export default defineSchedule({
 *     cron: "0 3 * * *",
 *     async run({ receive, waitUntil, appAuth }) { ... }
 *   });
 */

import {
  pingV2,
  listV2Sessions,
} from "@/lib/v2/bridge";

// ─── Schedule Definition ──────────────────────────────────────────────────────

export const driftDetectionSchedule = {
  name: "drift-detection",
  description: "Nightly drift detection — codebase health, V2 sessions, orphan detection",
  cron: "0 3 * * *", // Every day at 03:00 UTC

  async run(): Promise<{
    v2Status: string;
    orphanedSessions: number;
    findings: string[];
  }> {
    const findings: string[] = [];
    let orphanedSessions = 0;

    // 1. Check V2 health
    const v2Healthy = await pingV2();
    const v2Status = v2Healthy ? "healthy" : "unhealthy";
    if (!v2Healthy) {
      findings.push("V2 is unreachable — investigation required");
    }

    // 2. Check for orphaned V2 sessions (running > 8 hours)
    try {
      const { sessions } = await listV2Sessions("running", 25);
      const eightHoursAgo = Date.now() - 8 * 60 * 60 * 1000;

      orphanedSessions = sessions.filter((s) => {
        const createdAt = s.createdAt || s.created_at;
        if (!createdAt) return false;
        return new Date(createdAt).getTime() < eightHoursAgo;
      }).length;

      if (orphanedSessions > 0) {
        findings.push(`${orphanedSessions} V2 sessions running > 8 hours — may be orphaned`);
      }
    } catch (err) {
      findings.push(`Failed to check V2 sessions: ${(err as Error).message}`);
    }

    // 3. Check active mission count
    try {
      const res = await fetch("http://localhost:3001/api/missions?status=running", {
        headers: { Authorization: `Bearer ${process.env.BASE44_DIAG_KEY || ""}` },
      });
      if (res.ok) {
        const missions = await res.json();
        const runningCount = Array.isArray(missions) ? missions.length : 0;
        if (runningCount > 5) {
          findings.push(`${runningCount} missions running — may indicate backlog`);
        }
      }
    } catch {
      // Best-effort
    }

    // 4. Post findings to Slack
    try {
      const slackUrl = process.env.SLACK_WEBHOOK_URL;
      if (slackUrl && findings.length > 0) {
        await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: [
              "🔍 *Nightly Drift Detection*",
              `📊 V2: ${v2Status} | Orphaned sessions: ${orphanedSessions}`,
              findings.length > 0 ? `\n⚠️ ${findings.length} findings:\n${findings.map(f => `• ${f}`).join("\n")}` : "✅ No issues detected",
              `🕐 ${new Date().toISOString()}`,
            ].join("\n"),
          }),
        });
      }
    } catch {
      // Slack is best-effort
    }

    return { v2Status, orphanedSessions, findings };
  },
};

export default driftDetectionSchedule;
