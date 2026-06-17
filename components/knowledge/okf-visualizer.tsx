"use client";

/**
 * OKF Visualizer — Phase 34 Stream 4
 * Three views: Library (by type), Playbook (by domain), Graph (D3 force-directed).
 * OKF v0.1 compatible with Neptune extensions.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search, FileText, Brain, BookOpen, Tag, ExternalLink, Clock,
  Star, Grid3X3, List, Share2, Download, Network, Layers, Play,
  ChevronRight, Folder, Code, Activity, Shield, Cpu, Filter, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ---- Types ----

interface KnowledgeFile {
  path: string;
  name: string;
  type: string;
  description: string;
  version: string;
  updated: string;
  domain: string;
  tags: string[];
  size: number;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  domain: string;
  path: string;
  size: number;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

type ViewMode = "library" | "playbook" | "graph";

// ---- Category Config ----

const TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ size?: number }>; color: string }> = {
  playbook: { label: "Playbook", icon: BookOpen, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" },
  skill: { label: "Skill", icon: Cpu, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30" },
  connector: { label: "Connector", icon: Share2, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30" },
  index: { label: "Index", icon: Layers, color: "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/30" },
  concept: { label: "Concept", icon: FileText, color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30" },
  prd: { label: "PRD", icon: FileText, color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30" },
  spec: { label: "Spec", icon: Shield, color: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30" },
  research: { label: "Research", icon: Brain, color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30" },
  mission: { label: "Mission", icon: Activity, color: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30" },
  memory: { label: "Memory", icon: Brain, color: "text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/30" },
};

// ---- Component ----

export function OkfVisualizer() {
  const [viewMode, setViewMode] = useState<ViewMode>("library");
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load files on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/knowledge/files?limit=1000");
        if (!res.ok) throw new Error("Failed to load knowledge files");
        const data = await res.json();
        setFiles(data.files || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Load graph data when in graph view
  useEffect(() => {
    if (viewMode !== "graph" || graphData) return;
    async function loadGraph() {
      try {
        const res = await fetch("/api/knowledge/graph");
        if (res.ok) {
          const data = await res.json();
          setGraphData(data);
        }
      } catch {}
    }
    loadGraph();
  }, [viewMode, graphData]);

  // Filtered files
  const filtered = useMemo(() => {
    let items = files;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.tags.some(t => t.toLowerCase().includes(q)) ||
        f.path.toLowerCase().includes(q)
      );
    }
    if (typeFilter) items = items.filter(f => f.type === typeFilter);
    if (domainFilter) items = items.filter(f => f.domain === domainFilter);
    return items;
  }, [files, search, typeFilter, domainFilter]);

  // Type counts
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    files.forEach(f => { counts[f.type] = (counts[f.type] || 0) + 1; });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [files]);

  // Domain counts
  const domainCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    files.forEach(f => { counts[f.domain] = (counts[f.domain] || 0) + 1; });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [files]);

  // Domain groups for playbook view
  const domainGroups = useMemo(() => {
    const groups: Record<string, KnowledgeFile[]> = {};
    filtered.forEach(f => {
      if (!groups[f.domain]) groups[f.domain] = [];
      groups[f.domain].push(f);
    });
    return Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-2">
          <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground">Loading knowledge base...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-2">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="shrink-0 border-b px-4 py-2 flex items-center gap-2 flex-wrap">
        {/* View tabs */}
        <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
          {([
            ["library", Layers, "Library"],
            ["playbook", BookOpen, "Playbooks"],
            ["graph", Network, "Graph"],
          ] as const).map(([mode, Icon, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                viewMode === mode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search knowledge..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <span className="text-[10px] text-muted-foreground">
          {filtered.length} of {files.length} files
        </span>
      </div>

      {/* Type filter pills */}
      <div className="shrink-0 px-4 py-2 flex flex-wrap gap-1.5 border-b">
        <button
          onClick={() => setTypeFilter(null)}
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
            !typeFilter ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          All ({files.length})
        </button>
        {typeCounts.slice(0, 8).map(([type, count]) => {
          const cfg = TYPE_CONFIG[type];
          const Icon = cfg?.icon || FileText;
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? null : type)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                typeFilter === type
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon size={10} />
              {cfg?.label || type} ({count})
            </button>
          );
        })}
        {typeFilter && (
          <button onClick={() => setTypeFilter(null)} className="p-0.5 text-muted-foreground hover:text-foreground">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === "library" && <LibraryView files={filtered} domainCounts={domainCounts} onDomainFilter={setDomainFilter} domainFilter={domainFilter} />}
        {viewMode === "playbook" && <PlaybookView domainGroups={domainGroups} />}
        {viewMode === "graph" && <GraphView graphData={graphData} />}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>OKF v0.1 · Neptune Reference Implementation</span>
        <span className="flex items-center gap-1">
          <Download size={10} />
          <a href="/api/knowledge/export" className="hover:text-primary hover:underline">Export Bundle</a>
        </span>
      </div>
    </div>
  );
}

// ---- Library View (canonical OKF, by type) ----

function LibraryView({
  files, domainCounts, onDomainFilter, domainFilter,
}: {
  files: KnowledgeFile[];
  domainCounts: [string, number][];
  onDomainFilter: (d: string | null) => void;
  domainFilter: string | null;
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Domain filter */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] font-medium text-muted-foreground self-center mr-1">Domain:</span>
        <button
          onClick={() => onDomainFilter(null)}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] border",
            !domainFilter ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          )}
        >
          All
        </button>
        {domainCounts.slice(0, 8).map(([domain, count]) => (
          <button
            key={domain}
            onClick={() => onDomainFilter(domainFilter === domain ? null : domain)}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] border",
              domainFilter === domain ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            {domain} ({count})
          </button>
        ))}
      </div>

      {/* Card grid */}
      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search size={32} className="text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No knowledge files found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {files.map(f => (
            <KnowledgeCard key={f.path} file={f} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Playbook View (by domain hierarchy) ----

