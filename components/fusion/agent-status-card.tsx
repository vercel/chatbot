"use client";

/**
 * Phase 23A: Agent Status Card — per-agent progress during deliberation
 *
 * Shows: provider icon, agent name, status (waiting/running/complete/failed),
 * latency, token count, and response preview.
 * Uses GlassCard + SPRING physics.
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2Icon,
  ClockIcon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";
import { GlassCard } from "@/components/library/glass-card";
import { cn } from "@/lib/utils";

export type AgentStatus = "waiting" | "running" | "complete" | "failed";

interface AgentStatusCardProps {
  modelId: string;
  name: string;
  provider: string;
  status: AgentStatus;
  latency?: number;
  tokensIn?: number;
  tokensOut?: number;
  responsePreview?: string;
  className?: string;
}

const PROVIDER_INITIALS: Record<string, string> = {
  deepseek: "DS",
  moonshotai: "KI",
  zai: "GL",
  alibaba: "QW",
  anthropic: "CL",
  google: "GM",
};

const STATUS_ICONS: Record<AgentStatus, React.ReactNode> = {
  waiting: <ClockIcon className="size-3.5 text-muted-foreground/40" />,
  running: <Loader2Icon className="size-3.5 text-cyan-500 animate-spin" />,
  complete: <CheckCircle2Icon className="size-3.5 text-emerald-500" />,
  failed: <XCircleIcon className="size-3.5 text-red-500" />,
};

export function AgentStatusCard({
  modelId,
  name,
  provider,
  status,
  latency,
  tokensIn,
  tokensOut,
  responsePreview,
  className,
}: AgentStatusCardProps) {
  const initials =
    PROVIDER_INITIALS[provider] ?? provider.slice(0, 2).toUpperCase();

  return (
    <GlassCard
      className={cn(
        "flex items-start gap-3 p-3 transition-all",
        status === "running" && "ring-1 ring-cyan-500/30",
        status === "complete" && "ring-1 ring-emerald-500/20",
        status === "failed" && "ring-1 ring-red-500/20 opacity-70",
        className
      )}
      elevation="1"
      interactive={false}
    >
      {/* Provider badge */}
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

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium truncate">{name}</span>
          {STATUS_ICONS[status]}
        </div>

        {/* Stats row */}
        {(latency != null || tokensOut != null) && (
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/60">
            {latency != null && (
              <span>
                {latency < 1000
                  ? `${latency}ms`
                  : `${(latency / 1000).toFixed(1)}s`}
              </span>
            )}
            {tokensOut != null && <span>{tokensOut} tokens</span>}
          </div>
        )}

        {/* Response preview on complete */}
        <AnimatePresence>
          {status === "complete" && responsePreview && (
            <motion.p
              animate={{ opacity: 1, height: "auto" }}
              className="mt-1.5 text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed"
              initial={{ opacity: 0, height: 0 }}
            >
              {responsePreview.slice(0, 200)}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Cost */}
      {status === "complete" && tokensIn != null && (
        <span className="text-[10px] text-muted-foreground/40 tabular-nums whitespace-nowrap">
          {tokensIn}+{tokensOut ?? "?"}t
        </span>
      )}
    </GlassCard>
  );
}
