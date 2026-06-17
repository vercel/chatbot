/**
 * DiscoveryWorkflowPicker — Template selection grid for discovery workflows.
 *
 * Shows all 6 workflow templates as selectable cards with icons, descriptions,
 * step counts, and estimated durations.
 */

"use client";

import { useState } from "react";
import {
  Search,
  Clock,
  Layers,
  Play,
  AlertTriangle,
  Users,
  CreditCard,
  RefreshCw,
  UserCheck,
  TrendingDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WORKFLOW_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "🔍": Search,
  "💳": CreditCard,
  "🔄": RefreshCw,
  "👤": UserCheck,
  "🤝": Users,
  "⚠️": TrendingDown,
};

const CATEGORY_BADGES: Record<string, string> = {
  audit: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
  billing: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200",
  recovery: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
  customer_360: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
  agent_tracking: "bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200",
};

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  steps: { id: string; name: string; type: string }[];
  estimatedDuration: string;
  outputs: string[];
}

interface DiscoveryWorkflowPickerProps {
  templates: WorkflowTemplate[];
  onSelect: (template: WorkflowTemplate) => void;
  onRun: (template: WorkflowTemplate) => void;
  loading?: boolean;
  activeRunId?: string | null;
}

export default function DiscoveryWorkflowPicker({
  templates,
  onSelect,
  onRun,
  loading = false,
  activeRunId,
}: DiscoveryWorkflowPickerProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const categories = [...new Set(templates.map((t) => t.category))];

  const filtered = templates.filter((t) => {
    if (categoryFilter && t.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCategoryFilter(null)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
            !categoryFilter
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors",
              cat === categoryFilter
                ? "bg-primary text-primary-foreground"
                : CATEGORY_BADGES[cat] || "bg-muted hover:bg-muted/80"
            )}
          >
            {cat.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((template) => {
          const Icon = WORKFLOW_ICONS[template.icon] || Search;
          const isRunning = activeRunId !== null && activeRunId !== undefined;

          return (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              disabled={loading}
              className={cn(
                "text-left p-4 rounded-xl border transition-all duration-200",
                "hover:border-primary/50 hover:shadow-md hover:scale-[1.01]",
                "focus:outline-none focus:ring-2 focus:ring-primary/20",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "bg-card dark:bg-card"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{template.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {template.description}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap",
                    CATEGORY_BADGES[template.category] || "bg-muted"
                  )}
                >
                  {template.category.replace(/_/g, " ")}
                </span>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Layers className="h-3 w-3" />
                  {template.steps.length} steps
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {template.estimatedDuration}
                </span>
                {template.outputs.map((fmt) => (
                  <span
                    key={fmt}
                    className="px-1.5 py-0.5 rounded text-[9px] bg-muted font-mono uppercase"
                  >
                    {fmt}
                  </span>
                ))}
              </div>

              {/* Run button */}
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRun(template);
                  }}
                >
                  <Play className="h-3.5 w-3.5 mr-1" />
                  Run Now
                </Button>
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No workflows match your search</p>
        </div>
      )}
    </div>
  );
}
