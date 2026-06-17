/**
 * POST /api/twenty-sync
 *
 * Base44 → Twenty CRM sync endpoint.
 * Takes one or more Base44 CustomerProfile IDs and syncs them to Twenty CRM.
 * Idempotent — uses base44Id as external_id for upsert.
 *
 * Phase 27: FOUNDATION ONLY — not full migration (Phase 29).
 * NMI SACRED BOUNDARY: Card data NEVER transferred.
 *
 * Auth: Internal Bearer token (TWENTY_SYNC_API_KEY env var)
 */

import { NextRequest, NextResponse } from "next/server";

// ── Types ──────────────────────────────────────────────────────────

interface SyncRequest {
  customerIds: string[];
  objects?: string[]; // Default: all — ['person','subscription','paymentRecord','creditDispute','enrollment','activity']
  dryRun?: boolean;
}

interface SyncResult {
  customerId: string;
  person?: { action: "created" | "updated"; twentyId: string };
  subscription?: { action: "created" | "updated"; twentyId: string };
  paymentRecords?: { created: number; updated: number; errors: number };
  creditDisputes?: { created: number; updated: number };
  enrollment?: { action: "created" | "updated"; twentyId: string };
  activities?: { created: number };
  error?: string;
}

interface SyncResponse {
  success: boolean;
  synced: number;
  created: number;
  updated: number;
  errors: number;
  results: SyncResult[];
  duration: number;
  timestamp: string;
}

// ── Auth ───────────────────────────────────────────────────────────

function validateAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const expectedToken = process.env.TWENTY_SYNC_API_KEY;
  if (!expectedToken) {
    console.error("[twenty-sync] TWENTY_SYNC_API_KEY not configured");
    return false;
  }
  return token === expectedToken;
}

// ── Twenty API Helpers ─────────────────────────────────────────────

const TWENTY_API_URL = process.env.TWENTY_API_URL || "https://crm.newleaf.financial";
const TWENTY_API_KEY = process.env.TWENTY_API_KEY;

async function twentyGraphQL(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(`${TWENTY_API_URL}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TWENTY_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twenty GraphQL error ${res.status}: ${body.slice(0, 500)}`);
  }

  return res.json();
}

// ── Person Sync ────────────────────────────────────────────────────

async function syncPerson(cp: Record<string, unknown>): Promise<{ action: "created" | "updated"; twentyId: string }> {
  const base44Id = cp.id as string;
  const email = cp.email as string;
  const firstName = (cp.firstName as string) || "Unknown";
  const lastName = (cp.lastName as string) || "Unknown";

  // Check if Person exists by base44Id
  const checkQuery = `
    query($base44Id: String!) {
      people(filter: { base44Id: { eq: $base44Id } }) {
        edges { node { id } }
      }
    }
  `;
  const checkResult = await twentyGraphQL(checkQuery, { base44Id });
  const existing = checkResult?.data?.people?.edges?.[0]?.node;

  if (existing) {
    // Update existing
    const updateMutation = `
      mutation($id: String!, $data: UpdatePersonInput!) {
        updatePerson(id: $id, data: $data) {
          id
        }
      }
    `;
    const updateResult = await twentyGraphQL(updateMutation, {
      id: existing.id,
      data: {
        name: { firstName, lastName },
        emails: email ? { primaryEmail: email } : undefined,
        phones: cp.phone ? { primaryPhoneNumber: String(cp.phone) } : undefined,
        status: cp.status ? String(cp.status).toUpperCase() : undefined,
        enrollmentStatus: cp.enrollmentStatus ? String(cp.enrollmentStatus).toUpperCase() : undefined,
        agentEmail: cp.agentEmail as string | undefined,
        engagementTier: cp.engagementTier ? String(cp.engagementTier).toUpperCase() : undefined,
        creditScore: cp.creditScore as number | undefined,
        negativeItemCount: cp.negativeItemCount as number | undefined,
      },
    });
    return { action: "updated", twentyId: updateResult?.data?.updatePerson?.id || existing.id };
  } else {
    // Create new Person
    const createMutation = `
      mutation($data: CreatePersonInput!) {
        createPerson(data: $data) {
          id
        }
      }
    `;
    const createResult = await twentyGraphQL(createMutation, {
      data: {
        name: { firstName, lastName },
        emails: email ? { primaryEmail: email } : undefined,
        phones: cp.phone ? { primaryPhoneNumber: String(cp.phone) } : undefined,
        base44Id,
        status: cp.status ? String(cp.status).toUpperCase() : "NEW",
        enrollmentStatus: cp.enrollmentStatus ? String(cp.enrollmentStatus).toUpperCase() : "NOT_ENROLLED",
        agentEmail: cp.agentEmail as string | undefined,
        engagementTier: cp.engagementTier ? String(cp.engagementTier).toUpperCase() : undefined,
        creditScore: cp.creditScore as number | undefined,
        negativeItemCount: cp.negativeItemCount as number | undefined,
        isTestProfile: cp.isTestProfile as boolean | undefined,
      },
    });
    return { action: "created", twentyId: createResult?.data?.createPerson?.id || "" };
  }
}

// ── Subscription Sync ──────────────────────────────────────────────

