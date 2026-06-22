/**
 * Phase 5b M-NEPTUNE-PERFECT: runWorkflow Tool
 *
 * Executes a predefined workflow by name. Posts to /api/workflow/{workflow_name}/run
 * and returns { workflowRunId, sseUrl } for live progress tracking.
 *
 * Supports:
 *   - workflow_name: string identifier (e.g., "discover-customers", "audit-billing")
 *   - inputs: Record of workflow-specific parameters
 *   - Returns structured result with SSE URL for real-time monitoring
 */

import { tool } from "ai";
import { z } from "zod";

// ── Types ──────────────────────────────────────────────────────────────────

interface RunWorkflowResult {
  success: boolean;
  workflowName: string;
  workflowRunId?: string;
  sseUrl?: string;
  reportUrl?: string;
  status?: string;
  message?: string;
  error?: string;
}

// ── Tool Definition ────────────────────────────────────────────────────────

export const runWorkflowTool = tool({
  description:
    "Execute a predefined workflow by name. " +
    "Workflows chain multiple steps: research, PRD generation, gap analysis, " +
    "implementation planning, mission dispatch, and tech design. " +
    "Use for automated planning-research pipelines and domain-specific automation. " +
    "Returns a workflowRunId and SSE URL for tracking live progress. " +
    "Available workflows:\n" +
    "- discover-customers: Cross-reference Base44 customers across Slack, NMI, Vapi\n" +
    "- audit-billing: Compare Base44 enrollment vs NMI subscriptions for drift\n" +
    "- recovery-audit: Find declined payments with stale recovery tasks\n" +
    "- customer-360-deep: Full customer deep-dive across all systems\n" +
    "- churn-analysis: Identify at-risk customers from declines, sentiment, response times\n" +
    "- self-diagnostic: Run full system health check across all connectors\n" +
    "Use listPlaybooks to discover all available workflows.",
  inputSchema: z.object({
    workflow_name: z
      .string()
      .describe(
        "Name of the workflow to execute. Use kebab-case identifiers " +
        "(e.g., 'discover-customers', 'audit-billing', 'self-diagnostic'). " +
        "Use listPlaybooks or listWorkflows to discover available workflows."
      ),
    inputs: z
      .record(z.unknown())
      .optional()
      .describe(
        "Optional inputs/parameters for the workflow. Common keys:\n" +
        "- channels: string[] — Slack channels to scrape\n" +
        "- daysBack: number — Days back to look (default: 7)\n" +
        "- maxCustomers: number — Max customers to process (default: 200)\n" +
        "- customerId: string — Specific customer for deep-dive workflows\n" +
        "- staleHours: number — Hours threshold for stale tasks (default: 48)\n" +
        "- model: string — Model override for LLM calls within workflow"
      ),
    async: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "Whether to run asynchronously (true) or wait for completion (false). " +
        "Async returns immediately with a run ID and SSE URL."
      ),
  }),
  execute: async ({ workflow_name, inputs, async: isAsync }): Promise<RunWorkflowResult> => {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const internalToken = process.env.NEPTUNE_INTERNAL_TOKEN || "";

    // Validate workflow name (prevent path traversal)
    if (!/^[a-z][a-z0-9-]*$/.test(workflow_name)) {
      return {
        success: false,
        workflowName: workflow_name,
        error:
          `Invalid workflow name "${workflow_name}". Use kebab-case identifiers (e.g., 'discover-customers').`,
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const body: Record<string, unknown> = {
        inputs: inputs || {},
        async: isAsync,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (internalToken) {
        headers.Authorization = `Bearer ${internalToken}`;
      }

      const res = await fetch(
        `${baseUrl}/api/workflow/${encodeURIComponent(workflow_name)}/run`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        // Try fallback: legacy /api/workflow/run endpoint
        const fallbackRes = await fetch(`${baseUrl}/api/workflow/run`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            task: `Execute workflow: ${workflow_name}`,
            params: inputs || {},
          }),
        });

        if (!fallbackRes.ok) {
          return {
            success: false,
            workflowName: workflow_name,
            error:
              `Workflow endpoint returned ${res.status} (and fallback returned ${fallbackRes.status}). ` +
              `Ensure /api/workflow/${workflow_name}/run or /api/workflow/run is deployed.`,
          };
        }

        const data = await fallbackRes.json();
        return {
          success: true,
          workflowName: workflow_name,
          workflowRunId: data.workflowId || data.id,
          status: data.status || "started",
          sseUrl: data.sseUrl || `/api/workflow/sse?runId=${data.workflowId || data.id}`,
          reportUrl: data.reportUrl,
          message: `Workflow "${workflow_name}" triggered via legacy endpoint. Track at ${data.workflowId || data.id}.`,
        };
      }

      const data = await res.json();
      return {
        success: true,
        workflowName: workflow_name,
        workflowRunId: data.workflowRunId || data.runId || data.id,
        sseUrl:
          data.sseUrl ||
          `/api/workflow/${workflow_name}/sse?runId=${data.workflowRunId || data.runId || data.id}`,
        reportUrl: data.reportUrl || `/workflows/${data.workflowRunId || data.runId || data.id}`,
        status: data.status || "started",
        message:
          data.message ||
          `Workflow "${workflow_name}" triggered successfully. Track progress via SSE.`,
      };
    } catch (err) {
      return {
        success: false,
        workflowName: workflow_name,
        error: `Failed to trigger workflow: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});

export default runWorkflowTool;
