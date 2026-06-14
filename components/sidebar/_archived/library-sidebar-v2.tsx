"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  X,
  ChevronRight,
  Library,
  Puzzle,
  BookOpen,
  Workflow,
  Brain,
  Zap,
  FileCode2,
  Database,
  ExternalLink,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/canvas/store";
import type { CanvasMode } from "@/lib/canvas/types";

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

interface LibrarySidebarV2Props {
  className?: string;
  /** Called when a tree node is clicked (drill-down) */
  onDrillDown?: (node: TreeNode) => void;
  /** Called when "Add Connector" is clicked */
  onAddConnector?: () => void;
  /** Optional highlight for active node */
  activeNodeId?: string;
}

// ── Data fetcher ───────────────────────────────────────────────────────────

async function fetchLibraryTree(): Promise<TreeNode[]> {
  try {
    const res = await fetch("/api/library/tree");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.tree ?? []).map(transformTreeNode);
  } catch {
    // Fallback: build from known structure
    return FALLBACK_TREE;
  }
}

function transformTreeNode(raw: Record<string, unknown>): TreeNode {
  return {
    id: String(raw.id ?? raw.name ?? ""),
    label: String(raw.label ?? raw.name ?? ""),
    type: String(raw.type ?? "connector") as TreeNode["type"],
    icon: getIconForType(String(raw.type ?? "")),
    children: Array.isArray(raw.children) ? raw.children.map(transformTreeNode) : undefined,
    meta: raw.meta as TreeNode["meta"],
  };
}

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

