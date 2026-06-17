/**
 * schedules/knowledge-graph-reindex.ts — KG Reindex Schedule (Eve Pattern 3)
 *
 * Rebuilds the knowledge graph from cortex files weekly.
 * Posts stats to Slack #jarvis-admin.
 *
 * Pattern 3: Schedules/ directory
 * Phase 38: Autonomous Coding Platform
 *
 * Eve pattern:
 *   export default defineSchedule({
 *     cron: "0 4 * * 0", // Sundays at 04:00 UTC
 *     async run({ receive, waitUntil }) { ... }
 *   });
 */

import { buildKnowledgeGraph } from "@/lib/knowledge/parser";

export const kgReindexSchedule = {
  name: "knowledge-graph-reindex",
  description: "Rebuild knowledge graph from cortex files every Sunday at 04:00 UTC",
  cron: "0 4 * * 0", // Every Sunday at 04:00 UTC

  async run(): Promise<{
    nodes: number;
    edges: number;
    byType: Record<string, number>;
    byDomain: Record<string, number>;
    durationMs: number;
    slackPosted: boolean;
  }> {
    const start = Date.now();

    // Build full KG
    const graph = buildKnowledgeGraph();
    const durationMs = Date.now() - start;

    console.log(
      `[kg-reindex] Built graph: ${graph.stats.totalNodes} nodes, ${graph.stats.totalEdges} edges in ${Math.round(durationMs / 1000)}s`,
    );

    // Post summary to Slack
    let slackPosted = false;
    try {
      const slackUrl = process.env.SLACK_WEBHOOK_URL;
      if (slackUrl) {
        const topTypes = Object.entries(graph.stats.byType)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([t, c]) => `  ${t}: ${c}`)
          .join("\n");

        const topDomains = Object.entries(graph.stats.byDomain)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([d, c]) => `  ${d}: ${c}`)
          .join("\n");

        await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: [
              "📚 *Knowledge Graph Reindexed*",
              `📊 ${graph.stats.totalNodes} nodes · ${graph.stats.totalEdges} edges`,
              `⚡ ${Math.round(durationMs / 1000)}s`,
              "",
              "*Top Types:*",
              topTypes || "  (none)",
              "",
              "*Top Domains:*",
              topDomains || "  (none)",
              `🕐 ${new Date().toISOString()}`,
            ].join("\n"),
          }),
        });
        slackPosted = true;
      }
    } catch (err) {
      console.error("[kg-reindex] Slack post failed:", err);
    }

    return {
      nodes: graph.stats.totalNodes,
      edges: graph.stats.totalEdges,
      byType: graph.stats.byType,
      byDomain: graph.stats.byDomain,
      durationMs,
      slackPosted,
    };
  },
};

export default kgReindexSchedule;
