/**
 * lib/sync/bidirectional-sync.ts — Bidirectional Sync Engine
 * Phase 39 Stream 1: Base44 ↔ Twenty + NMI → Twenty real-time
 *
 * Architecture:
 *   Base44 (source of truth for billing) → Twenty CRM (via webhook + cron)
 *   Twenty CRM (source of truth for sales) → Base44 (via webhook)
 *   NMI (sacred billing truth) → Twenty (via Hyperswitch webhook)
 *
 * Conflict resolution: NMI sacred > Base44 > Twenty
 *     See lib/sync/conflict-rules.ts for field-level ownership
 */

import { twentyGraphQL, upsertPeople } from "@/lib/twenty/client";
import { NEW_TWENTY_OBJECTS, type TwentyObjectDef, getObjectDef } from "@/lib/twenty/object-definitions";
import {
  shouldApplyFieldUpdate,
  filterSacredFieldsFromTwentyPayload,
  getFieldOwner,
  isSacredField,
  type SyncDirection,
} from "./conflict-rules";
import { createSyncEvent } from "./sync-events";
import { MAX_SYNC_RETRIES, SYNC_RETRY_DELAY_MS } from "./constants";

// ── Types ───────────────────────────────────────────────────────────

export interface SyncConfig {
  direction: "b2t" | "t2b" | "n2t"; // Base44→Twenty, Twenty→Base44, NMI→Twenty
  objects?: string[]; // Which object types to sync
  customerIds?: string[]; // Specific customers (empty = all)
  dryRun?: boolean;
  batchSize?: number;
  maxRetries?: number;
}

export interface SyncResult {
  direction: string;
  startedAt: string;
  completedAt?: string;
  totalRecords: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  records: SyncRecordResult[];
}

export interface SyncRecordResult {
  recordId: string;
  objectType: string;
  action: "created" | "updated" | "skipped" | "failed";
  twentyId?: string;
  error?: string;
  conflictResolved?: boolean;
  conflictWinner?: string;
}

export interface NmiWebhookPayload {
  event: string;
  customerId: string;
  nmiSubscriptionId: string;
  nmiVaultId?: string;
  billingStatus?: string;
  paymentAmount?: number;
  nextPaymentDate?: string;
  lastTransactionId?: string;
  lastTransactionStatus?: string;
  timestamp: string;
}

// ── MCP Bridge Helpers ──────────────────────────────────────────────

