"use client";

/**
 * Knowledge Graph Visualizer — Client Component
 *
 * Interactive D3 force-directed knowledge graph at /knowledge/graph.
 * Fetches graph data from API on mount. Search + file content via API.
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 — Reference Implementation
 * Phase 35: Knowledge Visualizer | Stream 7
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { KnowledgeGraph } from "@/components/knowledge/knowledge-graph";
import { SearchBar } from "@/components/knowledge/search-bar";
import { DomainFilter } from "@/components/knowledge/domain-filter";
import { FileViewer } from "@/components/knowledge/file-viewer";
import { toD3Graph, groupByDomain, getRecentChanges, computeGraphStats } from "@/lib/knowledge/graph-builder";

// Lightweight client-safe types (no node:fs dependencies)
export interface KnowledgeNode {
  id: string;
  type: string;
  name: string;
  domain?: string;
  version?: string;
  description?: string;
  path: string;
  linkCount: number;
  frontmatter: Record<string, unknown>;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  type: string;
  label?: string;
}

interface SearchResult {
  node: KnowledgeNode;
  matchField: string;
  score: number;
}

interface D3Node {
  id: string;
  name: string;
  type: string;
  domain?: string;
  version?: string;
  description?: string;
  linkCount: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface D3Link {
  source: string | D3Node;
  target: string | D3Node;
  type: string;
}

interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  typeBreakdown: Record<string, number>;
  domainBreakdown: Record<string, number>;
}

interface KnowledgeClientProps {
  initialGraph?: {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
    stats: GraphStats;
  };
  allNodes?: KnowledgeNode[];
  allEdges?: KnowledgeEdge[];
}

/**
 * Client-side search (filters loaded nodes locally)
 */
