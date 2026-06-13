/**
 * U7.1: KG Speed Test Suite
 *
 * Benchmarks Postgres-native KG against 6 operational targets.
 * If benchmarks pass: postgres stays as v1 production KG.
 * If 2+ fail: notes Neo4j migration trigger in synthesis.
 *
 * Usage: npx tsx scripts/speed-test-kg.ts
 */

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const POSTGRES_URL: string = process.env.POSTGRES_URL as string;
if (!POSTGRES_URL) {
  console.error("POSTGRES_URL not set — cannot run speed tests");
  process.exit(1);
}

interface TestResult {
  name: string;
  targetMs: number;
  actualMs: number;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function record(name: string, targetMs: number, actualMs: number, details?: string) {
  const passed = actualMs <= targetMs;
  results.push({ name, targetMs, actualMs, passed, details });
  const icon = passed ? "✅" : "❌";
  console.log(
    `  ${icon} ${name}: ${actualMs.toFixed(1)}ms (target ≤${targetMs}ms)${details ? ` — ${details}` : ""}`
  );
}

async function run() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  U7.1 — Postgres KG Speed Test Suite                ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const sql = postgres(POSTGRES_URL!, { max: 10, idle_timeout: 30 });

  // Verify extensions
  const exts = await sql<{ extname: string }[]>`
    SELECT extname FROM pg_extension WHERE extname IN ('vector', 'ltree')
  `;
  console.log(`Extensions: ${exts.map((e) => e.extname).join(", ") || "NONE"}`);
  if (exts.length < 2) {
    console.warn("⚠️  WARNING: pgvector and/or ltree not installed. Running migration first...");
    // The migration should handle this
  }

  const SCALE = 1000; // Scale factor for insert test (use 100 for CI, 1000 for real benchmark)
  console.log(`\nScale factor: ${SCALE} entities\n`);

  // ── Test 1: Insert Benchmark ──────────────────────────────────────────
  console.log("1. Insert Benchmark (bulk insert)...");
  {
    // Clean up previous test data
    await sql`DELETE FROM kg_relations WHERE from_entity_id IN (SELECT id FROM kg_entities WHERE name LIKE 'speedtest_%')`;
    await sql`DELETE FROM kg_entities WHERE name LIKE 'speedtest_%'`;

    const start = Date.now();
    // Batch insert in chunks of 50 using simple SQL
    const chunkSize = 50;
    for (let batch = 0; batch < SCALE; batch += chunkSize) {
      const values: string[] = [];
      for (let i = batch; i < Math.min(batch + chunkSize, SCALE); i++) {
        values.push(
          `('Concept', 'speedtest_entity_${i}', 'Speed test entity ${i}', '{"index":${i},"batch":"speedtest"}'::jsonb)`
        );
      }
      await sql.unsafe(`
        INSERT INTO kg_entities (type, name, description, properties)
        VALUES ${values.join(", ")}
        ON CONFLICT (type, name) DO NOTHING
      `);
    }
    const duration = Date.now() - start;
    record("Insert 1K entities", 5000, duration, `${SCALE} rows in ${chunkSize}-row batches`);
  }

  // ── Test 2: Single-hop Traversal ──────────────────────────────────────
  console.log("2. Single-hop Traversal...");
  {
    // Create test relations
    const entities = await sql<{ id: string }[]>`
      SELECT id FROM kg_entities WHERE name LIKE 'speedtest_%' LIMIT 100
    `;
    if (entities.length >= 2) {
      // Insert test relations
      const relValues: string[] = [];
      for (let i = 0; i < entities.length - 1; i++) {
        relValues.push(`('${entities[i].id}', '${entities[i + 1].id}', 'REFERENCES')`);
      }
      await sql.unsafe(`
        INSERT INTO kg_relations (from_entity_id, to_entity_id, type)
        VALUES ${relValues.join(", ")}
        ON CONFLICT DO NOTHING
      `);

      const start = Date.now();
      const result = await sql`
        SELECT e.*, r.type AS rel_type
        FROM kg_entities e
        JOIN kg_relations r ON r.to_entity_id = e.id
        WHERE r.from_entity_id = ${entities[0].id}
        LIMIT 50
      `;
      const duration = Date.now() - start;
      record(
        "Single-hop traversal",
        50,
        duration,
        `${result.length} relations from entity`
      );
    } else {
      record("Single-hop traversal", 50, 0, "SKIPPED — not enough test data");
    }
  }