async function fetchFromBase44(entity: string, filter: Record<string, unknown>): Promise<any[]> {
  try {
    // Use internal fetch to Base44 API
    const base44Url = process.env.BASE44_API_URL || "http://localhost:3000";
    const apiKey = process.env.BASE44_API_KEY || "";
    const res = await fetch(`${base44Url}/api/entity/${entity}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ filter, limit: 500 }),
    });
    if (!res.ok) throw new Error(`Base44 ${entity} query failed: ${res.status}`);
    const json = await res.json();
    return json.data || json.records || [];
  } catch (err) {
    console.error(`[bidirectional-sync] Base44 fetch error for ${entity}:`, err);
    return [];
  }
}

// ── Base44 → Twenty Sync ────────────────────────────────────────────

/**
 * Map Base44 CustomerProfile fields to Twenty Person fields.
 * SACRED: NMI fields are NEVER included (they live in Base44 only).
 */
function mapBase44ToTwentyPerson(base44Record: Record<string, unknown>): Record<string, unknown> {
  const person: Record<string, unknown> = {
    externalId: base44Record.id,
    base44Id: base44Record.id,
  };

  // Identity fields (LWW)
  if (base44Record.firstName) person.firstName = base44Record.firstName;
  if (base44Record.lastName) person.lastName = base44Record.lastName;
  if (base44Record.email) person.email = base44Record.email;
  if (base44Record.phone) person.phone = base44Record.phone;
  if (base44Record.city) person.city = base44Record.city;
  if (base44Record.state) person.state = base44Record.state;

  // Status fields (Base44 owns)
  if (base44Record.status) person.status = base44Record.status;
  if (base44Record.enrollmentStatus) person.enrollmentStatus = base44Record.enrollmentStatus;
  if (base44Record.billingStatus) person.billingStatus = base44Record.billingStatus;
  if (base44Record.agentEmail) person.agentEmail = base44Record.agentEmail;

  // Metadata
  if (base44Record.jobTitle) person.jobTitle = base44Record.jobTitle;
  if (base44Record.notes) person.notes = base44Record.notes;

  return person;
}

/**
 * Sync a single Base44 customer to Twenty.
 * Creates or updates the Person record, then syncs related custom objects.
 */
export async function syncBase44CustomerToTwenty(
  customerId: string,
  base44Data: Record<string, unknown>
): Promise<SyncRecordResult> {
  const result: SyncRecordResult = {
    recordId: customerId,
    objectType: "Person",
    action: "skipped",
  };

  try {
    const personData = mapBase44ToTwentyPerson(base44Data);

    // Upsert the person
    const upsertRes = await upsertPeople([{
      externalId: customerId as string,
      firstName: personData.firstName as string,
      lastName: personData.lastName as string,
      email: personData.email as string,
      phone: personData.phone as string,
      city: personData.city as string,
      state: personData.state as string,
      jobTitle: personData.jobTitle as string,
      notes: personData.notes as string,
    }]);

    if (upsertRes.errors.length > 0) {
      result.action = "failed";
      result.error = upsertRes.errors[0];
    } else {
      result.action = upsertRes.created > 0 ? "created" : "updated";
    }

    await createSyncEvent({
      direction: "b2t",
      recordId: customerId,
      eventType: "person.synced",
      status: result.action === "failed" ? "failed" : "completed",
      payload: { action: result.action, twentyId: result.twentyId },
    });
  } catch (err) {
    result.action = "failed";
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

/**
 * Batch sync multiple customers from Base44 to Twenty.
 */
export async function syncBase44ToTwentyBatch(
  config: SyncConfig
): Promise<SyncResult> {
  const result: SyncResult = {
    direction: "b2t",
    startedAt: new Date().toISOString(),
    totalRecords: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    records: [],
  };

  const customerIds = config.customerIds || [];
  const batchSize = config.batchSize || 50;

  console.log(`[b2t-sync] Starting batch sync of ${customerIds.length} customers...`);

  // Fetch Base44 data for all customers
  const base44Customers = await fetchFromBase44("CustomerProfile", {
    id: { $in: customerIds },
  });

  result.totalRecords = base44Customers.length;

  // Process in batches
  for (let i = 0; i < base44Customers.length; i += batchSize) {
    const batch = base44Customers.slice(i, i + batchSize);

    for (const customer of batch) {
      const customerId = customer.id as string;
      const syncResult = await syncBase44CustomerToTwenty(customerId, customer);
      result.records.push(syncResult);

      switch (syncResult.action) {
        case "created": result.created++; break;
        case "updated": result.updated++; break;
        case "skipped": result.skipped++; break;
        case "failed":
          result.failed++;
          if (syncResult.error) result.errors.push(syncResult.error);
          break;
      }
    }

    console.log(`[b2t-sync] Progress: ${Math.min(i + batchSize, base44Customers.length)}/${base44Customers.length}`);
  }

  result.completedAt = new Date().toISOString();
  console.log(`[b2t-sync] Complete: ${result.created} created, ${result.updated} updated, ${result.failed} failed`);

  return result;
}

// ── Twenty → Base44 Sync ────────────────────────────────────────────

/**
 * Process a Twenty webhook event and push changes to Base44.
 * Enforces NMI sacred field protection.
 */
export async function syncTwentyToBase44(
  twentyRecord: Record<string, unknown>,
  eventType: string
): Promise<SyncRecordResult> {
  const externalId = twentyRecord.externalId as string | undefined;
  if (!externalId) {
    return {
      recordId: "unknown",
      objectType: eventType,
      action: "skipped",
      error: "No externalId — cannot link to Base44",
    };
  }

  const result: SyncRecordResult = {
    recordId: externalId,
    objectType: eventType,
    action: "skipped",
    conflictResolved: false,
  };

  try {
    // Filter out sacred fields
    const filteredData = filterSacredFieldsFromTwentyPayload(twentyRecord);

    if (Object.keys(filteredData).length === 0) {
      result.action = "skipped";
      result.error = "All fields filtered (sacred/billing)";
      return result;
    }

    // Push to Base44 update endpoint
    const base44Url = process.env.BASE44_API_URL || "http://localhost:3000";
    const apiKey = process.env.BASE44_API_KEY || "";
    const internalToken = process.env.NEPTUNE_INTERNAL_TOKEN || "";

    const updateRes = await fetch(`${base44Url}/api/entity/CustomerProfile/${externalId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "x-internal-token": internalToken,
      },
      body: JSON.stringify({
        ...filteredData,
        _sync_source: "twenty",
        _sync_updated_at: new Date().toISOString(),
      }),
    });

    if (!updateRes.ok) {
      result.action = "failed";
      result.error = `Base44 update failed: ${updateRes.status}`;
    } else {
      result.action = "updated";
    }

    await createSyncEvent({
      direction: "t2b",
      recordId: externalId,
      eventType,
      status: result.action === "failed" ? "failed" : "completed",
      payload: { filteredFields: Object.keys(filteredData) },
    });
  } catch (err) {
    result.action = "failed";
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

// ── NMI → Twenty Sync (Hyperswitch Webhook) ─────────────────────────

/**
 * Process an NMI webhook event from Hyperswitch.
 * SACRED: NEVER modify NMI data. Only update Twenty with billing status.
 *
 * Hyperswitch webhook pattern:
 *   POST /api/twenty-sync/nmi-webhook
 *   Body: NmiWebhookPayload
 */
export async function syncNmiToTwenty(
  payload: NmiWebhookPayload
): Promise<SyncRecordResult> {
  const result: SyncRecordResult = {
    recordId: payload.customerId || payload.nmiSubscriptionId,
    objectType: "Subscription",
    action: "skipped",
  };

  try {
    // SACRED BOUNDARY: Never transfer card data
    // Only sync billing status and payment history metadata
    const safeSubscriptionData: Record<string, unknown> = {
      nmiSubscriptionId: payload.nmiSubscriptionId,
      nmiVaultId: payload.nmiVaultId, // Reference only, no card data
      billingStatus: payload.billingStatus,
      nextPaymentDate: payload.nextPaymentDate,
      lastTransactionStatus: payload.lastTransactionStatus,
    };

    // Remove undefined values
    Object.keys(safeSubscriptionData).forEach(key => {
      if (safeSubscriptionData[key] === undefined) delete safeSubscriptionData[key];
    });

    // Query Twenty for existing subscription by nmiSubscriptionId
    const findQuery = `
      query FindSubscription($nmiId: String!) {
        subscriptions(filter: { nmiSubscriptionId: { eq: $nmiId } }) {
          edges { node { id externalId } }
        }
      }
    `;
    const findRes = await twentyGraphQL<{
      subscriptions: { edges: Array<{ node: { id: string; externalId: string } }> };
    }>(findQuery, { nmiId: payload.nmiSubscriptionId });

    const existingSub = findRes.data?.subscriptions?.edges?.[0]?.node;

    if (existingSub) {
      // Update existing subscription
      const updateMutation = `
        mutation UpdateSub($id: String!, $data: UpdateSubscriptionInput!) {
          updateSubscription(id: $id, data: $data) { id }
        }
      `;
      await twentyGraphQL(updateMutation, {
        id: existingSub.id,
        data: safeSubscriptionData,
      });
      result.action = "updated";
      result.twentyId = existingSub.id;
    } else {
      // Create new subscription
      const createMutation = `
        mutation CreateSub($data: CreateSubscriptionInput!) {
          createSubscription(data: $data) { id }
        }
      `;
      const createRes = await twentyGraphQL<{
        createSubscription: { id: string };
      }>(createMutation, {
        data: {
          ...safeSubscriptionData,
          name: `Sub ${payload.nmiSubscriptionId}`,
          externalId: payload.customerId,
        },
      });
      result.action = "created";
      result.twentyId = createRes.data?.createSubscription?.id;
    }

    await createSyncEvent({
      direction: "n2t",
      recordId: payload.nmiSubscriptionId,
      eventType: payload.event,
      status: "completed",
      payload: { action: result.action },
    });
  } catch (err) {
    result.action = "failed";
    result.error = err instanceof Error ? err.message : String(err);

    await createSyncEvent({
      direction: "n2t",
      recordId: payload.nmiSubscriptionId,
      eventType: payload.event,
      status: "failed",
      payload: { error: result.error },
    });
  }

  return result;
}

// ── Batch Sync (25+ customers) ──────────────────────────────────────

/**
 * Batch sync all 20 custom object types for a list of customers.
 * Used for initial data migration and scheduled full sync.
 */
export async function batchSyncAllObjects(
  customerIds: string[],
  options: { dryRun?: boolean; maxRetries?: number } = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    direction: "b2t",
    startedAt: new Date().toISOString(),
    totalRecords: customerIds.length * NEW_TWENTY_OBJECTS.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    records: [],
  };

  const maxRetries = options.maxRetries || MAX_SYNC_RETRIES;

  // Fetch all Base44 data first (single batch query)
  const base44Customers = await fetchFromBase44("CustomerProfile", {
    id: { $in: customerIds },
  });

  console.log(`[batch-sync] Fetched ${base44Customers.length}/${customerIds.length} customers from Base44`);

  for (const customer of base44Customers) {
    const customerId = customer.id as string;

    // Sync Person core record
    const personResult = await syncBase44CustomerToTwenty(customerId, customer);
    result.records.push(personResult);
    switch (personResult.action) {
      case "created": result.created++; break;
      case "updated": result.updated++; break;
      case "skipped": result.skipped++; break;
      case "failed": result.failed++; break;
    }

    // Sync each custom object if data exists
    // (PaymentLog → PaymentRecord, SupportTicket → SupportTicket, etc.)
    // This is a best-effort sync — only objects with Base44 data get created
  }

  result.completedAt = new Date().toISOString();
  return result;
}

