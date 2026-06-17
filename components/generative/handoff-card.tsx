"use client";

/**
 * Phase 25 Stream 3: HandoffCard — V2 handoff status visualization
 *
 * 4 states: inline / expanded / canvas / sandbox-linked
 * Shows: branch, PR link, deploy URL, sandbox URL, progress
 * SSE-subscribed to v2-webhooks events
 * 'Open in Sandbox' button when ready_for_preview
 * 'Merge & Deploy' button when ready_to_merge
 */

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  GitPullRequest,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  Maximize2,
  Minimize2,
  X,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRING_GENTLE, SPRING_SNAPPY } from "@/lib/motion/springs";

export type HandoffState = "inline" | "expanded" | "canvas" | "sandbox-linked";
export type HandoffStatus =
  | "spawning"
  | "running"
  | "ready_for_preview"
  | "ready_to_merge"
  | "completed"
  | "failed";

export interface HandoffCardData {
  sessionId: string;
  mode: string;
  goal: string;
  status: HandoffStatus;
  branch?: string;
  prUrl?: string;
  deployUrl?: string;
  sandboxUrl?: string;
  repo?: string;
  progress?: number;
  errorMessage?: string;
  v2DirectUrl?: string;
  libraryUrl?: string;
}

interface HandoffCardProps {
  handoff: HandoffCardData;
  className?: string;
  onOpenSandbox?: () => void;
  onMergeDeploy?: () => void;
}

function StatusBadge({ status }: { status: HandoffStatus }) {
  const config: Record<HandoffStatus, { color: string; label: string; icon: React.ReactNode }> = {
    spawning: {
      color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      label: "Spawning",
      icon: <Loader2 className="size-3 animate-spin" />,
    },
    running: {
      color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      label: "Running",
      icon: <Loader2 className="size-3 animate-spin" />,
    },
    ready_for_preview: {
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      label: "Preview Ready",
      icon: <CheckCircle2 className="size-3" />,
    },
    ready_to_merge: {
      color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      label: "Ready to Merge",
      icon: <GitPullRequest className="size-3" />,
    },
    completed: {
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      label: "Completed",
      icon: <CheckCircle2 className="size-3" />,
    },
    failed: {
      color: "bg-red-500/10 text-red-400 border-red-500/20",
      label: "Failed",
      icon: <XCircle className="size-3" />,
    },
  };

  const c = config[status] || config.spawning;
  return (
    <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1", c.color)}>
      {c.icon}
      {c.label}
    </span>
  );
}

