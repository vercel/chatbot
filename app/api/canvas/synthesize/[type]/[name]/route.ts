/**
 * GET /api/canvas/synthesize/[type]/[name]
 *
 * Phase 16.C: Synthesis endpoint — returns unified data for a single
 * library entity (connector, skill, function, playbook, workflow, wiki).
 *
 * Merges DB + filesystem MD + edges + usage_logs + KG neighbors.
 *
 * Cache: 5-min server-side LRU + Cache-Control header.
 * Auth: Admin allowlist required.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAllowlist } from "@/lib/auth/require-allowlist";
import { synthesize } from "@/lib/canvas/synthesizer";

export const GET = requireAllowlist(async (
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; name: string }> },
) => {
  const { type, name } = await params;

  // Validate type
  const validTypes = [
    "connector",
    "skill",
    "function",
    "playbook",
    "workflow",
    "wiki",
  ];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type: ${type}. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 },
    );
  }

  if (!name || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Name parameter is required" },
      { status: 400 },
    );
  }

  try {
    const data = await synthesize(type, name);

    // Check if the entity was actually found
    if (!data.meta || data.markdown === "" && data.sections.length === 0 && data.edges.length === 0) {
      return NextResponse.json(
        { error: `${type} '${name}' not found`, data },
        { status: 404 },
      );
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (err) {
    console.error(`[canvas/synthesize/${type}/${name}]`, err);
    return NextResponse.json(
      {
        error: "Synthesis failed",
        detail: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
});
