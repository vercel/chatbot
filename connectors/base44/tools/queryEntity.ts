/**
 * Base44 queryEntity — query any entity with MongoDB-style filter
 */
import { tool } from "ai";
import { z } from "zod";
import { base44Service } from "../client";

const COMMON_ENTITIES = [
  "CustomerProfile",
  "PaymentLog",
  "AdminNotification",
  "SupportTicket",
  "SlackSubmission",
  "CallLog",
  "VapiCallEvent",
  "CreditReport",
  "BillingQueue",
  "RecoveryItem",
  "Subscription",
  "NmiTransaction",
] as const;

export const queryEntity = tool({
  description:
    "Query a Base44 entity with MongoDB-style filter. Returns matching records.",
  inputSchema: z.object({
    entity: z.enum(COMMON_ENTITIES).describe("Entity type to query"),
    filter: z
      .record(z.unknown())
      .optional()
      .describe("MongoDB-style filter object"),
    sort: z
      .string()
      .optional()
      .describe("Sort direction, e.g. '-created_date'"),
    limit: z.number().int().min(1).max(500).optional().default(50),
  }),
  execute: async ({ entity, filter, sort, limit }) => {
    try {
      const results = await base44Service.entities[entity].filter(
        (filter as Record<string, unknown>) || {},
        sort || "-created_date",
        limit || 50
      );
      return {
        entity,
        count: Array.isArray(results) ? results.length : 0,
        results,
      };
    } catch (err) {
      return {
        error: `Base44 query failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});
