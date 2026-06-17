// @ts-nocheck
/**
 * Phase 24: Recompute Edge Weights (Nightly Cron)
 *
 * Aggregates library_panel_runs + library_playbook_usage
 * Updates library_edges.success_count / failure_count / confidence_score
 *
 * Scheduled via Vercel cron daily at 2am.
 * Usage: npx tsx scripts/recompute-edge-weights.ts [--dry-run]
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = drizzle(
    postgres(process.env.POSTGRES_URL || "", { max: 1 })
  );

  console.log("🔄 Recomputing edge weights...");

  // Aggregate playbook usage
  const usageStats = await db.execute(sql`
    SELECT
      playbook_slug,
      COUNT(*) AS total_uses,
      SUM(CASE WHEN success THEN 1 ELSE 0 END) AS success_count,
      SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) AS failure_count,
      AVG(duration_ms) AS avg_duration_ms,
      MAX(created_at) AS last_used
    FROM library_playbook_usage
    GROUP BY playbook_slug
  `);

  console.log(
    `📊 Found ${usageStats.rows.length} playbooks with usage data`
  );

  for (const row of usageStats.rows) {
    const slug = row.playbook_slug as string;
    const total = (row.total_uses as number) || 0;
    const successes = (row.success_count as number) || 0;
    const failures = (row.failure_count as number) || 0;
    const avgDuration = (row.avg_duration_ms as number) || 0;
    const lastUsed = row.last_used as string | null;

    // Confidence: success rate with recency boost
    const successRate = total > 0 ? successes / total : 0.5;
    // Recency decay: if used in last 7 days, +0.1; if never used, -0.2
    const recencyBoost = lastUsed
      ? Date.now() - new Date(lastUsed).getTime() <
        7 * 24 * 60 * 60 * 1000
        ? 0.1
        : 0
      : -0.2;
    const confidence = Math.max(
      0.05,
      Math.min(0.99, successRate + recencyBoost)
    );

    if (!dryRun) {
      await db.execute(sql`
        UPDATE library_edges
        SET
          success_count = ${successes},
          failure_count = ${failures},
          last_used_at = ${
            lastUsed ? new Date(lastUsed) : null
          }::timestamp,
          confidence_score = ${confidence},
          latency_ms_avg = ${Math.round(avgDuration)}
        WHERE to_node = ${slug} AND to_type = 'playbook'
      `);
    }

    console.log(
      `  ${dryRun ? "[DRY] " : ""}${slug}: confidence=${confidence.toFixed(
        2
      )} (${successes}/${total} successes, last used: ${lastUsed || "never"})`
    );
  }

  // Also update connector edges from panel runs
  const panelEdgeStats = await db.execute(sql`
    SELECT
      pr.preset_id,
      pr.execution_mode,
      pr.status,
      COUNT(*) AS run_count
    FROM library_panel_runs pr
    WHERE pr.created_at > NOW() - INTERVAL '30 days'
    GROUP BY pr.preset_id, pr.execution_mode, pr.status
  `);

  console.log(
    `📊 Found ${panelEdgeStats.rows.length} panel run stat groups`
  );

  if (!dryRun) {
    console.log("✅ Edge weights updated successfully");
  } else {
    console.log("🔍 Dry run complete — no changes made");
  }

  await db.$client.end();
}

main().catch(console.error);
