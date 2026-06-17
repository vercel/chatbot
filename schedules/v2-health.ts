/**
 * schedules/v2-health.ts — V2 Health Check Schedule (Eve Pattern 3)
 *
 * Runs every 12 hours: pings Neptune V2, checks sandbox health,
 * posts status to Slack #jarvis-admin if unhealthy.
 *
 * Pattern 3: Schedules/ directory
 * Phase 38: Autonomous Coding Platform
 *
 * Eve pattern:
 *   export default defineSchedule({
 *     cron: "0 */12 * * *",
 *     async run({ receive, waitUntil }) { ... }
 *   });
 */

import { pingV2 } from "@/lib/v2/bridge";
import { createDefaultSandbox } from "@/lib/sandbox/adapter";

// ─── Schedule Definition ──────────────────────────────────────────────────────

export const v2HealthSchedule = {
  name: "v2-health",
  description: "Ping Neptune V2 + sandbox health every 12 hours",
  cron: "0 */12 * * *", // Every 12 hours

  async run(): Promise<{
    v2Healthy: boolean;
    sandboxHealthy: boolean;
    slackPosted: boolean;
  }> {
    let v2Healthy = false;
    let sandboxHealthy = false;
    let slackPosted = false;

    // 1. Check V2 health
    try {
      v2Healthy = await pingV2();
      console.log(`[v2-health] V2 ping: ${v2Healthy ? "healthy" : "unhealthy"}`);
    } catch (err) {
      console.error("[v2-health] V2 ping error:", err);
    }

    // 2. Check sandbox health
    try {
      const sandbox = createDefaultSandbox({ timeoutMs: 30_000 });
      sandboxHealthy = await sandbox.health();
      console.log(`[v2-health] Sandbox: ${sandboxHealthy ? "healthy" : "unhealthy"}`);
    } catch (err) {
      console.error("[v2-health] Sandbox health error:", err);
    }

    // 3. Post to Slack if unhealthy
    if (!v2Healthy || !sandboxHealthy) {
      try {
        const slackUrl = process.env.SLACK_WEBHOOK_URL;
        if (slackUrl) {
          const issues: string[] = [];
          if (!v2Healthy) issues.push("🔴 Neptune V2 unreachable");
          if (!sandboxHealthy) issues.push("🔴 Sandbox backend unhealthy");

          await fetch(slackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: [
                "⚠️ *V2 Health Alert*",
                issues.join("\n"),
                `🕐 ${new Date().toISOString()}`,
                "Check /api/health for details",
              ].join("\n"),
            }),
          });
          slackPosted = true;
        }
      } catch (err) {
        console.error("[v2-health] Slack post failed:", err);
      }
    }

    return { v2Healthy, sandboxHealthy, slackPosted };
  },
};

export default v2HealthSchedule;