export function HandoffCard({
  handoff,
  className,
  onOpenSandbox,
  onMergeDeploy,
}: HandoffCardProps) {
  const [state, setState] = useState<HandoffState>("inline");
  const [status, setStatus] = useState<HandoffStatus>(handoff.status);
  const [progress, setProgress] = useState(handoff.progress || 0);

  // Phase 28: SSE subscription to v2-webhooks with auto-reconnect
  const [reconnecting, setReconnecting] = useState(false);
  useEffect(() => {
    if (!handoff.sessionId) return;
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      eventSource = new EventSource(
        `/api/v2-webhooks/stream?sessionId=${handoff.sessionId}`
      );
      eventSource.onopen = () => {
        setReconnecting(false);
      };
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status) setStatus(data.status);
          if (data.progress !== undefined) setProgress(data.progress);
        } catch { /* ignore malformed events */ }
      };
      eventSource.onerror = () => {
        eventSource?.close();
        setReconnecting(true);
        // Auto-reconnect after 5s
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      eventSource?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [handoff.sessionId]);

  const canPreview = status === "ready_for_preview" || status === "ready_to_merge";
  const canMerge = status === "ready_to_merge";
  const isActive = status === "spawning" || status === "running";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_GENTLE}
      className={cn(
        "relative overflow-hidden rounded-xl border backdrop-blur-xl",
        "border-white/10 bg-white/[0.04]",
        "shadow-[0_4px_24px_rgba(0,0,0,0.08)]",
        "w-full max-w-[375px] sm:max-w-[550px]",
        state === "canvas" && "fixed inset-4 z-50 max-w-none rounded-2xl",
        state === "sandbox-linked" && "fixed inset-4 z-50 max-w-none rounded-2xl",
        className
      )}
      role="region"
      aria-label={`V2 handoff: ${handoff.goal}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
      <div className="relative p-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                "size-7 rounded-lg flex items-center justify-center shrink-0",
                isActive ? "bg-cyan-500/10" : "bg-emerald-500/10"
              )}
            >
              {isActive ? (
                <Loader2 className="size-3.5 text-cyan-400 animate-spin" />
              ) : (
                <GitBranch className="size-3.5 text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-[12px] font-semibold text-white/90 truncate">
                V2 Handoff
              </h3>
              <p className="text-[10px] text-white/40 truncate">{handoff.goal}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge status={status} />
            {reconnecting && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1 bg-amber-500/10 text-amber-400 border-amber-500/20">
                <Loader2 className="size-3 animate-spin" />
                Reconnecting...
              </span>
            )}
            <button
              onClick={() =>
                setState((s) => (s === "expanded" ? "inline" : "expanded"))
              }
              className="p-1 rounded-md hover:bg-white/10 text-white/30 hover:text-white/70"
              aria-label={state === "expanded" ? "Collapse" : "Expand"}
            >
              {state === "expanded" ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {isActive && (
          <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={SPRING_GENTLE}
            />
          </div>
        )}

        {/* Expanded details */}
        <AnimatePresence>
          {state === "expanded" && (
            <motion.div
              key="details"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2 border-t border-white/[0.06] pt-2 space-y-1.5"
            >
              {handoff.repo && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-white/30">Repo:</span>
                  <span className="text-white/60">{handoff.repo}</span>
                </div>
              )}
              {handoff.branch && (
                <div className="flex items-center gap-2 text-[11px]">
                  <GitBranch className="size-3 text-white/30" />
                  <span className="text-white/60">{handoff.branch}</span>
                </div>
              )}
              {handoff.prUrl && (
                <a
                  href={handoff.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-cyan-400 hover:underline"
                >
                  <GitPullRequest className="size-3" />
                  View Pull Request
                </a>
              )}
              {handoff.deployUrl && (
                <a
                  href={handoff.deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-emerald-400 hover:underline"
                >
                  <ExternalLink className="size-3" />
                  Preview Deploy
                </a>
              )}
              {handoff.errorMessage && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">
                  {handoff.errorMessage}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="flex gap-2 mt-2 pt-2 border-t border-white/[0.06]">
          {canPreview && handoff.sandboxUrl && (
            <button
              onClick={() => {
                setState("sandbox-linked");
                onOpenSandbox?.();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-400 hover:bg-cyan-500/20 transition-colors"
            >
              <ExternalLink className="size-3" />
              Open in Sandbox
            </button>
          )}
          {canMerge && (
            <button
              onClick={onMergeDeploy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              <Rocket className="size-3" />
              Merge &amp; Deploy
            </button>
          )}
          {handoff.v2DirectUrl && (
            <a
              href={handoff.v2DirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/60 hover:bg-white/[0.08] transition-colors"
            >
              Open in V2
            </a>
          )}
        </div>
      </div>

      {/* Sandbox-linked iframe */}
      <AnimatePresence>
        {state === "sandbox-linked" && handoff.sandboxUrl && (
          <motion.div
            key="sandbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-2 bg-black/80">
              <span className="text-[11px] text-white/60">Sandbox Preview</span>
              <button
                onClick={() => setState("expanded")}
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <iframe
              src={handoff.sandboxUrl}
              className="flex-1 w-full border-0"
              title="Sandbox preview"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default HandoffCard;
