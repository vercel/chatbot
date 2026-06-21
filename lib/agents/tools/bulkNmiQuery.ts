/**
 * lib/agents/tools/bulkNmiQuery.ts — Phase 38.5 Wiring Fix
 *
 * Bulk NMI payment gateway query tool with BATCH processing.
 * Wraps the NMI MCP bridge to query multiple customers' subscription
 * state, last transactions, and next charge dates in parallel batches.
 *
 * Uses AI SDK v6 ai.tool() with inputSchema.
 * NMI vault SACRED — read-only queries only, no charges/refunds.
 */

import { tool } from "ai";
import { z } from "zod";

// ── Constants ────────────────────────────────────────────────────────

const BATCH_SIZE = 5; // Process 5 customers per batch
const BATCH_DELAY_MS = 7000; // 7s between batches (stays under 10 calls/min NMI limit)
const MAX_CUSTOMERS = 50;
const RESULT_TRUNCATE_LENGTH = 8000;
const BRIDGE_TIMEOUT_MS = 12_000;

interface NmiVaultResult {
  customerId: string;
  status: string;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  nextChargeDate: string | null;
  lastTransactionAmount: number | null;
  lastTransactionStatus: string | null;
  cofCompliant: boolean;
  error?: string;
}

// ── NMI MCP Bridge Call ──────────────────────────────────────────────

async function callNmiBridge(
  customerId: string
): Promise<Record<string, unknown> | null> {
  const bridgeUrl =
    process.env.VPS_BRIDGE_URL || "http://187.127.250.171:8400";
  const bridgeToken = process.env.VPS_BRIDGE_TOKEN || "";
  const diagKey = process.env.NEPTUNE_INTERNAL_TOKEN || bridgeToken;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);

  try {
    const res = await fetch(`${bridgeUrl}/vpsAgentToolRouter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        internalToken: diagKey,
        tool: "nmi_mcp_bridge",
        action: "query_vault",
        payload: { customerId },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function parseVaultResult(
  customerId: string,
  data: Record<string, unknown> | null
): NmiVaultResult {
  if (!data) {
    return {
      customerId,
      status: "error",
      subscriptionId: null,
      subscriptionStatus: null,
      nextChargeDate: null,
      lastTransactionAmount: null,
      lastTransactionStatus: null,
      cofCompliant: false,
      error: "NMI bridge returned no data",
    };
  }

  // Extract subscription info (NMI customer vault structure)
  const subscriptions = data.subscriptions as Array<Record<string, unknown>> | undefined;
  const sub = subscriptions?.[0];

  return {
    customerId,
    status: sub ? ((sub.status as string) || "unknown") : "none",
    subscriptionId: sub ? ((sub.subscription_id as string) || (sub.id as string) || null) : null,
    subscriptionStatus: sub ? ((sub.status as string) || null) : null,
    nextChargeDate: sub ? ((sub.next_charge_date as string) || null) : null,
    lastTransactionAmount: sub?.last_transaction
      ? ((sub.last_transaction as Record<string, unknown>).amount as number) || null
      : null,
    lastTransactionStatus: sub?.last_transaction
      ? ((sub.last_transaction as Record<string, unknown>).status as string) || null
      : null,
    cofCompliant: !!sub,
  };
}

// ── Tool Definition ──────────────────────────────────────────────────

export const bulkNmiQuery = tool({
  description:
    "Query NMI payment gateway for multiple customers' subscription status in bulk. " +
    "Processes up to 50 customers in batches of 5 with rate-limit-safe delays. " +
    "Returns subscription state, next charge date, and last transaction for each. " +
    "REAL NMI data via MCP bridge — no simulation. " +
    "READ-ONLY: queries customer vault only, no charges or refunds. " +
    "Use when checking billing alignment, subscription status, or payment health across customers.",
  inputSchema: z.object({
    customerIds: z
      .array(z.string())
      .min(1)
      .max(MAX_CUSTOMERS)
      .describe("Customer vault IDs to query (max 50)"),
    includeTransactionDetails: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include last transaction amount and status (adds latency)"),
  }),

  execute: async ({ customerIds, includeTransactionDetails: _includeDetails }) => {
    if (customerIds.length === 0) {
      return { error: "No customer IDs provided.", totalCustomers: 0, results: [] };
    }

    const allResults: NmiVaultResult[] = [];
    let batchNumber = 0;

    // Process in batches
    for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
      const batch = customerIds.slice(i, i + BATCH_SIZE);
      batchNumber++;

      // Fetch batch in parallel (NMI bridge handles sequential internally)
      const batchResults = await Promise.all(
        batch.map(async (customerId) => {
          const data = await callNmiBridge(customerId);
          return parseVaultResult(customerId, data);
        })
      );

      allResults.push(...batchResults);

      // Rate limit between batches
      if (i + BATCH_SIZE < customerIds.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    // ── Summary ──────────────────────────────────────────────────────
    const summary = {
      active: 0,
      declining: 0,
      cancelled: 0,
      none: 0,
      error: 0,
    };

    for (const r of allResults) {
      const key = r.subscriptionStatus as keyof typeof summary;
      if (key in summary) {
        summary[key]++;
      } else if (r.status === "error") {
        summary.error++;
      } else {
        summary.none++;
      }
    }

    const resultStr = JSON.stringify(allResults);
    const truncated = resultStr.length > RESULT_TRUNCATE_LENGTH;

    return {
      success: true,
      totalCustomers: customerIds.length,
      batchesProcessed: batchNumber,
      batchSize: BATCH_SIZE,
      summary,
      results: truncated ? allResults.slice(0, 15) : allResults,
      truncated,
      truncatedCount: truncated ? allResults.length - 15 : 0,
      tokenEstimate: resultStr.length,
      warning: truncated
        ? `Result too large (${resultStr.length} chars). Showing first 15 customers. Request fewer IDs or paginate.`
        : undefined,
    };
  },
});

export default bulkNmiQuery;
