"use client";

/**
 * ArtifactTabView — Tab wrapper for detail surfaces.
 * Phase 22: Premium tab navigation with animated indicator.
 *
 * Features:
 *  - Configurable tabs with labels and content
 *  - Animated active tab indicator (motion layoutId)
 *  - Glass surface styling
 *  - Keyboard accessible (← → to switch)
 *  - Content area with fade transition
 */

import React, { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY, FADE_UP } from "@/lib/motion/springs";

export interface TabDef {
  id: string;
  label: string;
  badge?: number;
  content: React.ReactNode;
}

interface ArtifactTabViewProps {
  tabs: TabDef[];
  defaultTab?: string;
  className?: string;
  contentClassName?: string;
}

export function ArtifactTabView({
  tabs,
  defaultTab,
  className,
  contentClassName,
}: ArtifactTabViewProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? "");

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = tabs.findIndex((t) => t.id === active);
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = (currentIndex + 1) % tabs.length;
        setActive(tabs[next].id);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = (currentIndex - 1 + tabs.length) % tabs.length;
        setActive(tabs[prev].id);
      }
    },
    [active, tabs]
  );

  const activeTab = tabs.find((t) => t.id === active);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Detail tabs"
        className="flex items-center gap-1 rounded-xl p-1 glass-1 w-fit"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === active}
            onClick={() => setActive(tab.id)}
            className={cn(
              "relative flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-sm font-medium transition-colors",
              "min-h-[36px]",
              tab.id === active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.id === active && (
              <motion.div
                layoutId="tab-active"
                transition={SPRING_SNAPPY}
                className="absolute inset-0 rounded-[10px] bg-background/80 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              />
            )}
            <span className="relative z-10">{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={cn(
                "relative z-10 text-[10px] tabular-nums",
                tab.id === active ? "text-muted-foreground" : "text-muted-foreground/50"
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={cn("min-h-[200px]", contentClassName)}>
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            {...FADE_UP}
            className="w-full"
          >
            {activeTab?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ArtifactTabView;
