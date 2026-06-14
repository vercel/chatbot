"use client";

/**
 * LibraryTree — Recursive tree component for the Library sidebar tab.
 *
 * Renders four top-level categories (Connectors, Skills, Functions, Playbooks)
 * with smooth Radix animations via shadcn Collapsible.
 * Each node is expandable with icons and metadata badges.
 *
 * Click function → detail panel with reverse refs.
 */

import {
  BookIcon,
  ChevronRightIcon,
  CodeIcon,
  CogIcon,
  CreditCardIcon,
  DollarSignIcon,
  LifeBuoyIcon,
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
import React, { useCallback, useEffect, useState } from "react";
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
  const Icon = resolveIcon(node.icon);
  const hasChildren = node.children && node.children.length > 0;
  const isCategory = node.type === "category";

  const handleClick = useCallback(() => {
    if (node.type === "function") {
      onSelectFunction?.(node);
    }
    if (hasChildren) {
      setOpen(!open);
    }
  }, [node, hasChildren, open, onSelectFunction]);

  if (!hasChildren && !isCategory) {
    // Leaf node
    return (
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
    );
  }

  // Expandable node
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
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
