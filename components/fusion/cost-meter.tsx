"use client";

/**
 * Phase 23A: Cost Meter — shows running cost during panel execution
 *
 * Compact meter showing: estimated cost range + running tally.
 * Updates in real-time during deliberation.
 */

import { motion } from "framer-motion";
import { DollarSignIcon } from "lucide-react";
import { SPRING_SNAPPY } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";

interface CostMeterProps {
  estCostMin: number;
  estCostMax: number;
  runningCost: number;
  className?: string;
}

export function CostMeter({
  estCostMin,
  estCostMax,
  runningCost,
  className,
}: CostMeterProps) {
  const percent = Math.min(100, (runningCost / estCostMax) * 100);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DollarSignIcon className="size-3.5 text-muted-foreground/50" />
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-mono tabular-nums text-muted-foreground/70">
          ${runningCost.toFixed(4)}
        </span>
        <span className="text-[10px] text-muted-foreground/40">
          / ~${estCostMin.toFixed(2)}–${estCostMax.toFixed(2)}
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1 flex-1 rounded-full bg-muted/30 max-w-[80px]">
        <motion.div
          animate={{ width: `${percent}%` }}
          className="h-full rounded-full bg-gradient-to-r from-cyan-500/50 to-cyan-500/30"
          transition={SPRING_SNAPPY}
        />
      </div>
    </div>
  );
}
