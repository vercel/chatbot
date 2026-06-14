"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelCard } from "./model-card";
import { FilterBar, type FilterBarState, type FilterChip } from "./filter-bar";
import type { ModelDetail } from "./model-tooltip";

// ── Types ──────────────────────────────────────────────────────────────────

interface ModelLibraryProps {
  onModelSelect?: (identifier: string) => void;
  selectedModelId?: string;
  className?: string;
  compact?: boolean;
  maxModels?: number;
  /** Playbook context for "Best for Playbook" sorting */
  playbookContext?: {
    domain: string;
    requiredCapabilities: string[];
  };
}

// ── Constants ──────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function scoreForPlaybookContext(
  model: ModelDetail,
  ctx?: { domain: string; requiredCapabilities: string[] },
): number {
  if (!ctx) return 0;
  let score = 0;

  // Bonus for matching required capabilities
  const modelCaps = new Set(model.capabilities);
  for (const cap of ctx.requiredCapabilities) {
    if (modelCaps.has(cap)) score += 20;
  }

  // Domain-based heuristics
  const domain = ctx.domain;
  if (domain.includes("coding") || domain.includes("engineering")) {
    score += (model.codingScore ?? 0) * 0.3;
  }
  if (domain.includes("vision") || domain.includes("design")) {
    score += (model.visionScore ?? 0) * 0.3;
  }
  if (domain.includes("fast") || domain.includes("chat")) {
    score += (model.speedScore ?? 0) * 0.3;
  }
  if (domain.includes("research") || domain.includes("analysis")) {
    score += (model.reasoningScore ?? 0) * 0.3;
  }

  return score;
}

