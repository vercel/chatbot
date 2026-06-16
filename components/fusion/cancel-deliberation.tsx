"use client";

/**
 * Phase 23A: Cancel Deliberation — stop button for panel execution
 *
 * Shows when a panel run is active. Calls onCancel to abort.
 */

import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CancelDeliberationProps {
  onCancel: () => void;
  className?: string;
}

export function CancelDeliberation({
  onCancel,
  className,
}: CancelDeliberationProps) {
  return (
    <button
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium",
        "border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
        "hover:bg-red-500/20 active:scale-95 transition-all",
        className
      )}
      onClick={onCancel}
      type="button"
    >
      <XIcon className="size-3.5" />
      Cancel
    </button>
  );
}
