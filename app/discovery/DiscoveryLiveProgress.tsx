/**
 * DiscoveryLiveProgress — Animated live progress panel shown during a running discovery.
 *
 * Displays: current step name, progress bar, step-by-step log with timestamps,
 * and a mini activity feed of SSE events.
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  SkipForward,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { DiscoveryEvent } from "./useDiscoverySSE";
import { useState } from "react";

interface DiscoveryLiveProgressProps {
  events: DiscoveryEvent[];
  isComplete: boolean;
  error: string | null;
  className?: string;
}

const EVENT_COLORS: Record<string, string> = {
  step_start: "text-blue-500",
  step_progress: "text-blue-400",
  step_complete: "text-emerald-500",
  step_error: "text-red-500",
  step_skip: "text-amber-500",
  run_complete: "text-emerald-600",
  run_error: "text-red-600",
};

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  step_start: Loader2,
  step_progress: Loader2,
  step_complete: CheckCircle2,
  step_error: XCircle,
  step_skip: SkipForward,
  run_complete: CheckCircle2,
  run_error: XCircle,
};

export default function DiscoveryLiveProgress({
  events,
  isComplete,
  error,
  className,
}: DiscoveryLiveProgressProps) {
  const [expanded, setExpanded] = useState(true);

  // Group events by step
  const stepGroups = useMemo(() => {
    const groups: Record<string, DiscoveryEvent[]> = {};
    for (const event of events) {
      if (event.type === "connected" || event.type === "stream_end" || event.type === "stream_timeout") continue;
      const key = event.stepId || "global";
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    }
    return groups;
  }, [events]);

  // Current overall progress
  const stepCompletes = events.filter((e) => e.type === "step_complete").length;
  const stepErrors = events.filter((e) => e.type === "step_error").length;
  const totalSteps = events.find((e) => e.type === "step_start")?.data?.totalSteps as number || 6;

  const progressPercent = Math.min(100, Math.round((stepCompletes / totalSteps) * 100));

  const lastEvent = events[events.length - 1];
  const latestMessage = lastEvent?.data?.message as string || (isComplete ? "Run complete" : "Waiting...");

  return (
    <div className={cn("space-y-3", className)}>
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isComplete && !error && (
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          )}
          {isComplete && !error && (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
          {error && (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm font-medium">
            {error ? "Run Failed" : isComplete ? "Run Complete" : "Running Discovery..."}
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {events.length} events
        </button>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span className="truncate">{latestMessage}</span>
          <span>{stepCompletes}/{totalSteps} steps</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out",
              error ? "bg-red-500" : isComplete ? "bg-emerald-500" : "bg-blue-500"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step groups — collapsible log */}
      {expanded && (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {Object.entries(stepGroups).map(([stepId, stepEvents]) => {
            const firstEvent = stepEvents[0];
            const lastEvt = stepEvents[stepEvents.length - 1];
            const isError = stepEvents.some((e) => e.type === "step_error");
            const isDone = lastEvt?.type === "step_complete";
            const stepName = firstEvent?.data?.name as string || stepId;

            return (
              <StepLogEntry
                key={stepId}
                stepName={stepName}
                events={stepEvents}
                isDone={isDone}
                isError={isError}
              />
            );
          })}

          {Object.keys(stepGroups).length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground">
              <Clock className="h-4 w-4 mx-auto mb-1 opacity-40" />
              Waiting for events...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepLogEntry({
  stepName,
  events,
  isDone,
  isError,
}: {
  stepName: string;
  events: DiscoveryEvent[];
  isDone: boolean;
  isError: boolean;
}) {
  const [open, setOpen] = useState(false);
  const progressEvents = events.filter((e) => e.type === "step_progress");

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors",
          isError ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/30"
        )}
      >
        {isDone ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
        ) : isError ? (
          <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin flex-shrink-0" />
        )}
        <span className="font-medium flex-1 text-left">{stepName}</span>
        {progressEvents.length > 0 && (
          <span className="text-muted-foreground">
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 py-1.5 space-y-0.5 bg-card text-[11px] font-mono">
          {events.map((e, i) => (
            <div key={i} className={cn("flex gap-2", EVENT_COLORS[e.type] || "text-muted-foreground")}>
              <span className="flex-shrink-0 opacity-60">{new Date(e.timestamp).toLocaleTimeString()}</span>
              <span>{e.type}</span>
              {e.data?.message && (
                <span className="text-muted-foreground truncate">— {e.data.message as string}</span>
              )}
            </div>
          ))}
          {events.length === 0 && (
            <span className="text-muted-foreground">No events recorded</span>
          )}
        </div>
      )}
    </div>
  );
}

// Re-export since used locally
import { ChevronUp } from "lucide-react";
