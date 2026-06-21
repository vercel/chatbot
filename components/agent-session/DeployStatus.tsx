"use client";

/**
 * DeployStatus — Vercel deploy state indicator with URL.
 *
 * Shows:
 *   - Deploy state badge (building/preview/ready/error)
 *   - Preview URL when ready (clickable)
 *   - Build elapsed time
 *   - Retry on failure
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { Rocket, ExternalLink, Clock, AlertTriangle, Loader2, CheckCircle2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

export type DeployState = "pending" | "building" | "preview" | "ready" | "error";

export interface DeployStatusProps {
  state: DeployState;
  deployUrl?: string;
  elapsedMs?: number;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

const STATE_CONFIG: Record<DeployState, {
  icon: typeof Rocket;
  label: string;
  iconClass: string;
  bgClass: string;
}> = {
  pending: {
    icon: Clock,
    label: "Deploy pending...",
    iconClass: "text-blue-400",
    bgClass: "bg-blue-500/5 border-blue-500/20",
  },
  building: {
    icon: Loader2,
    label: "Building...",
    iconClass: "text-purple-400 animate-spin",
    bgClass: "bg-purple-500/5 border-purple-500/20",
  },
  preview: {
    icon: CheckCircle2,
    label: "Preview ready",
    iconClass: "text-cyan-400",
    bgClass: "bg-cyan-500/5 border-cyan-500/20",
  },
  ready: {
    icon: CheckCircle2,
    label: "Deployed",
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-500/5 border-emerald-500/20",
  },
  error: {
    icon: AlertTriangle,
    label: "Deploy failed",
    iconClass: "text-red-400",
    bgClass: "bg-red-500/5 border-red-500/20",
  },
};

export function DeployStatus({
  state,
  deployUrl,
  elapsedMs,
  error,
  onRetry,
  className,
}: DeployStatusProps) {
  const config = STATE_CONFIG[state];
  const Icon = config.icon;

  const elapsedStr =
    elapsedMs !== undefined
      ? elapsedMs > 60_000
        ? `${Math.floor(elapsedMs / 60_000)}m ${Math.round((elapsedMs % 60_000) / 1000)}s`
        : `${Math.round(elapsedMs / 1000)}s`
      : undefined;

  return (
    <div className={cn("rounded-lg border p-3", config.bgClass, className)}>
      {/* Status header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          "size-6 rounded-lg flex items-center justify-center shrink-0",
          state === "ready" ? "bg-emerald-500/10" :
          state === "error" ? "bg-red-500/10" :
          "bg-blue-500/10"
        )}>
          <Icon className={cn("size-3.5", config.iconClass)} />
        </div>
        <span className="text-sm font-medium text-foreground">{config.label}</span>
        {elapsedStr && (
          <span className="text-[10px] text-muted-foreground ml-auto">{elapsedStr}</span>
        )}
      </div>

      {/* Deploy URL (ready/preview state) */}
      {(state === "ready" || state === "preview") && deployUrl && (
        <a
          href={deployUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-emerald-500/10 border border-emerald-500/20 text-emerald-400
                     hover:bg-emerald-500/20 transition-colors"
        >
          <Rocket className="size-3" />
          Open Deploy
          <ExternalLink className="size-3" />
        </a>
      )}

      {/* Error state */}
      {state === "error" && error && (
        <div className="space-y-2">
          <p className="text-xs text-red-400/80">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs
                         border border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
            >
              <RotateCw className="size-3" />
              Retry Deploy
            </button>
          )}
        </div>
      )}
    </div>
  );
}