const FALLBACK_TREE: TreeNode[] = [
  {
    id: "connectors", label: "Connectors", type: "connector",
    icon: <Puzzle className="size-3.5" />,
    children: [
      { id: "nmi-connector", label: "NMI", type: "connector", icon: <Puzzle className="size-3.5" /> },
      { id: "slack-connector", label: "Slack", type: "connector", icon: <Puzzle className="size-3.5" /> },
      { id: "github-connector", label: "GitHub", type: "connector", icon: <Puzzle className="size-3.5" /> },
      { id: "vercel-connector", label: "Vercel", type: "connector", icon: <Puzzle className="size-3.5" /> },
      { id: "vapi-connector", label: "Vapi", type: "connector", icon: <Puzzle className="size-3.5" /> },
      { id: "base44-connector", label: "Base44", type: "connector", icon: <Puzzle className="size-3.5" /> },
    ],
  },
  {
    id: "playbooks", label: "Playbooks", type: "playbook",
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
    id: "skills", label: "Skills", type: "skill",
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

// ── Tree Node Component ───────────────────────────────────────────────────

function TreeNodeItem({
  node,
  depth = 0,
  searchQuery = "",
  onDrillDown,
  activeNodeId,
}: {
  node: TreeNode;
  depth?: number;
  searchQuery?: string;
  onDrillDown?: (node: TreeNode) => void;
  activeNodeId?: string;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  const isActive = activeNodeId === node.id;

  // Filter children by search
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

  if (searchQuery && !matchesSearch && (!filteredChildren || filteredChildren.length === 0)) {
    return null;
  }

  return (
    <div>
      <motion.button
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onDrillDown?.(node);
        }}
        className={cn(
          "flex items-center gap-2 w-full py-1.5 rounded-lg text-left transition-all duration-150 group",
          "hover:bg-muted/40",
          isActive && "bg-primary/10 text-primary font-medium",
          !isActive && "text-muted-foreground hover:text-foreground",
        )}
        style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: 8 }}
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Expand chevron for folders */}
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

        {/* Icon */}
        <span className="flex-shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors">
          {node.icon}
        </span>

        {/* Label */}
        <span className="text-[12px] truncate flex-1">{node.label}</span>

        {/* Status badge */}
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

      {/* Children */}
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
                onDrillDown={onDrillDown}
                activeNodeId={activeNodeId}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function LibrarySidebarV2({
  className,
  onDrillDown,
  onAddConnector,
  activeNodeId,
}: LibrarySidebarV2Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [treeData, setTreeData] = useState<TreeNode[]>(FALLBACK_TREE);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Canvas store integration (Phase 16) ───────────────────────────
  const canvasOpen = useCanvasStore((s) => s.open);

  // Default drill-down: open the corresponding canvas mode
  const handleDrillDown = useCallback(
    (node: TreeNode) => {
      if (onDrillDown) {
        onDrillDown(node);
        return;
      }
      // Default: map tree node type → canvas mode
      const modeMap: Record<string, CanvasMode> = {
        connector: "connector-detail",
        skill: "skill-detail",
        function: "function-detail",
        playbook: "playbook-detail",
        workflow: "workflow-canvas",
        model: "library-overview",
      };
      const mode = modeMap[node.type] || "library-overview";
      // Build context from node type
      const ctx: Record<string, string> = {};
      if (node.type === "connector") ctx.connectorName = node.id.replace(/-connector$/, "");
      if (node.type === "skill") ctx.skillName = node.id;
      if (node.type === "function") ctx.functionName = node.id;
      if (node.type === "playbook") ctx.playbookName = node.id;
      if (node.type === "workflow") ctx.workflowName = node.id;

      canvasOpen(mode, ctx);
    },
    [onDrillDown, canvasOpen],
  );

  // Load tree data on mount
  useEffect(() => {
    if (isExpanded) {
      setLoading(true);
      fetchLibraryTree()
        .then(setTreeData)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isExpanded]);

  // Focus search input when expanding
  useEffect(() => {
    if (isExpanded && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  }, [isExpanded]);

  // Filter tree by search
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

  const handleToggle = useCallback(() => {
    if (isExpanded) {
      setSearchQuery("");
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  return (
    <div className={cn("relative flex", className)}>
      {/* Collapsed Icon Column (60px) */}
      <motion.button
        onClick={handleToggle}
        className={cn(
          "flex flex-col items-center gap-1.5 py-3 transition-all duration-200",
          "hover:bg-muted/30 rounded-lg",
          isExpanded ? "w-[60px]" : "w-[60px]",
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
      >
        <Library className="size-5 text-muted-foreground/60" />
        <span className="text-[9px] text-muted-foreground/40 leading-tight text-center">
          Library
        </span>
        {!isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-0.5"
          >
            <ChevronRight className="size-3 text-muted-foreground/30" />
          </motion.div>
        )}
      </motion.button>

      {/* Expanded Panel (280px) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{
              width: 280,
              opacity: 1,
              transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
            }}
            exit={{
              width: 0,
              opacity: 0,
              transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
            }}
            className={cn(
              "flex flex-col border-l border-border/30 overflow-hidden",
              "bg-card/60 backdrop-blur-xl",
            )}
          >
            {/* Header: Search Input */}
            <div className="flex items-center gap-2 px-3 py-3 border-b border-border/20">
              <motion.div
                className="relative flex-1"
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 }}
              >
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search library..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-full h-8 pl-8 pr-7 rounded-lg",
                    "bg-muted/30 text-xs",
                    "border border-border/20",
                    "placeholder:text-muted-foreground/30",
                    "focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/30",
                    "transition-all duration-200",
                  )}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted-foreground/10"
                  >
                    <X className="size-3 text-muted-foreground/50" />
                  </button>
                )}
              </motion.div>

              {/* Close button */}
              <motion.button
                onClick={handleToggle}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-1.5 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <X className="size-3.5 text-muted-foreground/50" />
              </motion.button>
            </div>

            {/* Tree Content */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  >
                    <Sparkles className="size-4 text-muted-foreground/30" />
                  </motion.div>
                </div>
              ) : hasResults ? (
                <div className="space-y-0.5">
                  {filteredTree.map((node) => (
                    <TreeNodeItem
                      key={node.id}
                      node={node}
                      searchQuery={searchQuery}
                      onDrillDown={handleDrillDown}
                      activeNodeId={activeNodeId}
                    />
                  ))}
                </div>
              ) : (
                /* No matches state */
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-12 gap-3 px-4 text-center"
                >
                  <AlertCircle className="size-8 text-muted-foreground/20" />
                  <div>
                    <div className="text-xs text-muted-foreground/50 font-medium">
                      No matches for &ldquo;{searchQuery}&rdquo;
                    </div>
                    <div className="text-[11px] text-muted-foreground/30 mt-1">
                      Try a different search term
                    </div>
                  </div>
                  {/* CTA to open Custom Connector Wizard */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      // Navigate to connector wizard
                      if (onAddConnector) {
                        onAddConnector();
                      } else {
                        window.open("/admin/connector-wizard", "_blank");
                      }
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
                      "text-[11px] font-medium",
                      "bg-primary/10 text-primary border border-primary/20",
                      "hover:bg-primary/15 transition-colors",
                    )}
                  >
                    <Plus className="size-3" />
                    Add custom connector
                  </motion.button>
                </motion.div>
              )}
            </div>

            {/* Pinned Bottom: + Add Connector */}
            <div className="border-t border-border/20 px-3 py-2">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (onAddConnector) {
                    onAddConnector();
                  } else {
                    window.open("/admin/connector-wizard", "_blank");
                  }
                }}
                className={cn(
                  "flex items-center justify-center gap-2 w-full py-2 rounded-lg",
                  "text-[12px] font-medium",
                  "bg-muted/30 hover:bg-muted/50",
                  "border border-dashed border-border/40",
                  "text-muted-foreground/70 hover:text-foreground/80",
                  "transition-all duration-200",
                )}
              >
                <Plus className="size-3.5" />
                Add Connector
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