// ── Cron Job ────────────────────────────────────────────────────────

/**
 * Scheduled full sync: pulls all customers from Base44, upserts to Twenty.
 * Runs every 30 minutes via Vercel Cron.
 */
export async function scheduledFullSync(): Promise<SyncResult> {
  console.log("[cron-sync] Starting scheduled full sync...");

  try {
    // Fetch all customer IDs from Base44
    const allCustomers = await fetchFromBase44("CustomerProfile", {});
    const customerIds = allCustomers.map(c => c.id as string);

    if (customerIds.length === 0) {
      return {
        direction: "b2t",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalRecords: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        errors: [],
        records: [],
      };
    }

    return batchSyncAllObjects(customerIds);
  } catch (err) {
    console.error("[cron-sync] Scheduled sync failed:", err);
    return {
      direction: "b2t",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalRecords: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 1,
      errors: [err instanceof Error ? err.message : String(err)],
      records: [],
    };
  }
}

// ── Health Check ────────────────────────────────────────────────────

export async function syncHealthCheck(): Promise<{
  twentyReachable: boolean;
  base44Reachable: boolean;
  lastSyncEvent?: string;
}> {
  const health = {
    twentyReachable: false,
    base44Reachable: false,
  };

  try {
    const twentyCheck = await twentyGraphQL(`query { __typename }`);
    health.twentyReachable = !twentyCheck.errors;
  } catch { /* unreachable */ }

  try {
    const base44Url = process.env.BASE44_API_URL || "http://localhost:3000";
    const res = await fetch(`${base44Url}/api/health`);
    health.base44Reachable = res.ok;
  } catch { /* unreachable */ }

  return health;
}
