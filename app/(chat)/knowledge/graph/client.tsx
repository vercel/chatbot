"use client";

/**
 * Knowledge Page — Client Component
 *
 * Interactive knowledge visualizer with:
 * - Force-directed graph (D3)
 * - Twin View toggle (Library / Playbook)
 * - Search, filter, file viewer
 * - OKF export button
 */

import { useState, useCallback, useMemo } from "react";
import { KnowledgeGraph } from "@/components/knowledge/knowledge-graph";
import { SearchBar } from "@/components/knowledge/search-bar";
import { DomainFilter } from "@/components/knowledge/domain-filter";
import { FileViewer } from "@/components/knowledge/file-viewer";
import { toD3Graph, groupByDomain, getRecentChanges, computeGraphStats } from "@/lib/knowledge/graph-builder";
import {
  searchKnowledge,
  getKnowledgeFileContent,
} from "@/lib/knowledge/parser";
import type {
  KnowledgeNode,
  KnowledgeEdge,
  SearchResult,
} from "@/lib/knowledge/parser";
import type { D3Node } from "@/lib/knowledge/graph-builder";

interface KnowledgeClientProps {
  initialGraph: {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
    stats: {
      totalNodes: number;
      totalEdges: number;
      byType: Record<string, number>;
      byDomain: Record<string, number>;
      generatedAt: string;
    };
  };
  allNodes: KnowledgeNode[];
  allEdges: KnowledgeEdge[];
}

