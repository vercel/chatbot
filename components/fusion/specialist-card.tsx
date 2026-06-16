"use client";

/**
 * Phase 23B: Specialist Card — single swarm specialist execution
 *
 * Shows:
 *   - Specialist model badge + sub-task assignment
 *   - Status (pending/running/complete/failed)
 *   - Result preview on completion
 *   - Token + latency metrics
 *   - Error message on failure
 *
 * Follows Phase 23A patterns: GlassCard, SPRING physics, mobile-first 375px.
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2Icon,
  ClockIcon,
  Loader2Icon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import { GlassCard } from "@/components/library/glass-card";
import { cn } from "@/lib/utils";

export type SpecialistStatus = "pending" | "running" | "complete" | "failed";

interface SpecialistCardProps {
  modelId: string;
  name: string;
  provider: string;
  status: SpecialistStatus;
  subTask: string;
  subTaskDescription?: string;
  responsePreview?: string;
  latency?: number;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
  className?: string;
}

const PROVIDER_INITIALS: Record<string, string> = {
  deepseek: "DS",
  moonshotai: "KI",
  zai: "GL",
  alibaba: "QW",
  anthropic: "CL",
  google: "GM",
  minimax: "MM",
  stepfun: "SF",
};

const STATUS_ICONS: Record<SpecialistStatus, React.ReactNode> = {
  pending: <ClockIcon className="size-3 text-muted-foreground/40" />,
  running: <Loader2Icon className="size-3 text-cyan-500 animate-spin" />,
  complete: <CheckCircle2Icon className="size-3 text-emerald-500" />,
  failed: <XCircleIcon className="size-3 text-red-500" />,
};

export function SpecialistCard({
  modelId: _modelId,
  name,
  provider,
  status,
  subTask,
  subTaskDescription,
  responsePreview,
  latency,
  tokensIn,
  tokensOut,
  error,
  className,
}: SpecialistCardProps) {
  const initials =
    PROVIDER_INITIALS[provider] ?? provider.slice(0, 2).toUpperCase();

  return (
    <GlassCard
      className={cn(
        "flex flex-col p-3 transition-all min-h-[80px]",
        status === "running" && "ring-1 ring-cyan-500/30",
        status === "complete" && "ring-1 ring-emerald-500/20",
        status === "failed" && "ring-1 ring-red-500/20 opacity-70",
        className
      )}
      elevation="1"
      interactive={false}
    >
      {/* Top row: model badge + name + status */}
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
            "bg-muted/50 border border-border/30 text-muted-foreground",
            status === "running" &&
              "bg-cyan-500/10 border-cyan-500/30 text-cyan-600",
            status === "complete" &&
              "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
          )}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <WrenchIcon className="size-3 text-muted-foreground/40 shrink-0" />
            <span className="text-[11px] font-medium truncate">{name}</span>
            {STATUS_ICONS[status]}
          </div>
          <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">
            {subTaskDescription || subTask}
          </p>
        </div>

        {/* Metrics */}
        {(latency != null || tokensOut != null) && (
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            {latency != null && (
              <span className="text-[9px] text-muted-foreground/40 tabular-nums">
                {latency < 1000
                  ? `${latency}ms`
                  : `${(latency / 1000).toFixed(1)}s`}
              </span>
            )}
            {tokensOut != null && (
              <span className="text-[9px] text-muted-foreground/40 tabular-nums">
                {tokensIn ?? "?"}+{tokensOut}t
              </span>
            )}
          </div>
        )}
      </div>

      {/* Result preview */}
      <AnimatePresence>
        {status === "complete" && responsePreview && (
          <motion.p
            animate={{ opacity: 1, height: "auto" }}
            className="mt-2 text-[11px] text-muted-foreground/70 line-clamp-3 leading-relaxed border-t border-border/20 pt-2"
            initial={{ opacity: 0, height: 0 }}
          >
            {responsePreview.slice(0, 300)}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Error */}
      {status === "failed" && error && (
        <div className="mt-2 text-[10px] text-red-400 bg-red-400/5 rounded px-2 py-1 border border-red-400/10">
          {error.slice(0, 200)}
        </div>
      )}
    </GlassCard>
  );
}
