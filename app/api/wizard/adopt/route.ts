/**
 * POST /api/wizard/adopt — Insert connector into library_* tables, KG, and registry.
 *
 * Body: { connectorName, apiUrl, endpoints, skillContent, functions, suggestedDomains, sopContent, sandboxResult, mcpCheck }
 *
 * The ADOPT step:
 *   1. Inserts library_connectors row
 *   2. Inserts library_skills row
 *   3. Inserts library_functions rows
 *   4. Inserts library_edges (connector → playbook, connector → skill, etc.)
 *   5. Optionally inserts library_playbooks if domain doesn't exist
 *   6. Returns { success, insertedRecords }
 */

import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { z } from "zod";

const POSTGRES_URL = process.env.POSTGRES_URL;

const bodySchema = z.object({
  connectorName: z.string().min(1),
  apiUrl: z.string().url(),
  endpoints: z.array(z.string()).default([]),
  skillContent: z.string().nullable().optional(),
  functions: z
    .array(z.object({ name: z.string(), signature: z.string().optional(), description: z.string().optional() }))
    .default([]),
  suggestedDomains: z.array(z.string()).default([]),
  sopContent: z.string().nullable().optional(),
  sandboxResult: z
    .object({ passed: z.boolean(), output: z.string(), durationMs: z.number() })
    .nullable()
    .optional(),
  mcpCheck: z
    .object({ exists: z.boolean(), url: z.string().nullable(), servers: z.array(z.string()) })
    .nullable()
    .optional(),
});

export async function POST(request: NextRequest) {
  if (!POSTGRES_URL) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: `Invalid body: ${(err as Error).message}` }, { status: 400 });
  }

  const {
    connectorName,
    apiUrl,
    endpoints,
    skillContent,
    functions,
    suggestedDomains,
    sopContent,
    sandboxResult,
    mcpCheck,
  } = body;

  // Require sandbox test to pass before adopt
  if (!sandboxResult?.passed) {
    return NextResponse.json(
      { error: "Sandbox test must pass before adopt. Run Step 7 first." },
      { status: 400 },
    );
  }

  const sql = postgres(POSTGRES_URL, { max: 3 });
  const inserted: Record<string, number> = {};

  try {
    // 1. Insert connector
    const domain = suggestedDomains[0] ?? "mcp-edits";

    await sql`
      INSERT INTO "library_connectors" (
        "name", "domain", "mcp_enabled", "description", "primary_domain",
        "also_in", "dependencies", "tools", "tool_names", "version", "file_path"
      ) VALUES (
        ${connectorName},
        ${domain},
        ${mcpCheck?.exists ?? false},
        ${`Integration with ${new URL(apiUrl).hostname} — ${endpoints.length} endpoints`},
        ${domain},
        ${JSON.stringify(suggestedDomains.slice(1))}::jsonb,
        ${"[]"}::jsonb,
        ${functions.length},
        ${JSON.stringify(functions.map((f) => f.name))}::jsonb,
        ${"1.0.0"},
        ${`connectors/${connectorName}/`}
      )
      ON CONFLICT ("name") DO UPDATE SET
        "tools" = EXCLUDED."tools",
        "tool_names" = EXCLUDED."tool_names",
        "updated_at" = now()
    `;
    inserted.connectors = 1;

    // 2. Insert skill
    if (skillContent) {
      await sql`
        INSERT INTO "library_skills" (
          "name", "type", "connector_name", "description", "file_path", "content", "version",
          "context_tokens_estimated", "typical_latency_ms", "dependencies", "optimal_for"
        ) VALUES (
          ${connectorName.replace(/-connector$/, "")},
          ${"connector"},
          ${connectorName},
          ${`${connectorName} integration skill`},
          ${`connectors/${connectorName}/SKILL.md`},
          ${skillContent},
          ${"1.0.0"},
          ${2000},
          ${sandboxResult?.durationMs ?? 500},
          ${"[]"}::jsonb,
          ${JSON.stringify(["api integration", "data fetching", domain])}::jsonb
        )
        ON CONFLICT ("name", "type") DO UPDATE SET
          "content" = EXCLUDED."content",
          "updated_at" = now()
      `;
      inserted.skills = 1;
    }

    // 3. Insert functions
    if (functions.length > 0) {
      let fnCount = 0;
      for (const fn of functions) {
        await sql`
          INSERT INTO "library_functions" (
            "name", "signature", "skill_name", "description", "domain", "dependencies", "version"
          ) VALUES (
            ${fn.name},
            ${fn.signature ?? "async function(): Promise<unknown>"},
            ${connectorName.replace(/-connector$/, "")},
            ${fn.description ?? "Auto-generated wrapper"},
            ${domain},
            ${"[]"}::jsonb,
            ${"1.0.0"}
          )
          ON CONFLICT ("name") DO UPDATE SET
            "signature" = EXCLUDED."signature",
            "updated_at" = now()
        `;
        fnCount++;
      }
      inserted.functions = fnCount;
    }

    // 4. Insert edges
    let edgeCount = 0;
    // Connector → Primary domain playbook
    await sql`
      INSERT INTO "library_edges" ("from_node", "from_type", "to_node", "to_type", "edge_type", "weight")
      VALUES (${connectorName}, ${"connector"}, ${domain}, ${"playbook"}, ${"belongs_to"}, 1)
      ON CONFLICT DO NOTHING
    `;
    edgeCount++;

    // Connector → Skill
    if (skillContent) {
      await sql`
        INSERT INTO "library_edges" ("from_node", "from_type", "to_node", "to_type", "edge_type", "weight")
        VALUES (${connectorName}, ${"connector"}, ${connectorName.replace(/-connector$/, "")}, ${"skill"}, ${"provides"}, 1)
        ON CONFLICT DO NOTHING
      `;
      edgeCount++;
    }

    // Functions → Connector
    for (const fn of functions.slice(0, 5)) {
      await sql`
        INSERT INTO "library_edges" ("from_node", "from_type", "to_node", "to_type", "edge_type", "weight")
        VALUES (${fn.name}, ${"function"}, ${connectorName}, ${"connector"}, ${"implements"}, 1)
        ON CONFLICT DO NOTHING
      `;
      edgeCount++;
    }

    inserted.edges = edgeCount;

    // 5. Ensure playbook exists for primary domain
    await sql`
      INSERT INTO "library_playbooks" ("name", "type", "description", "scope_connectors", "triggers", "workflows")
      VALUES (
        ${domain},
        ${"domain"},
        ${`Auto-generated playbook for ${domain} domain`},
        ${JSON.stringify([connectorName])}::jsonb,
        ${JSON.stringify([domain.replace(/-/g, " ")])}::jsonb,
        ${"[]"}::jsonb
      )
      ON CONFLICT ("name") DO UPDATE SET
        "scope_connectors" = "library_playbooks"."scope_connectors" || ${JSON.stringify([connectorName])}::jsonb,
        "updated_at" = now()
    `;
    inserted.playbookEnsured = 1;

    return NextResponse.json({
      success: true,
      insertedRecords: inserted,
      connectorName,
      primaryDomain: domain,
      summary: `Adopted ${connectorName} → ${inserted.functions ?? 0} functions, ${inserted.edges ?? 0} edges, ${inserted.skills ?? 0} skill(s), domain: ${domain}`,
    });
  } catch (err) {
    console.error("[wizard/adopt]", err);
    return NextResponse.json(
      { error: `Adopt failed: ${(err as Error).message}` },
      { status: 500 },
    );
  } finally {
    await sql.end();
  }
}
