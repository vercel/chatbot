/**
 * GET /api/connector-graph
 *
 * U2.4.B — 4-Dimensional Bidirectional DAG endpoint.
 *
 * Reads all GRAPH-TAG.json files from playbooks/, connectors/, and skills/
 * and provides omnidirectional queries.
 *
 * Query params:
 *   ?entity_id=playbooks/billing         — get one entity's full graph
 *   ?direction=playbooks                 — filter to entity_type
 *   ?connected_to=connectors/nmi         — find all entities linked to a target
 *   ?function=jarvis_file_read           — trace a function back to its connector + playbooks
 *   ?intent=refund                        — find playbooks/connectors matching intent tag
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const CWD = process.cwd();

// ── Types ────────────────────────────────────────────────────────────────────

interface GraphLink {
  ref: string;
  relationship?: string;
  strength?: string;
}

interface GraphDirections {
  associated_playbooks?: GraphLink[];
  associated_connectors?: GraphLink[];
  associated_skills?: GraphLink[];
  exposed_functions?: string[];
  runtime_types?: string[];
  intent_tags?: string[];
}

interface GraphTag {
  entity_type: string;
  entity_id: string;
  version: string;
  graph_version: string;
  directions: GraphDirections;
  metadata: Record<string, unknown>;
}

// ── Load all GRAPH-TAG.json files ────────────────────────────────────────────

function loadGraphTags(): GraphTag[] {
  const tags: GraphTag[] = [];
  const scanDirs = ["playbooks", "connectors"];

  for (const dir of scanDirs) {
    const dirPath = join(CWD, dir);
    if (!existsSync(dirPath)) continue;

    const entries = readdirSync(dirPath);
    for (const entry of entries) {
      const entryPath = join(dirPath, entry);
      if (!statSync(entryPath).isDirectory()) continue;

      const graphPath = join(entryPath, "GRAPH-TAG.json");
      if (!existsSync(graphPath)) continue;

      try {
        const raw = readFileSync(graphPath, "utf-8");
        const tag = JSON.parse(raw) as GraphTag;
        tags.push(tag);
      } catch {
        // Skip invalid files
      }
    }
  }

  // Also scan skills/ subdirectories
  const skillsDir = join(CWD, "skills");
  if (existsSync(skillsDir)) {
    for (const category of ["capabilities", "functions"]) {
      const catPath = join(skillsDir, category);
      if (!existsSync(catPath)) continue;
      const entries = readdirSync(catPath);
      for (const entry of entries) {
        const entryPath = join(catPath, entry);
        if (!statSync(entryPath).isDirectory()) continue;
        const graphPath = join(entryPath, "GRAPH-TAG.json");
        if (existsSync(graphPath)) {
          try {
            const raw = readFileSync(graphPath, "utf-8");
            const tag = JSON.parse(raw) as GraphTag;
            tags.push(tag);
          } catch {
            // Skip
          }
        }
      }
    }
  }

  return tags;
}

// ── Build omnidirectional index ──────────────────────────────────────────────

function buildIndex(tags: GraphTag[]) {
  const byId = new Map<string, GraphTag>();
  const byFunction = new Map<string, GraphTag[]>();
  const byConnectedTo = new Map<string, string[]>();
  const byIntent = new Map<string, GraphTag[]>();
  const byType = new Map<string, GraphTag[]>();

  for (const tag of tags) {
    byId.set(tag.entity_id, tag);

    const type = tag.entity_type;
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(tag);

    // Index exposed functions
    for (const fn of tag.directions.exposed_functions || []) {
      if (!byFunction.has(fn)) byFunction.set(fn, []);
      byFunction.get(fn)!.push(tag);
    }

    // Index intent tags
    for (const intent of tag.directions.intent_tags || []) {
      const lower = intent.toLowerCase();
      if (!byIntent.has(lower)) byIntent.set(lower, []);
      byIntent.get(lower)!.push(tag);
    }

    // Build reverse connections map
    const allLinks = [
      ...(tag.directions.associated_playbooks || []).map((l) => l.ref),
      ...(tag.directions.associated_connectors || []).map((l) => l.ref),
      ...(tag.directions.associated_skills || []).map((l) => l.ref),
    ];
    for (const link of allLinks) {
      if (!byConnectedTo.has(link)) byConnectedTo.set(link, []);
      if (!byConnectedTo.get(link)!.includes(tag.entity_id)) {
        byConnectedTo.get(link)!.push(tag.entity_id);
      }
    }
  }

  return { byId, byFunction, byConnectedTo, byIntent, byType };
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const tags = loadGraphTags();
  const { byId, byFunction, byConnectedTo, byIntent, byType } = buildIndex(tags);

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entity_id");
  const direction = searchParams.get("direction");
  const connectedTo = searchParams.get("connected_to");
  const functionName = searchParams.get("function");
  const intent = searchParams.get("intent");

  // Specific entity lookup
  if (entityId) {
    const tag = byId.get(entityId);
    if (!tag) {
      return NextResponse.json({ error: `Entity '${entityId}' not found in graph` }, { status: 404 });
    }
    // Return with reverse links (who links to this entity)
    const linkedFrom = byConnectedTo.get(entityId) || [];
    return NextResponse.json({
      entity: tag,
      linked_from: linkedFrom,
      graph_version: "4d-v1",
    });
  }

  // Filter by entity type
  if (direction) {
    const filtered = byType.get(direction) || [];
    return NextResponse.json({
      entities: filtered,
      count: filtered.length,
    });
  }

  // Find all entities connected to a target
  if (connectedTo) {
    const linkedFrom = byConnectedTo.get(connectedTo) || [];
    return NextResponse.json({
      target: connectedTo,
      connected_entities: linkedFrom,
      count: linkedFrom.length,
    });
  }

  // Trace a function back to its connector + associated playbooks
  if (functionName) {
    const fnTags = byFunction.get(functionName) || [];
    return NextResponse.json({
      function: functionName,
      providers: fnTags.map((t) => ({
        entity_id: t.entity_id,
        entity_type: t.entity_type,
        metadata: t.metadata,
        associated_playbooks: t.directions.associated_playbooks || [],
      })),
      count: fnTags.length,
    });
  }

  // Find by intent tag
  if (intent) {
    const lower = intent.toLowerCase();
    const intentTags = byIntent.get(lower) || [];
    return NextResponse.json({
      intent: intent,
      matches: intentTags.map((t) => ({
        entity_id: t.entity_id,
        entity_type: t.entity_type,
        metadata: t.metadata,
      })),
      count: intentTags.length,
    });
  }

  // Full graph summary
  const summary = {
    total_entities: tags.length,
    by_type: {} as Record<string, number>,
    total_functions: 0,
    total_intents: 0,
  };

  for (const [type, entries] of byType) {
    summary.by_type[type] = entries.length;
  }
  for (const tag of tags) {
    summary.total_functions += (tag.directions.exposed_functions || []).length;
    summary.total_intents += (tag.directions.intent_tags || []).length;
  }

  return NextResponse.json({
    summary,
    entities: tags.map((t) => ({
      entity_id: t.entity_id,
      entity_type: t.entity_type,
      metadata: t.metadata,
      function_count: (t.directions.exposed_functions || []).length,
      connection_count:
        (t.directions.associated_playbooks || []).length +
        (t.directions.associated_connectors || []).length +
        (t.directions.associated_skills || []).length,
    })),
    graph_version: "4d-v1",
    query_params: {
      entity_id: "Get one entity with all connections",
      direction: "Filter by entity_type (playbook|connector|skill)",
      connected_to: "Find all entities linking to a target",
      function: "Trace a function to its provider",
      intent: "Find entities matching an intent tag",
    },
  });
}
