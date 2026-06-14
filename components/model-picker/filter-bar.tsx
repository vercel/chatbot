"use client";

import {
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type SortOption =
  | "best_for_playbook"
  | "display_name"
  | "reasoning_score"
  | "coding_score"
  | "vision_score"
  | "speed_score"
  | "cost_score"
  | "context_window_tokens";

export type FilterChip = "reasoning" | "vision" | "long_context" | "cheap" | "fast" | "open_source" | "tools" | "streaming";

export interface FilterBarState {
  search: string;
  sort: SortOption;
  filters: Set<FilterChip>;
}

export const FILTER_CHIPS: { key: FilterChip; label: string; icon: string }[] = [
  { key: "reasoning", label: "Reasoning", icon: "🧠" },
  { key: "vision", label: "Vision", icon: "👁" },
  { key: "long_context", label: "Long Context", icon: "📚" },
  { key: "cheap", label: "Cheap", icon: "💰" },
  { key: "fast", label: "Fast", icon: "⚡" },
  { key: "tools", label: "Tools", icon: "🔧" },
  { key: "streaming", label: "Streaming", icon: "🌊" },
  { key: "open_source", label: "Open Source", icon: "🔓" },
];

export const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: "best_for_playbook", label: "Best for Playbook" },
  { key: "display_name", label: "Name" },
  { key: "reasoning_score", label: "Reasoning" },
  { key: "coding_score", label: "Coding" },
  { key: "vision_score", label: "Vision" },
  { key: "speed_score", label: "Speed" },
  { key: "cost_score", label: "Cost" },
  { key: "context_window_tokens", label: "Context Size" },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface FilterBarProps {
  state: FilterBarState;
  onChange: Dispatch<SetStateAction<FilterBarState>>;
  className?: string;
}

export function FilterBar({ state, onChange, className }: FilterBarProps) {
  const [showSortMenu, setShowSortMenu] = useState(false);

  const toggleFilter = useCallback(
    (chip: FilterChip) => {
      onChange((prev) => {
        const next = new Set(prev.filters);
        if (next.has(chip)) {
          next.delete(chip);
        } else {
          next.add(chip);
        }
        return { ...prev, filters: next };
      });
    },
    [onChange],
  );

  const clearFilters = useCallback(() => {
    onChange((prev) => ({ ...prev, filters: new Set(), search: "" }));
  }, [onChange]);

  const activeFilterCount = state.filters.size;
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search + Sort Row */}
      <div className="flex items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Search models..."
            value={state.search}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, search: e.target.value }))
            }
            className={cn(
              "w-full h-9 pl-9 pr-8 rounded-lg",
              "bg-muted/40 backdrop-blur-sm",
              "border border-border/40",
              "text-xs placeholder:text-muted-foreground/40",
              "focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40",
              "transition-all duration-200",
            )}
          />
          {state.search && (
            <button
              onClick={() => onChange((prev) => ({ ...prev, search: "" }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted-foreground/10 transition-colors"
            >
              <X className="size-3 text-muted-foreground/60" />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className={cn(
              "flex items-center gap-1.5 h-9 px-3 rounded-lg",
              "bg-muted/40 backdrop-blur-sm",
              "border border-border/40",
              "text-xs text-muted-foreground",
              "hover:bg-muted/60 transition-colors duration-200",
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            <span className="hidden sm:inline">Sort</span>
          </button>

          <AnimatePresence>
            {showSortMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSortMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className={cn(
                    "absolute right-0 top-full mt-1 z-50",
                    "w-48 py-1 rounded-xl",
                    "bg-card/90 backdrop-blur-2xl",
                    "border border-border/30",
                    "shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12)]",
                    "overflow-hidden",
                  )}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        onChange((prev) => ({ ...prev, sort: opt.key }));
                        setShowSortMenu(false);
                      }}
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-2 text-xs",
                        "hover:bg-muted/40 transition-colors",
                        state.sort === opt.key && "text-primary font-medium",
                      )}
                    >
                      {opt.label}
                      {state.sort === opt.key && (
                        <Check className="size-3 text-primary" />
                      )}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTER_CHIPS.map((chip) => {
          const isActive = state.filters.has(chip.key);
          return (
            <motion.button
              key={chip.key}
              onClick={() => toggleFilter(chip.key)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full",
                "text-[11px] font-medium",
                "border transition-all duration-200",
                isActive
                  ? "bg-primary/10 border-primary/30 text-primary shadow-sm"
                  : "bg-transparent border-border/30 text-muted-foreground hover:border-border/60 hover:text-foreground/80",
              )}
            >
              <span>{chip.icon}</span>
              <span>{chip.label}</span>
              {isActive && <X className="size-2.5 ml-0.5 opacity-60" />}
            </motion.button>
          );
        })}

        <AnimatePresence>
          {hasActiveFilters && (
            <motion.button
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <X className="size-3" /> Clear ({activeFilterCount})
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
