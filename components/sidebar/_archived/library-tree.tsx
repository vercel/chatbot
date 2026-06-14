"use client";

/**
 * LibraryTree — Recursive tree component for the Library sidebar tab.
 *
 * Renders four top-level categories (Connectors, Skills, Functions, Playbooks)
 * with smooth Radix animations via shadcn Collapsible.
 * Each node is expandable with icons and metadata badges.
 *
 * Click function → detail panel with reverse refs.
 * Phase 12.F: Hover on any node shows edge visualization (reverse refs from DB).
 */

import {
  BookIcon,
  ChevronRightIcon,
  CodeIcon,
  CogIcon,
  CreditCardIcon,
  DollarSignIcon,
  LifeBuoyIcon,
  LinkIcon,
  MailIcon,
  MessageCircleIcon,
  PlugIcon,
  ScaleIcon,
  SearchIcon,
  ShieldIcon,
  SparklesIcon,
  UserPlusIcon,
  UsersIcon,
  WrenchIcon,
  ZapIcon,
  BarChart3Icon,
  BrainIcon,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LibraryTreeNode } from "@/app/api/library/tree/route";

// ── Phase 12.F: Edge types ─────────────────────────────────────────────────

interface ReverseRef {
  from: string;
  fromType: string;
  edgeType: string;
  weight: number;
}

const EDGE_LABELS: Record<string, string> = {
  uses: "Uses",
  exposes: "Exposes",
  routes_to: "Routes to",
  implements: "Implements",
  depends_on: "Depends on",
  called_by: "Called by",
  also_in: "Also in",
};

// ── Icon Resolver ──────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Plug: PlugIcon,
  Sparkles: SparklesIcon,
  Zap: ZapIcon,
  Book: BookIcon,
  CreditCard: CreditCardIcon,
  Scale: ScaleIcon,
  UserPlus: UserPlusIcon,
  Shield: ShieldIcon,
  LifeBuoy: LifeBuoyIcon,
  DollarSign: DollarSignIcon,
  BarChart3: BarChart3Icon,
  Mail: MailIcon,
  Users: UsersIcon,
  Wrench: WrenchIcon,
  Code: CodeIcon,
  Cog: CogIcon,
  MessageCircle: MessageCircleIcon,
  Brain: BrainIcon,
  Search: SearchIcon,
};

function resolveIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] ?? PlugIcon;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface LibraryTreeProps {
  /** Called when a function node is clicked */
  onSelectFunction?: (node: LibraryTreeNode) => void;
  /** External search filter */
  searchQuery?: string;
  className?: string;
}

// ── Tree Node Component ────────────────────────────────────────────────────

interface TreeNodeProps {
  node: LibraryTreeNode;
  depth: number;
  onSelectFunction?: (node: LibraryTreeNode) => void;
  searchQuery?: string;
}

