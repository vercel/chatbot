#!/usr/bin/env npx tsx
/**
 * U2.7.A — Secrets Audit Scanner
 *
 * Scans three environments for secrets:
 *   1. Vercel Chat project (prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl)
 *   2. Vercel V2 project  (prj_lEoqz6p4zgdrLlObPl845TI2ApOm)
 *   3. VPS /etc/newleaf/.env
 *
 * Produces:
 *   - functions/secrets-inventory.json: masked listing with per-env presence
 *   - Drift report: keys present on Chat but missing on V2, stale values
 *
 * Cardinal: 6a273f70 — MUST use Vercel REST API.
 * Safety: ALL values masked (first 4 + last 4 chars only).
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ─── Constants ─────────────────────────────────────────────────────────────────

const VERCEL_CHAT_PROJECT = "prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl";
const VERCEL_V2_PROJECT = "prj_lEoqz6p4zgdrLlObPl845TI2ApOm";
const VPS_DOTENV_PATH = "/etc/newleaf/.env";
const OUTPUT_INVENTORY =
  path.resolve(__dirname, "../functions/secrets-inventory.json");

// ─── Types ────────────────────────────────────────────────────────────────────

interface VercelEnvVar {
  type: "encrypted" | "plain" | "secret" | "system";
  key: string;
  value: string | null;
  target: string[];
  id: string;
  createdAt: number;
  updatedAt: number;
}

interface VercelEnvResponse {
  envs: VercelEnvVar[];
}

interface MaskedSecret {
  envKey: string;
  category: string;
  maskedValue: string | null;
  vercelChat: "present" | "missing" | "placeholder";
  vercelV2: "present" | "missing" | "placeholder";
  vpsDotenv: "present" | "missing" | "placeholder";
  vercelChatType: "encrypted" | "plain" | "secret" | "system" | null;
  vercelV2Type: "encrypted" | "plain" | "secret" | "system" | null;
  syncStatus: "synced" | "drift_chat_only" | "drift_v2_only" | "drift_value" | "vps_only" | "unset_all";
  driftDetail: string | null;
  rotationDue: string;
  notes: string;
}

interface SecretsInventory {
  generatedAt: string;
  scannerVersion: string;
  projects: {
    chat: { id: string; envCount: number };
    v2: { id: string; envCount: number };
    vps: { path: string; envCount: number };
  };
  summary: {
    totalUniqueKeys: number;
    synced: number;
    driftChatOnly: number;
    driftV2Only: number;
    driftValue: number;
    vpsOnly: number;
    unsetAll: number;
  };
  secrets: MaskedSecret[];
  driftReport: {
    chatOnly: string[];
    v2Only: string[];
    valueMismatches: { key: string; chatMasked: string; v2Masked: string }[];
    unsetPlaceholders: string[];
  };
}

// ─── Masking ──────────────────────────────────────────────────────────────────

function maskValue(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("PENDING_") || value === "PENDING_user_not_yet_provided") {
    return "PENDING";
  }
  if (value.length <= 8) return value.slice(0, 2) + "****" + value.slice(-2);
  return value.slice(0, 4) + "****" + value.slice(-4);
}

function isPlaceholder(value: string | null): boolean {
  if (!value) return true;
  const lower = value.toLowerCase();
  return (
    lower.startsWith("pending") ||
    lower === "" ||
    lower === "stub_awaiting" ||
    lower.includes("<") ||
    lower.includes("placeholder")
  );
}

// ─── Vercel API ────────────────────────────────────────────────────────────────

async function fetchVercelEnv(projectId: string): Promise<VercelEnvVar[]> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.error("[audit-secrets] ⚠️  VERCEL_TOKEN not set — cannot query Vercel API.");
    console.error("  Set it via: export VERCEL_TOKEN=$(grep VERCEL_TOKEN /etc/newleaf/.env | cut -d= -f2)");
    return [];
  }

  const url = `https://api.vercel.com/v9/projects/${projectId}/env`;
  console.error(`[audit-secrets] Fetching ${projectId}...`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(
        `[audit-secrets] ❌ Vercel API returned ${res.status} for ${projectId}: ${res.statusText}`
      );
      return [];
    }

    const data: VercelEnvResponse = await res.json();
    console.error(
      `[audit-secrets] ✅ Fetched ${data.envs.length} env vars from ${projectId}`
    );
    return data.envs;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[audit-secrets] ❌ Failed to fetch ${projectId}: ${msg}`);
    return [];
  }
}

// ─── VPS .env Parser ──────────────────────────────────────────────────────────

function parseVpsDotenv(): Record<string, string> {
  const result: Record<string, string> = {};

  try {
    const raw = fs.readFileSync(VPS_DOTENV_PATH, "utf-8");
    const lines = raw.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith("#")) continue;
      // Match KEY=value or KEY="value" or KEY='value'
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;

      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();

      // Unwrap quotes
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }

      result[key] = val;
    }
  } catch (err) {
    console.error(
      `[audit-secrets] ⚠️  Could not read ${VPS_DOTENV_PATH}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return result;
}

// ─── Category inference ───────────────────────────────────────────────────────

const CATEGORY_PATTERNS: [RegExp, string][] = [
  [/^(SLACK_|JARVIS_ADMIN|NEWLEAF_ADMIN)/, "slack"],
  [/^NMI_/, "nmi"],
  [/^HYPERSWITCH_/, "hyperswitch"],
  [/^BASE44_/, "base44"],
  [/^VERCEL_/, "vercel"],
  [/^GITHUB_/, "github"],
  [/^(VPS_|HOSTINGER_|NEPTUNE_INTERNAL)/, "vps"],
  [/^(OPENAI_|ANTHROPIC_|DEEPSEEK_|AI_GATEWAY_|GOOGLE_|XAI_|GROQ_|KIMI_)/, "ai_providers"],
  [/^(NEXT_PUBLIC_CLERK_|CLERK_)/, "clerk"],
  [/^(POSTGRES_|REDIS_|AUTH_SECRET|BETTER_AUTH|BLOB_|DIAGNOSTICS_|IS_DEMO)/, "infrastructure"],
  [/^(NEPTUNE_V2_|OPEN_AGENTS|NEPTUNE_TEST)/, "neptune_v2"],
  [/^E2B_/, "e2b"],
  [/^(RESEND_|LINEAR_|FORTH_|VAPI_|GHL_|AFFY_)/, "connectors"],
  [/^(TWENTY_|N8N_|SMITHERY_|GODADDY_|TWENTYFIRST_|OLLAMA_|JDI_|SWAMI_)/, "other_services"],
  [/^(HERMES_|APP_BASE)/, "internal"],
  [/^WEBHOOK_/, "webhooks"],
  [/^NEXT_PUBLIC_/, "frontend"],
];

function inferCategory(key: string): string {
  for (const [pattern, cat] of CATEGORY_PATTERNS) {
    if (pattern.test(key)) return cat;
  }
  return "uncategorized";
}

// ─── Main Audit Logic ─────────────────────────────────────────────────────────

async function main() {
  console.error("\n🔍 U2.7.A Secrets Audit Scanner\n");

  // 1. Set VERCEL_TOKEN if not already in env
  if (!process.env.VERCEL_TOKEN) {
    const vpsEnv = parseVpsDotenv();
    const token = vpsEnv["VERCEL_TOKEN"];
    if (token) {
      process.env.VERCEL_TOKEN = token;
      console.error("[audit-secrets] Loaded VERCEL_TOKEN from VPS .env");
    }
  }

  // 2. Fetch both Vercel environments
  const [chatEnv, v2Env] = await Promise.all([
    fetchVercelEnv(VERCEL_CHAT_PROJECT),
    fetchVercelEnv(VERCEL_V2_PROJECT),
  ]);

  // 3. Parse VPS .env
  const vpsEnv = parseVpsDotenv();
  console.error(`[audit-secrets] Parsed ${Object.keys(vpsEnv).length} keys from VPS ${VPS_DOTENV_PATH}`);

  // 4. Build lookup maps
  const chatMap = new Map<string, VercelEnvVar>();
  for (const v of chatEnv) chatMap.set(v.key, v);

  const v2Map = new Map<string, VercelEnvVar>();
  for (const v of v2Env) v2Map.set(v.key, v);

  // 5. Collect all unique keys
  const allKeys = new Set<string>();
  for (const k of chatMap.keys()) allKeys.add(k);
  for (const k of v2Map.keys()) allKeys.add(k);
  for (const k of Object.keys(vpsEnv)) allKeys.add(k);

  // 6. Build masked inventory
  const secrets: MaskedSecret[] = [];
  const chatOnly: string[] = [];
  const v2Only: string[] = [];
  const valueMismatches: { key: string; chatMasked: string; v2Masked: string }[] = [];
  const unsetPlaceholders: string[] = [];

  for (const key of [...allKeys].sort()) {
    const chatVar = chatMap.get(key);
    const v2Var = v2Map.get(key);
    const vpsVal = vpsEnv[key];

    const chatVal = chatVar?.value ?? null;
    const v2Val = v2Var?.value ?? null;

    const chatMasked = maskValue(chatVal);
    const v2Masked = maskValue(v2Val);
    const vpsMasked = vpsVal ? maskValue(vpsVal) : null;

    // Determine presence
    const chatPresent = chatVar ? (isPlaceholder(chatVal) ? "placeholder" : "present") : "missing";
    const v2Present = v2Var ? (isPlaceholder(v2Val) ? "placeholder" : "present") : "missing";
    const vpsPresent = vpsVal !== undefined ? (isPlaceholder(vpsVal) ? "placeholder" : "present") : "missing";

    // Determine sync status
    let syncStatus: MaskedSecret["syncStatus"] = "unset_all";
    let driftDetail: string | null = null;

    if (chatPresent === "present" && v2Present === "present") {
      // Both encrypted on Vercel → can't compare ciphertext (per-project encryption keys differ)
      // Only compare if BOTH are plain text; otherwise treat as "encrypted_synced"
      if (chatVar?.type === "encrypted" || v2Var?.type === "encrypted") {
        // Can't compare encrypted values — mark as synced if both present
        // unless one is plain and the other encrypted (genuine mismatch)
        if (chatVar?.type === v2Var?.type) {
          syncStatus = "synced";
        } else {
          syncStatus = "drift_value";
          driftDetail = `Type mismatch: Chat=${chatVar?.type} vs V2=${v2Var?.type}`;
          valueMismatches.push({ key, chatMasked: chatMasked ?? "null", v2Masked: v2Masked ?? "null" });
        }
      } else if (chatVal === v2Val) {
        syncStatus = "synced";
      } else {
        syncStatus = "drift_value";
        driftDetail = `Chat="${chatMasked}" vs V2="${v2Masked}"`;
        valueMismatches.push({ key, chatMasked: chatMasked ?? "null", v2Masked: v2Masked ?? "null" });
      }
    } else if (chatPresent === "present" && v2Present === "missing") {
      syncStatus = "drift_chat_only";
      driftDetail = "Present in Chat but missing from V2";
      chatOnly.push(key);
    } else if (chatPresent === "missing" && v2Present === "present") {
      syncStatus = "drift_v2_only";
      driftDetail = "Present in V2 but missing from Chat";
      v2Only.push(key);
    } else if (chatPresent === "missing" && v2Present === "missing" && vpsPresent === "present") {
      syncStatus = "vps_only";
      driftDetail = "Only present in VPS .env — not in any Vercel env";
    }

    if (chatPresent === "placeholder" || v2Present === "placeholder" || vpsPresent === "placeholder") {
      unsetPlaceholders.push(key);
      if (syncStatus === "synced") syncStatus = "unset_all";
    }

    // Estimate rotation
    const rotationDue = estimateRotation(key, chatVar, v2Var);

    secrets.push({
      envKey: key,
      category: inferCategory(key),
      maskedValue: chatMasked ?? v2Masked ?? vpsMasked ?? null,
      vercelChat: chatPresent,
      vercelV2: v2Present,
      vpsDotenv: vpsPresent,
      vercelChatType: chatVar?.type ?? null,
      vercelV2Type: v2Var?.type ?? null,
      syncStatus,
      driftDetail,
      rotationDue,
      notes: "",
    });
  }

  // 7. Compute summary
  const summary = {
    totalUniqueKeys: secrets.length,
    synced: secrets.filter((s) => s.syncStatus === "synced").length,
    driftChatOnly: secrets.filter((s) => s.syncStatus === "drift_chat_only").length,
    driftV2Only: secrets.filter((s) => s.syncStatus === "drift_v2_only").length,
    driftValue: secrets.filter((s) => s.syncStatus === "drift_value").length,
    vpsOnly: secrets.filter((s) => s.syncStatus === "vps_only").length,
    unsetAll: secrets.filter((s) => s.syncStatus === "unset_all").length,
  };

  // 8. Build final output
  const inventory: SecretsInventory = {
    generatedAt: new Date().toISOString(),
    scannerVersion: "U2.7.A-v1.0",
    projects: {
      chat: { id: VERCEL_CHAT_PROJECT, envCount: chatEnv.length },
      v2: { id: VERCEL_V2_PROJECT, envCount: v2Env.length },
      vps: { path: VPS_DOTENV_PATH, envCount: Object.keys(vpsEnv).length },
    },
    summary,
    secrets,
    driftReport: {
      chatOnly,
      v2Only,
      valueMismatches,
      unsetPlaceholders,
    },
  };

  // 9. Write output
  const outputDir = path.dirname(OUTPUT_INVENTORY);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_INVENTORY, JSON.stringify(inventory, null, 2), "utf-8");
  console.error(`\n✅ Inventory written to ${OUTPUT_INVENTORY}`);
  console.error(`   ${summary.totalUniqueKeys} unique keys across 3 environments`);
  console.error(`   ${summary.synced} synced | ${summary.driftChatOnly} chat-only | ${summary.driftV2Only} v2-only`);
  console.error(`   ${summary.driftValue} value mismatches | ${summary.vpsOnly} vps-only | ${summary.unsetAll} unset\n`);

  // 10. Print drift report to stdout for commit message
  if (valueMismatches.length > 0) {
    console.error("🔴 VALUE MISMATCHES:");
    for (const m of valueMismatches) {
      console.error(`   ${m.key}: Chat=${m.chatMasked} vs V2=${m.v2Masked}`);
    }
  }
  if (chatOnly.length > 0) {
    console.error(`🟡 CHAT-ONLY (${chatOnly.length}): ${chatOnly.join(", ")}`);
  }
  if (v2Only.length > 0) {
    console.error(`🟡 V2-ONLY (${v2Only.length}): ${v2Only.join(", ")}`);
  }

  // Output just the JSON path for programmatic use
  console.log(OUTPUT_INVENTORY);
}

function estimateRotation(
  _key: string,
  _chatVar: VercelEnvVar | undefined,
  _v2Var: VercelEnvVar | undefined
): string {
  // Use the later of the two timestamps
  const chatTs = _chatVar?.updatedAt ?? 0;
  const v2Ts = _v2Var?.updatedAt ?? 0;
  const latestTs = Math.max(chatTs, v2Ts);

  if (!latestTs) return "unknown";

  const lastUpdate = new Date(latestTs);
  const now = new Date();
  const ageDays = Math.floor(
    (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (ageDays > 90) return "⚠️ overdue (>90d)";
  if (ageDays > 60) return "due soon (>60d)";
  return "ok (<60d)";
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
