/**
 * DiscoveryRunCard — Status card for an active or completed discovery run.
 *
 * Shows: workflow name, status badge, step progress, duration, and action buttons.
 * Animated pulse border for running state.
 */

"use client";

import { cn } from "@/lib/utils";
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  SkipForward,
  Loader2,
} from "lucide-react";

interface RunStep {
  stepId: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  name?: string;
  error?: string;
}

interface DiscoveryRunCardProps {
  runId: string;
  workflowName: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  steps: RunStep[];
  progress?: { current: number; total: number; message?: string; percent?: number };
  onClick?: () => void;
  className?: string;
}

const STATUS_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; className: string }> = {
  pending: { icon: Clock, label: "Pending", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  running: { icon: Loader2, label: "Running", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  completed: { icon: CheckCircle2, label: "Completed", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  failed: { icon: XCircle, label: "Failed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

const STEP_STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  completed: CheckCircle2,
  running: Loader2,
  failed: XCircle,
  skipped: SkipForward,
  pending: Clock,
};

const STEP_STATUS_COLORS: Record<string, string> = {
  completed: "text-emerald-500",
  running: "text-blue-500 animate-spin",
  failed: "text-red-500",
  skipped: "text-amber-500",
  pending: "text-muted-foreground/40",
};

export default function DiscoveryRunCard({
  runId,
  workflowName,
  status,
  startedAt,
  completedAt,
  steps,
  progress,
  onClick,
  className,
}: DiscoveryRunCardProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const StatusIcon = config.icon;
  const isRunning = status === "running";
  const isCompleted = status === "completed" || status === "failed";

  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const failedSteps = steps.filter((s) => s.status === "failed").length;
  const totalSteps = steps.length;

  const duration = completedAt
    ? formatDuration(new Date(startedAt).getTime(), new Date(completedAt).getTime())
    : isRunning
      ? "Running..."
      : "—";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-all duration-200",
        "hover:shadow-md hover:border-primary/30",
        "focus:outline-none focus:ring-2 focus:ring-primary/20",
        isRunning && "ring-1 ring-blue-400/50 animate-pulse",
        "bg-card dark:bg-card",
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{workflowName}</h3>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{runId}</p>
        </div>
        <span
          className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1",
            config.className
          )}
        >
          <StatusIcon className={cn("h-3 w-3", status === "running" && "animate-spin")} />
          {config.label}
        </span>
      </div>

      {/* Progress bar */}
      {!isCompleted && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{progress?.message || `Step ${completedSteps + 1} of ${totalSteps}`}</span>
            <span>{progress?.percent != null ? `${progress.percent}%` : `${Math.round((completedSteps / totalSteps) * 100)}%`}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                isRunning ? "bg-blue-500" : "bg-emerald-500"
              )}
              style={{
                width: `${progress?.percent ?? Math.round((completedSteps / totalSteps) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Step indicators */}
      <div className="flex items-center gap-1.5 mt-2">
        {steps.map((step, i) => {
          const Icon = STEP_STATUS_ICONS[step.status] || Clock;
          return (
            <div
              key={step.stepId}
              className="flex items-center"
              title={`${step.name || step.stepId}: ${step.status}${step.error ? ` — ${step.error}` : ""}`}
            >
              <Icon className={cn("h-3.5 w-3.5", STEP_STATUS_COLORS[step.status] || "text-muted-foreground")} />
              {i < steps.length - 1 && (
                <div className={cn(
                  "w-3 h-px",
                  step.status === "completed" ? "bg-emerald-400" : "bg-muted-foreground/20"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{new Date(startedAt).toLocaleTimeString()}</span>
          <span>{duration}</span>
          {failedSteps > 0 && (
            <span className="text-red-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {failedSteps} failed
            </span>
          )}
        </div>
        {isCompleted && (
          <span className="text-xs text-primary font-medium">View report →</span>
        )}
      </div>
    </button>
  );
}

function formatDuration(startMs: number, endMs: number): string {
  const diffMs = endMs - startMs;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
