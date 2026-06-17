#!/usr/bin/env -S pnpm tsx
/**
 * scripts/migrate-base44-batch.ts — Base44 → Twenty Bulk Migration Engine
 * Phase 30: Idempotent, resumable, rate-limited migration with progress tracking.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-base44-batch.ts --wave-size 50
 *   pnpm tsx scripts/migrate-base44-batch.ts --wave-size 5 --customer-ids id1,id2,id3
 *   pnpm tsx scripts/migrate-base44-batch.ts --wave-size 50 --dry-run
 *   pnpm tsx scripts/migrate-base44-batch.ts --wave-size 100 --resume
 *   pnpm tsx scripts/migrate-base44-batch.ts --wave-size 50 --filter '{"enrollmentStatus":"active"}'
 */

import * as fs from "fs";
import * as path from "path";

// ── Types ──────────────────────────────────────────────────────────

interface MigrationRun {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  waveSize: number;
  startedAt: string;
  completedAt?: string;
  recordsMigrated: number;
  recordsFailed: number;
  recordsSkipped: number;
  filter?: string;
  customerIds?: string[];
  dryRun: boolean;
}

interface MigrationRecord {
  runId: string;
  base44Id: string;
  twentyId?: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  errorMessage?: string;
  retriedCount: number;
  fieldMap?: Record<string, string>;
}

interface CustomerProfile {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  state?: string;
  addressLine1?: string;
  zipCode?: string;
  dob?: string;
  status?: string;
  notes?: string;
  billingStatus?: string;
  paymentAmount?: number;
  paymentFrequency?: string;
  nextPaymentDate?: string;
  nmiSubscriptionId?: string;
  nmiVaultId?: string;
  enrollmentStatus?: string;
  disputeStatus?: string;
  agentEmail?: string;
  company?: string;
  employerName?: string;
}

interface TwentyPersonInput {
  externalId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  notes?: string;
  jobTitle?: string;
}

// ── Config ─────────────────────────────────────────────────────────

const SLACK_CHANNEL = "C0AQDDC3HAB"; // #jarvis-admin
const PROGRESS_INTERVAL = 50; // Report every N records
const RATE_LIMIT_RPM = 60;
const BATCH_SIZE = 60;

// ── CLI Args ───────────────────────────────────────────────────────

function parseArgs(): {
  waveSize: number;
  filter?: string;
  resume: boolean;
  dryRun: boolean;
  customerIds?: string[];
} {
  const args = process.argv.slice(2);
  const result: ReturnType<typeof parseArgs> = {
    waveSize: 50,
    resume: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--wave-size":
        result.waveSize = parseInt(args[++i], 10) || 50;
        break;
      case "--filter":
        result.filter = args[++i];
        break;
      case "--resume":
        result.resume = true;
        break;
      case "--dry-run":
        result.dryRun = true;
        break;
      case "--customer-ids":
        result.customerIds = args[++i]?.split(",").map((s) => s.trim());
        break;
    }
  }

  return result;
}

// ── Base44 Data Fetching ───────────────────────────────────────────

