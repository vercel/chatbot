"use client";

/**
 * components/canvas/modes/skill-detail.tsx — Skill Detail mode.
 *
 * Phase 16.F: Constraint badges + MD content + functions grid + reverse refs.
 * Shared GlassCard + ActionButton primitives.
 */

import type { ModeProps } from "@/lib/canvas/types";
import { useCanvasSynthesis } from "@/hooks/use-canvas-synthesis";
import { Sparkles, ExternalLink, Beaker } from "lucide-react";
import { cn } from "@/lib/utils";

export function SkillDetail({ context, onNavigate }: ModeProps) {
  const skillName = context.skillName || "";
  const { data, isLoading, error } = useCanvasSynthesis("skill", skillName);

  if (!skillName) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No skill specified.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h2 className="text-xl font-bold capitalize">
            {skillName.replace(/-/g, " ")}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground/60">
          Skill detail view
        </p>
      </div>

      {/* ── Constraint Badges ────────────────────────────────────────── */}
      {data?.constraints && (
        <div className="flex flex-wrap gap-2">
          {data.constraints.tokens && (
            <span className="px-2 py-1 rounded-md text-[12px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
              ~{data.constraints.tokens} tokens
            </span>
          )}
          {data.constraints.latency && (
            <span className="px-2 py-1 rounded-md text-[12px] font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20">
              ~{data.constraints.latency}ms
            </span>
          )}
          {data.constraints.cost && (
            <span className="px-2 py-1 rounded-md text-[12px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              ~${data.constraints.cost}
            </span>
          )}
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-4 w-3/4 bg-muted/30 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-muted/20 rounded animate-pulse" />
        </div>
      ) : error ? (
        <div className="text-sm text-destructive/60">Failed to load skill data.</div>
      ) : (
        <>
          {/* MD content */}
          <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none">
            <pre className="text-xs whitespace-pre-wrap bg-muted/20 rounded-lg p-4">
              {data?.markdown || "Skill content loading..."}
            </pre>
          </div>

          {/* Functions grid */}
          {data?.reverseRefs?.functions && data.reverseRefs.functions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Exposed Functions</h3>
              <div className="grid grid-cols-2 gap-2">
                {(data.reverseRefs.functions || []).map((fn) => (
                  <button
                    key={fn}
                    onClick={() =>
                      onNavigate("function-detail", { functionName: fn })
                    }
                    className={cn(
                      "rounded-lg border border-border/30 p-2.5 text-left",
                      "hover:bg-muted/20 transition-colors",
                      "text-sm font-mono",
                    )}
                  >
                    {fn}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reverse refs */}
          <ReverseRefs data={data} onNavigate={onNavigate} />

          {/* Test in Sandbox CTA */}
          <button
            onClick={() => {
              // Open in sandbox flow
              window.open(`/sandbox?skill=${skillName}`, "_blank");
            }}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
              "text-sm font-medium",
              "bg-muted/30 hover:bg-muted/50 border border-border/30",
              "transition-colors",
            )}
          >
            <Beaker className="h-4 w-4" />
            Test in Sandbox
          </button>
        </>
      )}
    </div>
  );
}

function ReverseRefs({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data,
  onNavigate,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  onNavigate: ModeProps["onNavigate"];
}) {
  const refs = (data?.reverseRefs as Record<string, string[]>) || {};
  const entries = Object.entries(refs).filter(
    ([, arr]) => arr && arr.length > 0,
  );

  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Referenced By</h3>
      {entries.map(([key, items]) => (
        <div key={key}>
          <p className="text-[11px] text-muted-foreground/40 uppercase mb-1">
            {key}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => (
              <span
                key={item}
                className="text-xs px-2 py-0.5 rounded bg-muted/30 text-muted-foreground/70"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
