/**
 * lib/canvas/types.ts — Library Canvas type definitions.
 *
 * Phase 16: Generative Library Canvas — Neptune Control Panel OS
 * Namespace: 'LibraryCanvas' (NOT 'Artifact' — avoids collision with chat/artifact.tsx)
 */

// ── Canvas Modes ──────────────────────────────────────────────────────────────

export type CanvasMode =
  | "library-overview"
  | "connector-detail"
  | "skill-detail"
  | "function-detail"
  | "playbook-detail"
  | "workflow-canvas"
  | "kg-explorer"
  | "wiki-browser"
  | "add-new";

// ── Canvas Context (typed per mode) ───────────────────────────────────────────

export interface CanvasContext {
  connectorName?: string;
  skillName?: string;
  functionName?: string;
  playbookName?: string;
  workflowName?: string;
  kgNode?: string;
  wikiPath?: string;
  addType?: "connector" | "skill" | "function" | "playbook" | "workflow";
}

// ── History Entry ─────────────────────────────────────────────────────────────

export interface CanvasHistoryEntry {
  mode: CanvasMode;
  context: CanvasContext;
  ts: number;
}

// ── Mode Props (contract every mode component must satisfy) ───────────────────

export interface ModeProps {
  context: CanvasContext;
  onNavigate: (mode: CanvasMode, context?: CanvasContext) => void;
}

// ── Synthesis Response (from /api/canvas/synthesize/[type]/[name]) ────────────

export interface SynthesisResponse {
  meta: {
    type: string;
    name: string;
    version?: string;
    lastUpdated?: string;
  };
  markdown: string;
  sections: Array<{ id: string; title: string; content: string }>;
  reverseRefs: {
    playbooks: string[];
    workflows: string[];
    skills: string[];
    functions: string[];
  };
  edges: GraphEdge[];
  usage: {
    last7d: {
      tokens: number;
      cost: number;
      calls: number;
      successRate: number;
    };
    sparkline: number[];
  };
  kgNeighbors: GraphNode[];
  wikiRefs: Array<{ path: string; title: string; snippet: string }>;
  constraints?: {
    tokens?: number;
    latency?: number;
    cost?: number;
    deps?: string[];
  };
  signatures?: {
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  };
  triggers?: string[];
  modelRouting?: Record<string, string>;
}

export interface GraphNode {
  id: string;
  type: "connector" | "skill" | "function" | "playbook" | "workflow";
  name: string;
  label: string;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  fromType: string;
  to: string;
  toType: string;
  type: string;
  weight: number;
}

// ── Enriched Graph Response (from /api/library/graph?enrich=usage) ────────────

export interface EnrichedLibraryGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    totalNodes: number;
    totalEdges: number;
    byType: Record<string, number>;
  };
  usage: {
    tokensThisWeek: number;
    costThisWeek: number;
    evalPassRate: number;
    sparkline: Array<{ ts: string; tokens: number; cost: number; successRate: number }>;
  };
  recent: Array<{
    type: string;
    name: string;
    label: string;
    viewedAt: string;
  }>;
}