function localSearch(
  nodes: KnowledgeNode[],
  query: string
): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const node of nodes) {
    let score = 0;
    let matchField = "";

    if (node.name.toLowerCase().includes(q)) {
      score += 10;
      matchField = "name";
    }
    if (node.description?.toLowerCase().includes(q)) {
      score += 5;
      if (!matchField) matchField = "description";
    }
    if (node.domain?.toLowerCase().includes(q)) {
      score += 3;
      if (!matchField) matchField = "domain";
    }
    if (node.type.toLowerCase().includes(q)) {
      score += 2;
      if (!matchField) matchField = "type";
    }

    if (score > 0) {
      results.push({ node, matchField, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export function KnowledgeClient({
  initialGraph,
  allNodes: initialAllNodes,
  allEdges: initialAllEdges,
}: KnowledgeClientProps) {
  // State
  const [view, setView] = useState<"library" | "playbook">("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<D3Node | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [graphData, setGraphData] = useState<{
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
    stats: GraphStats;
  } | null>(initialGraph || null);

  // Fetch graph data on mount if not provided
  useEffect(() => {
    if (initialGraph) return;
    async function fetchGraph() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/knowledge/graph");
        const data = await res.json();
        if (data.success) {
          setGraphData({
            nodes: data.nodes,
            edges: data.edges,
            stats: data.stats,
          });
        }
      } catch (e) {
        console.error("Failed to load knowledge graph:", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchGraph();
  }, [initialGraph]);

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];
  const allNodes = initialAllNodes || nodes;
  const allEdges = initialAllEdges || edges;

  // Derive D3 graph
  const d3Graph = useMemo(() => {
    if (nodes.length === 0) return { nodes: [], links: [] };
    return toD3Graph(nodes, edges);
  }, [nodes, edges]);

  // Domain list for filter
  const domains = useMemo(() => {
    return groupByDomain(nodes);
  }, [nodes]);

  // Recent changes from graph stats
  const recentChanges = useMemo(() => {
    return getRecentChanges(nodes);
  }, [nodes]);

  const graphStats = useMemo(() => {
    return computeGraphStats(nodes, edges);
  }, [nodes, edges]);

  // Search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      const results = localSearch(allNodes, query);
      setSearchResults(results);
    },
    [allNodes]
  );

  // Type filter
  const toggleType = useCallback((type: string | null) => {
    setSelectedType((prev) => (prev === type ? null : type));
  }, []);

  // Domain filter
  const toggleDomain = useCallback((domain: string) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  }, []);

  const clearDomainFilter = useCallback(() => {
    setSelectedDomains(new Set());
  }, []);

  // Filtered nodes for display
  const filteredNodes = useMemo(() => {
    let filtered = nodes;

    if (selectedType) {
      filtered = filtered.filter((n) => n.type === selectedType);
    }

    if (selectedDomains.size > 0) {
      filtered = filtered.filter(
        (n) => n.domain && selectedDomains.has(n.domain)
      );
    }

    if (searchQuery.trim()) {
      const resultIds = new Set(searchResults.map((r) => r.node.id));
      filtered = filtered.filter((n) => resultIds.has(n.id));
    }

    return filtered;
  }, [nodes, selectedType, selectedDomains, searchQuery, searchResults]);

  // File viewer
  const handleNodeClick = useCallback(
    async (node: D3Node) => {
      const fullNode = nodes.find((n) => n.id === node.id);
      if (!fullNode) return;
      setSelectedNode(fullNode);

      // Fetch file content via API
      try {
        const res = await fetch(
          `/api/knowledge/files?path=${encodeURIComponent(fullNode.path)}`
        );
        const data = await res.json();
        if (data.success) {
          setFileContent(data.content);
        } else {
          setFileContent("File not found or inaccessible.");
        }
      } catch {
        setFileContent("Error loading file content.");
      }
    },
    [nodes]
  );

  const handleNodeHover = useCallback((node: D3Node | null) => {
    setHoveredNode(node);
  }, []);

  const handleCloseFileViewer = useCallback(() => {
    setSelectedNode(null);
    setFileContent(null);
  }, []);

  // OKF Export
  const handleExportOKF = useCallback(() => {
    window.open("/api/knowledge/export", "_blank");
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur-sm shrink-0">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <span>Knowledge Graph</span>
          {graphStats && (
            <span className="text-[10px] text-muted-foreground font-normal">
              {graphStats.totalNodes} nodes · {graphStats.totalEdges} edges
            </span>
          )}
        </h2>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center rounded-md border border-border/50 overflow-hidden">
          <button
            onClick={() => setView("library")}
            className={`px-2.5 py-1 text-[11px] transition-colors ${
              view === "library"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Library
          </button>
          <button
            onClick={() => setView("playbook")}
            className={`px-2.5 py-1 text-[11px] transition-colors ${
              view === "playbook"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Playbook
          </button>
        </div>

        {/* Export button */}
        <button
          onClick={handleExportOKF}
          className="px-2.5 py-1 text-[11px] rounded-md border border-teal-500/30 text-teal-400 hover:bg-teal-500/10 transition-colors"
        >
          Export OKF
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border/30 bg-background/50 shrink-0">
        <SearchBar
          value={searchQuery}
          onChange={handleSearch}
          results={searchResults}
          onSelect={(result) => {
            const d3Node = d3Graph.nodes.find(
              (n: D3Node) => n.id === result.node.id
            );
            if (d3Node) handleNodeClick(d3Node);
          }}
        />
        <DomainFilter
          domains={domains}
          selected={selectedDomains}
          onToggle={toggleDomain}
          onClear={clearDomainFilter}
        />
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>Type:</span>
          {["skill", "playbook", "prd", "mission", "research", "memory"].map(
            (type) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`px-1.5 py-0.5 rounded ${
                  selectedType === type
                    ? "bg-accent text-foreground"
                    : "hover:text-foreground"
                }`}
              >
                {type}
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Graph or Library View */}
        <div
          className={`${
            selectedNode ? "w-[60%]" : "w-full"
          } transition-all duration-200`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-muted-foreground animate-pulse">
                Loading knowledge graph...
              </div>
            </div>
          ) : view === "library" ? (
            /* Library: Node List */
            <div className="h-full overflow-auto p-4 space-y-1">
              {filteredNodes.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No nodes found. Try adjusting filters.
                </div>
              )}
              {filteredNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => {
                    const d3Node = d3Graph.nodes.find(
                      (n: D3Node) => n.id === node.id
                    );
                    if (d3Node) handleNodeClick(d3Node);
                  }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/30 transition-colors flex items-center gap-3"
                >
                  <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0">
                    {node.type}
                  </span>
                  <span className="text-sm flex-1 truncate">{node.name}</span>
                  {node.domain && (
                    <span className="text-[10px] text-muted-foreground">
                      {node.domain}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {node.linkCount} links
                  </span>
                </button>
              ))}
            </div>
          ) : (
            /* Playbook: D3 Graph */
            <KnowledgeGraph
              data={d3Graph}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              selectedNodeId={selectedNode?.id || null}
            />
          )}
        </div>

        {/* Right: File Viewer Panel */}
        {selectedNode && (
          <div className="w-[40%] border-l border-border/50 overflow-hidden">
            <FileViewer
              node={selectedNode}
              content={fileContent}
              onClose={handleCloseFileViewer}
            />
          </div>
        )}
      </div>

      {/* Footer: Recent Changes */}
      {recentChanges.length > 0 && (
        <div className="border-t border-border/30 px-4 py-2 flex items-center gap-3 text-[10px] text-muted-foreground shrink-0 overflow-x-auto">
          <span className="font-semibold uppercase shrink-0">
            Recent Changes:
          </span>
          {recentChanges.slice(0, 8).map((change, i) => (
            <span key={i} className="shrink-0">
              {change}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