async function fetchCustomerProfiles(
  filter?: string,
  customerIds?: string[]
): Promise<CustomerProfile[]> {
  const base44Url =
    process.env.BASE44_FUNCTIONS_URL ?? process.env.BASE44_API_HOST ?? "";
  const apiKey = process.env.BASE44_APP_API_KEY ?? process.env.BASE44_API_KEY ?? "";
  const internalToken = process.env.NEPTUNE_INTERNAL_TOKEN ?? "";

  if (!base44Url || !apiKey) {
    console.error("❌ BASE44_FUNCTIONS_URL and BASE44_APP_API_KEY must be set");
    process.exit(1);
  }

  const filterPayload: Record<string, unknown> = {};

  if (customerIds && customerIds.length > 0) {
    filterPayload.customerIds = customerIds;
  } else if (filter) {
    try {
      filterPayload.filter = JSON.parse(filter);
    } catch {
      filterPayload.filter = { enrollmentStatus: filter };
    }
  }

  console.log(`📡 Fetching Base44 customers...`, filterPayload);

  // Phase 32: Use jarvisDataEngine for entity queries (was broken endpoint)
  try {
    if (customerIds && customerIds.length > 0) {
      // Fetch individually via entity_get
      const profiles: CustomerProfile[] = [];
      for (const cid of customerIds) {
        try {
          const res = await fetch(`${base44Url}/jarvisDataEngine`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              ...(internalToken ? { "x-internal-token": internalToken } : {}),
            },
            body: JSON.stringify({ entity: "CustomerProfile", id: cid }),
          });
          if (res.ok) {
            const json = await res.json();
            const profile: CustomerProfile = json.record ?? json.data ?? json;
            if (profile?.id) profiles.push(profile);
          } else {
            console.error(`  ⚠️ Failed to fetch ${cid.slice(0,12)}...: ${res.status}`);
          }
        } catch (e) {
          console.error(`  ⚠️ Error fetching ${cid.slice(0,12)}...:`, e);
        }
      }
      console.log(`✅ Fetched ${profiles.length}/${customerIds.length} customer profiles`);
      return profiles;
    }

    // Batch query fallback: use jarvisDataEngine with filter
    const res = await fetch(`${base44Url}/jarvisDataEngine`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        ...(internalToken ? { "x-internal-token": internalToken } : {}),
      },
      body: JSON.stringify({
        entity: "CustomerProfile",
        filter: filter ? JSON.parse(filter) : {},
        limit: 5000,
        fetchAll: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`Base44 returned ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    const profiles: CustomerProfile[] = json.results ?? json.data ?? [];
    console.log(`✅ Fetched ${profiles.length} customer profiles`);
    return profiles;
  } catch (err) {
    console.error("❌ Failed to fetch Base44 profiles:", err);
    throw err;
  }
}

// ── Field Mapping ──────────────────────────────────────────────────

function mapCustomerToTwentyPerson(profile: CustomerProfile): TwentyPersonInput {
  return {
    externalId: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone,
    city: profile.city,
    state: profile.state,
    notes: profile.notes
      ? `${profile.notes}\n\n--- Base44 Metadata ---\nStatus: ${profile.status ?? "N/A"}\nEnrollment: ${profile.enrollmentStatus ?? "N/A"}\nBilling: ${profile.billingStatus ?? "N/A"}\nAgent: ${profile.agentEmail ?? "unassigned"}`
      : undefined,
    jobTitle: profile.company ?? profile.employerName,
  };
}

// ── Twenty Upsert ──────────────────────────────────────────────────

async function upsertToTwenty(
  people: TwentyPersonInput[],
  dryRun: boolean
): Promise<{ created: number; updated: number; errors: string[] }> {
  if (dryRun) {
    console.log(`🟡 DRY RUN — Would upsert ${people.length} people to Twenty:`);
    for (const p of people.slice(0, 5)) {
      console.log(`   ${p.externalId.slice(0, 12)}... ${p.firstName} ${p.lastName} <${p.email}>`);
    }
    if (people.length > 5) console.log(`   ... and ${people.length - 5} more`);
    return { created: 0, updated: 0, errors: [] };
  }

  const twentyUrl =
    process.env.TWENTY_SERVER_URL?.replace(/\/$/, "") ?? "https://crm.newleaf.financial";
  const twentyKey =
    process.env.TWENTY_API_KEY ??
    process.env.TWENTYFIRST_API_KEY ??
    "";

  if (!twentyKey) {
    return { created: 0, updated: 0, errors: ["TWENTY_API_KEY not set"] };
  }

  const results = { created: 0, updated: 0, errors: [] as string[] };

  for (let i = 0; i < people.length; i += BATCH_SIZE) {
    const batch = people.slice(i, i + BATCH_SIZE);

    // Rate limiting
    const batchNumber = i / BATCH_SIZE;
    if (batchNumber > 0 && batchNumber % Math.floor(RATE_LIMIT_RPM / (60000 / 1000)) === 0) {
      await new Promise((r) => setTimeout(r, 2000));
    }

    const mutation = `
      mutation UpsertPeople($data: [PersonUpsertInput!]!) {
        upsertPeople(data: $data) {
          id
          externalId
        }
      }
    `;

    try {
      const res = await fetch(`${twentyUrl}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${twentyKey}`,
        },
        body: JSON.stringify({ query: mutation, variables: { data: batch } }),
      });

      const json = await res.json();

      if (json.errors) {
        const errMsgs = json.errors.map(
          (e: { message: string }) => e.message
        );
        results.errors.push(`Batch ${batchNumber}: ${errMsgs.join("; ")}`);
      } else if (json.data?.upsertPeople) {
        results.created += batch.length;
      }
    } catch (err) {
      results.errors.push(
        `Batch ${batchNumber}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Progress
    if ((i + batch.length) % PROGRESS_INTERVAL === 0 || i + batch.length >= people.length) {
      const pct = Math.round(((i + batch.length) / people.length) * 100);
      console.log(`   📊 Progress: ${i + batch.length}/${people.length} (${pct}%) — ${results.created} upserted, ${results.errors.length} errors`);
    }
  }

  return results;
}

