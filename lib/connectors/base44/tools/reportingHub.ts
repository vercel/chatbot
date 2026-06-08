/**
 * Base44 reportingHub — wrapper for reportingHubQuery
 */
import { tool } from "ai";
import { z } from "zod";
import { base44Service } from "../client";

const REPORT_ACTIONS = [
  "overview",
  "enrollments",
  "lead_flow",
  "billing",
  "communications",
  "calls",
  "agents",
  "support",
  "automations",
  "activity_feed",
  "customer_360",
  "customer_comms",
  "sync_health",
  "morning_pulse",
  "vapi_intelligence",
  "enrollment_intelligence",
] as const;

export const reportingHub = tool({
  description:
    "Run a Base44 operational report. Pre-aggregated data — fast, no manual queries needed.",
  inputSchema: z.object({
    action: z.enum(REPORT_ACTIONS).describe("Report action to run"),
    params: z
      .record(z.unknown())
      .optional()
      .describe("Optional parameters for the report"),
  }),
  execute: async ({ action, params }) => {
    try {
      const result = await base44Service.functions.invoke("reportingHubQuery", {
        action,
        ...(params || {}),
      });
      return { action, report: result };
    } catch (err) {
      return {
        error: `Reporting hub failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});
