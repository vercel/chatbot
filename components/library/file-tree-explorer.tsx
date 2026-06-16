"use client";

/**
 * FileTreeExplorer — Enhanced file tree with icons, types, and motion.
 * Phase 22: Extends the existing FileTreeNav with premium styling.
 *
 * Features:
 *  - Recursive tree with Collapsible nodes
 *  - Type-specific icons (folder, playbook, connector, skill, function)
 *  - Glass surface container
 *  - Loading/error/empty states
 *  - Staggered child entrance animation
 *  - respects the existing /api/file-tree endpoint
 */

import {
  BookOpen,
  ChevronRight,
  Code2,
  FileText,
  Folder,
  FolderOpen,
  FunctionSquare,
  Plug,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SPRING_GENTLE, STAGGER_ITEM } from "@/lib/motion/springs";

// ── Types ──────────────────────────────────────────────────────────────────

interface FileTreeNode {
  name: string;
  type: "directory" | "file";
  path: string;
  children?: FileTreeNode[];
  description?: string;
  icon?: string;
}

interface FileTreeResponse {
  root: string;
  tree: FileTreeNode;
  total: number;
}

interface FileTreeExplorerProps {
  root: "playbooks" | "connectors" | "skills";
  collapsed?: boolean;
  className?: string;
}

// ── Icon mapping ───────────────────────────────────────────────────────────

function getIcon(iconHint?: string, isOpen?: boolean): React.ReactNode {
  switch (iconHint) {
    case "book":
      return <BookOpen size={15} />;
    case "plug":
      return <Plug size={15} />;
    case "sparkles":
      return <Sparkles size={15} />;
    case "code":
      return <Code2 size={15} />;
    case "function":
      return <FunctionSquare size={15} />;
    case "folder":
      return isOpen ? <FolderOpen size={15} /> : <Folder size={15} />;
    default:
      return <FileText size={15} />;
  }
}

function getTypeColor(type: string, iconHint?: string): string {
  switch (iconHint) {
    case "book":
      return "text-amber-400";
    case "plug":
      return "text-cyan-400";
    case "sparkles":
      return "text-emerald-400";
    case "code":
    case "function":
      return "text-violet-400";
    default:
      return type === "directory" ? "text-blue-400" : "text-muted-foreground";
  }
}

// ── TreeNode ───────────────────────────────────────────────────────────────

function TreeNode({
  node,
  collapsed: sidebarCollapsed,
  depth = 0,
  index = 0,
}: {
  node: FileTreeNode;
  collapsed: boolean;
  depth?: number;
  index?: number;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const displayName = node.type === "file"
    ? node.name.replace(/\.(md|mdx|yaml|yml)$/, "").replace(/^playbook-/, "").replace(/-/g, " ")
    : node.name.replace(/-/g, " ");
  const iconColor = getTypeColor(node.type, node.icon);

  if (sidebarCollapsed && depth > 0) return null;

  if (node.type === "directory" && hasChildren) {
    return (
      <motion.div {...STAGGER_ITEM} transition={{ delay: index * 0.02 }}>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-left rounded-lg text-sm",
              "hover:bg-muted/50 transition-colors",
              "min-h-[40px]",
              sidebarCollapsed && "justify-center px-0"
            )}
          >
            <ChevronRight
              size={13}
              className={cn(
                "shrink-0 transition-transform text-muted-foreground/50",
                open && "rotate-90"
              )}
            />
            <span className={cn("shrink-0", iconColor)}>
              {getIcon(node.icon, open)}
            </span>
            {!sidebarCollapsed && (
              <span className="font-medium truncate text-[13px] capitalize">
                {displayName}
              </span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-3 pl-2 border-l border-border/30">
              {node.children!.map((child, i) => (
                <TreeNode
                  key={child.path}
                  node={child}
                  collapsed={sidebarCollapsed}
                  depth={depth + 1}
                  index={i}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>
    );
  }

  // Leaf node
  const href = `/library/${node.path}`;

  return (
    <motion.div {...STAGGER_ITEM} transition={{ delay: index * 0.02 }}>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm",
          "hover:bg-muted/50 transition-colors group",
          "min-h-[40px]",
          sidebarCollapsed && "justify-center px-0",
          depth > 0 && "ml-4"
        )}
        title={node.description ?? displayName}
      >
        <span className={cn("shrink-0 transition-colors", iconColor, "group-hover:opacity-80")}>
          {getIcon(node.icon)}
        </span>
        {!sidebarCollapsed && (
          <div className="flex flex-col min-w-0">
            <span className="truncate capitalize text-[13px]">{displayName}</span>
            {node.description && (
              <span className="text-[10px] text-muted-foreground truncate">
                {node.description.slice(0, 60)}
              </span>
            )}
          </div>
        )}
      </Link>
    </motion.div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export function FileTreeExplorer({ root, collapsed = false, className }: FileTreeExplorerProps) {
  const [tree, setTree] = useState<FileTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/file-tree?root=${root}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<FileTreeResponse>;
      })
      .then((data) => {
        if (!cancelled) setTree(data.tree);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [root]);

  if (loading) {
    return (
      <div className={cn("space-y-2 p-2", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !tree) {
    return (
      <div className={cn("p-4 text-xs text-muted-foreground", className)}>
        {error ? `⚠ ${error}` : "Empty tree"}
      </div>
    );
  }

  return (
    <div className={cn("py-1", className)} data-tree-root={root}>
      {!collapsed && (
        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          {tree.name}
        </div>
      )}
      <motion.div
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.02 } } }}
      >
        {tree.children?.map((child, i) => (
          <TreeNode
            key={child.path}
            node={child}
            collapsed={collapsed}
            depth={0}
            index={i}
          />
        ))}
      </motion.div>
    </div>
  );
}

export default FileTreeExplorer;
