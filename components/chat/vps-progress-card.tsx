"use client";

/**
 * VpsProgressCard — inline message card showing VPS dispatch progress.
 *
 * Renders inside chat messages when a VPS dispatch is confirmed.
 * Polls /api/hermes-vps/poll every 10s for status updates.
 * Shows:
 *   - Status badge (queued/running/completed/failed/cancelled)
 *   - Progress bar (turnsUsed / maxTurns)
 *   - Current step
 *   - Cancel button
 *   - On complete: result summary + Slack thread link
 *
 * Pattern: similar to RoutineProgressCard + HandoffTile
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Bot,
  Terminal,
  X,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { POLL_INTERVAL_MS } from "@/playbook-skills/connectors/hermes-vps/actions";
import type { PollResult } from "@/playbook-skills/connectors/hermes-vps/actions";

// ── Types ───────────────────────────────────────────────────────────────

export interface VpsProgressCardProps {
  dispatchId: string;
  prompt: string;
  className?: string;
  /** Optional: remove from chat view */
  onDismiss?: () => void;
}

type CardStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "lost";

// ── Status config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CardStatus, {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  label: string;
  bgClass: string;
}> = {
  queued:    { icon: Clock,        iconClass: "text-blue-400",  label: "Queued on VPS...",       bgClass: "bg-blue-500/5 border-blue-500/20" },
  running:   { icon: RotateCw,     iconClass: "text-amber-400 animate-spin", label: "VPS working...", bgClass: "bg-amber-500/5 border-amber-500/20" },
  completed: { icon: CheckCircle2, iconClass: "text-emerald-400",  label: "VPS complete",       bgClass: "bg-emerald-500/5 border-emerald-500/20" },
  failed:    { icon: XCircle,      iconClass: "text-red-400",    label: "VPS failed",          bgClass: "bg-red-500/5 border-red-500/20" },
  cancelled: { icon: X,            iconClass: "text-gray-400",   label: "Cancelled",           bgClass: "bg-gray-500/5 border-gray-500/20" },
  lost:      { icon: AlertTriangle, iconClass: "text-orange-400", label: "Session lost",       bgClass: "bg-orange-500/5 border-orange-500/20" },
};

// ── Component ────────────────────────────────────────────────────────────

