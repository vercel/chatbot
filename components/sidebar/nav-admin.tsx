"use client";

/**
 * NavAdmin — Administration navigation group with collapsible sections.
 * PHASE B: Sidebar Overhaul — shadcn-based enterprise design.
 *
 * Renders admin tools: Secrets, Reports, Connectors Panel, Settings.
 * With live counts for secrets and connector status.
 */

import {
  ActivityIcon,
  BarChart3Icon,
  BeakerIcon,
  FunctionSquareIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  PlugIcon,
  PuzzleIcon,
  SettingsIcon,
  ShieldAlertIcon,
  ShieldIcon,
  StoreIcon,
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

interface AdminCounts {
  secrets: number;
  connectorsConfigured: number;
}

async function fetchAdminCounts(): Promise<AdminCounts> {
  const counts: AdminCounts = { secrets: 0, connectorsConfigured: 0 };

  try {
    const [connRes] = await Promise.allSettled([
      fetch("/api/connectors"),
    ]);

    if (connRes.status === "fulfilled" && connRes.value.ok) {
      const conn = await connRes.value.json();
      counts.connectorsConfigured = conn.summary?.configured ?? 0;
    }
  } catch {
    // Silent
  }

  return counts;
}

const ADMIN_ITEMS = [
  {
    id: "function-inventory",
    label: "Function Inventory",
    icon: FunctionSquareIcon,
    href: "/admin/function-inventory",
    description: "Enterprise function map",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboardIcon,
    href: "/admin/dashboard",
    description: "Observability KPIs",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    icon: StoreIcon,
    href: "/admin/marketplace",
    description: "Skill discovery",
  },
  {
    id: "agent-sim",
    label: "Agent Sim",
    icon: BeakerIcon,
    href: "/admin/agent-sim",
    description: "Side-by-side comparison",
  },
  {
    id: "connector-wizard",
    label: "Connector Wizard",
    icon: PuzzleIcon,
    href: "/admin/connector-wizard",
    description: "8-step builder",
  },
  {
    id: "evals",
    label: "Evals",
    icon: BarChart3Icon,
    href: "/admin/evals",
    description: "Quality leaderboard",
  },
  {
    id: "connectors-admin",
    label: "Connectors",
    icon: PlugIcon,
    href: "/connectors",
    shortcut: "⌘2",
    countKey: "connectorsConfigured" as const,
    description: "MCP connections",
  },
  {
    id: "secrets",
    label: "Secrets",
    icon: KeyRoundIcon,
    href: "/secrets",
    shortcut: "⌘7",
    description: "API keys",
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3Icon,
    href: "/reports",
    shortcut: "⌘6",
    description: "Operational reports",
  },
  {
    id: "telemetry",
    label: "Telemetry",
    icon: ActivityIcon,
    href: "/telemetry",
    description: "Event tracing",
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    icon: ShieldAlertIcon,
    href: "/diagnostics",
    description: "System health",
  },
  {
    id: "settings",
    label: "Settings",
    icon: SettingsIcon,
    href: "/settings",
    description: "Configuration",
  },
];

export function NavAdmin() {
  const pathname = usePathname();
  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAdminCounts().then((c) => {
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
        Admin
      </SidebarGroupLabel>
      <SidebarMenu>
        {ADMIN_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);
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
