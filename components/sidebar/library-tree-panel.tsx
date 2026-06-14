"use client";

/**
 * LibraryTreePanel — Inline library tree rendered INSIDE the sidebar.
 * Phase 17: Navigation Rehaul — refactored from library-sidebar-v2.tsx.
 *
 * Renders the full library tree (Connectors, Skills, Playbooks, Workflows)
 * as collapsible nodes with live search and canvas integration.
 *
 * Each leaf/node click opens the canvas in the correct mode.
 * On mobile, also closes the sidebar so the canvas sheet is visible.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  ChevronRight,
  Puzzle,
  BookOpen,
  Sparkles,
  FileCode2,
  Workflow,
  Brain,
  Database,
  AlertCircle,
  Loader2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/canvas/store";
import type { CanvasMode } from "@/lib/canvas/types";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ──────────────────────────────────────────────────────────────────

interface TreeNode {
  id: string;
  label: string;
  type: "connector" | "playbook" | "skill" | "function" | "workflow" | "model";
  icon: React.ReactNode;
  children?: TreeNode[];
  meta?: {
    domain?: string;
    version?: string;
    description?: string;
    status?: string;
  };
}

// ── Icons ──────────────────────────────────────────────────────────────────

function getIconForType(type: string): React.ReactNode {
  switch (type) {
    case "connector":
      return <Puzzle className="size-3.5" />;
    case "playbook":
      return <BookOpen className="size-3.5" />;
    case "skill":
      return <Sparkles className="size-3.5" />;
    case "function":
      return <FileCode2 className="size-3.5" />;
    case "workflow":
      return <Workflow className="size-3.5" />;
    case "model":
      return <Brain className="size-3.5" />;
    default:
      return <Database className="size-3.5" />;
  }
}

// ── Mode map (tree node type → canvas mode) ────────────────────────────────

const MODE_MAP: Record<string, CanvasMode> = {
  connector: "connector-detail",
  skill: "skill-detail",
  function: "function-detail",
  playbook: "playbook-detail",
  workflow: "workflow-canvas",
  model: "library-overview",
};

// ── Fallback tree ──────────────────────────────────────────────────────────

const FALLBACK_TREE: TreeNode[] = [
  {
    id: "connectors",
    label: "Connectors",
    type: "connector",
    icon: <Puzzle className="size-3.5" />,
    children: [
      { id: "nmi", label: "NMI", type: "connector", icon: <Puzzle className="size-3.5" /> },
      { id: "slack", label: "Slack", type: "connector", icon: <Puzzle className="size-3.5" /> },
      { id: "github", label: "GitHub", type: "connector", icon: <Puzzle className="size-3.5" /> },
      { id: "vercel", label: "Vercel", type: "connector", icon: <Puzzle className="size-3.5" /> },
      { id: "vapi", label: "Vapi", type: "connector", icon: <Puzzle className="size-3.5" /> },
      { id: "base44", label: "Base44", type: "connector", icon: <Puzzle className="size-3.5" /> },
    ],
  },
  {
    id: "playbooks",
    label: "Playbooks",
    type: "playbook",
    icon: <BookOpen className="size-3.5" />,
    children: [
      { id: "billing-flow", label: "Billing Flow", type: "playbook", icon: <BookOpen className="size-3.5" /> },
      { id: "credit-disputes", label: "Credit Disputes", type: "playbook", icon: <BookOpen className="size-3.5" /> },
      { id: "engineering", label: "Engineering", type: "playbook", icon: <BookOpen className="size-3.5" /> },
      { id: "deploy-vercel-github", label: "Deploy", type: "playbook", icon: <BookOpen className="size-3.5" /> },
      { id: "support-triage", label: "Support Triage", type: "playbook", icon: <BookOpen className="size-3.5" /> },
    ],
  },
  {
    id: "skills",
    label: "Skills",
    type: "skill",
    icon: <Sparkles className="size-3.5" />,
    children: [
      { id: "billing-and-payments", label: "Billing & Payments", type: "skill", icon: <Sparkles className="size-3.5" /> },
      { id: "ui-and-design", label: "UI & Design", type: "skill", icon: <Sparkles className="size-3.5" /> },
      { id: "tool-routing", label: "Tool Routing", type: "skill", icon: <Sparkles className="size-3.5" /> },
      { id: "vps-operations", label: "VPS Operations", type: "skill", icon: <Sparkles className="size-3.5" /> },
      { id: "dispatch", label: "Dispatch", type: "skill", icon: <Sparkles className="size-3.5" /> },
    ],
  },
];

// ── Data fetcher ───────────────────────────────────────────────────────────

async function fetchLibraryTree(): Promise<TreeNode[]> {
  try {
    const res = await fetch("/api/library/tree");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.tree ?? []).map(transformTreeNode);
  } catch {
    return FALLBACK_TREE;
  }
}

function transformTreeNode(raw: Record<string, unknown>): TreeNode {
  return {
    id: String(raw.id ?? raw.name ?? ""),
    label: String(raw.label ?? raw.name ?? ""),
    type: String(raw.type ?? "connector") as TreeNode["type"],
    icon: getIconForType(String(raw.type ?? "")),
    children: Array.isArray(raw.children)
      ? raw.children.map(transformTreeNode)
      : undefined,
    meta: raw.meta as TreeNode["meta"],
  };
}

// ── TreeNodeItem ───────────────────────────────────────────────────────────

function TreeNodeItem({
  node,
  depth = 0,
  searchQuery = "",
  onSelect,
  activeNodeId,
}: {
  node: TreeNode;
  depth?: number;
  searchQuery?: string;
  onSelect?: (node: TreeNode) => void;
  activeNodeId?: string;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  const isActive = activeNodeId === node.id;

  const filteredChildren = useMemo(() => {
    if (!searchQuery || !node.children) return node.children;
    const q = searchQuery.toLowerCase();
    return node.children.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.meta?.description ?? "").toLowerCase().includes(q),
    );
  }, [node.children, searchQuery]);

  const matchesSearch =
    !searchQuery ||
    node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.id.toLowerCase().includes(searchQuery.toLowerCase());

  if (
    searchQuery &&
    !matchesSearch &&
    (!filteredChildren || filteredChildren.length === 0)
  ) {
    return null;
  }

  return (
    <div>
      <motion.button
        aria-expanded={hasChildren ? expanded : undefined}
        aria-label={`${node.label}${hasChildren ? ", has children" : ""}`}
        className={cn(
          "flex items-center gap-2 w-full py-1.5 rounded-lg text-left transition-all duration-150 group",
          "hover:bg-sidebar-accent/50",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          !isActive && "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onSelect?.(node);
        }}
        style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: 8 }}
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
      >
        {hasChildren ? (
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="flex-shrink-0"
          >
            <ChevronRight className="size-3 text-muted-foreground/40" />
          </motion.span>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <span className="flex-shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors">
          {node.icon}
        </span>
        <span className="text-[12px] truncate flex-1">{node.label}</span>
        {node.meta?.status && (
          <span
            className={cn(
              "text-[9px] px-1 py-0.5 rounded font-medium flex-shrink-0",
              node.meta.status === "active" && "bg-emerald-500/10 text-emerald-500",
              node.meta.status === "beta" && "bg-amber-500/10 text-amber-500",
              node.meta.status === "deprecated" && "bg-red-500/10 text-red-500",
            )}
          >
            {node.meta.status}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {expanded && filteredChildren && filteredChildren.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            {filteredChildren.map((child) => (
              <TreeNodeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                searchQuery={searchQuery}
                onSelect={onSelect}
                activeNodeId={activeNodeId}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── LibraryTreePanel ───────────────────────────────────────────────────────

interface LibraryTreePanelProps {
  className?: string;
}

export function LibraryTreePanel({ className }: LibraryTreePanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [treeData, setTreeData] = useState<TreeNode[]>(FALLBACK_TREE);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Canvas + mobile ─────────────────────────────────────────────
  const canvasOpen = useCanvasStore((s) => s.open);
  const isMobile = useIsMobile();
  const { setOpenMobile } = useSidebar();

  // ── Load tree data ──────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    fetchLibraryTree()
      .then(setTreeData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Handle node selection → canvas open ─────────────────────────
  const handleSelect = useCallback(
    (node: TreeNode) => {
      const mode = MODE_MAP[node.type] || "library-overview";
      const ctx: Record<string, string> = {};
      if (node.type === "connector") ctx.connectorName = node.id;
      if (node.type === "skill") ctx.skillName = node.id;
      if (node.type === "function") ctx.functionName = node.id;
      if (node.type === "playbook") ctx.playbookName = node.id;
      if (node.type === "workflow") ctx.workflowName = node.id;

      canvasOpen(mode, ctx);

      // On mobile, close sidebar so canvas sheet is visible
      if (isMobile) {
        setOpenMobile(false);
      }
    },
    [canvasOpen, isMobile, setOpenMobile],
  );

  // ── Filter tree by search ───────────────────────────────────────
  const filteredTree = useMemo(() => {
    if (!searchQuery) return treeData;
    const q = searchQuery.toLowerCase();
    return treeData
      .map((node) => {
        const selfMatch =
          node.label.toLowerCase().includes(q) ||
          node.id.toLowerCase().includes(q);
        const childMatch = node.children?.some(
          (c) =>
            c.label.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q),
        );
        if (selfMatch || childMatch) return node;
        return null;
      })
      .filter(Boolean) as TreeNode[];
  }, [treeData, searchQuery]);

  const hasResults = filteredTree.length > 0;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Search input */}
      <div className="relative px-2 py-1.5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
        <input
          ref={searchInputRef}
          aria-label="Search library"
          className={cn(
            "w-full h-7 pl-7 pr-6 rounded-md",
            "bg-sidebar-accent/40 text-xs",
            "border border-sidebar-border/50",
            "placeholder:text-muted-foreground/30",
            "focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/30",
            "transition-all duration-200",
          )}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search library..."
          type="text"
          value={searchQuery}
        />
        {searchQuery && (
          <button
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted-foreground/10"
            onClick={() => setSearchQuery("")}
          >
            <X className="size-3 text-muted-foreground/50" />
          </button>
        )}
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1">
        {loading ? (
          <div className="space-y-2 px-2 py-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full rounded" />
            ))}
          </div>
        ) : hasResults ? (
          <div className="space-y-0.5">
            {filteredTree.map((node) => (
              <TreeNodeItem
                key={node.id}
                node={node}
                onSelect={handleSelect}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        ) : (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-8 gap-2 px-3 text-center"
            initial={{ opacity: 0, y: 8 }}
          >
            <AlertCircle className="size-6 text-muted-foreground/20" />
            <div>
              <div className="text-[11px] text-muted-foreground/50 font-medium">
                No matches for &ldquo;{searchQuery}&rdquo;
              </div>
              <div className="text-[10px] text-muted-foreground/30 mt-0.5">
                Try a different search term
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
