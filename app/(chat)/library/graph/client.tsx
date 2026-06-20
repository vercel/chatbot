"use client";

/**
 * Phase 24: Visual KG Explorer — Force-Directed Graph
 *
 * Uses react-force-graph-2d for rendering.
 * Glass styling from Phase 22.
 * Mobile-first 375px.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Fuse from "fuse.js";
import {
  Search,
  RotateCcw,
  X,
  ExternalLink,
  MessageSquare,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Dynamic import to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[70vh]">
      <Loader2 className="size-8 animate-spin text-cyan-400" />
    </div>
  ),
});

// ── Types ────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  name: string;
  type: string;
  metadata?: Record<string, unknown>;
  x?: number;
  y?: number;
}

interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  type?: string;
  weight?: number;
  confidence_score?: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphEdge[];
}

// ── Color Maps ──────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  connector: "#3B82F6",
  playbook: "#10B981",
  skill: "#8B5CF6",
  function: "#6366F1",
  workflow: "#F59E0B",
  panel: "#EC4899",
  v2_handoff: "#F97316",
  model: "#EAB308",
};

const EDGE_COLORS: Record<string, string> = {
  uses: "#94A3B8",
  routes_to: "#3B82F6",
  exposes: "#10B981",
  pairs_with: "#EC4899",
  succeeded_in: "#22C55E",
  depends_on: "#F97316",
};

const NODE_TYPE_LABELS: Record<string, string> = {
  connector: "Connector",
  playbook: "Playbook",
  skill: "Skill",
  function: "Function",
  workflow: "Workflow",
  panel: "Panel",
  v2_handoff: "V2 Handoff",
  model: "Model",
};

// ── Component ───────────────────────────────────────────────────

interface GraphClientProps {
  initialData: GraphData;
  focusId?: string;
}

export function GraphClient({ initialData, focusId }: GraphClientProps) {
  const router = useRouter();
  const graphRef = useRef<any>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set([
      "connector",
      "playbook",
      "skill",
      "function",
      "workflow",
      "panel",
      "v2_handoff",
    ])
  );
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(
    new Set()
  );
  const [relatedNodes, setRelatedNodes] = useState<GraphNode[]>([]);

  // Filter data based on visible types
  const filteredData = useMemo(() => {
    const visibleNodes = initialData.nodes.filter((n) =>
      visibleTypes.has(n.type)
    );
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleLinks = initialData.links.filter(
      (e) =>
        visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );
    return { nodes: visibleNodes, links: visibleLinks };
  }, [initialData, visibleTypes]);

  // Fuzzy search
  const fuse = useMemo(
    () =>
      new Fuse(filteredData.nodes, {
        keys: ["name", "type"],
        threshold: 0.3,
      }),
    [filteredData.nodes]
  );

  useEffect(() => {
    if (searchQuery.trim()) {
      const results = fuse.search(searchQuery);
      setHighlightNodes(new Set(results.map((r) => r.item.id)));
    } else {
      setHighlightNodes(new Set());
    }
  }, [searchQuery, fuse]);

  // Get related nodes (hop=1)
  const getRelatedNodes = useCallback(
    (nodeId: string) => {
      const related = initialData.links
        .filter((e) => e.source === nodeId || e.target === nodeId)
        .map((e) => (e.source === nodeId ? e.target : e.source));
      return initialData.nodes.filter((n) => related.includes(n.id));
    },
    [initialData]
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node);
      setRelatedNodes(getRelatedNodes(node.id));
    },
    [getRelatedNodes]
  );

  const handleTryInChat = (node: GraphNode) => {
    router.push(
      `/?prompt=${encodeURIComponent(`Tell me about the ${node.type}: ${node.name}`)}`
    );
  };

  const handleViewInWiki = (node: GraphNode) => {
    router.push(`/library/wiki?focus=${node.id}`);
  };

  const toggleType = (type: string) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const resetView = () => {
    setSearchQuery("");
    setSelectedNode(null);
    setHighlightNodes(new Set());
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50);
    }
  };

  // Focus on node from URL param
  useEffect(() => {
    if (focusId) {
      const node = initialData.nodes.find((n) => n.id === focusId);
      if (node) {
        setSelectedNode(node);
        setRelatedNodes(getRelatedNodes(node.id));
        // Center on node after graph settles
        setTimeout(() => {
          if (graphRef.current && node.x && node.y) {
            graphRef.current.centerAt(node.x, node.y, 1000);
            graphRef.current.zoom(3, 1000);
          }
        }, 500);
      }
    }
  }, [focusId, initialData.nodes, getRelatedNodes]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#0A0A0F]">
      {/* Top Bar */}
      <div className="flex items-center gap-3 p-3 border-b border-white/5 bg-[#0A0A0F]/80 backdrop-blur-xl shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-lg" role="img" aria-label="brain">
            🧠
          </span>
          <h1 className="text-sm font-semibold text-white/90">
            Knowledge Graph
          </h1>
          <span className="text-xs text-white/30">
            {filteredData.nodes.length} nodes &middot;{" "}
            {filteredData.links.length} links
          </span>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/30" />
          <input
            type="text"
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80
                       placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* Type filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(NODE_TYPE_LABELS).map(([type, label]) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-medium transition-all border shrink-0",
                visibleTypes.has(type)
                  ? "border-white/20 text-white/80"
                  : "border-white/5 text-white/20 bg-transparent"
              )}
              style={{
                borderColor: visibleTypes.has(type)
                  ? NODE_COLORS[type] + "80"
                  : undefined,
              }}
            >
              <span
                className="inline-block size-1.5 rounded-full mr-1"
                style={{ backgroundColor: NODE_COLORS[type] }}
              />
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={resetView}
          className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white/80 transition-colors shrink-0"
          title="Reset view"
          aria-label="Reset view"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>

      {/* Graph + Side Panel */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Force Graph */}
        <div className="flex-1">
          <ForceGraph2D
            ref={graphRef}
            graphData={filteredData}
            nodeLabel="name"
            nodeColor={(node: GraphNode) => {
              if (
                highlightNodes.size > 0 &&
                !highlightNodes.has(node.id)
              ) {
                return NODE_COLORS[node.type] + "30";
              }
              return NODE_COLORS[node.type] || "#6B7280";
            }}
            nodeRelSize={6}
            nodeVal={(node: GraphNode) => {
              if (selectedNode?.id === node.id) return 8;
              return 4;
            }}
            linkColor={(link: GraphEdge) => {
              const color =
                EDGE_COLORS[link.type || ""] || "#475569";
              if (highlightNodes.size > 0) {
                const sourceIn = highlightNodes.has(
                  link.source as string
                );
                const targetIn = highlightNodes.has(
                  link.target as string
                );
                if (!sourceIn && !targetIn)
                  return color + "15";
              }
              return color + "60";
            }}
            linkWidth={(link: GraphEdge) => {
              const w =
                link.weight || link.confidence_score || 0.5;
              return Math.max(0.5, w * 3);
            }}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={2}
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => setSelectedNode(null)}
            width={
              typeof window !== "undefined"
                ? window.innerWidth - (selectedNode ? 320 : 0)
                : 800
            }
            height={
              typeof window !== "undefined"
                ? window.innerHeight - 100
                : 600
            }
            cooldownTicks={100}
            d3VelocityDecay={0.3}
          />
        </div>

        {/* Side Panel */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 200,
              }}
              className="w-80 shrink-0 border-l border-white/10 bg-[#0A0A0F]/90 backdrop-blur-xl overflow-y-auto relative"
            >
              <div className="p-4 space-y-4">
                {/* Close */}
                <button
                  onClick={() => setSelectedNode(null)}
                  className="absolute top-3 right-3 p-1 rounded-lg bg-white/5 text-white/40 hover:text-white/80"
                  aria-label="Close panel"
                >
                  <X className="size-4" />
                </button>

                {/* Entity header */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{
                        backgroundColor:
                          NODE_COLORS[selectedNode.type],
                      }}
                    />
                    <span className="text-[10px] uppercase tracking-wider text-white/30">
                      {NODE_TYPE_LABELS[selectedNode.type] ||
                        selectedNode.type}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-white/90">
                    {selectedNode.name}
                  </h2>
                  <p className="text-xs text-white/40 font-mono">
                    {selectedNode.id.slice(0, 12)}...
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      handleTryInChat(selectedNode)
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10
                               border border-cyan-500/20 text-xs text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                  >
                    <MessageSquare className="size-3" />
                    Try in Chat
                  </button>
                  <button
                    onClick={() =>
                      handleViewInWiki(selectedNode)
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5
                               border border-white/10 text-xs text-white/60 hover:bg-white/10 transition-colors"
                  >
                    <ExternalLink className="size-3" />
                    Wiki
                  </button>
                </div>

                {/* Metadata */}
                {selectedNode.metadata && (
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
                      Metadata
                    </h3>
                    <pre
                      className="p-3 rounded-lg bg-white/[0.03] border border-white/5 text-[11px] text-white/60
                                   font-mono overflow-x-auto max-h-40 overflow-y-auto"
                    >
                      {JSON.stringify(
                        selectedNode.metadata,
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}

                {/* Related Entities (hop=1) */}
                {relatedNodes.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
                      Related ({relatedNodes.length})
                    </h3>
                    <div className="space-y-1">
                      {relatedNodes
                        .slice(0, 10)
                        .map((node) => (
                          <button
                            key={node.id}
                            onClick={() => {
                              setSelectedNode(node);
                              setRelatedNodes(
                                getRelatedNodes(node.id)
                              );
                            }}
                            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                          >
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  NODE_COLORS[node.type],
                              }}
                            />
                            <span className="text-xs text-white/70 truncate">
                              {node.name}
                            </span>
                            <span className="text-[10px] text-white/30 ml-auto">
                              {
                                NODE_TYPE_LABELS[
                                  node.type
                                ]
                              }
                            </span>
                            <ChevronRight className="size-3 text-white/20" />
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
