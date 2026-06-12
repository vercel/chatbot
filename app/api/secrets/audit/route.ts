/**
 * GET /api/secrets/audit — U2.7.A Drift Report
 *
 * Returns the secrets inventory with drift analysis.
 * Admin-only: requires authenticated session (regular user, not guest).
 * Falls back to internal token check for programmatic access.
 *
 * Query params:
 *   ?refresh=true  — re-run the scanner before returning (default: cached JSON)
 *   ?format=drift  — return only drift items (default: full inventory)
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const INVENTORY_PATH = join(
  process.cwd(),
  "functions",
  "secrets-inventory.json"
);

// ── Types ────────────────────────────────────────────────────────────────────

interface MaskedSecret {
  envKey: string;
  category: string;
  maskedValue: string | null;
  vercelChat: "present" | "missing" | "placeholder";
  vercelV2: "present" | "missing" | "placeholder";
  vpsDotenv: "present" | "missing" | "placeholder";
  vercelChatType: string | null;
  vercelV2Type: string | null;
  syncStatus:
    | "synced"
    | "drift_chat_only"
    | "drift_v2_only"
    | "drift_value"
    | "vps_only"
    | "unset_all";
  driftDetail: string | null;
  rotationDue: string;
  notes: string;
}

interface DriftReport {
  chatOnly: string[];
  v2Only: string[];
  valueMismatches: { key: string; chatMasked: string; v2Masked: string }[];
  unsetPlaceholders: string[];
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
  driftReport: DriftReport;
}

// ── Auth Check ────────────────────────────────────────────────────────────────

async function isAuthorized(request: NextRequest): Promise<boolean> {
  // Check 1: Internal token for programmatic access
  const internalToken =
    request.headers.get("x-neptune-internal-token") ??
    request.nextUrl.searchParams.get("token");

  if (internalToken && process.env.NEPTUNE_INTERNAL_TOKEN) {
    return internalToken === process.env.NEPTUNE_INTERNAL_TOKEN;
  }

  // Check 2: NextAuth session cookie — verify user is regular (not guest)
  // We check cookies directly to avoid auth() redirect behavior
  try {
    const { getToken } = await import("next-auth/jwt");
    const token = await getToken({
      req: request as unknown as Request,
      secret: process.env.AUTH_SECRET,
    });
    if (token?.type === "regular") {
      return true;
    }
  } catch {
    // getToken not available — deny
  }

  return false;
}

// ── Read Inventory ────────────────────────────────────────────────────────────

function readInventory(): SecretsInventory | null {
  try {
    if (!existsSync(INVENTORY_PATH)) return null;
    const raw = readFileSync(INVENTORY_PATH, "utf-8");
    return JSON.parse(raw) as SecretsInventory;
  } catch {
    return null;
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message:
          "Admin access required. Sign in with a regular account or provide a valid internal token.",
      },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const formatOnly = searchParams.get("format") === "drift";

  const inventory = readInventory();

  if (!inventory) {
    return NextResponse.json(
      {
        error: "No inventory found",
        message:
          "Run scripts/audit-secrets.ts first to generate the inventory.",
      },
      { status: 404 }
    );
  }

  if (formatOnly) {
    // Return compact drift report only
    const drift = inventory.driftReport;
    const secretsWithStatus = inventory.secrets.filter(
      (s) =>
        s.syncStatus !== "synced"
    );

    // Add clear text for the JARVIS_ADMIN_CHANNEL_ID mismatch
    const enhancedMismatches = drift.valueMismatches.map((m) => ({
      ...m,
      resolution:
        m.key === "JARVIS_ADMIN_CHANNEL_ID"
          ? "Expected: V2 uses a different Slack workspace with a different channel ID"
          : "Values differ between the two Vercel projects",
    }));

    return NextResponse.json({
      generatedAt: inventory.generatedAt,
      summary: inventory.summary,
      driftReport: {
        ...drift,
        valueMismatches: enhancedMismatches,
      },
      driftedSecrets: secretsWithStatus.map((s) => ({
        key: s.envKey,
        category: s.category,
        status: s.syncStatus,
        detail: s.driftDetail,
      })),
    });
  }

  // Return full inventory
  return NextResponse.json(inventory, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Generated-At": inventory.generatedAt,
    },
  });
}

// ── POST: Trigger re-scan ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Re-run audit by spawning the script
  try {
    const output = execSync("npx tsx scripts/audit-secrets.ts", {
      encoding: "utf-8",
      timeout: 30_000,
      env: {
        ...process.env,
        VERCEL_TOKEN: process.env.VERCEL_TOKEN ?? "",
      },
    });

    const refreshed = readInventory();

    return NextResponse.json({
      success: true,
      message: "Audit refreshed successfully",
      generatedAt: refreshed?.generatedAt ?? null,
      summary: refreshed?.summary ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Refresh failed",
        message,
      },
      { status: 500 }
    );
  }
}
