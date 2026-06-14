"use client";

/**
 * NavAgents — Agents navigation group with collapsible sections.
 * PHASE B: Sidebar Overhaul — shadcn-based enterprise design.
 *
 * Renders agent-related navigation: Chats, V2 Sessions, Workflows, Sandbox.
 * With live badge counts where applicable.
 */

import {
  BotIcon,
  ChevronRightIcon,
  MessageSquareIcon,
  PlayIcon,
  WorkflowIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AgentCounts {
  tools: number;
  v2Sessions: number;
}

async function fetchAgentCounts(): Promise<AgentCounts> {
  const counts: AgentCounts = { tools: 0, v2Sessions: 0 };

  try {
    const [toolsRes, v2Res] = await Promise.allSettled([
      fetch("/api/tools"),
      fetch("/api/v2/sessions?status=all&limit=1"),
    ]);

    if (toolsRes.status === "fulfilled" && toolsRes.value.ok) {
      const tools = await toolsRes.value.json();
      counts.tools = tools.count ?? 0;
    }
    if (v2Res.status === "fulfilled" && v2Res.value.ok) {
      const v2 = await v2Res.value.json();
      counts.v2Sessions = v2.total ?? v2.count ?? 0;
    }
  } catch {
    // Silent
  }

  return counts;
}

const AGENT_ITEMS = [
  {
    id: "chat",
    label: "Chat",
    icon: MessageSquareIcon,
    href: "/",
    shortcut: "⌘1",
  },
  {
    id: "tools",
    label: "Tools",
    icon: ZapIcon,
    href: "/tools",
    shortcut: "⌘3",
    countKey: "tools" as const,
  },
  {
    id: "v2-sessions",
    label: "V2 Sessions",
    icon: BotIcon,
    href: "/v2-sessions",
    shortcut: "⌘8",
    countKey: "v2Sessions" as const,
  },
  {
    id: "sessions",
    label: "Sessions",
    icon: BotIcon,
    href: "/sessions",
  },
  {
    id: "workflows",
    label: "Workflows",
    icon: WorkflowIcon,
    href: "/workflows",
    shortcut: "⌘5",
  },
  {
    id: "sandbox",
    label: "Sandbox",
    icon: PlayIcon,
    href: "/sandbox",
  },
];

export function NavAgents() {
  const pathname = usePathname();
  const [counts, setCounts] = useState<AgentCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAgentCounts().then((c) => {
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
        Agents
      </SidebarGroupLabel>
      <SidebarMenu>
        {AGENT_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/"
            ? pathname === "/"
            : item.href === "/sessions"
              ? pathname?.startsWith("/sessions") || pathname?.startsWith("/handoff")
              : pathname?.startsWith(item.href);
          const count = item.countKey ? counts?.[item.countKey] : undefined;
          const showCount = count !== undefined && count > 0;

          return (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                asChild
                className={cn(
                  "transition-colors duration-150",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                )}
                isActive={isActive}
                tooltip={`${item.label}${item.shortcut ? ` (${item.shortcut})` : ""}`}
              >
                <Link href={item.href}>
                  <Icon className="size-4" />
                  <span>{item.label}</span>
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
