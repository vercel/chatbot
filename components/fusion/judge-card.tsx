"use client";

/**
 * Phase 23A: Judge Card — shows judge synthesis status
 *
 * Displays judge model info with star badge, status, and final synthesis.
 * Appears after all agents complete.
 */

import { motion } from "framer-motion";
import { CheckCircle2Icon, Loader2Icon, StarIcon } from "lucide-react";
import { GlassCard } from "@/components/library/glass-card";
import { FADE_UP } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";

type JudgeStatus = "waiting" | "synthesizing" | "complete" | "failed";

interface JudgeCardProps {
  name: string;
  provider: string;
  status: JudgeStatus;
  responsePreview?: string;
  latency?: number;
  className?: string;
}

export function JudgeCard({
  name,
  provider,
  status,
  responsePreview,
  latency,
  className,
}: JudgeCardProps) {
  const _isActive = status === "synthesizing" || status === "complete";

  return (
    <motion.div {...FADE_UP}>
      <GlassCard
        className={cn(
          "flex items-start gap-3 p-3.5 transition-all",
          status === "synthesizing" && "ring-1 ring-amber-500/40",
          status === "complete" && "ring-1 ring-amber-500/20",
          className
        )}
        elevation="2"
        interactive={false}
      >
        {/* Judge badge */}
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
            "bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400",
            status === "synthesizing" && "animate-pulse"
          )}
        >
          <StarIcon className="size-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold">Judge</span>
            <span className="text-[11px] text-muted-foreground">{name}</span>
            {status === "waiting" && (
              <span className="text-[10px] text-muted-foreground/50">
                waiting for agents...
              </span>
            )}
            {status === "synthesizing" && (
              <Loader2Icon className="size-3.5 text-amber-500 animate-spin" />
            )}
            {status === "complete" && (
              <CheckCircle2Icon className="size-3.5 text-emerald-500" />
            )}
          </div>

          {latency != null && status === "complete" && (
            <p className="mt-0.5 text-[10px] text-muted-foreground/50">
              Synthesized in {(latency / 1000).toFixed(1)}s
            </p>
          )}

          {status === "complete" && responsePreview && (
            <motion.p
              animate={{ opacity: 1 }}
              className="mt-2 text-[12px] text-muted-foreground/80 line-clamp-3 leading-relaxed"
              initial={{ opacity: 0 }}
            >
              {responsePreview.slice(0, 300)}
            </motion.p>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}
