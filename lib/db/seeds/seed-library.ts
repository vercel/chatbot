/**
 * Phase 22.5: Seed library_* tables from lib/system-capabilities.json
 *
 * Reads the auto-generated truth file and upserts into the Knowledge Graph
 * tables created by migration 0007 (library_connectors, library_skills,
 * library_functions, library_playbooks, library_workflows, library_edges).
 *
 * Idempotent — safe to re-run on every build. Uses ON CONFLICT UPSERT
 * for entities and DELETE+INSERT for edges (no natural PK for upsert).
 *
 * Usage: npx tsx lib/db/seeds/seed-library.ts
 * npm script: pnpm db:seed-library
 */

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  libraryConnector,
  librarySkill,
  libraryFunction,
  libraryPlaybook,
  libraryWorkflow,
  libraryEdge,
} from "../schema";

interface CapabilitiesFile {
  generatedAt: string;
  version: string;
  counts: Record<string, number>;
  connectors: Array<{
    name: string; slug: string; path: string;
    hasMcp: boolean; hasCustomClient: boolean; hasSchema: boolean;
    toolCount: number; toolNames: string[];
    hasPlaybookMd: boolean; hasSkillMd: boolean;
    domain?: string; playbooksReferencing: string[];
  }>;
  playbooks: Array<{
    name: string; slug: string; path: string;
    domain?: string; version?: string; description?: string;
    hasManifest: boolean; hasPlaybookMd: boolean;
    requires: { connectors: string[]; skills: string[]; functions: string[]; workflows: string[] };
    isMeta: boolean;
  }>;
  skills: Array<{ name: string; type: string; path: string; description: string }>;
  functions: Array<{ name: string; path?: string; description: string }>;
  workflows: Array<{ name: string; path: string; durable: boolean; description: string }>;
  manifestEdges: Array<{
    from: string; fromType: string; to: string; toType: string; edgeType: string;
  }>;
  truth_assertion: string;
}

const ROOT = path.resolve(__dirname, "..", "..", "..");
const CAPS_PATH = path.join(ROOT, "lib", "system-capabilities.json");

function loadCapabilities(): CapabilitiesFile | null {
  try {
    return JSON.parse(fs.readFileSync(CAPS_PATH, "utf-8"));
  } catch {
    console.error("❌ system-capabilities.json not found. Run pnpm capabilities:regen first.");
    return null;
  }
}

