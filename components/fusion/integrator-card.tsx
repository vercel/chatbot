"use client";

/**
 * Phase 23B: Integrator Card — swarm/hybrid synthesis result
 *
 * Shows:
 *   - Integrator model badge + status (waiting/integrating/complete/failed)
 *   - Final synthesized response
 *   - Agent contribution scores (visual bars)
 *   - Total cost + latency
 *
 * Follows Phase 23A patterns: GlassCard, SPRING physics, mobile-first 375px.
 * Reuses JudgeCard styling (amber accent) for visual consistency.
 */

import { motion } from "framer-motion";
import {
  CheckCircle2Icon,
  Loader2Icon,
  PuzzleIcon,
  StarIcon,
  XCircleIcon,
} from "lucide-react";
import { GlassCard } from "@/components/library/glass-card";
import { FADE_UP } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";

export type IntegratorStatus = "waiting" | "integrating" | "complete" | "failed";

interface IntegratorCardProps {
  modelId: string;
  name: string;
  provider: string;
  status: IntegratorStatus;
  fullResponse?: string;
  contributionScores?: Record<string, number>;
  totalCost?: number;
  totalLatency?: number;
  totalTokensIn?: number;
  totalTokensOut?: number;
  className?: string;
}

export function IntegratorCard({
  modelId: _modelId,
  name,
  provider,
  status,
  fullResponse,
  contributionScores,
  totalCost,
  totalLatency,
  totalTokensIn,
  totalTokensOut,
  className,
}: IntegratorCardProps) {
  const hasContributions =
    contributionScores && Object.keys(contributionScores).length > 0;

  const maxScore = hasContributions
    ? Math.max(...Object.values(contributionScores!), 1)
    : 1;

  return (
    <motion.div {...FADE_UP} className={className}>
      <GlassCard
        className={cn(
          "p-4 transition-all",
          status === "integrating" && "ring-1 ring-amber-500/40",
          status === "complete" && "ring-1 ring-amber-500/20",
          status === "failed" && "ring-1 ring-red-500/20 opacity-70"
        )}
        elevation="2"
        interactive={false}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
              "bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400",
              status === "integrating" && "animate-pulse"
            )}
          >
            {status === "complete" ? (
              <StarIcon className="size-3.5" />
            ) : (
              <PuzzleIcon className="size-3.5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold">Integrator</span>
              <span className="text-[11px] text-muted-foreground">{name}</span>
              {status === "waiting" && (
                <span className="text-[10px] text-muted-foreground/50">
                  waiting for specialists...
                </span>
              )}
              {status === "integrating" && (
                <Loader2Icon className="size-3.5 text-amber-500 animate-spin" />
              )}
              {status === "complete" && (
                <CheckCircle2Icon className="size-3.5 text-emerald-500" />
              )}
              {status === "failed" && (
                <XCircleIcon className="size-3.5 text-red-500" />
              )}
            </div>
            {/* Totals row */}
            {(totalLatency != null || totalCost != null) && (
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground/50">
                {totalLatency != null && (
                  <span>
                    {totalLatency < 1000
                      ? `${totalLatency}ms`
                      : `${(totalLatency / 1000).toFixed(1)}s`}{" "}
                    total
                  </span>
                )}
                {totalTokensIn != null && totalTokensOut != null && (
                  <span>
                    {totalTokensIn}+{totalTokensOut}t
                  </span>
                )}
                {totalCost != null && (
                  <span className="text-amber-500/70">
                    ${totalCost.toFixed(4)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Contribution scores */}
        {hasContributions && status === "complete" && (
          <motion.div
            animate={{ opacity: 1 }}
            className="mb-3 space-y-1"
            initial={{ opacity: 0 }}
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 px-1 mb-2">
              Contribution Scores
            </p>
            {Object.entries(contributionScores!)
              .sort(([, a], [, b]) => b - a)
              .map(([agent, score]) => (
                <div className="flex items-center gap-2" key={agent}>
                  <span className="text-[10px] text-muted-foreground/60 w-20 truncate">
                    {agent}
                  </span>
                  <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <motion.div
                      animate={{ width: `${(score / maxScore) * 100}%` }}
                      className="h-full bg-amber-500/60 rounded-full"
                      initial={{ width: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums w-8 text-right">
                    {score}%
                  </span>
                </div>
              ))}
          </motion.div>
        )}

        {/* Final response */}
        {status === "complete" && fullResponse && (
          <motion.div
            animate={{ opacity: 1 }}
            className="border-t border-border/20 pt-3"
            initial={{ opacity: 0 }}
          >
            <p className="text-[12px] text-muted-foreground/80 line-clamp-6 leading-relaxed">
              {fullResponse.slice(0, 600)}
            </p>
          </motion.div>
        )}
      </GlassCard>
    </motion.div>
  );
}
