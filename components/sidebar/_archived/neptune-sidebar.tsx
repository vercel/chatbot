"use client";

import {
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
  Key,
  Library,
  MessageSquare,
  Plug,
  Target,
  Wrench,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { LibraryTree } from "./library-tree";
import { FunctionDetail } from "./function-detail";
import type { LibraryTreeNode } from "@/app/api/library/tree/route";

const TABS = [
  { id: "chats", label: "Chats", icon: MessageSquare, href: "/chat" },
  { id: "library", label: "Library", icon: Library, href: "/library" },
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
  { id: "v2-sessions", label: "V2 Sessions", icon: Bot, href: "/v2-sessions" },
] as const;

export function NeptuneSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [selectedFunction, setSelectedFunction] = useState<LibraryTreeNode | null>(null);

  const isLibraryActive = pathname?.startsWith("/library");

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

      {/* New Chat */}
      <div className="px-2 pt-2">
        <Link
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          href="/chat"
        >
          <MessageSquare size={16} />
          {!collapsed && <span>+ New Chat</span>}
        </Link>
      </div>

      {/* Tabs / Library Tree */}
      <nav className="flex-1 overflow-y-auto py-2">
        {/* Show LibraryTree when on /library route */}
        {isLibraryActive && !collapsed ? (
          <div className="mt-2">
            <LibraryTree onSelectFunction={setSelectedFunction} />
          </div>
        ) : (
          TABS.map((tab) => {
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
          })
        )}
      </nav>

      {/* Function Detail Panel */}
      <FunctionDetail
        node={selectedFunction}
        onClose={() => setSelectedFunction(null)}
      />

      {/* Footer */}
      {!collapsed && (
        <div className="border-t p-3 text-xs text-muted-foreground">
          Neptune v3.1 · Grand Unification
        </div>
      )}
    </div>
  );
}
