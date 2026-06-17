/**
 * lib/agents/tools/bulkBase44Pull.ts — Phase 38.5 Wiring Fix
 *
 * Bulk Base44 CRM entity query tool using filter+list pattern.
 * Pulls multiple entity records at once using the Base44 SDK/API.
 * Supports CustomerProfile, PaymentLog, SupportTicket, CallLog, AdminNotification.
 *
 * Uses AI SDK v6 ai.tool() with inputSchema.
 * Calls Base44 bridge on VPS for production access.
 */

import { tool } from "ai";
import { z } from "zod";

// ── Constants ────────────────────────────────────────────────────────

const MAX_IDS = 100;
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 300;
const BRIDGE_TIMEOUT_MS = 10_000;

const SUPPORTED_ENTITIES = [
  "CustomerProfile",
  "PaymentLog",
  "SupportTicket",
  "CallLog",
  "AdminNotification",
] as const;

type SupportedEntity = (typeof SUPPORTED_ENTITIES)[number];

// ── Base44 Bridge Call ───────────────────────────────────────────────

async function callBase44Bridge(
  entity: string,
  id: string
): Promise<Record<string, unknown> | null> {
  const bridgeUrl =
    process.env.VPS_BRIDGE_URL || "http://187.127.250.171:8400";
  const bridgeToken = process.env.VPS_BRIDGE_TOKEN || "";
  const diagKey = process.env.BASE44_DIAG_KEY || bridgeToken;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);

  try {
    const res = await fetch(`${bridgeUrl}/vpsAgentToolRouter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        internalToken: diagKey,
        tool: "b44_get",
        entity,
        id,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return { _error: `Bridge returned ${res.status}`, _id: id };
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    clearTimeout(timeout);
    return {
      _error: err instanceof Error ? err.message : "Unknown bridge error",
      _id: id,
    };
  }
}

// ── Tool Definition ──────────────────────────────────────────────────

export const bulkBase44Pull = tool({
  description:
    "Pull multiple records from Base44 CRM in bulk with batch processing. " +
    "Use for batch retrieval of customer profiles, payment logs, support tickets, " +
    "call logs, or admin notifications. Maximum 100 IDs per call, processed in " +
    "batches of 10. Returns summary counts and detailed records. " +
    "REAL Base44 data via VPS bridge — no simulation. " +
    "Use when cross-referencing CRM data against Slack or NMI.",
  inputSchema: z.object({
    entity: z
      .enum(SUPPORTED_ENTITIES)
      .describe("The Base44 entity type to query"),
    ids: z
      .array(z.string())
      .min(1)
      .max(MAX_IDS)
      .describe("Entity record IDs to pull (max 100)"),
    fields: z
      .array(z.string())
      .optional()
      .describe("Specific fields to return (returns all fields if omitted)"),
  }),

  execute: async ({ entity, ids, fields }) => {
    if (ids.length === 0) {
      return { error: "No IDs provided.", entity, totalRequested: 0, results: {} };
    }

    const allResults: Record<string, Record<string, unknown> | null> = {};
    let successCount = 0;
    let errorCount = 0;
    let batchNumber = 0;

    // Process in batches to avoid overwhelming the bridge
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      batchNumber++;

      const batchResults = await Promise.all(
        batch.map(async (id) => {
          const data = await callBase44Bridge(entity, id);
          return { id, data };
        })
      );

      for (const { id, data } of batchResults) {
        if (data && !data._error) {
          // Apply field filter if specified
          if (fields && fields.length > 0) {
            const filtered: Record<string, unknown> = {};
            for (const f of fields) {
              if (f in data) filtered[f] = data[f];
            }
            allResults[id] = filtered;
          } else {
            allResults[id] = data;
          }
          successCount++;
        } else {
          allResults[id] = data || {
            _error: "No data returned",
            _id: id,
          };
          errorCount++;
        }
      }

      // Small delay between batches
      if (i + BATCH_SIZE < ids.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    // ── Truncation handling ──────────────────────────────────────────
    const resultStr = JSON.stringify(allResults);
    const TOO_LARGE = resultStr.length > 12000;
    const TRUNCATE_LIMIT = 20;

    return {
      success: true,
      entity,
      totalRequested: ids.length,
      batchesProcessed: batchNumber,
      successCount,
      errorCount,
      successRate: ids.length > 0 ? Math.round((successCount / ids.length) * 100) : 0,
      results: TOO_LARGE
        ? Object.fromEntries(Object.entries(allResults).slice(0, TRUNCATE_LIMIT))
        : allResults,
      truncated: TOO_LARGE,
      truncatedCount: TOO_LARGE ? ids.length - TRUNCATE_LIMIT : 0,
      warning: TOO_LARGE
        ? `Result too large (${resultStr.length} chars). Showing first ${TRUNCATE_LIMIT} records. Use fields filter or fewer IDs.`
        : undefined,
    };
  },
});

export default bulkBase44Pull;
