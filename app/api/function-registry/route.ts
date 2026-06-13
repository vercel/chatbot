/**
 * GET /api/function-registry
 *
 * U2.4.C — Functions atomic execution registry.
 * Returns all 169+ callable actions from functions/master-registry.json.
 *
 * Query params:
 *   ?connector=base44              — filter by parent connector
 *   ?category=nmi                   — filter by category
 *   ?search=charge                  — full-text search function name
 *   ?intent=payment                 — search intent tags
 *   ?limit=50&offset=0             — pagination
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

const CWD = process.cwd();
const REGISTRY_PATH = join(CWD, "functions", "master-registry.json");

interface FunctionEntry {
  function_name: string;
  execution_signature: string;
  runtime_type: string;
  parent_connector: string;
  parent_skill: string;
  associated_playbooks: string[];
  intent_tags: string[];
  category: string;
}

interface MasterRegistry {
  version: string;
  generated: string;
  total_functions: number;
  connectors: string[];
  functions: FunctionEntry[];
}

function loadRegistry(): MasterRegistry | null {
  try {
    if (!existsSync(REGISTRY_PATH)) return null;
    return JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
  } catch {
    return null;
  }
}

export const GET = requireAllowlist(async (req: NextRequest) => {
  const registry = loadRegistry();

  if (!registry) {
    return NextResponse.json(
      { error: "Master registry not found. Run the generation script." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const connector = searchParams.get("connector");
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const intent = searchParams.get("intent");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const offset = parseInt(searchParams.get("offset") || "0");

  let functions = registry.functions;

  // Filter by parent connector
  if (connector) {
    functions = functions.filter((f) => f.parent_connector === `connectors/${connector}`);
  }

  // Filter by category
  if (category) {
    functions = functions.filter((f) => f.category === category);
  }

  // Full-text search on function name
  if (search) {
    const q = search.toLowerCase();
    functions = functions.filter(
      (f) =>
        f.function_name.toLowerCase().includes(q) ||
        f.intent_tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  // Search by intent tag
  if (intent) {
    const q = intent.toLowerCase();
    functions = functions.filter((f) =>
      f.intent_tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  const total = functions.length;
  const paginated = functions.slice(offset, offset + limit);

  // Group counts by category
  const byCategory: Record<string, number> = {};
  for (const f of registry.functions) {
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
  }

  return NextResponse.json({
    functions: paginated,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
    summary: {
      total_functions: registry.total_functions,
      by_category: byCategory,
      by_connector: {
        base44: registry.functions.filter((f) => f.category === "base44").length,
        nmi: registry.functions.filter((f) => f.category === "nmi").length,
        slack: registry.functions.filter((f) => f.category === "slack").length,
        hyperswitch: registry.functions.filter((f) => f.category === "hyperswitch").length,
        vapi: registry.functions.filter((f) => f.category === "vapi").length,
        neptune: registry.functions.filter((f) => f.category === "neptune").length,
        "custom-skills": registry.functions.filter((f) => f.category === "custom-skills").length,
      },
    },
    version: registry.version,
  });
});
