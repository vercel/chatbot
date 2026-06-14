"use client";

/**
 * components/canvas/modes/playbook-detail.tsx — Playbook Detail mode.
 *
 * Phase 16.F: Trigger chips + Plan SOP component + connector graph +
 * model_routing display + recent invocations table.
 */

import type { ModeProps } from "@/lib/canvas/types";
import { useCanvasSynthesis } from "@/hooks/use-canvas-synthesis";
import { BookOpen, GitBranch, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function PlaybookDetail({ context, onNavigate }: ModeProps) {
  const playbookName = context.playbookName || "";
  const { data, isLoading, error } = useCanvasSynthesis("playbook", playbookName);

  if (!playbookName) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No playbook specified.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-5 w-5 text-amber-500" />
          <h2 className="text-xl font-bold capitalize">
            {playbookName.replace(/-/g, " ")}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground/60">
          Playbook detail view
        </p>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-4 w-3/4 bg-muted/30 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-muted/20 rounded animate-pulse" />
        </div>
      ) : error ? (
        <div className="text-sm text-destructive/60">Failed to load playbook data.</div>
      ) : (
        <>
          {/* Triggers */}
          {data?.triggers && data.triggers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Triggers
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {data.triggers.map((trigger) => (
                  <span
                    key={trigger}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  >
                    {trigger}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Connector graph link */}
          <div>
            <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
              <GitBranch className="h-4 w-4" />
              Scope Connectors
            </h3>
            <button
              onClick={() => onNavigate("kg-explorer", { kgNode: `playbook:${playbookName}` })}
              className={cn(
                "w-full rounded-lg border border-border/30 p-3 text-left",
                "hover:bg-muted/20 transition-colors",
                "text-sm text-muted-foreground/70",
              )}
            >
              View connector graph →
            </button>
          </div>

          {/* Model routing */}
          {data?.modelRouting && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Model Routing</h3>
              <div className="rounded-lg border border-border/30 divide-y divide-border/20">
                {Object.entries(data.modelRouting).map(([tier, model]) => (
                  <div
                    key={tier}
                    className="flex items-center justify-between p-3 text-sm"
                  >
                    <span className="text-muted-foreground/70 capitalize">
                      {tier}
                    </span>
                    <span className="font-mono text-xs">{model}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MD content / SOP steps */}
          {data?.markdown && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">SOP Steps</h3>
              <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none">
                <pre className="text-xs whitespace-pre-wrap bg-muted/20 rounded-lg p-4">
                  {data.markdown}
                </pre>
              </div>
            </div>
          )}

          {/* Reverse refs */}
          {data?.reverseRefs && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Referenced Workflows</h3>
              <div className="flex flex-wrap gap-2">
                {(data.reverseRefs.workflows || []).map((wf) => (
                  <button
                    key={wf}
                    onClick={() =>
                      onNavigate("workflow-canvas", { workflowName: wf })
                    }
                    className="text-xs px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border/30 transition-colors"
                  >
                    {wf}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
