"use client";

/**
 * LibrarySidebar — Collapsible OS-style sidebar for library navigation.
 * Phase 22: Premium glass sidebar with motion transitions.
 *
 * Features:
 *  - Collapsible with smooth width animation (SPRING_GENTLE)
 *  - Glass-3 elevation with refractive edge
 *  - Icon-only when collapsed, full labels when expanded
 *  - Quick-jump sections: Playbooks, Connectors, Skills, Neptune
 *  - Active state highlighting with dot indicator
 *  - Mobile: becomes a drawer (vaul)
 *  - Keyboard accessible
 */

import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
  Plug,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SPRING_GENTLE } from "@/lib/motion/springs";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<any>;
  badge?: number;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Library",
    items: [
      { id: "home", label: "Home", href: "/library", icon: BookOpen },
    ],
  },
  {
    title: "Browse",
    items: [
      { id: "playbooks", label: "Playbooks", href: "/library/playbooks", icon: FolderGit2 },
      { id: "connectors", label: "Connectors", href: "/library/connectors", icon: Plug },
      { id: "skills", label: "Skills", href: "/library/skills", icon: Sparkles },
      { id: "workflows", label: "Workflows", href: "/library/workflows", icon: Workflow },
    ],
  },
  {
    title: "Special",
    items: [
      { id: "neptune", label: "Neptune", href: "/library/neptune", icon: Sparkles },
    ],
  },
];

export function LibrarySidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 256 }}
      transition={SPRING_GENTLE}
      className={cn(
        "relative flex flex-col h-full glass-3 rounded-2xl overflow-hidden",
        "border border-glass-border",
        className
      )}
    >
      {/* Toggle button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          "absolute top-3 right-2 h-7 w-7 rounded-lg z-10",
          "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          collapsed && "right-1/2 translate-x-1/2"
        )}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </Button>

      <ScrollArea className="flex-1 pt-12">
        <nav className="flex flex-col gap-4 px-2 pb-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1">
              {!collapsed && (
                <div className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== "/library" && pathname.startsWith(item.href));
                const Icon = item.icon;

                const linkContent = (
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 py-2 rounded-xl text-sm transition-all duration-200",
                      collapsed ? "justify-center px-2" : "px-3",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                      "min-h-[44px]"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="shrink-0">
                      <Icon size={18} />
                    </span>
                    <AnimatePresence mode="wait">
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.15 }}
                          className="truncate"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {isActive && collapsed && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r-full" />
                    )}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.id} delayDuration={300}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return <React.Fragment key={item.id}>{linkContent}</React.Fragment>;
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground/50 text-center">
            ⌘K to search
          </p>
        </div>
      )}
    </motion.aside>
  );
}

export default LibrarySidebar;
