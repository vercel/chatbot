"use client";

/**
 * components/canvas/breadcrumb.tsx — History breadcrumb for canvas navigation.
 *
 * Shows: Library > Connector: NMI > Function: send-sms
 * Click any segment to jump back to that history entry.
 */

import { ChevronRight } from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";
import type { CanvasHistoryEntry } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";

// ── Breadcrumb label helpers ──────────────────────────────────────────────────

function modeLabel(mode: string): string {
  const labels: Record<string, string> = {
    "library-overview": "Library",
    "connector-detail": "Connector",
    "skill-detail": "Skill",
    "function-detail": "Function",
    "playbook-detail": "Playbook",
    "workflow-canvas": "Workflow",
    "kg-explorer": "KG Explorer",
    "wiki-browser": "Wiki",
    "add-new": "Add New",
  };
  return labels[mode] || mode;
}

function contextName(ctx: Record<string, string | undefined>): string | null {
  return (
    ctx.connectorName ||
    ctx.skillName ||
    ctx.functionName ||
    ctx.playbookName ||
    ctx.workflowName ||
    ctx.kgNode ||
    ctx.wikiPath ||
    null
  );
}

function entryLabel(entry: CanvasHistoryEntry): string {
  const mode = modeLabel(entry.mode);
  const name = contextName(entry.context as Record<string, string | undefined>);
  return name ? `${mode}: ${name}` : mode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CanvasBreadcrumb() {
  const { activeMode, context, history, goToHistoryIndex } = useCanvasStore();

  // Build the full breadcrumb trail: [history... , current]
  const breadcrumbs: Array<{ label: string; index: number | null }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentEntry = {
    mode: activeMode,
    context: context as Record<string, any>,
    ts: Date.now(),
  };

  // Only show breadcrumb when we have history
  if (history.length === 0) return null;

  // Always start with Library Overview
  breadcrumbs.push({ label: "Library", index: -1 });

  // Add history entries
  for (let i = 0; i < history.length; i++) {
    breadcrumbs.push({ label: entryLabel(history[i]), index: i });
  }

  // Add current
  breadcrumbs.push({ label: entryLabel(currentEntry), index: null });

  // If only one or two entries (Library + current), show compact
  if (breadcrumbs.length <= 2) return null;

  return (
    <nav aria-label="Canvas breadcrumb" className="flex items-center gap-0.5 text-[11px] text-muted-foreground/60">
      {breadcrumbs.map((crumb, i) => {
        const isLast = i === breadcrumbs.length - 1;
        const isClickable = crumb.index !== null && crumb.index >= 0;

        return (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && <ChevronRight className="h-3 w-3 flex-shrink-0" />}
            {isClickable ? (
              <button
                onClick={() => goToHistoryIndex(crumb.index!)}
                className={cn(
                  "hover:text-foreground/80 hover:underline truncate max-w-[100px]",
                  "transition-colors",
                )}
              >
                {crumb.label}
              </button>
            ) : (
              <span
                className={cn(
                  "truncate max-w-[100px]",
                  isLast && "text-foreground/70 font-medium",
                )}
              >
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
