"use client";

import {
  BarChart3,
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
  Key,
  MessageSquare,
  Plug,
  Target,
  Wrench,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "chats", label: "Chats", icon: MessageSquare, href: "/chat" },
  { id: "vault", label: "Vault", icon: Key, href: "/vault" },
  { id: "tools", label: "Tools", icon: Wrench, href: "/tools" },
  {
    id: "connectors",
    label: "Connectors",
    icon: Plug,
    href: "/connectors",
  },
  { id: "skills", label: "Skills", icon: Target, href: "/skills" },
  { id: "playbooks", label: "Playbooks", icon: FolderGit2, href: "/playbooks" },
  { id: "memory", label: "Memory", icon: Brain, href: "/memory" },
  { id: "knowledge", label: "Knowledge", icon: BookOpen, href: "/knowledge" },
  { id: "workflows", label: "Workflows", icon: Zap, href: "/workflows" },
  { id: "reports", label: "Reports", icon: BarChart3, href: "/reports" },
] as const;

export function NeptuneSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div
      className={cn(
        "h-full border-r bg-background flex flex-col transition-all duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        {!collapsed && <span className="font-semibold text-sm">Neptune</span>}
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1 rounded hover:bg-muted"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Tabs */}
      <nav className="flex-1 overflow-y-auto py-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname?.startsWith(tab.href);
          return (
            <Link
              className={cn(
                "flex items-center gap-3 px-3 py-2 mx-1 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              href={tab.href}
              key={tab.id}
            >
              <Icon size={18} />
              {!collapsed && <span>{tab.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t p-3 text-xs text-muted-foreground">
          Neptune v3.1 · Grand Unification
        </div>
      )}
    </div>
  );
}
