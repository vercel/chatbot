"use client";

/**
 * NavLibrary — Library navigation group with collapsible sections.
 * PHASE B: Sidebar Overhaul — shadcn-based enterprise design.
 *
 * Renders collapsible groups for Playbooks, Connectors, Skills, Memory, Knowledge.
 * Each group has a chevron toggle and child items with icon + label + count badge.
 */

import {
  BookOpenIcon,
  BrainCircuitIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderGit2Icon,
  LayersIcon,
  NetworkIcon,
  PlugIcon,
  SparklesIcon,
  TargetIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
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
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LibraryCounts {
  playbooks: number;
  connectors: number;
  skills: number;
  memory: number;
}

async function fetchLibraryCounts(): Promise<LibraryCounts> {
  const counts: LibraryCounts = { playbooks: 0, connectors: 0, skills: 0, memory: 0 };

  try {
    // Fetch counts from multiple endpoints in parallel
    const [skillsRes, connectorsRes] = await Promise.allSettled([
      fetch("/api/skills"),
      fetch("/api/connectors"),
    ]);

    if (skillsRes.status === "fulfilled" && skillsRes.value.ok) {
      const skills = await skillsRes.value.json();
      counts.skills = skills.summary?.totalSkills ?? 0;
    }
    if (connectorsRes.status === "fulfilled" && connectorsRes.value.ok) {
      const connectors = await connectorsRes.value.json();
      counts.connectors = connectors.summary?.total ?? 0;
    }
  } catch {
    // Silent — use defaults
  }

  // Playbooks count: try file-tree endpoint
  try {
    const res = await fetch("/api/file-tree?root=playbooks");
    if (res.ok) {
      const data = await res.json();
      counts.playbooks = data.total ?? 0;
    }
  } catch {
    // Silent
  }

  return counts;
}

const LIBRARY_SECTIONS = [
  {
    id: "playbooks",
    label: "Playbooks",
    icon: FolderGit2Icon,
    href: "/playbooks",
    countKey: "playbooks" as const,
  },
  {
    id: "connectors",
    label: "Connectors",
    icon: PlugIcon,
    href: "/connectors",
    countKey: "connectors" as const,
  },
  {
    id: "skills",
    label: "Skills",
    icon: TargetIcon,
    href: "/skills",
    countKey: "skills" as const,
  },
  {
    id: "memory",
    label: "Memory",
    icon: BrainCircuitIcon,
    href: "/memory",
    countKey: "memory" as const,
  },
  {
    id: "knowledge",
    label: "Knowledge",
    icon: BookOpenIcon,
    href: "/knowledge",
  },
  {
    id: "graph",
    label: "Knowledge Graph",
    icon: NetworkIcon,
    href: "/library/graph",
  },
];

export function NavLibrary() {
  const pathname = usePathname();
  const [counts, setCounts] = useState<LibraryCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchLibraryCounts().then((c) => {
      if (!cancelled) {
        setCounts(c);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[11px] tracking-wider uppercase">
        Library
      </SidebarGroupLabel>
      <SidebarMenu>
        {LIBRARY_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = pathname?.startsWith(section.href);
          const count = section.countKey ? counts?.[section.countKey] : undefined;
          const showCount = count !== undefined && count > 0;

          return (
            <SidebarMenuItem key={section.id}>
              <SidebarMenuButton
                asChild
                className={cn(
                  "transition-colors duration-150",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                )}
                isActive={isActive}
                tooltip={section.label}
              >
                <Link href={section.href}>
                  <Icon className="size-4" />
                  <span>{section.label}</span>
                </Link>
              </SidebarMenuButton>
              {showCount && (
                <SidebarMenuBadge>
                  {loading ? (
                    <Skeleton className="h-4 w-5 rounded" />
                  ) : (
                    <span className="text-[11px] tabular-nums">{count}</span>
                  )}
                </SidebarMenuBadge>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