function TreeNode({ node, depth, onSelectFunction }: TreeNodeProps) {
  const [open, setOpen] = useState(depth === 0); // Categories open by default
  const [edgeHover, setEdgeHover] = useState(false);
  const [edgeData, setEdgeData] = useState<ReverseRef[] | null>(null);
  const [edgeLoading, setEdgeLoading] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Icon = resolveIcon(node.icon);
  const hasChildren = node.children && node.children.length > 0;
  const isCategory = node.type === "category";
  const isLeaf = !hasChildren && !isCategory;

  // Phase 12.F: Fetch reverse refs on hover
  const handlePointerEnter = useCallback(() => {
    if (isCategory) return;
    hoverTimerRef.current = setTimeout(async () => {
      setEdgeLoading(true);
      try {
        const nodeType = node.type;
        const nodeName = node.name;
        const res = await fetch(`/api/library/reverse-refs/${nodeType}/${encodeURIComponent(nodeName)}`);
        if (res.ok) {
          const data = await res.json();
          setEdgeData((data as any).refs?.slice(0, 10) || []);
        }
      } catch {
        // silent
      } finally {
        setEdgeLoading(false);
        setEdgeHover(true);
      }
    }, 400);
  }, [node.type, node.name, isCategory]);

  const handlePointerLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setEdgeHover(false);
    setEdgeData(null);
  }, []);

  const handleClick = useCallback(() => {
    if (node.type === "function") {
      onSelectFunction?.(node);
    }
    if (hasChildren) {
      setOpen(!open);
    }
  }, [node, hasChildren, open, onSelectFunction]);

  if (!hasChildren && !isCategory) {
    // Leaf node with edge hover
    return (
      <div className="relative" onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent/50",
            node.type === "function" && "cursor-pointer"
          )}
          onClick={handleClick}
          style={{ paddingLeft: `${12 + depth * 12}px` }}
          type="button"
        >
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate flex-1 text-left">{node.label}</span>
          {node.metadata?.tools != null && node.metadata.tools > 0 && (
            <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
              {node.metadata.tools}
            </span>
          )}
          {node.metadata?.usedBy && node.metadata.usedBy.length > 0 && (
            <span className="ml-auto shrink-0 text-[10px] tabular-nums text-primary/70">
              ←{node.metadata.usedBy.length}
            </span>
          )}
        </button>

        {/* Phase 12.F: Edge hover popup */}
        {edgeHover && (
          <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border bg-popover p-3 shadow-md text-popover-foreground">
            <div className="flex items-center gap-1.5 mb-2">
              <LinkIcon className="size-3 text-primary" />
              <span className="text-xs font-semibold">Edges</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {node.type}:{node.name}
              </span>
            </div>
            {edgeLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : edgeData && edgeData.length > 0 ? (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {edgeData.map((ref, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px]">
                    <span className={cn(
                      "shrink-0 text-[10px] px-1 py-px rounded font-medium",
                      ref.edgeType === "depends_on" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                      ref.edgeType === "uses" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                      ref.edgeType === "routes_to" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                      ref.edgeType === "exposes" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {EDGE_LABELS[ref.edgeType] || ref.edgeType}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {ref.from}
                    </span>
                    {ref.weight > 1 && (
                      <span className="text-[9px] text-muted-foreground/60 ml-auto shrink-0">
                        w:{ref.weight}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">No incoming edges</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Expandable node
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave} className="relative">
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent/50",
              isCategory && "font-semibold"
            )}
            style={{ paddingLeft: `${12 + depth * 12}px` }}
            type="button"
          >
            <ChevronRightIcon
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-90"
              )}
            />
            <Icon
              className={cn(
                "size-3.5 shrink-0",
                isCategory ? "text-foreground" : "text-muted-foreground"
              )}
            />
            <span className="truncate flex-1 text-left">{node.label}</span>
            {node.metadata?.skillsCount != null && node.metadata.skillsCount > 0 && (
              <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
                {node.metadata.skillsCount}
              </span>
            )}
          </button>
        </CollapsibleTrigger>

        {/* Phase 12.F: Edge hover popup for expandable nodes too */}
        {edgeHover && !isCategory && (
          <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border bg-popover p-3 shadow-md">
            <div className="flex items-center gap-1.5 mb-2">
              <LinkIcon className="size-3 text-primary" />
              <span className="text-xs font-semibold">Edges</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {node.type}:{node.name}
              </span>
            </div>
            {edgeLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : edgeData && edgeData.length > 0 ? (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {edgeData.map((ref, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px]">
                    <span className={cn(
                      "shrink-0 text-[10px] px-1 py-px rounded font-medium",
                      ref.edgeType === "depends_on" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                      ref.edgeType === "uses" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                      ref.edgeType === "routes_to" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                      ref.edgeType === "exposes" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {EDGE_LABELS[ref.edgeType] || ref.edgeType}
                    </span>
                    <span className="truncate">{ref.from}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">No incoming edges</p>
            )}
          </div>
        )}
      </div>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="pt-0.5">
          {node.children?.map((child) => (
            <TreeNode
              depth={depth + 1}
              key={child.id}
              node={child}
              onSelectFunction={onSelectFunction}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function LibraryTree({ onSelectFunction, searchQuery, className }: LibraryTreeProps) {
  const [tree, setTree] = useState<LibraryTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch("/api/library/tree")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setTree(data.tree ?? []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load library");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Library</SidebarGroupLabel>
        <div className="space-y-2 px-3 py-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton className="h-6 w-full rounded" key={i} />
          ))}
        </div>
      </SidebarGroup>
    );
  }

  if (error) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Library</SidebarGroupLabel>
        <p className="px-3 py-2 text-xs text-destructive">{error}</p>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[11px] tracking-wider uppercase">
        Library
      </SidebarGroupLabel>
      <div className={cn("overflow-y-auto", className)}>
        {tree.map((category) => (
          <TreeNode
            depth={0}
            key={category.id}
            node={category}
            onSelectFunction={onSelectFunction}
          />
        ))}
      </div>
    </SidebarGroup>
  );
}