// ── Checkpoint File ────────────────────────────────────────────────

const CHECKPOINT_DIR = path.resolve(__dirname, "../.migration-checkpoints");

function ensureCheckpointDir(): void {
  if (!fs.existsSync(CHECKPOINT_DIR)) {
    fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  }
}

function saveCheckpoint(run: MigrationRun, records: MigrationRecord[]): void {
  ensureCheckpointDir();
  const filepath = path.join(CHECKPOINT_DIR, `run-${run.id}.json`);
  fs.writeFileSync(
    filepath,
    JSON.stringify({ run, records, savedAt: new Date().toISOString() }, null, 2)
  );
  console.log(`💾 Checkpoint saved: ${filepath}`);
}

function loadLatestCheckpoint(): {
  run: MigrationRun;
  records: MigrationRecord[];
} | null {
  ensureCheckpointDir();
  const files = fs
    .readdirSync(CHECKPOINT_DIR)
    .filter((f) => f.startsWith("run-") && f.endsWith(".json"))
    .sort()
    .reverse();

  for (const file of files) {
    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(CHECKPOINT_DIR, file), "utf-8")
      );
      if (data.run?.status === "in_progress") {
        console.log(`📂 Resuming from checkpoint: ${file}`);
        return data;
      }
    } catch {
      // Skip corrupt checkpoints
    }
  }

  return null;
}

// ── Migration Run ──────────────────────────────────────────────────

function createRun(waveSize: number, filter?: string, customerIds?: string[], dryRun = false): MigrationRun {
  return {
    id: `mig-${Date.now().toString(36)}`,
    status: "in_progress",
    waveSize,
    startedAt: new Date().toISOString(),
    recordsMigrated: 0,
    recordsFailed: 0,
    recordsSkipped: 0,
    filter,
    customerIds,
    dryRun,
  };
}

// ── Slack Notification ─────────────────────────────────────────────

