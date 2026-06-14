"use client";

/**
 * components/canvas/mode-skeleton.tsx — Skeleton loader for canvas modes.
 *
 * Phase 16: Shown during lazy-load (Suspense fallback) for each mode.
 * Uses the existing Shimmer AI Element pattern for consistency.
 */

import type { CanvasMode } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-4 rounded-md bg-muted/40 animate-pulse",
        className,
      )}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border/30 p-4 space-y-3">
      <SkeletonBar className="w-1/3 h-5" />
      <SkeletonBar className="w-full" />
      <SkeletonBar className="w-2/3" />
    </div>
  );
}

export function CanvasModeSkeleton({ mode }: { mode: CanvasMode }) {
  return (
    <div className="p-4 space-y-4" aria-busy="true" aria-label={`Loading ${mode}`}>
      {/* Header skeleton */}
      <div className="space-y-2">
        <SkeletonBar className="w-2/5 h-6" />
        <SkeletonBar className="w-3/5" />
      </div>
      {/* Content skeleton — variable by mode */}
      {mode === "library-overview" ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : mode === "connector-detail" ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonBar key={i} className="w-16 h-7" />
            ))}
          </div>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : mode === "kg-explorer" ? (
        <SkeletonBar className="h-64 w-full" />
      ) : (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}
    </div>
  );
}
