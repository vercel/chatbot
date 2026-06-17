/**
 * sync-base44-customer.ts
 *
 * Manual script to sync a single Base44 CustomerProfile to Twenty CRM.
 * Usage: pnpm tsx scripts/sync-base44-customer.ts <CustomerProfileID>
 *
 * Phase 27: FOUNDATION ONLY — test sync with 1 customer.
 * Phase 29: Full migration will build on this.
 *
 * NMI SACRED BOUNDARY (memory 6a1f118b):
 * - Card data NEVER transferred to Twenty
 * - Only last4 + paymentMethod type synced
 */

// ── Config ─────────────────────────────────────────────────────────

const TWENTY_API_URL = process.env.TWENTY_API_URL || "https://crm.newleaf.financial";
const TWENTY_API_KEY = process.env.TWENTY_API_KEY || "";
const BASE44_API_URL = process.env.BASE44_API_URL || "http://localhost:3000";
const BASE44_API_KEY = process.env.BASE44_API_KEY || "";

// ── Types ──────────────────────────────────────────────────────────

interface CustomerProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  enrollmentStatus: string;
  agentEmail: string;
  source: string;
  engagementTier: string;
  creditScore: number | null;
  negativeItemCount: number;
  unsecuredDebtAmount: number | null;
  annualIncome: number | null;
  debtToIncomeRatio: number | null;
  conversationSentiment: string;
  timezone: string;
  company: string;
  isTestProfile: boolean;
  disputeStatus: string;
  notes: string;
  nmiSubscriptionId: string | null;
  nmiVaultId: string | null;
  nmiBillingId: string | null;
  paymentAmount: number;
  paymentFrequency: string;
  billingStatus: string;
  subscriptionHealth: string;
  nextPaymentDate: string | null;
  consecutiveSuccessCount: number;
  consecutiveDeclineCount: number;
  lastDeclineCode: string | null;
  paymentMethod: string | null;
  paymentSourceType: string;
  vaultHealth: string;
  recoveryStatus: string;
  nmiDayZeroTransactionId: string | null;
}

interface SyncStep {
  step: string;
  status: "ok" | "error" | "skip";
  detail: string;
  twentyId?: string;
}

const steps: SyncStep[] = [];

function log(step: SyncStep) {
  steps.push(step);
  const icon = step.status === "ok" ? "✅" : step.status === "error" ? "❌" : "⏭️";
  console.log(`${icon} [${step.step}] ${step.detail}${step.twentyId ? ` (ID: ${step.twentyId})` : ""}`);
}

// ── Helpers ────────────────────────────────────────────────────────

async function fetchBase44Customer(customerId: string): Promise<CustomerProfile | null> {
  const url = `${BASE44_API_URL}/api/entity/CustomerProfile/${customerId}`;
  console.log(`\n📡 Fetching Base44 CustomerProfile: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${BASE44_API_KEY}` },
    });
    if (!res.ok) {
      log({ step: "fetch-base44", status: "error", detail: `HTTP ${res.status}: ${res.statusText}` });
      return null;
    }
    const cp = await res.json();
    log({ step: "fetch-base44", status: "ok", detail: `Found: ${cp.firstName} ${cp.lastName} (${cp.email})` });
    return cp as CustomerProfile;
  } catch (err) {
    log({ step: "fetch-base44", status: "error", detail: String(err) });
    return null;
  }
}

