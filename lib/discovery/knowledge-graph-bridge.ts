/**
 * lib/discovery/knowledge-graph-bridge.ts
 * Phase 38 Stream 7 — Knowledge Graph Integration
 *
 * Bridges discovery dependency graphs into the existing Neptune Knowledge Graph.
 *
 * Capabilities:
 * 1. Convert DependencyGraph → D3-compatible graph data for visualization
 * 2. Persist discovery graphs to PostgreSQL library_knowledge_graph table
 * 3. Query discovery graphs with temporal filters (by run, date range, severity)
 * 4. Merge multiple discovery runs into a unified customer graph
 * 5. Export as Graphviz DOT or Mermaid diagram
 */

import { randomUUID } from "crypto";
import type {
  DependencyGraph,
  GraphNode,
  GraphEdge,
  GraphCycle,
  ActionChain,
} from "./types";
import { summarizeGraph, type GraphSummary } from "./dependency-graph";

// ── D3 Conversion (compatible with existing knowledge graph) ──────

export interface D3Node {
  id: string;
  type: string;
  label: string;
  group?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  data: Record<string, unknown>;
  severity?: string; // for cycle nodes
}

export interface D3Edge {
  source: string;
  target: string;
  label: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

export interface D3GraphData {
  nodes: D3Node[];
  edges: D3Edge[];
}

// Color mapping for discovery node types
const DISCOVERY_TYPE_COLORS: Record<string, string> = {
  customer: "#3B82F6",
  agent: "#8B5CF6",
  ticket: "#F97316",
  payment: "#22C55E",
  subscription: "#14B8A6",
  action: "#EAB308",
  call: "#EC4899",
};

const EDGE_TYPE_COLORS: Record<string, string> = {
  ACTIVE_SUBSCRIPTION: "#14B8A6",
  HAS_OPEN_TICKET: "#F97316",
  REQUESTED_BY: "#8B5CF6",
  REQUIRES_ACTION: "#EAB308",
  LAST_CALL: "#EC4899",
  SHOULD_BE_CHARGED: "#22C55E",
  PROMISED_TO: "#3B82F6",
  ESCALATED_TO: "#F43F5E",
  MENTIONED_IN: "#94A3B8",
};

/**
 * Converts a discovery DependencyGraph into D3-compatible format.
 */
export function toD3Format(graph: DependencyGraph): D3GraphData {
  const nodes: D3Node[] = [];
  const edges: D3Edge[] = [];

  for (const [, node] of graph.nodes) {
    nodes.push({
      id: node.id,
      type: node.type,
      label: node.label,
      group: node.type,
      data: node.data,
    });
  }

  for (const edge of graph.edges) {
    edges.push({
      source: edge.from,
      target: edge.to,
      label: edge.type,
      type: edge.type,
      metadata: edge.metadata,
    });
  }

  return { nodes, edges };
}

/**
 * Converts to D3 format with additional discovery-specific metadata
 * for enhanced visualization.
 */
export function toRichD3Format(graph: DependencyGraph): D3GraphData & {
  summary: GraphSummary;
  cycles: GraphCycle[];
  chains: ActionChain[];
  typeColors: Record<string, string>;
  edgeColors: Record<string, string>;
} {
  const d3 = toD3Format(graph);
  return {
    ...d3,
    summary: summarizeGraph(graph),
    cycles: graph.cycles,
    chains: graph.chains,
    typeColors: DISCOVERY_TYPE_COLORS,
    edgeColors: EDGE_TYPE_COLORS,
  };
}

// ── Graph Merging ──────────────────────────────────────────────────

/**
 * Merges multiple discovery graphs (e.g., from different runs) into one
 * unified graph. Deduplicates nodes by ID and edges by from→to→type.
 */
export function mergeGraphs(graphs: DependencyGraph[]): DependencyGraph {
  const mergedNodes = new Map<string, GraphNode>();
  const mergedEdges: GraphEdge[] = [];
  const mergedCycles: GraphCycle[] = [];
  const mergedChains: ActionChain[] = [];
  const edgeSet = new Set<string>();

  for (const graph of graphs) {
    for (const [id, node] of graph.nodes) {
      if (!mergedNodes.has(id)) {
        mergedNodes.set(id, { ...node });
      } else {
        // Merge data
        const existing = mergedNodes.get(id)!;
        existing.data = { ...existing.data, ...node.data };
      }
    }

    for (const edge of graph.edges) {
      const edgeKey = `${edge.from}→${edge.to}→${edge.type}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        mergedEdges.push({ ...edge });
      }
    }

    mergedCycles.push(...graph.cycles);
    mergedChains.push(...graph.chains);
  }

  return {
    nodes: mergedNodes,
    edges: mergedEdges,
    cycles: mergedCycles,
    chains: mergedChains,
  };
}

// ── Graph Querying ─────────────────────────────────────────────────

export interface GraphQuery {
  nodeTypes?: string[];
  edgeTypes?: string[];
  customerId?: string;
  agentName?: string;
  minSeverity?: string;
  limit?: number;
}

/**
 * Queries a discovery graph with filters.
 */
export function queryGraph(
  graph: DependencyGraph,
  query: GraphQuery
): DependencyGraph {
  const filteredNodes = new Map<string, GraphNode>();
  const filteredEdges: GraphEdge[] = [];
  const filteredCycles: GraphCycle[] = [];
  const filteredChains: ActionChain[] = [];

  // Filter nodes
  for (const [id, node] of graph.nodes) {
    if (query.nodeTypes && !query.nodeTypes.includes(node.type)) continue;
    if (query.customerId && node.type === "customer" && node.data.customerId !== query.customerId) continue;
    if (query.agentName && node.type === "agent" && node.data.agentName !== query.agentName) continue;
    filteredNodes.set(id, node);
  }

  // Filter edges (only include edges where both ends are in filtered nodes)
  for (const edge of graph.edges) {
    if (query.edgeTypes && !query.edgeTypes.includes(edge.type)) continue;
    if (filteredNodes.has(edge.from) && filteredNodes.has(edge.to)) {
      filteredEdges.push(edge);
    }
  }

  // Filter cycles
  for (const cycle of graph.cycles) {
    if (query.minSeverity) {
      const sevOrder = ["low", "medium", "high", "critical"];
      if (sevOrder.indexOf(cycle.severity) < sevOrder.indexOf(query.minSeverity)) continue;
    }
    filteredCycles.push(cycle);
  }

  // Limit
  if (query.limit && query.limit > 0) {
    return {
      nodes: new Map([...filteredNodes.entries()].slice(0, query.limit)),
      edges: filteredEdges.slice(0, query.limit),
      cycles: filteredCycles.slice(0, query.limit),
      chains: filteredChains.slice(0, query.limit),
    };
  }

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    cycles: filteredCycles,
    chains: filteredChains,
  };
}

// ── Graph Export Formats ───────────────────────────────────────────

/**
 * Exports graph as Graphviz DOT format for rendering with viz.js or graphviz.
 */
export function toGraphvizDOT(graph: DependencyGraph, title = "Discovery Graph"): string {
  const lines: string[] = [];
  lines.push(`digraph "${title}" {`);
  lines.push(`  rankdir=LR;`);
  lines.push(`  node [shape=box, style=rounded];`);
  lines.push("");

  // Node declarations with colors
  for (const [, node] of graph.nodes) {
    const color = DISCOVERY_TYPE_COLORS[node.type] || "#94A3B8";
    const label = node.label.replace(/"/g, '\\"');
    lines.push(`  "${node.id}" [label="${node.type}: ${label}", fillcolor="${color}20", color="${color}", style="filled,rounded"];`);
  }

  lines.push("");

  // Edge declarations
  for (const edge of graph.edges) {
    const color = EDGE_TYPE_COLORS[edge.type] || "#94A3B8";
    lines.push(`  "${edge.from}" -> "${edge.to}" [label="${edge.type}", color="${color}"];`);
  }

  lines.push("");
  lines.push(`  label="${title}";`);
  lines.push(`  fontsize=14;`);
  lines.push("}");

  return lines.join("\n");
}

/**
 * Exports graph as Mermaid diagram (compatible with GitHub, Notion, etc.).
 */
export function toMermaid(graph: DependencyGraph, title = "Discovery Graph"): string {
  const lines: string[] = [];
  lines.push("```mermaid");
  lines.push("graph LR");
  lines.push(`  %% ${title}`);

  // Node aliases (shortened for readability)
  const aliasMap = new Map<string, string>();
  let counter = 0;
  for (const [id, node] of graph.nodes) {
    const alias = `N${counter++}`;
    aliasMap.set(id, alias);
    const label = node.label.length > 30 ? node.label.slice(0, 27) + "..." : node.label;
    lines.push(`  ${alias}["${node.type}: ${label.replace(/"/g, '#quot;')}"]`);
    // Add class for styling
    lines.push(`  class ${alias} ${node.type}_node`);
  }

  lines.push("");

  // Edges
  for (const edge of graph.edges) {
    const fromAlias = aliasMap.get(edge.from);
    const toAlias = aliasMap.get(edge.to);
    if (fromAlias && toAlias) {
      lines.push(`  ${fromAlias} -->|"${edge.type}"| ${toAlias}`);
    }
  }

  // Style classes
  for (const [type, color] of Object.entries(DISCOVERY_TYPE_COLORS)) {
    lines.push(`  classDef ${type}_node fill:${color}20,stroke:${color},stroke-width:2px`);
  }

  lines.push("```");
  return lines.join("\n");
}

// ── Graph Analysis ─────────────────────────────────────────────────

export interface CustomerGraphSummary {
  customerId: string;
  name: string;
  totalConnections: number;
  openTickets: number;
  activeSubscriptions: number;
  agentsInvolved: string[];
  pendingActions: number;
  cycleCount: number;
  stalledChains: number;
  riskScore: number; // 0-100, higher = more at risk
}

/**
 * Computes per-customer risk scores and summaries from the graph.
 */
export function analyzeCustomerGraphs(
  graph: DependencyGraph
): CustomerGraphSummary[] {
  const summaries: CustomerGraphSummary[] = [];
  const customerNodes = [...graph.nodes.values()].filter((n) => n.type === "customer");

  for (const cNode of customerNodes) {
    const customerId = cNode.data.customerId as string || cNode.id.replace("customer:", "");

    // Count connections
    const connections = graph.edges.filter(
      (e) => e.from === cNode.id || e.to === cNode.id
    );

    // Count various elements
    let openTickets = 0;
    let activeSubscriptions = 0;
    let pendingActions = 0;
    const agentsInvolved = new Set<string>();

    for (const conn of connections) {
      const targetId = conn.from === cNode.id ? conn.to : conn.from;
      const targetNode = graph.nodes.get(targetId);

      if (conn.type === "HAS_OPEN_TICKET") openTickets++;
      if (conn.type === "ACTIVE_SUBSCRIPTION") activeSubscriptions++;
      if (conn.type === "REQUIRES_ACTION") pendingActions++;
      if (targetNode?.type === "agent" && conn.type === "MENTIONED_IN") {
        agentsInvolved.add(targetNode.label);
      }
    }

    // Risk score calculation
    let riskScore = 0;
    riskScore += openTickets * 10;
    riskScore += pendingActions * 15;
    riskScore += activeSubscriptions === 0 ? 5 : 0; // No subscription is moderate risk

    // Cycles involving this customer increase risk
    const customerCycles = graph.cycles.filter(
      (c) => c.path.includes(cNode.id)
    );
    riskScore += customerCycles.filter((c) => c.severity === "critical").length * 25;
    riskScore += customerCycles.filter((c) => c.severity === "high").length * 15;

    // Stalled chains increase risk
    const customerChains = graph.chains.filter(
      (c) => c.steps.includes(cNode.id) && c.status === "stalled"
    );
    riskScore += customerChains.length * 20;

    riskScore = Math.min(100, riskScore);

    summaries.push({
      customerId,
      name: cNode.label,
      totalConnections: connections.length,
      openTickets,
      activeSubscriptions,
      agentsInvolved: [...agentsInvolved],
      pendingActions,
      cycleCount: customerCycles.length,
      stalledChains: customerChains.length,
      riskScore,
    });
  }

  // Sort by risk score descending
  summaries.sort((a, b) => b.riskScore - a.riskScore);

  return summaries;
}

// ── Persistence Layer ──────────────────────────────────────────────

export interface PersistedGraph {
  id: string;
  runId: string;
  createdAt: string;
  graphJson: string; // Serialized D3GraphData
  summary: GraphSummary;
  customerRiskScores: CustomerGraphSummary[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    cycleCount: number;
    chainCount: number;
    runCompletedAt?: string;
  };
}

/**
 * Prepares a graph for persistence (serializes Map to plain objects).
 */
export function prepareForPersistence(
  runId: string,
  graph: DependencyGraph
): PersistedGraph {
  const d3 = toRichD3Format(graph);
  const riskScores = analyzeCustomerGraphs(graph);

  return {
    id: `kg-${runId}`,
    runId,
    createdAt: new Date().toISOString(),
    graphJson: JSON.stringify({
      nodes: d3.nodes,
      edges: d3.edges,
      cycles: d3.cycles,
      chains: d3.chains,
      typeColors: d3.typeColors,
      edgeColors: d3.edgeColors,
    }),
    summary: d3.summary,
    customerRiskScores: riskScores,
    metadata: {
      totalNodes: graph.nodes.size,
      totalEdges: graph.edges.length,
      cycleCount: graph.cycles.length,
      chainCount: graph.chains.length,
    },
  };
}

/**
 * Deserializes a persisted graph back to DependencyGraph.
 */
export function deserializeFromPersistence(persisted: PersistedGraph): {
  graph: DependencyGraph;
  d3: D3GraphData & {
    summary: GraphSummary;
    cycles: GraphCycle[];
    chains: ActionChain[];
    typeColors: Record<string, string>;
    edgeColors: Record<string, string>;
  };
  riskScores: CustomerGraphSummary[];
} {
  const parsed = JSON.parse(persisted.graphJson);

  const nodeMap = new Map<string, GraphNode>();
  if (Array.isArray(parsed.nodes)) {
    for (const n of parsed.nodes) {
      nodeMap.set(n.id, {
        id: n.id,
        type: n.type,
        label: n.label,
        data: n.data || {},
      });
    }
  }

  const edges: GraphEdge[] = (parsed.edges || []).map((e: Record<string, unknown>) => ({
    from: e.source as string || e.from as string,
    to: e.target as string || e.to as string,
    type: (e.type as GraphEdge["type"]) || (e.label as GraphEdge["type"]),
    metadata: e.metadata as Record<string, unknown>,
    timestamp: e.timestamp as string,
  }));

  const cycles: GraphCycle[] = parsed.cycles || [];
  const chains: ActionChain[] = parsed.chains || [];

  const graph: DependencyGraph = { nodes: nodeMap, edges, cycles, chains };

  return {
    graph,
    d3: {
      nodes: parsed.nodes || [],
      edges: parsed.edges || [],
      summary: persisted.summary,
      cycles,
      chains,
      typeColors: parsed.typeColors || DISCOVERY_TYPE_COLORS,
      edgeColors: parsed.edgeColors || EDGE_TYPE_COLORS,
    },
    riskScores: persisted.customerRiskScores,
  };
}

// ── Temporal Queries ───────────────────────────────────────────────

/**
 * Filters graph to a specific time window based on edge/cycle timestamps.
 */
export function filterByTimeRange(
  graph: DependencyGraph,
  startDate: Date,
  endDate: Date
): DependencyGraph {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  const filteredEdges = graph.edges.filter((e) => {
    if (!e.timestamp) return true;
    const ts = new Date(e.timestamp).getTime();
    return ts >= startMs && ts <= endMs;
  });

  // Keep nodes that are referenced by filtered edges
  const referencedNodes = new Set<string>();
  for (const edge of filteredEdges) {
    referencedNodes.add(edge.from);
    referencedNodes.add(edge.to);
  }

  // Also keep customer nodes always
  for (const [id, node] of graph.nodes) {
    if (node.type === "customer") referencedNodes.add(id);
  }

  const filteredNodes = new Map<string, GraphNode>();
  for (const id of referencedNodes) {
    const node = graph.nodes.get(id);
    if (node) filteredNodes.set(id, node);
  }

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    cycles: graph.cycles,
    chains: graph.chains,
  };
}