export function VpsProgressCard({
  dispatchId,
  prompt,
  className,
  onDismiss,
}: VpsProgressCardProps) {
  const [status, setStatus] = useState<CardStatus>("queued");
  const [progress, setProgress] = useState<PollResult["progress"] | null>(null);
  const [result, setResult] = useState<PollResult["result"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTerminal = status === "completed" || status === "failed" || status === "cancelled" || status === "lost";

  // ── Poll loop ──────────────────────────────────────────────────────────

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/hermes-vps/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispatchId }),
      });

      const data: PollResult = await res.json();

      if (!data.success) {
        setStatus("lost");
        setError(data.error || "Poll failed");
        return;
      }

      setStatus(data.status as CardStatus);
      setProgress(data.progress || null);
      setResult(data.result || null);
      setElapsedMs(data.elapsedMs || 0);

      if (data.error) setError(data.error);

      // Stop polling on terminal states
      if (["completed", "failed", "cancelled", "lost"].includes(data.status)) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch (err) {
      // Network error — don't stop polling, just log
      console.error("[VpsProgressCard] Poll error:", err);
    }
  }, [dispatchId]);

  useEffect(() => {
    // Immediate first poll
    poll();

    // Then every 10s
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [poll]);

  // ── Cancel handler ─────────────────────────────────────────────────────

  const handleCancel = async () => {
    if (isCancelling || isTerminal) return;
    setIsCancelling(true);
    try {
      const res = await fetch("/api/hermes-vps/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispatchId }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("cancelled");
      } else {
        // If cancel fails, poll again to see current state
        poll();
      }
    } catch (err) {
      console.error("[VpsProgressCard] Cancel error:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  // ── Formatting helpers ─────────────────────────────────────────────────

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const turnsUsed = progress?.turnsUsed ?? 0;
  const maxTurns = progress?.maxTurns ?? 60;
  const progressPct = maxTurns > 0 ? Math.round((turnsUsed / maxTurns) * 100) : 0;

  const elapsedSecs = Math.round((elapsedMs || 0) / 1000);
  const elapsedStr = elapsedSecs > 60
    ? `${Math.floor(elapsedSecs / 60)}m ${elapsedSecs % 60}s`
    : `${elapsedSecs}s`;

  const promptPreview = prompt.length > 80 ? prompt.slice(0, 80) + "..." : prompt;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 my-2 text-sm",
        config.bgClass,
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn(
          "size-6 rounded-lg flex items-center justify-center shrink-0",
          status === "completed" ? "bg-emerald-500/10" :
          status === "running" ? "bg-amber-500/10" :
          status === "failed" ? "bg-red-500/10" :
          "bg-blue-500/10"
        )}>
          <Icon className={cn("size-3.5", config.iconClass)} />
        </div>
        <span className="font-medium text-foreground text-sm">
          {config.label}
        </span>
        {!isTerminal && (
          <Loader2 className="size-3 animate-spin text-blue-400 shrink-0 ml-auto" />
        )}
        {isTerminal && onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-auto p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* Prompt preview */}
      <p className="text-xs text-muted-foreground mb-2 truncate">
        {promptPreview}
      </p>

      {/* Progress bar (running/queued only) */}
      {!isTerminal && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Turns: {turnsUsed}/{maxTurns}</span>
            <span>{elapsedStr}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                status === "running" ? "bg-amber-500" : "bg-blue-500"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progressPct, 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      {/* Current step */}
      {progress?.currentStep && status === "running" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <Terminal className="size-3" />
          <span className="font-mono truncate">{progress.currentStep}</span>
        </div>
      )}

      {/* Tool calls counter */}
      {progress?.toolCalls !== undefined && progress.toolCalls > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <Bot className="size-3" />
          <span>{progress.toolCalls} tool calls</span>
        </div>
      )}

      {/* Result (completed) */}
      {status === "completed" && result && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-foreground/80 leading-relaxed">
            {result.summary}
          </p>
          {result.output && (
            <pre className="text-[10px] bg-black/20 rounded-lg p-2 max-h-[120px] overflow-y-auto text-white/50 font-mono">
              {result.output.length > 500 ? result.output.slice(0, 500) + "..." : result.output}
            </pre>
          )}
          {result.slackThreadTs && (
            <a
              href={`https://newleaf-financial.slack.com/archives/C0AQDDC3HAB/p${result.slackThreadTs.replace(".", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              <ExternalLink className="size-3" />
              View in #jarvis-admin
            </a>
          )}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Zap className="size-3" />
            <span>{turnsUsed} turns · {elapsedStr}</span>
          </div>
        </div>
      )}

      {/* Error (failed/lost) */}
      {(status === "failed" || status === "lost") && error && (
        <div className="mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-1 text-xs text-destructive mb-1">
            <AlertTriangle className="size-3" />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-xs text-destructive/80">{error}</p>
        </div>
      )}

      {/* Action buttons */}
      {!isTerminal && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
              "border border-red-500/20 text-red-400 hover:bg-red-500/10",
              isCancelling && "opacity-50 cursor-not-allowed"
            )}
          >
            {isCancelling ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <XCircle className="size-3" />
            )}
            Cancel
          </button>
          <button
            onClick={poll}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted-foreground
                       border border-white/5 hover:bg-white/[0.04] transition-all"
          >
            <RotateCw className="size-3" />
            Refresh now
          </button>
        </div>
      )}

      {/* Retry on failure */}
      {status === "failed" && (
        <button
          onClick={() => {
            setStatus("queued");
            setError(null);
            poll();
            pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
          }}
          className="flex items-center gap-1 mt-3 px-2.5 py-1 rounded-lg text-xs font-medium
                     border border-amber-500/20 text-amber-400 hover:bg-amber-500/10 transition-all"
        >
          <RotateCw className="size-3" />
          Retry
        </button>
      )}
    </div>
  );
}