async function twentyGraphQL(query: string, variables?: Record<string, unknown>) {
  if (!TWENTY_API_KEY) {
    throw new Error("TWENTY_API_KEY not set — create key in Twenty Settings → API & Webhooks");
  }
  const res = await fetch(`${TWENTY_API_URL}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TWENTY_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) {
    const errs = body.errors?.map((e: { message: string }) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new Error(errs);
  }
  return body.data;
}

// ── Person Sync ────────────────────────────────────────────────────

async function syncPerson(cp: CustomerProfile): Promise<string> {
  // Check existing
  try {
    const data = await twentyGraphQL(
      `query($base44Id: String!) {
        people(filter: { base44Id: { eq: $base44Id } }) {
          edges { node { id } }
        }
      }`,
      { base44Id: cp.id }
    );
    const existing = data?.people?.edges?.[0]?.node;

    if (existing) {
      log({ step: "person-check", status: "ok", detail: `Already exists: ${existing.id}`, twentyId: existing.id });
      return existing.id;
    }
  } catch {
    // Person might not exist yet — proceed to create
  }

  // Create Person
  try {
    const data = await twentyGraphQL(
      `mutation($data: CreatePersonInput!) {
        createPerson(data: $data) {
          id
          name { firstName lastName }
        }
      }`,
      {
        data: {
          name: { firstName: cp.firstName || "Unknown", lastName: cp.lastName || "Unknown" },
          emails: cp.email ? { primaryEmail: cp.email } : undefined,
          phones: cp.phone ? { primaryPhoneNumber: cp.phone } : undefined,
          base44Id: cp.id,
          status: cp.status?.toUpperCase() || "NEW",
          enrollmentStatus: cp.enrollmentStatus?.toUpperCase() || "NOT_ENROLLED",
          agentEmail: cp.agentEmail || undefined,
          engagementTier: cp.engagementTier?.toUpperCase() || undefined,
          creditScore: cp.creditScore || undefined,
          negativeItemCount: cp.negativeItemCount || 0,
          isTestProfile: cp.isTestProfile || false,
        },
      }
    );

    const twentyId = data?.createPerson?.id;
    const displayName = `${cp.firstName} ${cp.lastName}`;
    log({ step: "person-create", status: "ok", detail: `Person created: ${displayName}`, twentyId });
    return twentyId;
  } catch (err) {
    log({ step: "person-create", status: "error", detail: String(err) });
    throw err;
  }
}

// ── Subscription Sync ──────────────────────────────────────────────

async function syncSubscription(cp: CustomerProfile, personTwentyId: string): Promise<string | null> {
  if (!cp.nmiSubscriptionId) {
    log({ step: "subscription", status: "skip", detail: "No NMI subscription ID — customer has no subscription" });
    return null;
  }

  // Check existing
  try {
    const data = await twentyGraphQL(
      `query($nmiSubId: String!) {
        subscriptions(filter: { nmiSubscriptionId: { eq: $nmiSubId } }) {
          edges { node { id } }
        }
      }`,
      { nmiSubId: cp.nmiSubscriptionId }
    );
    const existing = data?.subscriptions?.edges?.[0]?.node;
    if (existing) {
      log({ step: "subscription-check", status: "ok", detail: `Already exists: NMI ${cp.nmiSubscriptionId}`, twentyId: existing.id });
      return existing.id;
    }
  } catch {
    // Proceed to create
  }

  // Create Subscription
  try {
    // Amount handling — Twenty currency expects micros format
    const amountMicros = Math.round((cp.paymentAmount || 0) * 1_000_000);

    const data = await twentyGraphQL(
      `mutation($data: CreateSubscriptionInput!) {
        createSubscription(data: $data) {
          id
          nmiSubscriptionId
        }
      }`,
      {
        data: {
          name: `Sub ${cp.nmiSubscriptionId}`,
          nmiSubscriptionId: cp.nmiSubscriptionId,
          nmiVaultId: cp.nmiVaultId || undefined,
          nmiBillingId: cp.nmiBillingId || undefined,
          paymentAmount: { amountMicros, currencyCode: "USD" },
          paymentFrequency: cp.paymentFrequency?.toUpperCase() || undefined,
          billingStatus: cp.billingStatus?.toUpperCase() || undefined,
          subscriptionHealth: cp.subscriptionHealth?.toUpperCase() || undefined,
          nextPaymentDate: cp.nextPaymentDate || undefined,
          consecutiveSuccessCount: cp.consecutiveSuccessCount || 0,
          consecutiveDeclineCount: cp.consecutiveDeclineCount || 0,
          lastDeclineCode: cp.lastDeclineCode || undefined,
          base44Id: cp.id,
          personId: personTwentyId,
        },
      }
    );

    const twentyId = data?.createSubscription?.id;
    log({ step: "subscription-create", status: "ok", detail: `Subscription created: NMI ${cp.nmiSubscriptionId}`, twentyId });
    return twentyId;
  } catch (err) {
    log({ step: "subscription-create", status: "error", detail: String(err) });
    throw err;
  }
}

// ── CreditDispute Sync ─────────────────────────────────────────────

async function syncCreditDispute(cp: CustomerProfile, personTwentyId: string): Promise<void> {
  if (!cp.disputeStatus || cp.disputeStatus === "not_started") {
    log({ step: "credit-dispute", status: "skip", detail: "No active dispute" });
    return;
  }

  try {
    const data = await twentyGraphQL(
      `mutation($data: CreateCreditDisputeInput!) {
        createCreditDispute(data: $data) {
          id
        }
      }`,
      {
        data: {
          name: `Dispute Round ${1}`,
          roundNumber: 1,
          status: cp.disputeStatus?.toUpperCase() || "ACTIVE",
          negativeItemCount: cp.negativeItemCount || 0,
          personId: personTwentyId,
          base44CustomerId: cp.id,
        },
      }
    );

    const twentyId = data?.createCreditDispute?.id;
    log({ step: "credit-dispute-create", status: "ok", detail: `Dispute created`, twentyId });
  } catch (err) {
    log({ step: "credit-dispute-create", status: "error", detail: String(err) });
  }
}

// ── Activity Log Sync ──────────────────────────────────────────────

async function syncActivity(cp: CustomerProfile, personTwentyId: string): Promise<void> {
  try {
    const data = await twentyGraphQL(
      `mutation($data: CreateActivityInput!) {
        createActivity(data: $data) {
          id
        }
      }`,
      {
        data: {
          name: `Base44 Sync: ${cp.firstName} ${cp.lastName}`,
          activityType: "SYSTEM_EVENT",
          summary: `Initial sync from Base44 — Phase 27 foundation`,
          direction: "INTERNAL",
          occurredAt: new Date().toISOString(),
          personId: personTwentyId,
          source: "base44-sync",
          sourceId: cp.id,
        },
      }
    );

    const twentyId = data?.createActivity?.id;
    log({ step: "activity-create", status: "ok", detail: `Sync event logged`, twentyId });
  } catch (err) {
    log({ step: "activity-create", status: "error", detail: String(err) });
  }
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const customerId = process.argv[2];

  if (!customerId) {
    console.error("❌ Usage: pnpm tsx scripts/sync-base44-customer.ts <CustomerProfileID>");
    console.error("   Example: pnpm tsx scripts/sync-base44-customer.ts 6a2c65e58d7c7ec2b929603f");
    process.exit(1);
  }

  if (!TWENTY_API_KEY) {
    console.error("❌ TWENTY_API_KEY environment variable not set.");
    console.error("   Create an API key in Twenty Settings → API & Webhooks first.");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════");
  console.log("  Base44 → Twenty CRM Sync (Phase 27)");
  console.log(`  Customer: ${customerId}`);
  console.log(`  Twenty API: ${TWENTY_API_URL}`);
  console.log(`  NMI Sacred Boundary: ENFORCED`);
  console.log("═══════════════════════════════════════════");

  // 1. Fetch Base44 customer
  const cp = await fetchBase44Customer(customerId);
  if (!cp) {
    console.error("\n❌ Failed to fetch Base44 customer. Aborting.");
    process.exit(1);
  }

  // 2. Sync Person
  console.log("\n── Phase 1/4: Person ──");
  const personTwentyId = await syncPerson(cp);

  // 3. Sync Subscription
  console.log("\n── Phase 2/4: Subscription ──");
  const subscriptionTwentyId = await syncSubscription(cp, personTwentyId);

  // 4. Sync CreditDispute
  console.log("\n── Phase 3/4: Credit Dispute ──");
  await syncCreditDispute(cp, personTwentyId);

  // 5. Log Activity
  console.log("\n── Phase 4/4: Activity ──");
  await syncActivity(cp, personTwentyId);

  // Summary
  console.log("\n═══════════════════════════════════════════");
  console.log("  Sync Complete");
  console.log(`  Person: ${personTwentyId || "FAILED"}`);
  console.log(`  Subscription: ${subscriptionTwentyId || "N/A (no sub)"}`);
  console.log(`  Steps: ${steps.length} total`);
  console.log("═══════════════════════════════════════════");

  // Output full log
  console.log("\n📋 Detailed Steps:");
  steps.forEach((s, i) => {
    const icon = s.status === "ok" ? "  ✅" : s.status === "error" ? "  ❌" : "  ⏭️";
    console.log(`${icon} ${i + 1}. ${s.step}: ${s.detail}${s.twentyId ? ` [${s.twentyId}]` : ""}`);
  });
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
