"use client";

/**
 * Phase 24: V2 Handoff Artifact
 *
 * Renders a live V2 handoff card in chat with:
 * - Progress bar
 * - Status indicator (starting/running/completing/completed/failed)
 * - PR link (when ready)
 * - Deploy URL (when ready)
 * - Glass styling matching Phase 22
 *
 * Subscribes to SSE via /api/v2-handoffs/[id]/stream
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, ExternalLink, GitPullRequest, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

type HandoffStatus = "starting" | "running" | "completing" | "completed" | "failed";

interface HandoffCardProps {
  sessionId: string;
  goal: string;
  targetRepo: string;
  className?: string;
}

const STATUS_CONFIG: Record<HandoffStatus, { icon: React.ReactNode; label: string; color: string }> = {
  starting: { icon: <Loader2 className="size-4 animate-spin" />, label: "Starting...", color: "text-cyan-400" },
  running: { icon: <Loader2 className="size-4 animate-spin" />, label: "Running...", color: "text-blue-400" },
  completing: { icon: <Loader2 className="size-4 animate-spin" />, label: "Completing...", color: "text-emerald-400" },
  completed: { icon: <CheckCircle2 className="size-4" />, label: "Completed", color: "text-emerald-500" },
  failed: { icon: <XCircle className="size-4" />, label: "Failed", color: "text-red-400" },
};

export function V2HandoffCard({ sessionId, goal, targetRepo, className }: HandoffCardProps) {
  const [status, setStatus] = useState<HandoffStatus>("starting");
  const [progress, setProgress] = useState(0);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to SSE
    const eventSource = new EventSource(`/api/v2-handoffs/${sessionId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status) setStatus(data.status);
        if (data.progress !== undefined) setProgress(data.progress);
        if (data.prUrl) setPrUrl(data.prUrl);
        if (data.deployUrl) setDeployUrl(data.deployUrl);
        if (data.error) setError(data.error);
      } catch {
        // Skip malformed events
      }
    };

    eventSource.onerror = () => {
      // Fallback: close SSE, rely on polling via parent
      eventSource.close();
    };

    return () => eventSource.close();
  }, [sessionId]);

  const config = STATUS_CONFIG[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl border backdrop-blur-xl",
        "border-white/10 bg-white/5 p-4",
        "shadow-[0_8px_32px_rgba(0,0,0,0.12)]",
        className
      )}
    >
      {/* Glass shimmer */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      <div className="relative space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("flex items-center gap-1.5 text-sm", config.color)}>
              {config.icon}
              {config.label}
            </span>
            <span className="text-xs text-white/40">V2 Handoff</span>
          </div>
          <span className="text-xs text-white/30 font-mono">{sessionId.slice(0, 8)}</span>
        </div>

        {/* Goal */}
        <p className="text-sm text-white/80 line-clamp-2">{goal}</p>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                status === "failed" ? "bg-red-500" : "bg-gradient-to-r from-cyan-500 to-emerald-500"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/30">
            <span>{targetRepo}</span>
            <span>{progress}%</span>
          </div>
        </div>

        {/* Results */}
        <AnimatePresence>
          {status === "completed" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              {prUrl && (
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <GitPullRequest className="size-3" />
                  View Pull Request
                  <ExternalLink className="size-3" />
                </a>
              )}
              {deployUrl && (
                <a
                  href={deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <Rocket className="size-3" />
                  View Deployment
                  <ExternalLink className="size-3" />
                </a>
              )}
            </motion.div>
          )}
          {status === "failed" && error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