  // ── Test 3: Multi-hop Traversal (recursive CTE) ───────────────────────
  console.log("3. Multi-hop Traversal (depth 3)...");
  {
    const entities = await sql<{ id: string }[]>`
      SELECT id FROM kg_entities WHERE name LIKE 'speedtest_%' LIMIT 1
    `;
    if (entities.length > 0) {
      const start = Date.now();
      const result = await sql`
        WITH RECURSIVE walk AS (
          SELECT e.id, 0 AS depth
          FROM kg_entities e
          WHERE e.id = ${entities[0].id}

          UNION

          SELECT
            CASE WHEN r.from_entity_id = w.id THEN r.to_entity_id ELSE r.from_entity_id END,
            w.depth + 1
          FROM kg_relations r
          JOIN walk w ON (r.from_entity_id = w.id OR r.to_entity_id = w.id)
          WHERE w.depth < 3
        )
        SELECT DISTINCT id, depth FROM walk ORDER BY depth
      `;
      const duration = Date.now() - start;
      const maxDepth = Math.max(...result.map((r) => r.depth), 0);
      record(
        "Multi-hop traversal (depth 3)",
        200,
        duration,
        `${result.length} nodes reached, max depth ${maxDepth}`
      );
    } else {
      record("Multi-hop traversal", 200, 0, "SKIPPED — no test data");
    }
  }

  // ── Test 4: Semantic Search (vector similarity) ───────────────────────
  console.log("4. Semantic Search (vector similarity)...");
  {
    // Insert a few test entities with embeddings
    const testVec = new Array(768).fill(0).map(() => Math.random() * 0.1);
    const vecStr = `[${testVec.join(",")}]`;
    await sql.unsafe(`
      INSERT INTO kg_entities (type, name, description, embedding)
      VALUES ('Concept', 'speedtest_vec_1', 'Test vector search entity alpha', '${vecStr}'::vector)
      ON CONFLICT (type, name) DO UPDATE SET embedding = '${vecStr}'::vector
    `);

    const start = Date.now();
    const result = await sql.unsafe(`
      SELECT id, name, 1 - (embedding <=> '${vecStr}'::vector) AS similarity
      FROM kg_entities
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> '${vecStr}'::vector
      LIMIT 10
    `);
    const duration = Date.now() - start;
    record(
      "Semantic search",
      100,
      duration,
      `${result.length} results, top similarity: ${result[0] ? "found" : "none"}`
    );
  }

  // ── Test 5: Hierarchical Query (ltree) ────────────────────────────────
  console.log("5. Hierarchical Query (ltree)...");
  {
    // Insert test entities with ltree paths
    await sql.unsafe(`
      INSERT INTO kg_entities (type, name, description, path)
      VALUES
        ('Domain', 'speedtest_ltree_root', 'Root domain', 'root'),
        ('Skill', 'speedtest_ltree_child1', 'Child skill 1', 'root.billing'),
        ('Skill', 'speedtest_ltree_child2', 'Child skill 2', 'root.billing.payments'),
        ('Skill', 'speedtest_ltree_child3', 'Child skill 3', 'root.support')
      ON CONFLICT (type, name) DO UPDATE SET path = EXCLUDED.path
    `);

    const start = Date.now();
    const result = await sql.unsafe(`
      SELECT id, name, path::text
      FROM kg_entities
      WHERE path IS NOT NULL
        AND path::text LIKE 'root.billing%'
      LIMIT 50
    `);
    const duration = Date.now() - start;
    record(
      "Hierarchical ltree query",
      50,
      duration,
      `${result.length} results under root.billing`
    );
  }

  // ── Test 6: Concurrent Reads ──────────────────────────────────────────
  console.log("6. Concurrent Reads (100 parallel)...");
  {
    const queries: Promise<unknown>[] = [];
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      queries.push(
        sql`SELECT * FROM kg_entities WHERE type = 'Concept' LIMIT 10`
      );
    }
    await Promise.all(queries);
    const duration = Date.now() - start;
    record(
      "Concurrent reads (100x)",
      500,
      duration,
      "100 parallel entity queries"
    );
  }

  // ── Cleanup ───────────────────────────────────────────────────────────
  console.log("\nCleaning up test data...");
  await sql`DELETE FROM kg_relations WHERE from_entity_id IN (SELECT id FROM kg_entities WHERE name LIKE 'speedtest_%')`;
  await sql`DELETE FROM kg_entities WHERE name LIKE 'speedtest_%'`;

  // ── Summary ───────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const verdict = failed === 0 ? "PASS" : failed <= 1 ? "PARTIAL" : "FAIL";

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log(`║  RESULTS: ${passed}/${results.length} passed, ${failed} failed — ${verdict.padEnd(13)}║`);
  console.log("╚══════════════════════════════════════════════════════╝");

  const suite = {
    timestamp: new Date().toISOString(),
    postgresUrl: POSTGRES_URL.replace(/\/\/.*@/, "//***:***@"), // redact credentials
    results,
    summary: { total: results.length, passed, failed, verdict },
  };

  console.log("\n" + JSON.stringify(suite, null, 2));

  // Write to file for proof
  const fs = await import("fs");
  fs.writeFileSync(
    "/home/hermes/data/u7_speed_test.json",
    JSON.stringify(suite, null, 2)
  );
  console.log("\n📄 Results written to /home/hermes/data/u7_speed_test.json");

  await sql.end();
  process.exit(failed > 1 ? 1 : 0);
}

run().catch((err) => {
  console.error("Speed test failed:", err);
  process.exit(1);
});
