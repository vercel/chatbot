/**
 * lib/ai/tools/run-discovery-workflow.ts — Phase 38.5 Stream 2
 *
 * Tool wrapper for the Phase 38 Discovery Engine.
 * Allows chat agents to trigger discovery workflows directly.
 *
 * Calls POST /api/discovery/run and returns runId + SSE URL.
 * The frontend subscribes to SSE for live progress.
 */

import { tool } from "ai";
import { z } from "zod";

const VALID_WORKFLOWS = [
  "audit-slack-tickets-last-7d",
  "find-misaligned-billing",
  "recovery-stale-tasks-audit",
  "customer-360-deep-pull",
  "agent-promise-tracker",
  "churn-risk-analysis",
] as const;

export const runDiscoveryWorkflow = tool({
  description:
    "Start a Phase 38 Discovery Engine workflow. " +
    "Use this for bulk operations like auditing Slack, cross-referencing CRM data, " +
    "checking billing alignment, or analyzing churn risk. " +
    "Each workflow scrapes REAL Slack/NMI/Base44 data — no simulation. " +
    "Returns a runId and SSE URL for tracking live progress. " +
    "Available workflows:\n" +
    "- audit-slack-tickets-last-7d: Scrape Slack, pull Base44, cross-reference\n" +
    "- find-misaligned-billing: Compare Base44 enrollment vs NMI subscriptions\n" +
    "- recovery-stale-tasks-audit: Find declined payments with stale recovery\n" +
    "- customer-360-deep-pull: Full customer deep dive across all systems\n" +
    "- agent-promise-tracker: Track agent promises in Slack vs follow-through\n" +
    "- churn-risk-analysis: Identify at-risk customers from declines/sentiment",
  inputSchema: z.object({
    workflowId: z.enum(VALID_WORKFLOWS).describe(
      "The discovery workflow to run"
    ),
    config: z.record(z.unknown()).optional().describe(
      "Optional configuration overrides. Common keys:\n" +
      "- channels: string[] — Slack channels to scrape (default: newleaf-admin)\n" +
      "- daysBack: number — How many days back to look (default: 7)\n" +
      "- maxCustomers: number — Max customers to process (default: 200)\n" +
      "- customerId: string — For customer-360, the specific customer ID\n" +
      "- staleHours: number — Hours threshold for stale tasks (default: 48)"
    ),
  }),
  execute: async ({ workflowId, config }) => {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    try {
      const res = await fetch(`${baseUrl}/api/discovery/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, config: config || {} }),
      });

      if (!res.ok) {
        return {
          success: false,
          error: `Discovery API returned ${res.status}`,
          workflowId,
        };
      }

      const data = await res.json();

      return {
        success: true,
        runId: data.runId,
        workflowId,
        workflowName: data.workflowName,
        estimatedDuration: data.estimatedDuration,
        sseUrl: `/api/discovery/sse?runId=${encodeURIComponent(data.runId)}`,
        reportUrl: `/discovery/${data.runId}`,
        message: `Discovery run "${data.workflowName}" started. Track progress via the SSE URL or report page.`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to start discovery: ${err instanceof Error ? err.message : "Unknown"}`,
        workflowId,
      };
    }
  },
});

export default runDiscoveryWorkflow;
