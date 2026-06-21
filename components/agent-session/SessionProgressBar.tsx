"use client";

/**
 * SessionProgressBar — Shared progress indicator for both V2 and VPS lanes.
 *
 * Shows:
 *   - Progress percentage bar with animated fill
 *   - Step counter (e.g., "Step 3/8")
 *   - Elapsed time
 *   - Current step label
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SessionProgressBarProps {
  /** Progress percentage 0–100 */
  progress: number;
  /** Total steps (for step counter display) */
  totalSteps?: number;
  /** Current step index (1-based) */
  currentStep?: number;
  /** Elapsed time string (e.g., "2m 30s") */
  elapsed?: string;
  /** Current step description */
  stepLabel?: string;
  /** Status — affects bar color */
  status?: "spawning" | "running" | "building" | "deploying" | "complete" | "failed";
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  spawning: "bg-blue-500",
  running: "bg-amber-500",
  building: "bg-purple-500",
  deploying: "bg-cyan-500",
  complete: "bg-emerald-500",
  failed: "bg-red-500",
};

export function SessionProgressBar({
  progress = 0,
  totalSteps,
  currentStep,
  elapsed,
  stepLabel,
  status = "running",
  className,
}: SessionProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const barColor = STATUS_COLORS[status] || "bg-amber-500";

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Info row */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          {totalSteps && currentStep && (
            <span>
              Step {currentStep}/{totalSteps}
            </span>
          )}
          {stepLabel && (
            <span className="truncate max-w-[200px]">{stepLabel}</span>
          )}
        </div>
        {elapsed && (
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="size-2.5" />
            {elapsed}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
