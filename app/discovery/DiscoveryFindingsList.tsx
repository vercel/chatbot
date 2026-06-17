/**
 * DiscoveryFindingsList — Displays finding cards with severity indicators,
 * expandable evidence, and suggested actions.
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ExternalLink,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Finding {
  id: string;
  customerId: string;
  customerName: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  evidence: string[];
  recommendation: string;
  suggestedAction: {
    type: string;
    description: string;
    entityId: string;
  };
}

interface DiscoveryFindingsListProps {
  findings: Finding[];
  className?: string;
  onActionClick?: (finding: Finding) => void;
}

const SEVERITY_COLORS: Record<string, { border: string; bg: string; text: string; icon: string }> = {
  critical: {
    border: "border-l-red-500",
    bg: "bg-red-50 dark:bg-red-950/20",
    text: "text-red-700 dark:text-red-300",
    icon: "text-red-500",
  },
  high: {
    border: "border-l-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    text: "text-orange-700 dark:text-orange-300",
    icon: "text-orange-500",
  },
  medium: {
    border: "border-l-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
    text: "text-yellow-700 dark:text-yellow-300",
    icon: "text-yellow-500",
  },
  low: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    text: "text-emerald-700 dark:text-emerald-300",
    icon: "text-emerald-500",
  },
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export default function DiscoveryFindingsList({
  findings,
  className,
  onActionClick,
}: DiscoveryFindingsListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>("all");

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const severities = [...new Set(findings.map((f) => f.severity))];

  const filtered = filter === "all"
    ? findings
    : findings.filter((f) => f.severity === filter);

  if (findings.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <CheckCircle className="h-10 w-10 mx-auto mb-2 text-emerald-400" />
        <p className="text-sm text-muted-foreground">No findings — all systems aligned</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Findings ({findings.length})
          {findings.filter((f) => f.severity === "critical").length > 0 && (
            <span className="ml-2 text-red-500">
              {findings.filter((f) => f.severity === "critical").length} critical
            </span>
          )}
        </h3>

        {/* Severity filter pills */}
        <div className="flex gap-1">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            All
          </button>
          {severities.map((sev) => (
            <button
              key={sev}
              onClick={() => setFilter(sev === filter ? "all" : sev)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                sev === filter
                  ? `${SEVERITY_COLORS[sev]?.bg} ${SEVERITY_COLORS[sev]?.text}`
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              {SEVERITY_LABELS[sev]}
            </button>
          ))}
        </div>
      </div>

      {filtered.map((finding) => {
        const colors = SEVERITY_COLORS[finding.severity] || SEVERITY_COLORS.low;
        const isExpanded = expandedIds.has(finding.id);

        return (
          <div
            key={finding.id}
            className={cn(
              "border border-border rounded-lg overflow-hidden transition-all",
              "border-l-4",
              colors.border,
              isExpanded && colors.bg
            )}
          >
            {/* Header — always visible */}
            <button
              onClick={() => toggleExpand(finding.id)}
              className="w-full text-left px-4 py-2.5 flex items-start gap-3"
            >
              <AlertTriangle className={cn("h-4 w-4 mt-0.5 flex-shrink-0", colors.icon)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{finding.title}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium",
                      colors.bg, colors.text
                    )}
                  >
                    {SEVERITY_LABELS[finding.severity]}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                    {finding.category.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {finding.customerName} — {finding.description}
                </p>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-3 space-y-2 border-t border-border/50 pt-2">
                {/* Evidence */}
                {finding.evidence.length > 0 && (
                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground">Evidence:</span>
                    <ul className="mt-1 space-y-0.5">
                      {finding.evidence.map((e, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-muted-foreground/40 mt-0.5">•</span>
                          <span className="font-mono text-[11px]">{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendation */}
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground">Recommendation:</span>
                  <p className="text-xs mt-0.5">{finding.recommendation}</p>
                </div>

                {/* Action row */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    onClick={() => onActionClick?.(finding)}
                  >
                    <ArrowRight className="h-3 w-3 mr-1" />
                    {finding.suggestedAction.type.replace(/_/g, " ")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `Customer: ${finding.customerName} (${finding.customerId})\nIssue: ${finding.description}\nRecommendation: ${finding.recommendation}`
                      );
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Import for zero-findings state
import { CheckCircle } from "lucide-react";
