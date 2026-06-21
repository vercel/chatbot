/**
 * lib/ai/tools/bulk-nmi-query.ts — Phase 38.5 Stream 2
 *
 * Bulk NMI query tool for chat agents.
 * Queries NMI customer vault for multiple customers at once.
 * Rate-limited to 10 calls/minute (6s between calls).
 *
 * Uses the NMI MCP bridge for production access.
 * Falls back gracefully when bridge is unavailable.
 */

import { tool } from "ai";
import { z } from "zod";
import { secrets } from "@/secrets";

const NMI_RATE_LIMIT_MS = 6000; // 6s between calls (max 10/min)
const MAX_CUSTOMERS = 50;
const RESULT_TRUNCATE_LENGTH = 8000; // Warn if result > 8K chars

let lastNmiCallTime = 0;

async function rateLimitNmi(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastNmiCallTime;
  if (elapsed < NMI_RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, NMI_RATE_LIMIT_MS - elapsed));
  }
  lastNmiCallTime = Date.now();
}

export const bulkNmiQuery = tool({
  description:
    "Query NMI (payment gateway) for multiple customers' subscription status. " +
    "Returns subscription state, last transaction, and next charge date for each. " +
    "Rate-limited to 10 calls/minute. Maximum 50 customer IDs per call. " +
    "Use when you need real NMI data for multiple customers at once.",
  inputSchema: z.object({
    customerIds: z.array(z.string()).min(1).max(MAX_CUSTOMERS).describe(
      "Customer IDs to query (max 50)"
    ),
    includeTransactions: z.boolean().optional().default(false).describe(
      "Whether to include recent transaction details (slower)"
    ),
  }),
  execute: async ({ customerIds, includeTransactions }) => {
    const results: Record<string, {
      status: string;
      subscriptionId: string | null;
      nextChargeDate: string | null;
      lastTransaction: Record<string, unknown> | null;
      cofCompliant: boolean;
      error?: string;
    }> = {};

    let totalTokens = 0;
    const bridgeUrl = process.env.VPS_BRIDGE_URL || "http://localhost:8400";
    const diagKey = process.env.NEPTUNE_INTERNAL_TOKEN || "";

    for (let i = 0; i < customerIds.length; i++) {
      const customerId = customerIds[i];

      try {
        await rateLimitNmi();

        // Call NMI MCP bridge
        const res = await fetch(`${bridgeUrl}/vpsAgentToolRouter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            internalToken: diagKey,
            tool: "nmi_mcp_bridge",
            action: "query_vault",
            payload: { customerId },
          }),
        });

        if (!res.ok) {
          results[customerId] = {
            status: "error",
            subscriptionId: null,
            nextChargeDate: null,
            lastTransaction: null,
            cofCompliant: false,
            error: `NMI bridge returned ${res.status}`,
          };
          continue;
        }

        const data = await res.json();

        if (data?.subscriptions && Array.isArray(data.subscriptions) && data.subscriptions.length > 0) {
          const sub = data.subscriptions[0];
          results[customerId] = {
            status: sub.status || "unknown",
            subscriptionId: sub.subscription_id || sub.id || null,
            nextChargeDate: sub.next_charge_date || null,
            lastTransaction: sub.last_transaction || null,
            cofCompliant: true,
          };
        } else {
          results[customerId] = {
            status: "none",
            subscriptionId: null,
            nextChargeDate: null,
            lastTransaction: null,
            cofCompliant: false,
          };
        }

        totalTokens += JSON.stringify(results[customerId]).length;

      } catch (err) {
        results[customerId] = {
          status: "error",
          subscriptionId: null,
          nextChargeDate: null,
          lastTransaction: null,
          cofCompliant: false,
          error: err instanceof Error ? err.message : "Unknown NMI error",
        };
      }
    }

    const statusCounts = {
      active: 0,
      declining: 0,
      cancelled: 0,
      none: 0,
      error: 0,
    };

    for (const r of Object.values(results)) {
      const key = r.status as keyof typeof statusCounts;
      if (key in statusCounts) statusCounts[key]++;
    }

    const resultStr = JSON.stringify(results);
    const truncated = resultStr.length > RESULT_TRUNCATE_LENGTH;

    return {
      totalCustomers: customerIds.length,
      summary: statusCounts,
      results: truncated
        ? Object.fromEntries(
            Object.entries(results).slice(0, 15)
          )
        : results,
      truncated,
      truncatedCount: truncated ? customerIds.length - 15 : 0,
      tokenEstimate: totalTokens,
      warning: truncated
        ? `Result too large (${resultStr.length} chars). Showing first 15 customers. Use pagination for more.`
        : undefined,
    };
  },
});

export default bulkNmiQuery;