async function syncSubscription(
  cp: Record<string, unknown>,
  personTwentyId: string
): Promise<{ action: "created" | "updated"; twentyId: string } | null> {
  const nmiSubscriptionId = cp.nmiSubscriptionId as string | undefined;
  if (!nmiSubscriptionId) return null; // No subscription to sync

  const base44Id = cp.id as string;

  // Check if Subscription exists by nmiSubscriptionId
  const checkQuery = `
    query($nmiSubscriptionId: String!) {
      subscriptions(filter: { nmiSubscriptionId: { eq: $nmiSubscriptionId } }) {
        edges { node { id } }
      }
    }
  `;
  const checkResult = await twentyGraphQL(checkQuery, { nmiSubscriptionId });
  const existing = checkResult?.data?.subscriptions?.edges?.[0]?.node;

  if (existing) {
    return { action: "updated", twentyId: existing.id };
  } else {
    // Create Subscription
    const createMutation = `
      mutation($data: CreateSubscriptionInput!) {
        createSubscription(data: $data) {
          id
        }
      }
    `;
    const createResult = await twentyGraphQL(createMutation, {
      data: {
        name: `Sub ${nmiSubscriptionId}`,
        nmiSubscriptionId,
        nmiVaultId: cp.nmiVaultId as string | undefined,
        nmiBillingId: cp.nmiBillingId as string | undefined,
        paymentAmount: { amountMicros: ((cp.paymentAmount as number) || 0) * 1_000_000, currencyCode: "USD" },
        paymentFrequency: cp.paymentFrequency ? String(cp.paymentFrequency).toUpperCase() : undefined,
        billingStatus: cp.billingStatus ? String(cp.billingStatus).toUpperCase() : undefined,
        subscriptionHealth: cp.subscriptionHealth ? String(cp.subscriptionHealth).toUpperCase() : undefined,
        nextPaymentDate: cp.nextPaymentDate as string | undefined,
        consecutiveSuccessCount: cp.consecutiveSuccessCount as number | undefined,
        consecutiveDeclineCount: cp.consecutiveDeclineCount as number | undefined,
        base44Id,
        personId: personTwentyId,
      },
    });
    return { action: "created", twentyId: createResult?.data?.createSubscription?.id || "" };
  }
}

// ── PaymentRecord Sync ─────────────────────────────────────────────

async function syncPaymentRecords(
  cp: Record<string, unknown>,
  personTwentyId: string,
  subscriptionTwentyId?: string
): Promise<{ created: number; updated: number; errors: number }> {
  // PaymentLog records are fetched separately via Base44
  // This is a placeholder — full sync pulls PaymentLog[] for the customer
  // For foundation, we sync zero payment records and mark as pending
  try {
    // TODO Phase 29: Pull PaymentLog from Base44 and sync each one
    return { created: 0, updated: 0, errors: 0 };
  } catch (err) {
    return { created: 0, updated: 0, errors: 1 };
  }
}

// ── Main Handler ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const results: SyncResult[] = [];
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  // Auth check
  if (!validateAuth(req)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Parse request
  let body: SyncRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { customerIds, objects = ["person", "subscription"], dryRun = false } = body;

  if (!customerIds || customerIds.length === 0) {
    return NextResponse.json(
      { success: false, error: "customerIds array is required" },
      { status: 400 }
    );
  }

  // Process each customer
  for (const customerId of customerIds) {
    const result: SyncResult = { customerId };

    try {
      // Fetch Base44 CustomerProfile
      // In production, this calls Base44 API or database directly
      // For foundation, assume the caller passes all necessary data
      // Phase 29 will add direct Base44 querying here

      const base44Url = `${process.env.BASE44_API_URL || "http://localhost:3000"}/api/entity/CustomerProfile/${customerId}`;
      const cpRes = await fetch(base44Url, {
        headers: { Authorization: `Bearer ${process.env.BASE44_API_KEY || ""}` },
      });

      if (!cpRes.ok) {
        result.error = `Base44 fetch failed: ${cpRes.status}`;
        totalErrors++;
        results.push(result);
        continue;
      }

      const cp = await cpRes.json();

      if (dryRun) {
        result.person = { action: "created", twentyId: "dry-run" };
        results.push(result);
        continue;
      }

      // 1. Sync Person
      if (objects.includes("person")) {
        const personResult = await syncPerson(cp);
        result.person = personResult;
        if (personResult.action === "created") totalCreated++;
        else totalUpdated++;

        // 2. Sync Subscription
        if (objects.includes("subscription") && personResult.twentyId) {
          const subResult = await syncSubscription(cp, personResult.twentyId);
          if (subResult) {
            result.subscription = subResult;
            if (subResult.action === "created") totalCreated++;
            else totalUpdated++;

            // 3. Sync PaymentRecords
            if (objects.includes("paymentRecord")) {
              result.paymentRecords = await syncPaymentRecords(
                cp,
                personResult.twentyId,
                subResult.twentyId
              );
              totalCreated += result.paymentRecords.created;
              totalUpdated += result.paymentRecords.updated;
              totalErrors += result.paymentRecords.errors;
            }
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.error = message;
      totalErrors++;
      console.error(`[twenty-sync] Error syncing customer ${customerId}:`, message);
    }

    results.push(result);
  }

  const duration = Date.now() - startTime;

  const response: SyncResponse = {
    success: totalErrors === 0,
    synced: customerIds.length,
    created: totalCreated,
    updated: totalUpdated,
    errors: totalErrors,
    results,
    duration,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status: 200 });
}