function matchesFilters(model: ModelDetail, filters: Set<FilterChip>): boolean {
  if (filters.size === 0) return true;

  const modelCaps = new Set(model.capabilities);
  const contextTokens = model.contextWindowTokens;

  for (const filter of filters) {
    switch (filter) {
      case "reasoning":
        if (!modelCaps.has("reasoning")) return false;
        break;
      case "vision":
        if (!modelCaps.has("vision")) return false;
        break;
      case "tools":
        if (!modelCaps.has("tools")) return false;
        break;
      case "streaming":
        if (!modelCaps.has("streaming")) return false;
        break;
      case "long_context":
        if (contextTokens < 200_000) return false;
        break;
      case "cheap":
        if (model.inputPricePerMillion > 1.0) return false;
        break;
      case "fast":
        if ((model.speedScore ?? 0) < 70) return false;
        break;
      case "open_source":
        if (!model.capabilities.some((c) => c.toLowerCase().includes("open")))
          return false;
        break;
    }
  }
  return true;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ModelLibrary({
  onModelSelect,
  selectedModelId,
  className,
  compact = false,
  maxModels,
  playbookContext,
}: ModelLibraryProps) {
  const [models, setModels] = useState<ModelDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterState, setFilterState] = useState<FilterBarState>({
    search: "",
    sort: "best_for_playbook",
    filters: new Set(),
  });

  // Fetch models
  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/library/models?status=active");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setModels(data.models ?? []);
    } catch (err) {
      console.error("[ModelLibrary] fetch failed:", err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Filtered + sorted models
  const processedModels = useMemo(() => {
    let result = [...models];

    // Search filter
    if (filterState.search) {
      const q = filterState.search.toLowerCase();
      result = result.filter(
        (m) =>
          m.displayName.toLowerCase().includes(q) ||
          m.identifier.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q),
      );
    }

    // Chip filters
    result = result.filter((m) => matchesFilters(m, filterState.filters));

    // Sort
    const sort = filterState.sort;
    if (sort === "best_for_playbook") {
      result.sort((a, b) => {
        const scoreA = scoreForPlaybookContext(a, playbookContext);
        const scoreB = scoreForPlaybookContext(b, playbookContext);
        return scoreB - scoreA;
      });
    } else if (sort === "display_name") {
      result.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } else if (sort === "reasoning_score") {
      result.sort((a, b) => (b.reasoningScore ?? 0) - (a.reasoningScore ?? 0));
    } else if (sort === "coding_score") {
      result.sort((a, b) => (b.codingScore ?? 0) - (a.codingScore ?? 0));
    } else if (sort === "vision_score") {
      result.sort((a, b) => (b.visionScore ?? 0) - (a.visionScore ?? 0));
    } else if (sort === "speed_score") {
      result.sort((a, b) => (b.speedScore ?? 0) - (a.speedScore ?? 0));
    } else if (sort === "cost_score") {
      result.sort((a, b) => (b.costScore ?? 0) - (a.costScore ?? 0));
    } else if (sort === "context_window_tokens") {
      result.sort((a, b) => b.contextWindowTokens - a.contextWindowTokens);
    }

    if (maxModels) {
      result = result.slice(0, maxModels);
    }

    return result;
  }, [models, filterState, playbookContext, maxModels]);

  // Group by provider
  const groupedModels = useMemo(() => {
    const groups: Record<string, ModelDetail[]> = {};
    for (const m of processedModels) {
      const key = m.provider || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }
    return groups;
  }, [processedModels]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-16", className)}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        >
          <Loader2 className="size-5 text-muted-foreground/40" />
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-16 gap-3",
          className,
        )}
      >
        <AlertCircle className="size-8 text-red-400/60" />
        <div className="text-sm text-muted-foreground text-center max-w-xs">
          Failed to load models: {error}
        </div>
        <button
          onClick={fetchModels}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/40 hover:bg-muted/60 transition-colors"
        >
          <RefreshCw className="size-3" /> Retry
        </button>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-16 gap-3",
          className,
        )}
      >
        <Sparkles className="size-8 text-muted-foreground/30" />
        <div className="text-sm text-muted-foreground text-center">
          No models seeded yet. Run <code className="text-xs bg-muted/40 px-1 py-0.5 rounded">pnpm seed:models</code>.
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Filter Bar */}
      <FilterBar state={filterState} onChange={setFilterState} />

      {/* Results count */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground/60">
          {processedModels.length} model{processedModels.length !== 1 ? "s" : ""}
          {filterState.filters.size > 0 && " filtered"}
        </div>
        <button
          onClick={fetchModels}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
        >
          <RefreshCw className="size-3" /> Refresh
        </button>
      </div>

      {/* Model Grid by Provider */}
      <AnimatePresence mode="wait">
        {processedModels.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12 gap-2"
          >
            <Sparkles className="size-6 text-muted-foreground/20" />
            <div className="text-xs text-muted-foreground/50">No matching models</div>
            <div className="text-[11px] text-muted-foreground/30">
              Try adjusting your search or filters
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={filterState.search + [...filterState.filters].join(",")}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {Object.entries(groupedModels).map(([provider, providerModels]) => (
              <div key={provider}>
                {/* Provider Header */}
                <motion.div
                  variants={itemVariants}
                  className="flex items-center gap-2 mb-2 px-0.5"
                >
                  <img
                    src={`https://models.dev/logos/${provider}.svg`}
                    alt={provider}
                    className="size-4 rounded-full ring-1 ring-border/20 dark:invert"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="text-[11px] font-semibold text-muted-foreground capitalize">
                    {provider}
                  </span>
                  <span className="text-[10px] text-muted-foreground/30">
                    {providerModels.length}
                  </span>
                </motion.div>

                {/* Cards Grid */}
                <div
                  className={cn(
                    "grid gap-2.5",
                    compact
                      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
                  )}
                >
                  {providerModels.map((model, i) => (
                    <motion.div
                      key={model.identifier}
                      variants={itemVariants}
                      custom={i}
                    >
                      <ModelCard
                        model={model}
                        isSelected={selectedModelId === model.identifier}
                        onSelect={onModelSelect}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