function PlaybookView({ domainGroups }: { domainGroups: [string, KnowledgeFile[]][] }) {
  return (
    <div className="p-4 space-y-6">
      {domainGroups.map(([domain, domainFiles]) => (
        <div key={domain} className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Folder size={14} className="text-muted-foreground" />
            {domain}
            <span className="text-xs font-normal text-muted-foreground">({domainFiles.length} files)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {domainFiles.map(f => (
              <div key={f.path} className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-muted/30 transition-colors text-xs">
                {(() => {
                  const cfg = TYPE_CONFIG[f.type];
                  const Icon = cfg?.icon || FileText;
                  return <Icon size={12} className={cn("shrink-0", cfg?.color?.split(" ")[0])} />;
                })()}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{f.description || f.path}</p>
                </div>
                <ChevronRight size={12} className="text-muted-foreground/40" />
              </div>
            ))}
          </div>
        </div>
      ))}
      {domainGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen size={32} className="text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No playbooks found.</p>
        </div>
      )}
    </div>
  );
}

// ---- Graph View (D3 force-directed, lazy-loaded) ----

function GraphView({ graphData }: { graphData: { nodes: GraphNode[]; edges: GraphEdge[] } | null }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!graphData || !containerRef.current) return;

    // Lazy load D3
    async function renderGraph() {
      try {
        const d3 = await import("d3");
        const el = document.getElementById("okf-graph-container");
        if (!el) return;

        el.innerHTML = "";
        const width = el.clientWidth || 800;
        const height = el.clientHeight || 500;

        const svg = d3.select(el)
          .append("svg")
          .attr("width", width)
          .attr("height", height);

        // Type-based color scale
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

        // Filter top nodes by size for performance
        const nodes = graphData.nodes
          .sort((a, b) => b.size - a.size)
          .slice(0, 200);
        const nodeIds = new Set(nodes.map(n => n.id));
        const edges = graphData.edges
          .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
          .slice(0, 300);

        const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
          .force("link", d3.forceLink(edges).id((d: { id?: string }) => (d as GraphNode).id).distance(50))
          .force("charge", d3.forceManyBody().strength(-100))
          .force("center", d3.forceCenter(width / 2, height / 2))
          .force("collision", d3.forceCollide().radius(15));

        const link = svg.append("g")
          .selectAll("line")
          .data(edges)
          .join("line")
          .attr("stroke", "#999")
          .attr("stroke-opacity", 0.3)
          .attr("stroke-width", 0.5);

        const node = svg.append("g")
          .selectAll("circle")
          .data(nodes)
          .join("circle")
          .attr("r", d => Math.min(8, 3 + d.size / 1000))
          .attr("fill", d => colorScale(d.type))
          .attr("cursor", "pointer")
          .append("title")
          .text(d => `${d.label}\n${d.type} · ${d.domain}`);

        simulation.on("tick", () => {
          link
            .attr("x1", (d: { source: { x: number } }) => (d.source as { x: number }).x)
            .attr("y1", (d: { source: { y: number } }) => (d.source as { y: number }).y)
            .attr("x2", (d: { target: { x: number } }) => (d.target as { x: number }).x)
            .attr("y2", (d: { target: { y: number } }) => (d.target as { y: number }).y);

          node
            .attr("cx", (d: { x: number }) => d.x)
            .attr("cy", (d: { y: number }) => d.y);
        });

      } catch (err) {
        console.error("D3 render error:", err);
      }
    }

    renderGraph();
  }, [graphData]);

  if (!graphData) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{graphData.nodes.length} nodes</span>
        <span>·</span>
        <span>{graphData.edges.length} edges</span>
        <span>·</span>
        <span className="flex flex-wrap gap-1">
          {graphData.stats.domains.map((d: string) => (
            <span key={d} className="px-1.5 py-0.5 rounded bg-muted text-[10px]">{d}</span>
          ))}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        {Object.entries(TYPE_CONFIG).slice(0, 6).map(([type, cfg]) => (
          <span key={type} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50">
            <span className={cn("size-2 rounded-full", cfg.color.split(" ")[0].replace("text-", "bg-"))} />
            {cfg.label}
          </span>
        ))}
      </div>

      <div
        id="okf-graph-container"
        className="w-full h-[500px] rounded-lg border bg-card overflow-hidden"
      />
    </div>
  );
}

