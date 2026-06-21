/**
 * lib/ai/tools/bulk-base44-pull.ts — Phase 38.5 Stream 2
 *
 * Bulk Base44 entity query tool for chat agents.
 * Pulls multiple entity records at once using Base44 SDK.
 * Supports CustomerProfile, PaymentLog, SupportTicket, CallLog.
 *
 * Uses direct fetch to Base44 bridge when on VPS.
 * Falls back gracefully when bridge is unavailable.
 */

import { tool } from "ai";
import { z } from "zod";

const MAX_IDS = 100;
const SUPPORTED_ENTITIES = [
  "CustomerProfile", "PaymentLog", "SupportTicket",
  "CallLog", "AdminNotification",
] as const;

export const bulkBase44Pull = tool({
  description:
    "Pull multiple records from Base44 CRM at once. " +
    "Use for batch retrieval of customer profiles, payment logs, support tickets, etc. " +
    "Maximum 100 IDs per call. Results include a summary and truncated data if too large.",
  inputSchema: z.object({
    entity: z.enum(SUPPORTED_ENTITIES).describe(
      "The Base44 entity to query"
    ),
    ids: z.array(z.string()).min(1).max(MAX_IDS).describe(
      "Entity IDs to pull (max 100)"
    ),
    fields: z.array(z.string()).optional().describe(
      "Specific fields to return (returns all if omitted)"
    ),
  }),
  execute: async ({ entity, ids, fields }) => {
    const bridgeUrl = process.env.VPS_BRIDGE_URL || "http://localhost:8400";
    const diagKey = process.env.NEPTUNE_INTERNAL_TOKEN || "";

    const results: Record<string, Record<string, unknown> | null> = {};
    let successCount = 0;
    let errorCount = 0;

    for (const id of ids) {
      try {
        // Use Base44 MCP bridge for individual entity lookup
        const res = await fetch(`${bridgeUrl}/vpsAgentToolRouter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            internalToken: diagKey,
            tool: "b44_get",
            entity,
            id,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (fields && fields.length > 0) {
            const filtered: Record<string, unknown> = {};
            for (const f of fields) {
              if (f in (data || {})) filtered[f] = data[f];
            }
            results[id] = filtered;
          } else {
            results[id] = data || null;
          }
          if (data) successCount++;
          else errorCount++;
        } else {
          results[id] = { _error: `Bridge returned ${res.status}` };
          errorCount++;
        }
      } catch (err) {
        results[id] = {
          _error: err instanceof Error ? err.message : "Unknown error",
        };
        errorCount++;
      }
    }

    const resultStr = JSON.stringify(results);
    const TOO_LARGE = resultStr.length > 12000;
    const MAP_LIMIT = 20;

    return {
      entity,
      totalRequested: ids.length,
      successCount,
      errorCount,
      results: TOO_LARGE
        ? Object.fromEntries(Object.entries(results).slice(0, MAP_LIMIT))
        : results,
      truncated: TOO_LARGE,
      truncatedCount: TOO_LARGE ? ids.length - MAP_LIMIT : 0,
      warning: TOO_LARGE
        ? `Result too large (${resultStr.length} chars). Showing first ${MAP_LIMIT} records. Use pagination or specify fields to reduce size.`
        : undefined,
    };
  },
});

export default bulkBase44Pull;
