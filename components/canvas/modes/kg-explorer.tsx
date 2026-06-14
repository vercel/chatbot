"use client";

/**
 * components/canvas/modes/kg-explorer.tsx — Knowledge Graph Explorer mode.
 *
 * Phase 16.G: react-force-graph-2d visualization with glass-card tooltips.
 * Click a node to push its detail mode. Filter by entity type.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ModeProps } from "@/lib/canvas/types";
import { GitBranch, Search, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

import type { GraphNode, GraphEdge } from "@/lib/canvas/types";

// ── Dynamic import for react-force-graph-2d (SSR incompatible) ────────────────

interface KgExplorerGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (node: GraphNode) => void;
}

function ForceGraphWrapper({ nodes, edges, onNodeClick }: KgExplorerGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ForceGraph, setForceGraph] = useState<any>(null);

  // Load react-force-graph-2d on client only
  useEffect(() => {
    import("react-force-graph-2d").then((mod) => {
      setForceGraph(() => mod.default);
    });
  }, []);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!ForceGraph) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Transform for react-force-graph-2d format
  const graphData = {
    nodes: nodes.map((n) => ({
      id: n.id,
      name: n.label || n.name,
      type: n.type,
      val: n.type === "connector" ? 8 : n.type === "playbook" ? 6 : 4,
      color: nodeColor(n.type),
    })),
    links: edges.map((e) => ({
      source: e.from,
      target: e.to,
      type: e.type,
      value: e.weight,
    })),
  };

  return (
    <ForceGraph
      width={dimensions.width}
      height={dimensions.height}
      graphData={graphData}
      nodeLabel="name"
      nodeColor="color"
      linkDirectionalArrowLength={4}
      linkDirectionalArrowRelPos={1}
      linkCurvature={0.25}
      onNodeClick={(node: Record<string, unknown>) => {
        const n = nodes.find((n) => n.id === node.id);
        if (n) onNodeClick(n);
      }}
      cooldownTicks={100}
      enableNodeDrag
      enableZoomInteraction
    />
  );
}

function nodeColor(type: string): string {
  switch (type) {
    case "connector":
      return "#0A84FF";
    case "skill":
      return "#A855F7";
    case "function":
      return "#10B981";
    case "playbook":
      return "#F59E0B";
    case "workflow":
      return "#6366F1";
    default:
      return "#6B7280";
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

const ENTITY_TYPES = ["connector", "skill", "function", "playbook", "workflow"] as const;

export function KgExplorer({ context, onNavigate }: ModeProps) {
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());

  // Fetch graph data
  useEffect(() => {
    async function fetchGraph() {
      try {
        setLoading(true);
        const res = await fetch("/api/library/graph");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setGraph({ nodes: data.nodes, edges: data.edges });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load graph");
      } finally {
        setLoading(false);
      }
    }
    fetchGraph();
  }, []);

  // Filter nodes
  const filteredNodes = graph?.nodes.filter((n) => {
    if (typeFilter.size > 0 && !typeFilter.has(n.type)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        n.name.toLowerCase().includes(q) ||
        n.label.toLowerCase().includes(q)
      );
    }
    return true;
  }) || [];

  // Filtered edges (only those connecting filtered nodes)
  const nodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges =
    graph?.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to)) || [];

  // Handle node click
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      const modeMap: Record<string, string> = {
        connector: "connector-detail",
        skill: "skill-detail",
        function: "function-detail",
        playbook: "playbook-detail",
        workflow: "workflow-canvas",
      };
      const mode = modeMap[node.type] || "library-overview";
      const ctx: Record<string, string> = {};
      if (node.type === "connector") ctx.connectorName = node.name;
      if (node.type === "skill") ctx.skillName = node.name;
      if (node.type === "function") ctx.functionName = node.name;
      if (node.type === "playbook") ctx.playbookName = node.name;
      if (node.type === "workflow") ctx.workflowName = node.name;

      onNavigate(mode as Parameters<typeof onNavigate>[0], ctx);
    },
    [onNavigate],
  );

  const toggleTypeFilter = (type: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Controls ────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 p-3 border-b border-border/30 space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full h-8 pl-8 pr-7 rounded-lg",
              "bg-muted/20 text-xs",
              "border border-border/30",
              "focus:outline-none focus:ring-1 focus:ring-primary/20",
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted-foreground/10"
            >
              <X className="h-3 w-3 text-muted-foreground/50" />
            </button>
          )}
        </div>

        {/* Type filter chips */}
        <div className="flex flex-wrap gap-1">
          {ENTITY_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => toggleTypeFilter(type)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                typeFilter.has(type)
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-muted/20 text-muted-foreground/50 border border-transparent hover:border-border/30",
              )}
            >
              {type}
              {typeFilter.has(type) && (
                <span className="ml-1 text-[10px]">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Graph ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0" ref={() => {}}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground/50">Loading graph...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <div className="w-full h-full" id="kg-container">
            <ForceGraphWrapper
              nodes={filteredNodes}
              edges={filteredEdges}
              onNodeClick={handleNodeClick}
            />
          </div>
        )}
      </div>

      {/* ── Footer stats ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 p-2 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground/40">
        <span>
          {filteredNodes.length} nodes · {filteredEdges.length} edges
        </span>
        <span>Click node to explore</span>
      </div>
    </div>
  );
}
