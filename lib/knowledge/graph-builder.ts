/**
 * Graph Builder — Build D3-compatible graph data from parsed knowledge
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 — Reference Implementation
 * Transforms KnowledgeGraph into D3 force-directed graph format
 * with layout optimization and interaction helpers.
 */

import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraph,
} from "./parser";

// ============================================================================
// D3 GRAPH FORMAT
// ============================================================================

export interface D3Node extends KnowledgeNode {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  index?: number;
}

export interface D3Edge {
  source: D3Node | string;
  target: D3Node | string;
  label: string;
}

export interface D3GraphData {
  nodes: D3Node[];
  edges: D3Edge[];
}

// ============================================================================
// COLOR MAPPING
// ============================================================================

export const TYPE_COLORS: Record<string, string> = {
  skill: "#14B8A6",
  playbook: "#3B82F6",
  prd: "#8B5CF6",
  trd: "#7C3AED",
  design: "#EC4899",
  navigation: "#F43F5E",
  implementation: "#F97316",
  research: "#06B6D4",
  mission: "#22C55E",
  memory: "#F59E0B",
  concept: "#64748B",
  connector: "#84CC16",
  workflow: "#EAB308",
  index: "#475569",
  log: "#475569",
};

export const TYPE_ICONS: Record<string, string> = {
  skill: "⚡",
  playbook: "📋",
  prd: "📄",
  trd: "🔧",
  design: "🎨",
  navigation: "🗺️",
  implementation: "⚙️",
  research: "🔍",
  mission: "🎯",
  memory: "🧠",
  concept: "💡",
  connector: "🔌",
  workflow: "⚡",
  index: "📑",
  log: "📝",
};

export function getTypeColor(type: string): string {
  return TYPE_COLORS[type] || TYPE_COLORS.concept;
}

export function getTypeIcon(type: string): string {
  return TYPE_ICONS[type] || "";
}

// ============================================================================
// NODE SIZE CALCULATION
// ============================================================================

export function getNodeRadius(node: KnowledgeNode): number {
  const base = 5;
  const max = 18;
  const linkBonus = Math.min(node.linkCount * 1.5, 10);

  // Type-based sizing
  const typeSizes: Record<string, number> = {
    playbook: 3,
    skill: 2,
    prd: 2,
    mission: 1,
    index: -2,
    log: -3,
  };

  const typeBonus = typeSizes[node.type] || 0;
  return Math.max(base, Math.min(max, base + linkBonus + typeBonus));
}

// ============================================================================
// LAYOUT PRESETS
// ============================================================================

export interface LayoutConfig {
  chargeStrength: number;
  linkDistance: number;
  centerForce: number;
  collideRadius: number;
  alphaDecay: number;
}

export const LAYOUT_PRESETS: Record<string, LayoutConfig> = {
  default: {
    chargeStrength: -300,
    linkDistance: 100,
    centerForce: 0.1,
    collideRadius: 20,
    alphaDecay: 0.02,
  },
  compact: {
    chargeStrength: -150,
    linkDistance: 60,
    centerForce: 0.3,
    collideRadius: 10,
    alphaDecay: 0.05,
  },
  spread: {
    chargeStrength: -500,
    linkDistance: 200,
    centerForce: 0.05,
    collideRadius: 30,
    alphaDecay: 0.01,
  },
};

// ============================================================================
// GRAPH TRANSFORMER
// ============================================================================

export function toD3Graph(
  graph: KnowledgeGraph,
  filter?: { type?: string; domain?: string }
): D3GraphData {
  let nodes = graph.nodes;

  if (filter?.type && filter.type !== "ALL") {
    nodes = nodes.filter((n) => n.type === filter.type);
  }
  if (filter?.domain) {
    nodes = nodes.filter((n) => n.domain === filter.domain);
  }

  const nodeIdSet = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter(
    (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
  );

  return {
    nodes: nodes.map((n) => ({ ...n })),
    edges: edges.map((e) => ({ ...e })),
  };
}

// ============================================================================
// DOMAIN GROUPING (for playbook view)
// ============================================================================

export interface DomainGroup {
  domain: string;
  label: string;
  nodes: KnowledgeNode[];
  totalLinks: number;
  skillCount: number;
  playbookCount: number;
  prdCount: number;
}

export function groupByDomain(graph: KnowledgeGraph): DomainGroup[] {
  const domainMap = new Map<string, KnowledgeNode[]>();

  for (const node of graph.nodes) {
    const domain = node.domain || "ungrouped";
    if (!domainMap.has(domain)) domainMap.set(domain, []);
    domainMap.get(domain)!.push(node);
  }

  const groups: DomainGroup[] = [];

  for (const [domain, nodes] of domainMap) {
    const nodeIds = new Set(nodes.map((n) => n.id));
    const totalLinks = graph.edges.filter(
      (e) => nodeIds.has(e.source) || nodeIds.has(e.target)
    ).length;

    groups.push({
      domain,
      label: domain
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      nodes,
      totalLinks,
      skillCount: nodes.filter((n) => n.type === "skill").length,
      playbookCount: nodes.filter((n) => n.type === "playbook").length,
      prdCount: nodes.filter((n) => n.type === "prd").length,
    });
  }

  return groups.sort((a, b) => b.totalLinks - a.totalLinks);
}

// ============================================================================
// RECENT CHANGES
// ============================================================================

export interface RecentChange {
  node: KnowledgeNode;
  changeType: "created" | "updated" | "deleted";
  timestamp: Date;
  relativeTime: string;
}

export function getRecentChanges(graph: KnowledgeGraph, limit = 20): RecentChange[] {
  return graph.nodes
    .map((node) => ({
      node,
      changeType: "updated" as const,
      timestamp: node.lastModified,
      relativeTime: getRelativeTime(node.lastModified),
    }))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

function getRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString();
}

// ============================================================================
// GRAPH STATS
// ============================================================================

export function computeGraphStats(graph: KnowledgeGraph) {
  const typeDistribution = graph.stats.byType;
  const domainDistribution = graph.stats.byDomain;

  const mostLinked = [...graph.nodes]
    .sort((a, b) => b.linkCount - a.linkCount)
    .slice(0, 10);

  const isolates = graph.nodes.filter((n) => n.linkCount === 0);

  return {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    typeDistribution,
    domainDistribution,
    mostLinked,
    isolateCount: isolates.length,
    avgLinks: graph.nodes.length > 0
      ? (graph.edges.length / graph.nodes.length).toFixed(1)
      : "0",
  };
}
