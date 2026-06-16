"use client";

/**
 * FilterBar — Animated filter chips for library browsing.
 * Phase 22: Horizontal scrollable chip bar with animated selection.
 *
 * Features:
 *  - Multiple filter chips with active/inactive states
 *  - Animated layout transitions (motion layoutId)
 *  - Horizontal scroll on overflow
 *  - Glass surface container
 *  - Clear all button
 */

import { motion } from "framer-motion";
import { X } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY } from "@/lib/motion/springs";

export interface FilterChip {
  id: string;
  label: string;
  count?: number;
}

interface FilterBarProps {
  chips: FilterChip[];
  active: string[];
  onChange: (active: string[]) => void;
  label?: string;
  multiSelect?: boolean;
  className?: string;
}

export function FilterBar({
  chips,
  active,
  onChange,
  label = "Filter",
  multiSelect = true,
  className,
}: FilterBarProps) {
  const toggle = (id: string) => {
    if (multiSelect) {
      onChange(
        active.includes(id)
          ? active.filter((a) => a !== id)
          : [...active, id]
      );
    } else {
      onChange(active.includes(id) ? [] : [id]);
    }
  };

  const clearAll = () => onChange([]);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="text-xs font-medium text-muted-foreground shrink-0">{label}</span>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex items-center gap-1.5 pb-1">
          {chips.map((chip) => {
            const isActive = active.includes(chip.id);
            return (
              <button
                key={chip.id}
                onClick={() => toggle(chip.id)}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
                  "text-xs font-medium transition-colors",
                  "min-h-[32px]",
                  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                aria-pressed={isActive}
              >
                {isActive && (
                  <motion.div
                    layoutId="filter-active"
                    transition={SPRING_SNAPPY}
                    className="absolute inset-0 rounded-full bg-primary"
                    style={{ borderRadius: 9999 }}
                  />
                )}
                <span className="relative z-10">{chip.label}</span>
                {chip.count !== undefined && (
                  <span className={cn(
                    "relative z-10 text-[10px] tabular-nums",
                    isActive ? "text-primary-foreground/70" : "text-muted-foreground/50"
                  )}>
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>

      {active.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="h-7 text-[11px] gap-1 text-muted-foreground shrink-0"
        >
          <X size={11} />
          Clear
        </Button>
      )}
    </div>
  );
}

export default FilterBar;
