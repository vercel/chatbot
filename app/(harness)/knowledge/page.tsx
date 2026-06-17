/**
 * Knowledge Page — Server Component
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 — Reference Implementation
 * Loads the knowledge graph on the server and passes to client component.
 */

import { buildKnowledgeGraph } from "@/lib/knowledge/parser";
import { KnowledgeClient } from "./client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Knowledge | Neptune",
  description: "Interactive knowledge graph — NEPTUNE-KNOWLEDGE-SPEC v1.0",
};

export default async function KnowledgePage() {
  // Build graph from cortex on the server
  const graph = buildKnowledgeGraph();

  return (
    <KnowledgeClient
      initialGraph={{
        nodes: graph.nodes,
        edges: graph.edges,
        stats: graph.stats,
      }}
      allNodes={graph.nodes}
      allEdges={graph.edges}
    />
  );
}