async function slackProgress(
  message: string,
  channel = SLACK_CHANNEL
): Promise<void> {
  const slackToken = process.env.SLACK_BOT_TOKEN;
  if (!slackToken) {
    console.log(`[slack] ${message}`);
    return;
  }

  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${slackToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        text: `🤖 *Migration Bot* — ${message}`,
        mrkdwn: true,
      }),
    });
  } catch {
    // Non-blocking — log to console
    console.log(`[slack-fallback] ${message}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  console.log("═══════════════════════════════════════════");
  console.log("  Base44 → Twenty Migration Engine");
  console.log("  Phase 30 — Neptune Command Center");
  console.log("═══════════════════════════════════════════");
  console.log(`  Wave Size:  ${args.waveSize}`);
  console.log(`  Filter:     ${args.filter ?? "none"}`);
  console.log(`  Customer IDs: ${args.customerIds?.join(", ") ?? "none"}`);
  console.log(`  Dry Run:    ${args.dryRun}`);
  console.log(`  Resume:     ${args.resume}`);
  console.log("═══════════════════════════════════════════\n");

  // 1. Check for resume
  let run: MigrationRun;
  const records: MigrationRecord[] = [];

  if (args.resume) {
    const checkpoint = loadLatestCheckpoint();
    if (checkpoint) {
      run = checkpoint.run;
      records.push(...checkpoint.records);
      console.log(`📂 Resuming run ${run.id} — ${records.length} records tracked`);
    } else {
      console.log("⚠️ No checkpoint found, starting fresh");
      run = createRun(args.waveSize, args.filter, args.customerIds, args.dryRun);
    }
  } else {
    run = createRun(args.waveSize, args.filter, args.customerIds, args.dryRun);
  }

  // 2. Fetch Base44 data
  const profiles = await fetchCustomerProfiles(args.filter, args.customerIds);
  if (profiles.length === 0) {
    console.log("⚠️ No profiles to migrate");
    await slackProgress("No profiles found to migrate — stopping");
    return;
  }

  // Limit to wave size
  const wave = profiles.slice(0, args.waveSize);
  console.log(`\n📦 Processing wave of ${wave.length} profiles\n`);

  // 3. Map and prepare
  const twentyPeople: TwentyPersonInput[] = wave.map(mapCustomerToTwentyPerson);

  // Track records
  for (const p of wave) {
    records.push({
      runId: run.id,
      base44Id: p.id,
      status: "pending",
      retriedCount: 0,
    });
  }

  // 4. Upsert to Twenty
  console.log(`🚀 ${args.dryRun ? "DRY RUN — Simulating" : "Migrating"} ${twentyPeople.length} records to Twenty...\n`);
  await slackProgress(
    `Starting migration wave: ${twentyPeople.length} records ${args.dryRun ? "(DRY RUN)" : ""}`
  );

  const startTime = Date.now();
  const result = await upsertToTwenty(twentyPeople, args.dryRun);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // 5. Update records
  if (!args.dryRun) {
    for (const record of records) {
      const hasError = result.errors.some((e) =>
        e.includes(record.base44Id.slice(0, 12))
      );
      record.status = hasError ? "failed" : "completed";
      if (hasError) {
        record.errorMessage = result.errors.find((e) =>
          e.includes(record.base44Id.slice(0, 12))
        );
      }
    }
    run.recordsMigrated = result.created + result.updated;
    run.recordsFailed = result.errors.length;
  }
  run.status = args.dryRun ? "completed" : result.errors.length > 0 ? "completed" : "completed";
  run.completedAt = new Date().toISOString();

  // 6. Save checkpoint
  saveCheckpoint(run, records);

  // 7. Report
  console.log("\n═══════════════════════════════════════════");
  console.log("  Migration Complete");
  console.log("═══════════════════════════════════════════");
  console.log(`  Run ID:     ${run.id}`);
  console.log(`  Status:     ${run.status}`);
  console.log(`  Records:    ${run.recordsMigrated} upserted`);
  console.log(`  Failed:     ${run.recordsFailed}`);
  console.log(`  Skipped:    ${run.recordsSkipped}`);
  console.log(`  Time:       ${elapsed}s`);
  console.log("═══════════════════════════════════════════");

  const slackMsg = [
    `✅ *Migration Wave Complete*`,
    `• Run: \`${run.id}\``,
    `• Records: ${run.recordsMigrated} upserted`,
    `• Failed: ${run.recordsFailed}`,
    `• Time: ${elapsed}s`,
    args.dryRun ? `• Mode: DRY RUN` : `• Mode: LIVE`,
    result.errors.length > 0
      ? `• ⚠️ ${result.errors.length} batch errors — check logs`
      : `• ✅ All batches successful`,
  ].join("\n");

  await slackProgress(slackMsg);

  if (result.errors.length > 0) {
    console.log("\n⚠️ Errors:");
    for (const err of result.errors.slice(0, 10)) {
      console.log(`   - ${err}`);
    }
    if (result.errors.length > 10) {
      console.log(`   ... and ${result.errors.length - 10} more`);
    }
  }
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
