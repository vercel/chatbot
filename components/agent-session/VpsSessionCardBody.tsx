"use client";

/**
 * VpsSessionCardBody — VPS-specific UI for AgentSessionCard (lane=vps).
 *
 * Shows:
 *   - DeepSeek V4 Pro model badge
 *   - Step-by-step Todo list (from hermes-vps progress)
 *   - Live tool call stream
 *   - Slack thread link (#jarvis-admin)
 *   - "Open Slack thread" action
 *
 * Extracted + extended from existing VpsProgressCard pattern.
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { Bot, Terminal, ExternalLink, Circle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { SessionProgressBar } from "./SessionProgressBar";
import { cn } from "@/lib/utils";

export interface VpsStep {
  id: string;
  name: string;
  status: "pending" | "running" | "complete" | "failed";
  evidence?: string[];
}

export interface ToolCallEntry {
  id?: string;
  toolName: string;
  timestamp?: string;
  status: "running" | "complete" | "error";
  preview?: string;
}

export interface VpsSessionCardBodyProps {
  sessionId: string;
  goal: string;
  status: string;
  progress: number;
  dispatchId?: string;
  steps?: VpsStep[];
  toolCalls?: ToolCallEntry[];
  currentStep?: string;
  slackThreadTs?: string;
  turnsUsed?: number;
  maxTurns?: number;
  elapsed?: string;
  result?: string;
  model?: string;
  className?: string;
}

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Circle,
  running: Loader2,
  complete: CheckCircle2,
  failed: XCircle,
};

const STEP_COLORS: Record<string, string> = {
  pending: "text-white/20",
  running: "text-amber-400",
  complete: "text-emerald-400",
  failed: "text-red-400",
};

export function VpsSessionCardBody({
  sessionId,
  goal,
  status,
  progress,
  dispatchId,
  steps = [],
  toolCalls = [],
  currentStep,
  slackThreadTs,
  turnsUsed = 0,
  maxTurns = 60,
  elapsed,
  result,
  model = "DeepSeek V4 Pro",
  className,
}: VpsSessionCardBodyProps) {
  const isActive = !["complete", "failed"].includes(status);
  const progressPct = maxTurns > 0 ? Math.round((turnsUsed / maxTurns) * 100) : progress;

  const statusLabel = {
    routing: "Routing to VPS...",
    spawning: "Dispatching to VPS...",
    running: "VPS executing...",
    complete: "VPS complete",
    failed: "VPS failed",
  }[status] || "VPS working...";

  const slackUrl = slackThreadTs
    ? `https://newleaf-financial.slack.com/archives/C0AQDDC3HAB/p${slackThreadTs.replace(".", "")}`
    : null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Model & dispatch metadata */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium
                       bg-amber-500/10 border border-amber-500/20 text-amber-400">
          <Bot className="size-2.5" />
          {model}
        </span>
        {dispatchId && (
          <span className="text-[9px] text-white/20 font-mono">
            #{dispatchId.slice(-8)}
          </span>
        )}
      </div>

      {/* Goal preview */}
      <p className="text-xs text-white/60 truncate">{goal.length > 100 ? goal.slice(0, 100) + "..." : goal}</p>

      {/* Progress bar (active states) */}
      {isActive && (
        <SessionProgressBar
          progress={progressPct}
          status={status as "spawning" | "running"}
          stepLabel={statusLabel}
          elapsed={elapsed}
        />
      )}

      {/* Turns counter */}
      {turnsUsed > 0 && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Turns: {turnsUsed}/{maxTurns}</span>
        </div>
      )}

      {/* Step-by-step progress */}
      {steps.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Steps</span>
          <div className="space-y-0.5">
            {steps.map((step) => {
              const StepIcon = STEP_ICONS[step.status] || Circle;
              const color = STEP_COLORS[step.status];
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-1.5 text-xs py-0.5 px-1 rounded",
                    step.status === "running" && "bg-amber-500/5"
                  )}
                >
                  <StepIcon
                    className={cn(
                      "size-3 shrink-0",
                      color,
                      step.status === "running" && "animate-spin"
                    )}
                  />
                  <span className={cn("text-xs truncate", color, step.status === "pending" && "opacity-50")}>
                    {step.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current step */}
      {currentStep && status === "running" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Terminal className="size-3" />
          <span className="font-mono truncate">{currentStep}</span>
        </div>
      )}

      {/* Live tool call stream */}
      {toolCalls.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Bot className="size-3 text-muted-foreground" />
            <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">
              Tool Calls ({toolCalls.length})
            </span>
          </div>
          <pre className="text-[10px] bg-black/20 rounded-lg p-2 max-h-[150px] overflow-y-auto text-white/50 font-mono leading-relaxed">
            {toolCalls.map((tc, i) => (
              <div key={tc.id || i} className="flex items-start gap-1.5">
                <span className={cn(
                  "shrink-0 mt-px",
                  tc.status === "running" ? "text-amber-400" :
                  tc.status === "error" ? "text-red-400" :
                  "text-emerald-400"
                )}>
                  {tc.status === "running" ? "⟳" : tc.status === "error" ? "✕" : "✓"}
                </span>
                <span className="text-cyan-400/70">{tc.toolName}</span>
                {tc.preview && (
                  <span className="text-white/30 truncate">{tc.preview}</span>
                )}
              </div>
            ))}
          </pre>
        </div>
      )}

      {/* Result (completed) */}
      {status === "complete" && result && (
        <p className="text-xs text-foreground/80 leading-relaxed">{result}</p>
      )}

      {/* Slack thread link */}
      {slackUrl && (
        <a
          href={slackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
        >
          <ExternalLink className="size-3" />
          View in #jarvis-admin
        </a>
      )}

      {/* Session ID (debug) */}
      <div className="text-[9px] text-white/10 font-mono">
        {sessionId.slice(0, 16)}...
      </div>
    </div>
  );
}