async function main() {
  config({ path: ".env.local" });

  if (!process.env.POSTGRES_URL) {
    console.log("POSTGRES_URL not defined, skipping library seed");
    process.exit(0);
  }

  const caps = loadCapabilities();
  if (!caps) process.exit(1);

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("🌱 Seeding Knowledge Graph from system-capabilities.json...");
  console.log(`   Generated at: ${caps.generatedAt}`);
  console.log(`   Counts: ${caps.counts.connectors}c / ${caps.counts.playbooks}p / ${caps.counts.skills}s / ${caps.counts.functions}f / ${caps.counts.workflows}w`);
  console.log(`   Edges: ${caps.manifestEdges.length}\n`);

  let n = { connectors: 0, skills: 0, functions: 0, playbooks: 0, workflows: 0, edges: 0 };

  // ── Connectors ────────────────────────────────────────────────────────
  console.log("📦 Connectors...");
  for (const c of caps.connectors) {
    await db
      .insert(libraryConnector)
      .values({
        name: c.slug,
        domain: c.domain || "",
        mcpEnabled: c.hasMcp,
        description: c.playbooksReferencing.length > 0
          ? `Connector for: ${c.playbooksReferencing.join(", ")}`
          : `${c.name} integration`,
        primaryDomain: c.domain || null,
        alsoIn: c.playbooksReferencing,
        dependencies: [],
        tools: c.toolCount,
        toolNames: c.toolNames,
        version: "1.0.0",
        filePath: c.path,
      })
      .onConflictDoUpdate({
        target: libraryConnector.name,
        set: {
          mcpEnabled: c.hasMcp,
          description: c.playbooksReferencing.length > 0
            ? `Connector for: ${c.playbooksReferencing.join(", ")}`
            : `${c.name} integration`,
          tools: c.toolCount,
          toolNames: c.toolNames,
          alsoIn: c.playbooksReferencing,
          filePath: c.path,
          updatedAt: new Date(),
        },
      });
    n.connectors++;
  }
  console.log(`   ✅ ${n.connectors} connectors upserted`);

  // ── Skills ────────────────────────────────────────────────────────────
  console.log("🎯 Skills...");
  for (const s of caps.skills) {
    await db
      .insert(librarySkill)
      .values({
        name: s.name,
        type: s.type,
        description: s.description,
        filePath: s.path,
        version: "1.0.0",
      })
      .onConflictDoUpdate({
        target: [librarySkill.name, librarySkill.type],
        set: {
          description: s.description,
          filePath: s.path,
          updatedAt: new Date(),
        },
      });
    n.skills++;
  }
  console.log(`   ✅ ${n.skills} skills upserted`);

  // ── Functions ─────────────────────────────────────────────────────────
  console.log("⚡ Functions...");
  for (const f of caps.functions) {
    await db
      .insert(libraryFunction)
      .values({
        name: f.name,
        description: f.description || "",
        filePath: f.path || null,
        version: "1.0.0",
      })
      .onConflictDoUpdate({
        target: libraryFunction.name,
        set: {
          description: f.description || "",
          filePath: f.path || null,
          updatedAt: new Date(),
        },
      });
    n.functions++;
  }
  console.log(`   ✅ ${n.functions} functions upserted`);

  // ── Playbooks ─────────────────────────────────────────────────────────
  console.log("📚 Playbooks...");
  for (const p of caps.playbooks) {
    await db
      .insert(libraryPlaybook)
      .values({
        name: p.slug,
        type: p.isMeta ? "meta" : "domain",
        scopeConnectors: p.requires?.connectors || [],
        triggers: [],
        workflows: p.requires?.workflows || [],
        description: p.description || `${p.name} playbook`,
        filePath: p.path,
        content: null,
      })
      .onConflictDoUpdate({
        target: libraryPlaybook.name,
        set: {
          scopeConnectors: p.requires?.connectors || [],
          workflows: p.requires?.workflows || [],
          description: p.description || `${p.name} playbook`,
          filePath: p.path,
          updatedAt: new Date(),
        },
      });
    n.playbooks++;
  }
  console.log(`   ✅ ${n.playbooks} playbooks upserted`);

  // ── Workflows ─────────────────────────────────────────────────────────
  console.log("🔄 Workflows...");
  for (const w of caps.workflows) {
    await db
      .insert(libraryWorkflow)
      .values({
        name: w.name,
        durable: w.durable,
        description: w.description || "",
        filePath: w.path,
      })
      .onConflictDoUpdate({
        target: libraryWorkflow.name,
        set: {
          durable: w.durable,
          description: w.description || "",
          filePath: w.path,
          updatedAt: new Date(),
        },
      });
    n.workflows++;
  }
  console.log(`   ✅ ${n.workflows} workflows upserted`);

  // ── Edges (delete all, then re-insert with dedup + try-catch) ────────
  console.log("🔗 Edges...");
  // Delete all existing edges for idempotency (edges lack a natural PK for upsert)
  await db.delete(libraryEdge);

  // Deduplicate and insert edges (try-catch per edge to survive duplicates)
  const seenEdges = new Set<string>();
  for (const edge of caps.manifestEdges) {
    if (!edge.from || !edge.to) continue;
    const key = `${edge.from}|${edge.fromType}|${edge.to}|${edge.toType}|${edge.edgeType}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    try {
      await db.insert(libraryEdge).values({
        fromNode: edge.from,
        fromType: edge.fromType,
        toNode: edge.to,
        toType: edge.toType,
        edgeType: edge.edgeType,
        weight: edge.edgeType === "requires" ? 3 : edge.edgeType === "uses" ? 2 : 1,
      });
      n.edges++;
    } catch (e: any) {
      if (e?.code === '23505') {
        // Duplicate key — skip silently (race condition with delete)
        console.warn(`   ⚠️  Skipping duplicate edge: ${key}`);
      } else {
        throw e;
      }
    }
  }
  console.log(`   ✅ ${n.edges} edges inserted`);

  // ── Summary ───────────────────────────────────────────────────────────
  const total = n.connectors + n.skills + n.functions + n.playbooks + n.workflows + n.edges;
  console.log(`\n✅ Knowledge Graph seeded! ${total} records (${n.connectors}c/${n.playbooks}p/${n.skills}s/${n.functions}f/${n.workflows}w/${n.edges}e)`);

  await connection.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
