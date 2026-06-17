/**
 * Phase 24: Visual KG Explorer — Server Page
 *
 * Reads KG data from Postgres and passes to client renderer.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { GraphClient } from "./client";

async function getGraphData(focusId?: string) {
  if (!process.env.POSTGRES_URL) return { nodes: [], links: [] };

  const dbClient = postgres(process.env.POSTGRES_URL, { max: 3 });
  const db = drizzle(dbClient);

  try {
    // Get nodes from all library_* tables
    const connectors = await db.execute(
      `SELECT id, name, 'connector' as type, metadata FROM library_connectors`
    );
    const playbooks = await db.execute(
      `SELECT id, name, 'playbook' as type, metadata FROM library_playbooks`
    );
    const skills = await db.execute(
      `SELECT id, name, 'skill' as type, metadata FROM library_skills`
    );
    const functions = await db.execute(
      `SELECT id, name, 'function' as type, metadata FROM library_functions`
    );
    const workflows = await db.execute(
      `SELECT id, name, 'workflow' as type, metadata FROM library_workflows`
    );

    // Get panel presets and V2 handoffs if available
    let panels: any = { rows: [] };
    let handoffs: any = { rows: [] };
    try {
      panels = await db.execute(
        `SELECT id, name, 'panel' as type, metadata FROM library_panel_presets`
      );
      handoffs = await db.execute(
        `SELECT id, v2_session_id as name, 'v2_handoff' as type, metadata FROM library_v2_handoffs`
      );
    } catch {
      // Tables may not exist yet
    }

    // Get edges
    const edges = await db.execute(
      `SELECT id, from_entity_id as source, to_entity_id as target, edge_type as type, weight, confidence_score FROM library_edges`
    );

    const allNodes = [
      ...connectors.rows,
      ...playbooks.rows,
      ...skills.rows,
      ...functions.rows,
      ...workflows.rows,
      ...panels.rows,
      ...handoffs.rows,
    ].map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      metadata: r.metadata,
    }));

    return { nodes: allNodes, links: edges.rows };
  } finally {
    await dbClient.end().catch(() => {});
  }
}

export default async function GraphPage({
  searchParams,
}: {
  searchParams: { focus?: string };
}) {
  const { focus } = searchParams;
  const data = await getGraphData(focus);

  return <GraphClient initialData={data} focusId={focus} />;
}
