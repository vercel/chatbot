/**
 * lib/agents/tools/runDiscoveryWorkflow.ts — Phase 38.5 Wiring Fix
 *
 * Tool wrapper for the Phase 38 Discovery Engine.
 * Allows chat agents to trigger discovery workflows directly.
 * Calls POST /api/discovery/run and returns runId + SSE URL for live progress.
 *
 * Uses AI SDK v6 ai.tool() with inputSchema.
 * Each workflow scrapes REAL Slack, NMI, and Base44 data — no simulation.
 */

import { tool } from "ai";
import { z } from "zod";

// ── Valid Workflows ──────────────────────────────────────────────────

const VALID_WORKFLOWS = [
  "audit-slack-tickets-last-7d",
  "find-misaligned-billing",
  "recovery-stale-tasks-audit",
  "customer-360-deep-pull",
  "agent-promise-tracker",
  "churn-risk-analysis",
] as const;

export type DiscoveryWorkflowId = (typeof VALID_WORKFLOWS)[number];

const WORKFLOW_DESCRIPTIONS: Record<DiscoveryWorkflowId, string> = {
  "audit-slack-tickets-last-7d":
    "Scrape Slack channels, pull Base44 CRM data, and cross-reference for billing alignment. " +
    "Finds tickets mentioned in Slack that don't exist in CRM, stale conversations, and " +
    "enrollment-to-billing mismatches. Real Slack + Base44 data — no simulation.",
  "find-misaligned-billing":
    "Compare Base44 enrollment status vs NMI subscription state for all customers. " +
    "Finds subscribers in Base44 with no active NMI subscription, " +
    "and NMI subscribers with no Base44 enrollment. Real NMI + Base44 data.",
  "recovery-stale-tasks-audit":
    "Find declined payments with stale recovery tasks. Cross-references " +
    "NMI transaction status with Base44 payment logs and recovery queue. " +
    "Identifies customers stuck in recovery for >48h with no agent action.",
  "customer-360-deep-pull":
    "Full customer deep dive across all systems — Base44 profile, NMI subscriptions, " +
    "Slack mentions, support tickets, call logs, and payment history. " +
    "Pulls from every available connector for a comprehensive dossier.",
  "agent-promise-tracker":
    "Track agent promises made in Slack against follow-through in Base44. " +
    "Finds messages where agents promised to follow up, call, or take action, " +
    "then checks if those actions were completed in the CRM.",
  "churn-risk-analysis":
    "Identify at-risk customers from payment declines, support sentiment, " +
    "and engagement signals. Analyzes NMI decline patterns, Slack sentiment, " +
    "and support ticket frequency to score churn risk.",
};

// ── Tool Definition ──────────────────────────────────────────────────

export const runDiscoveryWorkflow = tool({
  description:
    "Start a Phase 38 Discovery Engine workflow for bulk data operations. " +
    "AVAILABLE WORKFLOWS:\n" +
    "- audit-slack-tickets-last-7d: Cross-reference Slack vs CRM for billing alignment\n" +
    "- find-misaligned-billing: Compare Base44 enrollment vs NMI subscriptions\n" +
    "- recovery-stale-tasks-audit: Find declined payments with stale recovery\n" +
    "- customer-360-deep-pull: Full customer deep dive across all systems\n" +
    "- agent-promise-tracker: Track agent promises in Slack vs follow-through\n" +
    "- churn-risk-analysis: Identify at-risk customers from declines/sentiment\n\n" +
    "Each workflow uses REAL Slack, NMI, and Base44 data — NO simulation. " +
    "Returns a runId and SSE URL for tracking live progress. " +
    "Use this for ANY bulk operation involving Slack, billing, or CRM data.",
  inputSchema: z.object({
    workflowId: z
      .enum(VALID_WORKFLOWS)
      .describe("The discovery workflow to run"),
    config: z
      .record(z.unknown())
      .optional()
      .describe(
        "Optional configuration overrides:\n" +
          "- channels: string[] — Slack channels to scrape (default: ['newleaf-admin'])\n" +
          "- daysBack: number — How many days back to look (default: 7)\n" +
          "- maxCustomers: number — Max customers to process (default: 200)\n" +
          "- customerId: string — Specific customer ID for customer-360 workflow\n" +
          "- staleHours: number — Hours threshold for stale tasks in recovery audit (default: 48)"
      ),
  }),

  execute: async ({ workflowId, config }) => {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(`${baseUrl}/api/discovery/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId,
          config: config || {},
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          success: false,
          error: `Discovery API returned ${res.status}: ${body.slice(0, 300)}`,
          workflowId,
        };
      }

      const data = await res.json();

      return {
        success: true,
        runId: data.runId,
        workflowId,
        workflowName: data.workflowName,
        workflowDescription: WORKFLOW_DESCRIPTIONS[workflowId],
        estimatedDuration: data.estimatedDuration,
        status: data.status || "running",
        sseUrl: `/api/discovery/sse?runId=${encodeURIComponent(data.runId)}`,
        reportUrl: `/discovery/${data.runId}`,
        message:
          `Discovery run "${data.workflowName}" started.\n` +
          `Track progress: ${baseUrl}/api/discovery/sse?runId=${encodeURIComponent(data.runId)}\n` +
          `View report: ${baseUrl}/discovery/${data.runId}`,
      };
    } catch (err) {
      clearTimeout(timeout);
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Discovery engine unreachable",
        workflowId,
        hint: "Ensure /api/discovery/run is deployed and reachable.",
      };
    }
  },
});

export default runDiscoveryWorkflow;