// ---- Knowledge Card ----

function KnowledgeCard({ file }: { file: KnowledgeFile }) {
  const cfg = TYPE_CONFIG[file.type] || TYPE_CONFIG.concept;
  const Icon = cfg?.icon || FileText;

  return (
    <div className="group relative rounded-lg border bg-card hover:shadow-sm hover:border-primary/20 transition-all duration-200 flex flex-col">
      <div className="p-3 pb-1.5 flex items-start justify-between gap-2">
        <div className={cn("flex size-7 items-center justify-center rounded-md shrink-0", cfg.color)}>
          <Icon size={13} />
        </div>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
          {cfg.label}
        </span>
      </div>

      <div className="px-3 pb-2 flex-1">
        <h4 className="font-medium text-xs leading-snug mb-1 line-clamp-2">{file.name}</h4>
        <p className="text-[10px] text-muted-foreground line-clamp-2 mb-2">
          {file.description || file.path}
        </p>
        <div className="flex flex-wrap gap-1">
          {file.tags.slice(0, 3).map(tag => (
            <span key={tag} className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-muted text-muted-foreground font-medium">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="px-3 py-1.5 border-t bg-muted/20 flex items-center justify-between rounded-b-lg">
        <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
          <Clock size={9} />
          {file.updated}
        </span>
        <span className="text-[9px] text-muted-foreground">{file.domain}</span>
      </div>
    </div>
  );
}
