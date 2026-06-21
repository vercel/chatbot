/**
 * lib/ai/tools/billing-alignment.ts — M-N4: Billing Alignment Tool
 *
 * Compares Base44 subscription status against NMI payment gateway status.
 * Returns drift analysis with per-customer reconciliation rows for the
 * BillingAlignmentCard generative UI component.
 *
 * Uses VPS bridge for cross-system lookups (Base44 + NMI).
 */

import { tool } from "ai";
import { z } from "zod";

export const billingAlignment = tool({
  description:
    "Run a billing alignment sweep: compare Base44 subscription status " +
    "against NMI payment gateway status. Returns drift analysis and " +
    "per-customer reconciliation rows. Use this when the user asks about " +
    "billing health, payment drifts, or subscription reconciliation.",
  inputSchema: z.object({
    days: z
      .number()
      .optional()
      .default(7)
      .describe("Lookback days for NMI transactions (default 7)"),
    limit: z
      .number()
      .optional()
      .default(50)
      .describe("Maximum customers to check (default 50)"),
    customerIds: z
      .array(z.string())
      .optional()
      .describe(
        "Specific customer IDs to check. If empty, scans recent active customers."
      ),
  }),
  execute: async ({ days = 7, limit = 50, customerIds }) => {
    const bridgeUrl =
      process.env.VPS_BRIDGE_URL || "http://localhost:8400";
    const diagKey = process.env.NEPTUNE_INTERNAL_TOKEN || "";

    // ── Fetch Base44 customer profiles ─────────────────────────────────
    let profiles: Array<{
      id: string;
      name?: string;
      email?: string;
      status?: string;
    }> = [];

    try {
      const res = await fetch(`${bridgeUrl}/vpsAgentToolRouter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          internalToken: diagKey,
          tool: "b44_query_all",
          entity: "CustomerProfile",
          filter: customerIds?.length
            ? { id: { $in: customerIds } }
            : { status: "active" },
          fields: ["id", "name", "email", "status"],
          sort: "-updatedAt",
          maxRecords: limit,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        profiles = data.result?.results || data.results || [];
      }
    } catch (err) {
      console.error("[billingAlignment] Failed to fetch profiles:", err);
    }

    // ── Fetch NMI transactions for each customer ───────────────────────
    const rows: Array<{
      customerId: string;
      name: string;
      base44Status: string;
      nmiStatus: string;
      driftType: "DRIFT" | "OK" | "ERROR";
      nmiLastAmount?: number;
      lastChargeDate?: string;
      subscriptionId?: string;
    }> = [];

    let okCount = 0;
    let driftsFound = 0;
    let errorCount = 0;

    for (const profile of profiles) {
      const customerId = profile.id;
      const base44Status = profile.status || "unknown";
      const name = profile.name || profile.email || customerId;

      try {
        // Query NMI for this customer's recent transactions
        const nmiRes = await fetch(`${bridgeUrl}/vpsAgentToolRouter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            internalToken: diagKey,
            tool: "nmi_mcp_bridge",
            action: "customer_vault_query",
            payload: { customerId },
          }),
        });

        let nmiStatus = "unknown";
        let nmiLastAmount: number | undefined;
        let lastChargeDate: string | undefined;
        let subscriptionId: string | undefined;

        if (nmiRes.ok) {
          const nmiData = await nmiRes.json();
          const vault = nmiData.result || nmiData;

          // Determine NMI status from vault data
          if (vault?.subscriptions?.length) {
            const sub = vault.subscriptions[0];
            nmiStatus = sub.status || "unknown";
            nmiLastAmount = sub.amount ? parseFloat(sub.amount) * 100 : undefined;
            lastChargeDate = sub.next_charge_date || sub.last_charge_date;
            subscriptionId = sub.subscription_id;
          } else if (vault?.customer_vault_id) {
            nmiStatus = "no_subscription";
          }
        } else {
          nmiStatus = "gateway_error";
        }

        // ── Compute drift ──────────────────────────────────────────────
        let driftType: "DRIFT" | "OK" | "ERROR" = "OK";

        if (nmiStatus === "gateway_error") {
          driftType = "ERROR";
          errorCount++;
        } else if (nmiStatus === "unknown") {
          driftType = "ERROR";
          errorCount++;
        } else if (
          (base44Status === "active" && nmiStatus !== "active") ||
          (base44Status === "paused" && nmiStatus === "active") ||
          (base44Status === "cancelled" && nmiStatus === "active") ||
          nmiStatus === "failed" ||
          nmiStatus === "expired"
        ) {
          driftType = "DRIFT";
          driftsFound++;
        } else {
          okCount++;
        }

        rows.push({
          customerId,
          name,
          base44Status,
          nmiStatus,
          driftType,
          nmiLastAmount,
          lastChargeDate,
          subscriptionId,
        });
      } catch {
        rows.push({
          customerId,
          name,
          base44Status,
          nmiStatus: "gateway_error",
          driftType: "ERROR",
        });
        errorCount++;
      }
    }

    // ── Build response ─────────────────────────────────────────────────
    return {
      type: "billing-alignment",
      summary: {
        periodLabel: `${days} days`,
        customersChecked: profiles.length,
        driftsFound,
        okCount,
        errorCount,
      },
      rows,
      generatedAt: new Date().toISOString(),
      source: "billing-alignment-tool",
    };
  },
});

export default billingAlignment;
