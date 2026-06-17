"use client";

/**
 * Autonomous Mission — Enhanced MissionCard
 *
 * Displays live mission status with:
 *  - Status badge (PROPOSED → EXECUTING → COMPLETE)
 *  - Per-stream progress bars
 *  - Recent actions feed
 *  - Elapsed time ticker
 *  - Intervention controls (Pause / Resume / Inject / Abort)
 *  - SSE subscription to /api/missions/[id]/stream
 *
 * Phase 38: Autonomous Coding Platform
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  XCircle,
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Clock,
  GitBranch,
  Send,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SPRING_GENTLE,
  FADE_UP,
} from "@/lib/motion/springs";
import type { MissionEvent, MissionSummary } from "@/lib/autonomous-mission/runner";

// ─── Types ────────────────────────────────────────────────────────────────

export type AutonomousMissionStatus =
  | "PROPOSED"
  | "PARSING"
  | "PLANNING"
  | "EXECUTING"
  | "PAUSED"
  | "DEPLOYING"
  | "VERIFYING"
  | "COMPLETE"
  | "FAILED"
  | "ABORTED";

export interface StreamProgressData {
  streamId: string;
  name: string;
  status: "pending" | "running" | "complete" | "failed";
  totalSteps: number;
  completedSteps: number;
  currentStep?: string;
}

export interface AutonomousMissionProps {
  missionId: string;
  title: string;
  status: AutonomousMissionStatus;
  streams?: StreamProgressData[];
  events?: MissionEvent[];
  deployUrl?: string;
  commitSha?: string;
  branch?: string;
  error?: string;
  startedAt?: string;
  className?: string;
  onPause?: () => void;
  onResume?: () => void;
  onInject?: (instruction: string) => void;
  onAbort?: () => void;
  onOpenDetail?: () => void;
}

// ─── Status Badge ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AutonomousMissionStatus, {
  label: string;
  color: string;
  bg: string;
  icon: typeof Play;
}> = {
  PROPOSED:    { label: "Proposed",    color: "text-white/40", bg: "bg-white/5", icon: Circle },
  PARSING:     { label: "Parsing",     color: "text-blue-400", bg: "bg-blue-500/10", icon: Loader2 },
  PLANNING:    { label: "Planning",    color: "text-purple-400", bg: "bg-purple-500/10", icon: Loader2 },
  EXECUTING:   { label: "Executing",   color: "text-cyan-400", bg: "bg-cyan-500/10", icon: Play },
  PAUSED:      { label: "Paused",      color: "text-amber-400", bg: "bg-amber-500/10", icon: Pause },
  DEPLOYING:   { label: "Deploying",   color: "text-indigo-400", bg: "bg-indigo-500/10", icon: Loader2 },
  VERIFYING:   { label: "Verifying",   color: "text-teal-400", bg: "bg-teal-500/10", icon: Loader2 },
  COMPLETE:    { label: "Complete",    color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  FAILED:      { label: "Failed",      color: "text-red-400", bg: "bg-red-500/10", icon: AlertTriangle },
  ABORTED:     { label: "Aborted",     color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
};

function StatusBadge({ status }: { status: AutonomousMissionStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PROPOSED;
  const Icon = config.icon;
  const isSpinning = ["PARSING", "PLANNING", "EXECUTING", "DEPLOYING", "VERIFYING"].includes(status);

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium",
      config.bg, config.color,
    )}>
      <Icon className={cn("size-3", isSpinning && "animate-spin")} />
      {config.label}
    </span>
  );
}

// ─── Stream Progress Bar ───────────────────────────────────────────────────

function StreamBar({ stream }: { stream: StreamProgressData }) {
  const pct = stream.totalSteps > 0
    ? Math.round((stream.completedSteps / stream.totalSteps) * 100)
    : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {stream.status === "running" && <Loader2 className="size-3 text-cyan-400 animate-spin" />}
          {stream.status === "complete" && <CheckCircle2 className="size-3 text-emerald-400" />}
          {stream.status === "failed" && <AlertTriangle className="size-3 text-red-400" />}
          {stream.status === "pending" && <Circle className="size-3 text-white/20" />}
          <span className="text-[11px] text-white/70 truncate max-w-[180px]">{stream.name}</span>
        </div>
        <span className="text-[10px] text-white/40">{stream.completedSteps}/{stream.totalSteps}</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full",
            stream.status === "failed" ? "bg-red-500" : "bg-gradient-to-r from-cyan-500 to-emerald-500",
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={SPRING_GENTLE}
        />
      </div>
    </div>
  );
}

// ─── Elapsed Time ──────────────────────────────────────────────────────────

function ElapsedTime({ startedAt }: { startedAt?: string }) {
  const [elapsed, setElapsed] = useState("0s");

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();

    const update = () => {
      const diff = Date.now() - start;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) setElapsed(`${hours}h ${minutes % 60}m ${seconds % 60}s`);
      else if (minutes > 0) setElapsed(`${minutes}m ${seconds % 60}s`);
      else setElapsed(`${seconds}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <span className="flex items-center gap-1 text-[10px] text-white/40">
      <Clock className="size-3" />
      {elapsed}
    </span>
  );
}

// ─── Event Feed ────────────────────────────────────────────────────────────

function RecentEvents({ events }: { events: MissionEvent[] }) {
  const recent = events.slice(-8).reverse();

  return (
    <div className="space-y-1">
      {recent.map((event, i) => (
        <div key={i} className="flex items-start gap-2 text-[10px]">
          <span className="text-white/30 shrink-0 mt-0.5">
            {event.type === "STEP_COMPLETE" ? "✅" :
             event.type === "STEP_FAILED" ? "❌" :
             event.type === "STREAM_COMPLETE" ? "🏁" :
             event.type === "COMMIT_CREATED" ? "📝" :
             event.type === "DEPLOY_READY" ? "🚀" :
             event.type === "PAUSED" ? "⏸️" :
             event.type === "CHECKPOINT_SAVED" ? "💾" :
             event.type === "COMMENT" ? "💬" : "•"}
          </span>
          <span className="text-white/50">{event.message ?? event.type}</span>
          <span className="text-white/20 ml-auto shrink-0">
            {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Intervention Panel ────────────────────────────────────────────────────

function InterventionControls({
  status,
  onPause,
  onResume,
  onInject,
  onAbort,
}: {
  status: AutonomousMissionStatus;
  onPause?: () => void;
  onResume?: () => void;
  onInject?: (instruction: string) => void;
  onAbort?: () => void;
}) {
  const [injectText, setInjectText] = useState("");
  const [showInject, setShowInject] = useState(false);

  const active = ["EXECUTING", "DEPLOYING", "VERIFYING"].includes(status);
  const paused = status === "PAUSED";

  if (["COMPLETE", "FAILED", "ABORTED"].includes(status)) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {active && onPause && (
          <button
            onClick={onPause}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            <Pause className="size-3" />
            Pause
          </button>
        )}
        {paused && onResume && (
          <button
            onClick={onResume}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <Play className="size-3" />
            Resume
          </button>
        )}
        <button
          onClick={() => setShowInject(!showInject)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/60 hover:bg-white/[0.08] transition-colors"
        >
          <Send className="size-3" />
          Inject
        </button>
        {onAbort && (
          <button
            onClick={onAbort}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 hover:bg-red-500/20 transition-colors ml-auto"
          >
            <XCircle className="size-3" />
            Abort
          </button>
        )}
      </div>

      <AnimatePresence>
        {showInject && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={injectText}
                onChange={e => setInjectText(e.target.value)}
                placeholder="Inject instruction..."
                className="flex-1 px-2.5 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/70 placeholder:text-white/20 focus:outline-none focus:border-cyan-500/30"
                onKeyDown={e => {
                  if (e.key === "Enter" && injectText.trim()) {
                    onInject?.(injectText.trim());
                    setInjectText("");
                    setShowInject(false);
                  }
                }}
              />
              <button
                onClick={() => {
                  if (injectText.trim()) {
                    onInject?.(injectText.trim());
                    setInjectText("");
                    setShowInject(false);
                  }
                }}
                className="px-3 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-400 hover:bg-cyan-500/20 transition-colors"
              >
                <Send className="size-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function AutonomousMissionCard({
  missionId,
  title,
  status,
  streams = [],
  events = [],
  deployUrl,
  commitSha,
  branch,
  error,
  startedAt,
  className,
  onPause,
  onResume,
  onInject,
  onAbort,
  onOpenDetail,
}: AutonomousMissionProps) {
  const [expanded, setExpanded] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);

  // SSE subscription for live updates
  useEffect(() => {
    if (!missionId || ["COMPLETE", "FAILED", "ABORTED"].includes(status)) return;

    const eventSource = new EventSource(`/api/missions/${missionId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Events are handled by parent via the events prop re-render
        // This connection keeps the stream alive for server-side state
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [missionId, status]);

  const totalSteps = streams.reduce((sum, s) => sum + s.totalSteps, 0);
  const completedSteps = streams.reduce((sum, s) => sum + s.completedSteps, 0);
  const overallPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const isComplete = status === "COMPLETE";
  const isFailed = status === "FAILED" || status === "ABORTED";
  const isActive = !isComplete && !isFailed;

  return (
    <motion.div
      initial={FADE_UP.initial}
      animate={FADE_UP.animate}
      transition={SPRING_GENTLE}
      className={cn(
        "relative overflow-hidden rounded-xl border backdrop-blur-xl",
        isFailed ? "border-red-500/20 bg-red-500/[0.02]" :
        isComplete ? "border-emerald-500/20 bg-emerald-500/[0.02]" :
        "border-cyan-500/20 bg-cyan-500/[0.02]",
        "shadow-[0_4px_24px_rgba(0,0,0,0.08)]",
        "w-full max-w-[420px]",
        className,
      )}
      role="region"
      aria-label={`Autonomous Mission: ${title}`}
    >
      {/* Glass shimmer */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

      <div className="relative">
        {/* Header */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={status} />
                {branch && (
                  <span className="flex items-center gap-1 text-[10px] text-white/30">
                    <GitBranch className="size-3" />
                    {branch}
                  </span>
                )}
              </div>
              <h3 className="text-[13px] font-semibold text-white/90 truncate">
                {title}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <ElapsedTime startedAt={startedAt} />
                <span className="text-[10px] text-white/40">
                  {completedSteps}/{totalSteps} steps
                </span>
                {commitSha && (
                  <span className="text-[10px] text-white/30 font-mono">
                    {commitSha.slice(0, 7)}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded-md hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors shrink-0"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
            </button>
          </div>

          {/* Overall progress */}
          <div className="mt-3 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                isComplete ? "bg-emerald-500" :
                isFailed ? "bg-red-500" :
                "bg-gradient-to-r from-cyan-500 to-emerald-500",
              )}
              initial={{ width: 0 }}
              animate={{ width: `${overallPct}%` }}
              transition={SPRING_GENTLE}
            />
          </div>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-white/[0.06]"
            >
              <div className="p-4 space-y-4">
                {/* Streams */}
                {streams.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Streams</h4>
                    {streams.map(stream => (
                      <StreamBar key={stream.streamId} stream={stream} />
                    ))}
                  </div>
                )}

                {/* Recent events */}
                {events.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Recent Events</h4>
                    <div className="max-h-[200px] overflow-y-auto">
                      <RecentEvents events={events} />
                    </div>
                  </div>
                )}

                {/* Deployment info */}
                {(deployUrl || status === "DEPLOYING" || status === "VERIFYING") && (
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1">
                    <h4 className="text-[11px] font-medium text-white/40">Deployment</h4>
                    {deployUrl ? (
                      <a
                        href={deployUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <ExternalLink className="size-3" />
                        {deployUrl}
                      </a>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[11px] text-white/30">
                        <Loader2 className="size-3 animate-spin" />
                        Deploying...
                      </span>
                    )}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-500/[0.04] border border-red-500/15">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="size-3.5 text-red-400" />
                      <span className="text-[11px] font-medium text-red-400">Error</span>
                    </div>
                    <p className="text-[10px] text-red-400/70 font-mono whitespace-pre-wrap">{error}</p>
                  </div>
                )}

                {/* Terminal output toggle */}
                <button
                  onClick={() => setShowTerminal(!showTerminal)}
                  className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/60 transition-colors"
                >
                  <Terminal className="size-3" />
                  {showTerminal ? "Hide Terminal" : "Show Terminal"}
                </button>

                {showTerminal && (
                  <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] max-h-[200px] overflow-y-auto font-mono text-[10px] text-white/50 space-y-0.5">
                    {events.map((event, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-white/20 shrink-0">
                          [{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}]
                        </span>
                        <span className={cn(
                          event.type === "STEP_FAILED" || event.type === "STREAM_FAILED" || event.type === "MISSION_FAILED"
                            ? "text-red-400/70"
                            : "text-white/50"
                        )}>
                          {event.type}: {event.message ?? ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Open detail page */}
                {onOpenDetail && (
                  <button
                    onClick={onOpenDetail}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[12px] text-cyan-400 hover:bg-cyan-500/20 transition-colors font-medium"
                  >
                    <ExternalLink className="size-3.5" />
                    Open Full Mission View
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Intervention controls (always visible when active) */}
        {isActive && (
          <div className="px-4 pb-3">
            <InterventionControls
              status={status}
              onPause={onPause}
              onResume={onResume}
              onInject={onInject}
              onAbort={onAbort}
            />
          </div>
        )}

        {/* Complete state footer */}
        {isComplete && deployUrl && (
          <div className="px-4 pb-3">
            <a
              href={deployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[12px] text-emerald-400 hover:bg-emerald-500/20 transition-colors font-medium"
            >
              <ExternalLink className="size-3.5" />
              View Live Deploy
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default AutonomousMissionCard;
