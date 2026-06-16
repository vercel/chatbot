"use client";

/**
 * Phase 23B: Coordinator Card — swarm decomposition result
 *
 * Shows:
 *   - Coordinator model badge + status (decomposing/complete/failed)
 *   - Decomposition strategy
 *   - Sub-task list with assignments
 *   - Cost + latency metrics
 *
 * Follows Phase 23A patterns: GlassCard, SPRING physics, mobile-first 375px.
 */

import { motion } from "framer-motion";
import {
  BrainCircuitIcon,
  CheckCircle2Icon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";
import { GlassCard } from "@/components/library/glass-card";
import { FADE_UP } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";

export type CoordinatorStatus = "waiting" | "decomposing" | "complete" | "failed";

export interface SubTaskDef {
  id: string;
  description: string;
  assignedTo: string;
  priority: number;
  reasoning: string;
}

interface CoordinatorCardProps {
  modelId: string;
  name: string;
  provider: string;
  status: CoordinatorStatus;
  strategy?: string;
  subTasks?: SubTaskDef[];
  latency?: number;
  cost?: number;
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

export function CoordinatorCard({
  modelId: _modelId,
  name,
  provider,
  status,
  strategy,
  subTasks,
  latency,
  cost,
  className,
}: CoordinatorCardProps) {
  const initials =
    PROVIDER_INITIALS[provider] ?? provider.slice(0, 2).toUpperCase();

  return (
    <motion.div {...FADE_UP} className={className}>
      <GlassCard
        className={cn(
          "p-4 transition-all",
          status === "decomposing" && "ring-1 ring-purple-500/30",
          status === "complete" && "ring-1 ring-emerald-500/20",
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
              "bg-purple-500/10 border border-purple-500/30 text-purple-500",
              status === "decomposing" && "animate-pulse"
            )}
          >
            <BrainCircuitIcon className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold">Coordinator</span>
              <span className="text-[11px] text-muted-foreground">{name}</span>
              <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                {initials}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {status === "waiting" && (
                <span className="text-[10px] text-muted-foreground/50">
                  Waiting for task...
                </span>
              )}
              {status === "decomposing" && (
                <Loader2Icon className="size-3 text-purple-500 animate-spin" />
              )}
              {status === "complete" && (
                <CheckCircle2Icon className="size-3 text-emerald-500" />
              )}
              {status === "failed" && (
                <XCircleIcon className="size-3 text-red-500" />
              )}
              {latency != null && (
                <span className="text-[10px] text-muted-foreground/50">
                  {latency < 1000
                    ? `${latency}ms`
                    : `${(latency / 1000).toFixed(1)}s`}
                </span>
              )}
              {cost != null && (
                <span className="text-[10px] text-muted-foreground/40">
                  ${cost.toFixed(4)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Strategy */}
        {strategy && (
          <motion.div
            animate={{ opacity: 1, height: "auto" }}
            className="mb-3 px-3 py-2 rounded-lg bg-purple-500/5 border border-purple-500/10"
            initial={{ opacity: 0, height: 0 }}
          >
            <p className="text-[10px] uppercase tracking-wider text-purple-500/60 mb-1">
              Strategy
            </p>
            <p className="text-[12px] text-muted-foreground/80">{strategy}</p>
          </motion.div>
        )}

        {/* Sub-tasks */}
        {subTasks && subTasks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 px-1">
              {subTasks.length} sub-tasks
            </p>
            {subTasks.map((st, i) => (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30 text-[11px]"
                initial={{ opacity: 0, x: -8 }}
                key={st.id}
                transition={{ delay: i * 0.05 }}
              >
                <span className="text-[10px] font-mono text-muted-foreground/40 w-4">
                  P{st.priority}
                </span>
                <span className="flex-1 truncate">{st.description}</span>
                <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground/60 shrink-0">
                  {st.assignedTo.split("/").pop()}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
