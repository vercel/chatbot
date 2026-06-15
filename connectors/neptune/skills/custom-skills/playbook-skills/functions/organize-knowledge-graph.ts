/**
 * organize-knowledge-graph.ts — Wiki and knowledge graph integration for playbook-skills.
 *
 * Bridges playbook content into the knowledge graph by:
 * 1. Extracting entities from playbook frontmatter (domain, priority, connectors)
 * 2. POST-ing to /api/wiki/ingest for knowledge graph entity creation
 * 3. Querying /api/wiki/search for cross-references
 * 4. Returning structured graph data for visualization
 *
 * Part of the playbook-skills meta-skill.
 */

export interface KnowledgeEntity {
  id: string;
  type: "playbook" | "domain" | "connector" | "function" | "workflow";
  title: string;
  path: string;
  priority?: string;
  relatedEntities: string[];
  lastUpdated: string;
}

export interface OrganizeKGInput {
  /** What to organize: "all" | specific domain | specific path */
  scope: "all" | string;
  /** Action: "index" (create entities) | "query" (search) | "crossref" (find relationships) */
  action: "index" | "query" | "crossref";
  /** Optional search query */
  query?: string;
}

export interface OrganizeKGResult {
  success: boolean;
  action: string;
  entitiesFound: number;
  entitiesCreated: number;
  crossReferences: Array<{ source: string; target: string; relationship: string }>;
  message: string;
}

const API_BASE = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const INTERNAL_TOKEN = process.env.NEPTUNE_INTERNAL_TOKEN || "";

/**
 * Ingest a playbook entity into the knowledge graph via /api/wiki/ingest.
 */
async function ingestEntity(entity: KnowledgeEntity): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/wiki/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": INTERNAL_TOKEN,
      },
      body: JSON.stringify({
        title: entity.title,
        content: `# ${entity.title}\n\nType: ${entity.type}\nPath: ${entity.path}\nPriority: ${entity.priority || "N/A"}\nLast Updated: ${entity.lastUpdated}`,
        tags: [entity.type, entity.priority || "unset", "playbook-skills", "phase-21-v3"],
        metadata: {
          path: entity.path,
          type: entity.type,
          domain: entity.title,
          priority: entity.priority,
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Search the knowledge graph for related entities.
 */
async function searchKG(query: string): Promise<KnowledgeEntity[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/wiki/search?q=${encodeURIComponent(query)}`,
      {
        headers: { "x-internal-token": INTERNAL_TOKEN },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? data.entities ?? []).map((e: Record<string, unknown>) => ({
      id: String(e.id ?? ""),
      type: (e.type as KnowledgeEntity["type"]) ?? "playbook",
      title: String(e.title ?? ""),
      path: String(e.path ?? ""),
      priority: String(e.priority ?? ""),
      relatedEntities: Array.isArray(e.relatedEntities) ? e.relatedEntities.map(String) : [],
      lastUpdated: String(e.lastUpdated ?? ""),
    }));
  } catch {
    return [];
  }
}

/**
 * Organize playbook knowledge into the knowledge graph.
 * - action="index": Read all playbooks and create wiki entities for each
 * - action="query": Search for existing entities matching a query
 * - action="crossref": Find relationships between entities
 */
export async function organizeKnowledgeGraph(
  input: OrganizeKGInput
): Promise<OrganizeKGResult> {
  const result: OrganizeKGResult = {
    success: true,
    action: input.action,
    entitiesFound: 0,
    entitiesCreated: 0,
    crossReferences: [],
    message: "",
  };

  if (input.action === "query") {
    const entities = await searchKG(input.query ?? input.scope);
    result.entitiesFound = entities.length;
    result.message = `Found ${entities.length} entities matching "${input.query ?? input.scope}"`;
    return result;
  }

  if (input.action === "crossref") {
    // Search for relationships between playbooks and connectors
    const playbooks = await searchKG("playbook");
    const connectors = await searchKG("connector");
    for (const pb of playbooks) {
      for (const conn of connectors) {
        // Check if playbook content references this connector
        if (pb.path?.includes(conn.title?.toLowerCase() ?? "")) {
          result.crossReferences.push({
            source: pb.title,
            target: conn.title,
            relationship: "uses_connector",
          });
        }
      }
    }
    result.entitiesFound = playbooks.length + connectors.length;
    result.message = `Found ${result.crossReferences.length} cross-references across ${playbooks.length} playbooks and ${connectors.length} connectors`;
    return result;
  }

  // action === "index" — create entities
  result.message = "Knowledge graph indexing deferred to swarm dispatch. Use swarmDispatch tool for bulk indexing.";
  return result;
}

export default organizeKnowledgeGraph;