export function KnowledgeClient({
  initialGraph,
  allNodes,
  allEdges,
}: KnowledgeClientProps) {
  // State
  const [view, setView] = useState<"library" | "playbook">("library");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<D3Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<D3Node | null>(null);
  const [fileContent, setFileContent] = useState<{
    content: string;
    frontmatter: Record<string, unknown> | null;
    path: string;
  } | null>(null);

  // Memoized data
  const d3Graph = useMemo(() => {
    let nodes = allNodes;
    if (selectedType !== "ALL") {
      nodes = nodes.filter((n) => n.type === selectedType);
    }
    if (selectedDomains.length > 0) {
      nodes = nodes.filter((n) => n.domain && selectedDomains.includes(n.domain));
    }
    if (searchQuery) {
      const results = searchKnowledge(
        { nodes, edges: allEdges, stats: initialGraph.stats },
        searchQuery
      );
      nodes = results.map((r) => r.node);
    }
    return toD3Graph({ nodes, edges: allEdges, stats: initialGraph.stats });
  }, [allNodes, allEdges, selectedType, selectedDomains, searchQuery, initialGraph.stats]);

  const domainGroups = useMemo(() => {
    const graph = { nodes: allNodes, edges: allEdges, stats: initialGraph.stats };
    return groupByDomain(graph);
  }, [allNodes, allEdges, initialGraph.stats]);

  const recentChanges = useMemo(() => {
    const graph = { nodes: allNodes, edges: allEdges, stats: initialGraph.stats };
    return getRecentChanges(graph, 20);
  }, [allNodes, allEdges, initialGraph.stats]);

  const graphStats = useMemo(() => {
    const graph = { nodes: allNodes, edges: allEdges, stats: initialGraph.stats };
    return computeGraphStats(graph);
  }, [allNodes, allEdges, initialGraph.stats]);

  const uniqueTypes = useMemo(
    () => Object.keys(initialGraph.stats.byType).sort(),
    [initialGraph.stats.byType]
  );

  const uniqueDomains = useMemo(
    () =>
      Object.entries(initialGraph.stats.byDomain)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    [initialGraph.stats.byDomain]
  );

  // Handlers
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (query.length > 0) {
        const graph = { nodes: allNodes, edges: allEdges, stats: initialGraph.stats };
        setSearchResults(searchKnowledge(graph, query));
      } else {
        setSearchResults([]);
      }
    },
    [allNodes, allEdges, initialGraph.stats]
  );

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      setSelectedNode(result.node as D3Node);
    },
    []
  );

  const handleNodeClick = useCallback(
    (node: D3Node) => {
      setSelectedNode(node);
      const file = getKnowledgeFileContent(node.path);
      if (file.exists) {
        setFileContent({
          content: file.content,
          frontmatter: file.frontmatter as Record<string, unknown> | null,
          path: node.path,
        });
      }
    },
    []
  );

  const handleOpenFile = useCallback((node: D3Node) => {
    handleNodeClick(node);
  }, [handleNodeClick]);

  const handlePinNode = useCallback((_node: D3Node) => {
    // Pin functionality — keeps node fixed in graph
    // Auto-handled by D3 drag behavior
  }, []);

  const toggleDomain = useCallback((domain: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domain)
        ? prev.filter((d) => d !== domain)
        : [...prev, domain]
    );
  }, []);

  const clearDomains = useCallback(() => {
    setSelectedDomains([]);
  }, []);

  const handleOKFExport = useCallback(() => {
    window.open("/api/knowledge/okf-export", "_blank");
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="text-slate-500 hover:text-slate-300 transition-colors text-sm"
          >
            ← Chat
          </a>
          <h1 className="text-lg font-bold text-teal-400">⚡ Knowledge</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg bg-slate-800 p-0.5">
            <button
              onClick={() => setView("library")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                view === "library"
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Library
            </button>
            <button
              onClick={() => setView("playbook")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                view === "playbook"
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Playbook
            </button>
          </div>

          {/* OKF Export */}
          <button
            onClick={handleOKFExport}
            className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 text-xs font-medium hover:bg-teal-500/20 transition-colors"
          >
            Export OKF
          </button>

          {/* Stats */}
          <div className="text-xs text-slate-600">
            {graphStats.totalNodes} nodes · {graphStats.totalEdges} edges
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-slate-800">
            <SearchBar
              onSearch={handleSearch}
              results={searchResults}
              onSelectResult={handleSelectResult}
            />
          </div>

          {view === "library" ? (
            <>
              {/* Type Filter */}
              <div className="p-3 border-b border-slate-800">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedType("ALL")}
                    className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                      selectedType === "ALL"
                        ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                        : "bg-slate-800 text-slate-500 border border-transparent hover:text-slate-300"
                    }`}
                  >
                    ALL ({initialGraph.stats.totalNodes})
                  </button>
                  {uniqueTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                        selectedType === type
                          ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                          : "bg-slate-800 text-slate-500 border border-transparent hover:text-slate-300"
                      }`}
                    >
                      {type} ({initialGraph.stats.byType[type]})
                    </button>
                  ))}
                </div>
              </div>

              {/* Node List */}
              <div className="flex-1 overflow-y-auto p-2">
                {d3Graph.nodes.slice(0, 200).map((node) => (
                  <button
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
                      selectedNode?.id === node.id
                        ? "bg-teal-500/10 border border-teal-500/20"
                        : "hover:bg-slate-800/50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200 truncate flex-1">
                        {node.name}
                      </span>
                      <span className="text-[10px] text-slate-600">v{node.version}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500">{node.type}</span>
                      {node.domain && (
                        <span className="text-[10px] text-slate-600">· {node.domain}</span>
                      )}
                      {node.linkCount > 0 && (
                        <span className="text-[10px] text-slate-600">· {node.linkCount} links</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Playbook View */
            <div className="flex-1 overflow-y-auto p-2">
              {domainGroups.map((group) => (
                <div key={group.domain} className="mb-4">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="text-sm font-semibold text-slate-200">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      ({group.nodes.length} nodes · {group.totalLinks} links)
                    </span>
                  </div>
                  <div className="ml-2 space-y-0.5">
                    {group.nodes.slice(0, 10).map((node) => (
                      <button
                        key={node.id}
                        onClick={() => handleNodeClick(node as D3Node)}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-colors"
                      >
                        {node.name}
                        <span className="text-slate-600 ml-2">({node.type})</span>
                      </button>
                    ))}
                    {group.nodes.length > 10 && (
                      <div className="text-[10px] text-slate-600 px-3 py-1">
                        +{group.nodes.length - 10} more...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Changes */}
          <div className="border-t border-slate-800 p-3">
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Recent Changes
            </h4>
            <div className="space-y-1">
              {recentChanges.slice(0, 5).map((change) => (
                <div
                  key={change.node.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-slate-400 truncate flex-1 mr-2">
                    {change.node.name}
                  </span>
                  <span className="text-slate-600 flex-shrink-0">
                    {change.relativeTime}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Graph Area */}
        <main className="flex-1 relative">
          <KnowledgeGraph
            data={d3Graph}
            onNodeClick={handleNodeClick}
            onNodeHover={setHoveredNode}
            selectedNodeId={selectedNode?.id}
          />

          {/* File Viewer Panel (slide-in from right) */}
          {fileContent && (
            <div className="absolute top-0 right-0 w-96 h-full border-l border-slate-800 bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
              <FileViewer
                content={fileContent.content}
                frontmatter={fileContent.frontmatter as any}
                path={fileContent.path}
                onClose={() => setFileContent(null)}
                onLinkClick={(linkPath) => {
                  // Handle internal link navigation
                }}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
