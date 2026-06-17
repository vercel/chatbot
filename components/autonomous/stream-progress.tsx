"use client";

/**
 * Autonomous Mission — Stream Progress Component
 *
 * Displays per-stream execution progress with:
 *  - Step timeline (vertical, with status icons)
 *  - Budget used/remaining meter
 *  - Live code preview (diff view for file operations)
 *  - Output console (scrollable terminal)
 *  - Stream status badge
 *
 * Phase 38: Autonomous Coding Platform
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  XCircle,
  FileCode,
  Terminal,
  ChevronRight,
  Clock,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRING_GENTLE } from "@/lib/motion/springs";

// ─── Types ────────────────────────────────────────────────────────────────

export type StepStatus = "pending" | "running" | "complete" | "failed" | "skipped";

export interface StreamStep {
  id: string;
  type: "create_file" | "edit_file" | "run_test" | "run_build" | "commit" | "deploy" | "verify" | "slack" | "linear";
  description: string;
  status: StepStatus;
  filePath?: string;
  content?: string;
  output?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface StreamProgressProps {
  streamId: string;
  name: string;
  budget: number;
  budgetUsed?: number;
  status: "pending" | "running" | "complete" | "failed";
  steps: StreamStep[];
  className?: string;
  onRetry?: (streamId: string) => void;
  onSkip?: (streamId: string) => void;
}

// ─── Step Icon ─────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "complete":
      return <CheckCircle2 className="size-3.5 text-emerald-400" />;
    case "running":
      return <Loader2 className="size-3.5 text-cyan-400 animate-spin" />;
    case "failed":
      return <XCircle className="size-3.5 text-red-400" />;
    case "skipped":
      return <ChevronRight className="size-3.5 text-white/20" />;
    default:
      return <Circle className="size-3.5 text-white/[0.15]" />;
  }
}

function StepTypeIcon({ type }: { type: StreamStep["type"] }) {
  const iconMap: Record<string, string> = {
    create_file: "📄",
    edit_file: "✏️",
    run_test: "🧪",
    run_build: "🔨",
    commit: "📝",
    deploy: "🚀",
    verify: "✅",
    slack: "💬",
    linear: "🎫",
  };

  return <span className="text-[10px]">{iconMap[type] ?? "•"}</span>;
}

// ─── Step Duration ─────────────────────────────────────────────────────────

function StepDuration({ startedAt, completedAt, durationMs }: {
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}) {
  if (durationMs) {
    const seconds = (durationMs / 1000).toFixed(1);
    return <span className="text-[9px] text-white/20">{seconds}s</span>;
  }

  if (startedAt && !completedAt) {
    // Running — show elapsed
    const start = new Date(startedAt).getTime();
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
      const interval = setInterval(() => {
        setElapsed(Date.now() - start);
      }, 1000);
      return () => clearInterval(interval);
    }, [start]);

    return (
      <span className="flex items-center gap-1 text-[9px] text-cyan-400/50">
        <Clock className="size-2.5" />
        {(elapsed / 1000).toFixed(1)}s
      </span>
    );
  }

  return null;
}

// ─── Step Row ──────────────────────────────────────────────────────────────

function StepRow({
  step,
  index,
  isLast,
}: {
  step: StreamStep;
  index: number;
  isLast: boolean;
}) {
  const [showOutput, setShowOutput] = useState(false);
  const isActive = step.status === "running";
  const isFailed = step.status === "failed";

  return (
    <div className="relative flex gap-3">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className="mt-1">
          <StepIcon status={step.status} />
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-px flex-1 mt-1",
              step.status === "complete" ? "bg-emerald-500/20" :
              step.status === "running" ? "bg-cyan-500/20" :
              "bg-white/[0.04]"
            )}
          />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex-1 pb-3 group",
          isFailed && "opacity-100",
          step.status === "complete" && "opacity-60",
        )}
      >
        <div className={cn(
          "p-2.5 rounded-lg transition-colors",
          isActive && "bg-cyan-500/[0.04] border border-cyan-500/10",
          isFailed && "bg-red-500/[0.04] border border-red-500/10",
          step.status === "complete" && "bg-white/[0.01]",
        )}>
          <div className="flex items-start gap-2">
            <StepTypeIcon type={step.type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[11px] leading-snug",
                    isActive ? "text-white/90 font-medium" :
                    isFailed ? "text-red-300" :
                    step.status === "complete" ? "text-white/40" :
                    "text-white/50"
                  )}
                >
                  {step.description}
                </span>
                <StepDuration
                  startedAt={step.startedAt}
                  completedAt={step.completedAt}
                  durationMs={step.durationMs}
                />
              </div>

              {/* File path */}
              {step.filePath && (
                <div className="flex items-center gap-1 mt-1">
                  <FileCode className="size-3 text-white/20" />
                  <code className="text-[10px] text-white/30 font-mono">{step.filePath}</code>
                </div>
              )}

              {/* Error */}
              {step.error && (
                <div className="mt-1.5 p-2 rounded bg-red-500/[0.06] border border-red-500/10">
                  <p className="text-[10px] text-red-400/80 font-mono whitespace-pre-wrap">{step.error}</p>
                </div>
              )}

              {/* Output toggle */}
              {step.output && (
                <div className="mt-1.5">
                  <button
                    onClick={() => setShowOutput(!showOutput)}
                    className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/50 transition-colors"
                  >
                    <Terminal className="size-3" />
                    {showOutput ? "Hide output" : "Show output"}
                    <ChevronRight className={cn("size-3 transition-transform", showOutput && "rotate-90")} />
                  </button>

                  <AnimatePresence>
                    {showOutput && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <pre className="mt-1.5 p-2 rounded bg-black/40 border border-white/[0.04] font-mono text-[9px] text-white/40 max-h-[150px] overflow-y-auto whitespace-pre-wrap">
                          {step.output}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Code preview for file operations */}
              {step.content && (step.type === "create_file" || step.type === "edit_file") && (
                <div className="mt-1.5">
                  <button
                    onClick={() => setShowOutput(!showOutput)}
                    className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/50 transition-colors"
                  >
                    <FileCode className="size-3" />
                    {showOutput ? "Hide code" : "View code"}
                    <ChevronRight className={cn("size-3 transition-transform", showOutput && "rotate-90")} />
                  </button>

                  <AnimatePresence>
                    {showOutput && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <pre className="mt-1.5 p-2 rounded bg-black/40 border border-white/[0.04] font-mono text-[9px] text-emerald-400/60 max-h-[150px] overflow-y-auto whitespace-pre-wrap">
                          {step.content.slice(0, 2000)}
                          {step.content.length > 2000 && "\n... (truncated)"}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Budget Meter ──────────────────────────────────────────────────────────

function BudgetMeter({ budget, used = 0 }: { budget: number; used?: number }) {
  const pct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;
  const remaining = Math.max(0, budget - used);

  return (
    <div className="flex items-center gap-2">
      <DollarSign className="size-3 text-white/20" />
      <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full",
            pct > 90 ? "bg-amber-500" : "bg-gradient-to-r from-cyan-500 to-emerald-500",
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={SPRING_GENTLE}
        />
      </div>
      <span className="text-[9px] text-white/30 font-mono">
        {pct}% · {remaining.toLocaleString()}t left
      </span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function StreamProgress({
  streamId,
  name,
  budget,
  budgetUsed = 0,
  status,
  steps,
  className,
  onRetry,
  onSkip,
}: StreamProgressProps) {
  const completedCount = steps.filter(s => s.status === "complete").length;
  const failedCount = steps.filter(s => s.status === "failed").length;
  const isRunning = status === "running";
  const isComplete = status === "complete";
  const isFailed = status === "failed";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_GENTLE}
      className={cn(
        "rounded-xl border backdrop-blur-xl overflow-hidden",
        isRunning && "border-cyan-500/20 bg-cyan-500/[0.02]",
        isComplete && "border-emerald-500/20 bg-emerald-500/[0.02]",
        isFailed && "border-red-500/20 bg-red-500/[0.02]",
        !isRunning && !isComplete && !isFailed && "border-white/[0.06] bg-white/[0.02]",
        className,
      )}
    >
      {/* Header */}
      <div className="p-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isRunning && <Loader2 className="size-4 text-cyan-400 animate-spin" />}
            {isComplete && <CheckCircle2 className="size-4 text-emerald-400" />}
            {isFailed && <AlertTriangle className="size-4 text-red-400" />}
            {!isRunning && !isComplete && !isFailed && <Circle className="size-4 text-white/20" />}

            <div>
              <h4 className="text-[12px] font-semibold text-white/80">{name}</h4>
              <p className="text-[10px] text-white/40">
                {completedCount}/{steps.length} steps
                {failedCount > 0 && ` · ${failedCount} failed`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isFailed && onRetry && (
              <button
                onClick={() => onRetry(streamId)}
                className="px-2 py-1 rounded text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                Retry
              </button>
            )}
            {isRunning && onSkip && (
              <button
                onClick={() => onSkip(streamId)}
                className="px-2 py-1 rounded text-[10px] bg-white/[0.04] border border-white/[0.08] text-white/40 hover:bg-white/[0.08] transition-colors"
              >
                Skip
              </button>
            )}
          </div>
        </div>

        {/* Budget meter */}
        <div className="mt-2">
          <BudgetMeter budget={budget} used={budgetUsed} />
        </div>
      </div>

      {/* Steps */}
      <div className="p-3 max-h-[400px] overflow-y-auto">
        {steps.length === 0 ? (
          <p className="text-[11px] text-white/30 text-center py-4">No steps defined</p>
        ) : (
          <div className="space-y-0">
            {steps.map((step, i) => (
              <StepRow
                key={step.id}
                step={step}
                index={i}
                isLast={i === steps.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {(isComplete || isFailed) && (
        <div className="px-3 py-2 border-t border-white/[0.06]">
          <div className="flex items-center justify-between text-[10px]">
            <span className={cn(isComplete ? "text-emerald-400/60" : "text-red-400/60")}>
              {isComplete ? "Stream complete" : "Stream failed"}
            </span>
            <span className="text-white/20">
              {completedCount}/{steps.length} steps
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default StreamProgress;
