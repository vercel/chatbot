/**
 * Knowledge Graph Page — Server Component
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 — Reference Implementation
 * Client fetches graph data from /api/knowledge/graph on mount.
 *
 * Phase 35: Knowledge Visualizer | Stream 7
 */

import { KnowledgeClient } from "./client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Knowledge Graph | Neptune",
  description: "Interactive knowledge graph visualizer — NEPTUNE-KNOWLEDGE-SPEC v1.0",
};

export default function KnowledgeGraphPage() {
  return (
    <KnowledgeClient
      initialGraph={undefined}
      allNodes={undefined}
      allEdges={undefined}
    />
  );
}
