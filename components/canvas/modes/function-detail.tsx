"use client";

/**
 * components/canvas/modes/function-detail.tsx — Function Detail mode.
 *
 * Phase 16.F: Signature + SchemaDisplay I/O + Snippet examples + Try It live.
 * Shared GlassCard + ActionButton primitives.
 */

import type { ModeProps } from "@/lib/canvas/types";
import { useCanvasSynthesis } from "@/hooks/use-canvas-synthesis";
import { FileCode2, Play, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function FunctionDetail({ context, onNavigate }: ModeProps) {
  const functionName = context.functionName || "";
  const { data, isLoading, error } = useCanvasSynthesis("function", functionName);

  if (!functionName) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No function specified.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileCode2 className="h-5 w-5 text-emerald-500" />
          <h2 className="text-xl font-bold font-mono">{functionName}</h2>
        </div>
        <p className="text-sm text-muted-foreground/60">
          Function detail view
        </p>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-4 w-3/4 bg-muted/30 rounded animate-pulse" />
          <div className="h-20 w-full bg-muted/20 rounded animate-pulse" />
        </div>
      ) : error ? (
        <div className="text-sm text-destructive/60">Failed to load function data.</div>
      ) : (
        <>
          {/* Signature */}
          {data?.signatures && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border/30 p-4 bg-muted/10">
                <h3 className="text-xs font-medium text-muted-foreground/50 uppercase mb-2">
                  Signature
                </h3>
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {JSON.stringify(data.signatures, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Description */}
          {data?.markdown && (
            <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none">
              <pre className="text-xs whitespace-pre-wrap bg-muted/20 rounded-lg p-4">
                {data.markdown}
              </pre>
            </div>
          )}

          {/* Try It section */}
          <div className="rounded-xl border border-border/30 p-4 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Play className="h-4 w-4" />
              Try It Live
            </h3>
            <textarea
              className="w-full h-20 rounded-lg border border-border/30 bg-muted/10 p-3 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary/20"
              placeholder={`// Invoke ${functionName}\n`}
            />
            <div className="flex gap-2">
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
                  "text-xs font-medium",
                  "bg-[#0A84FF] text-white hover:bg-[#0070E0]",
                  "transition-colors",
                )}
              >
                <Play className="h-3 w-3" />
                Run
              </button>
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
                  "text-xs font-medium",
                  "bg-muted/30 hover:bg-muted/50 border border-border/30",
                  "transition-colors",
                )}
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
          </div>

          {/* Snippet examples */}
          {data?.wikiRefs && data.wikiRefs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Example Usages</h3>
              {(data.wikiRefs || []).map((ref, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/30 p-3 hover:bg-muted/10 transition-colors"
                >
                  <p className="text-xs font-medium">{ref.title}</p>
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    {ref.snippet}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
