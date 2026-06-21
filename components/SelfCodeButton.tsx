"use client";

/**
 * SelfCodeButton — "I'll code it myself" button
 *
 * M-N-SELF-CODING (2026-06-21): Appears next to "Send to V2" button when
 * code blocks > 50 lines or coding keywords are detected.
 *
 * Triggers the self-coding workflow directly in Neptune Chat using the
 * GitHub + Vercel connectors — no external handoff needed.
 *
 * States:
 *   - hidden (no code detected)
 *   - idle (code detected, ready to click)
 *   - planning (submitted, classifying task)
 *   - applying (applying code to GitHub)
 *   - deploying (triggering Vercel deploy)
 *   - complete (PR opened + deployed)
 *   - error (something failed)
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  GitBranch,
  Code2,
  X,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface SelfCodeButtonProps {
  /** The full message/response content to detect code from */
  content: string;
  /** Optional session context */
  sessionId?: string;
  /** Preset repo to target (default: neptune-chat) */
  repo?: string;
  className?: string;
  /** Callback when self-coding session starts */
  onSessionStart?: (sessionId: string) => void;
}

type SelfCodeStatus =
  | "idle"
  | "planning"
  | "applying"
  | "deploying"
  | "complete"
  | "error";

interface SelfCodeState {
  status: SelfCodeStatus;
  sessionId?: string;
  branch?: string;
  prUrl?: string;
  deployUrl?: string;
  error?: string;
  committedFiles: string[];
}

// ── Detection ──────────────────────────────────────────────────────────────

const SELF_CODE_TRIGGER_KEYWORDS = [
  "create file",
  "create a file",
  "multi-file",
  "multi file",
  "refactor",
  "rewrite the",
  "fix the bug",
  "add new endpoint",
  "build a new",
  "scaffold",
  "bootstrap",
];

const CODE_LINE_THRESHOLD = 50;
const CONTENT_LENGTH_THRESHOLD = 2000;

function shouldShowSelfCodeButton(content: string): boolean {
  if (!content || content.length < 50) return false;

  const lower = content.toLowerCase();
  for (const keyword of SELF_CODE_TRIGGER_KEYWORDS) {
    if (lower.includes(keyword)) return true;
  }

  const codeBlockMatch = content.match(/```[\s\S]*?```/g);
  if (codeBlockMatch) {
    for (const block of codeBlockMatch) {
      const lines = block.split("\n").length;
      if (lines > CODE_LINE_THRESHOLD) return true;
    }
  }

  if (content.length > CONTENT_LENGTH_THRESHOLD) return true;
  return false;
}

// ── Component ──────────────────────────────────────────────────────────────

export function SelfCodeButton({
  content,
  sessionId,
  repo = "neptune-chat",
  className,
  onSessionStart,
}: SelfCodeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<SelfCodeState>({
    status: "idle",
    committedFiles: [],
  });

  const showButton = useMemo(() => shouldShowSelfCodeButton(content), [content]);
  if (!showButton) return null;

  const handleSelfCode = async () => {
    setState((prev) => ({ ...prev, status: "planning" }));

    try {
      const response = await fetch("/api/self-code/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo,
          content: content.slice(0, 8000),
          sessionId,
        }),
      });

      if (!response.ok) {
        const err = await response.text().catch(() => "Unknown error");
        throw new Error(`API returned ${response.status}: ${err.slice(0, 200)}`);
      }

      const data = await response.json();

      if (data.success) {
        setState({
          status: "complete",
          sessionId: data.sessionId,
          branch: data.branch,
          prUrl: data.prUrl,
          deployUrl: data.deployUrl,
          committedFiles: data.committedFiles || [],
        });
        onSessionStart?.(data.sessionId);
      } else {
        throw new Error(data.error || "Self-coding failed");
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  };

  const statusConfig: Record<SelfCodeStatus, {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    colorClass: string;
  }> = {
    idle: { icon: Wand2, label: "I'll code it myself", colorClass: "text-emerald-400" },
    planning: { icon: Loader2, label: "Planning...", colorClass: "text-blue-400" },
    applying: { icon: Loader2, label: "Applying code...", colorClass: "text-amber-400" },
    deploying: { icon: Loader2, label: "Deploying...", colorClass: "text-purple-400" },
    complete: { icon: CheckCircle2, label: "Done!", colorClass: "text-emerald-400" },
    error: { icon: AlertTriangle, label: "Failed", colorClass: "text-red-400" },
  };

  const config = statusConfig[state.status];
  const Icon = config.icon;
  const isActive = ["planning", "applying", "deploying"].includes(state.status);
  const isTerminal = state.status === "complete" || state.status === "error";

  return (
    <>
      {/* Trigger button */}
      <motion.button
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => state.status === "idle" && setIsOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium",
          "bg-gradient-to-r from-emerald-500/10 to-teal-500/10",
          "border border-emerald-500/20 hover:border-emerald-500/40",
          "text-emerald-400 hover:text-emerald-300",
          "transition-all duration-200",
          "shadow-[0_0_12px_rgba(16,185,129,0.1)]",
          isActive && "animate-pulse",
          className
        )}
        disabled={isActive}
      >
        <Icon className={cn("size-3", isActive && "animate-spin")} />
        {config.label}
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => isTerminal && setIsOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div
                className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0A0A0F]/95 backdrop-blur-xl
                          shadow-[0_16px_64px_rgba(0,0,0,0.4)] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Wand2 className="size-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-white/90">
                      Self-Code
                    </span>
                  </div>
                  {isTerminal && (
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                {state.status === "idle" && (
                  <div className="p-4 space-y-4">
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                      <p className="text-xs text-white/70">
                        Neptune Chat will code this directly using GitHub + Vercel
                        connectors — no external handoff needed.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <GitBranch className="size-3" />
                        <span>Will create a branch, commit changes, and open a PR on:</span>
                      </div>
                      <code className="block p-2 rounded bg-white/5 text-xs font-mono text-emerald-300">
                        abhiswami2121/{repo}
                      </code>
                    </div>

                    <button
                      onClick={handleSelfCode}
                      className="w-full py-2.5 rounded-xl text-sm font-medium
                                 bg-gradient-to-r from-emerald-500 to-teal-500
                                 text-white shadow-[0_4px_16px_rgba(16,185,129,0.25)]
                                 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]
                                 transition-all flex items-center justify-center gap-2"
                    >
                      <Wand2 className="size-4" />
                      Code it myself
                    </button>
                  </div>
                )}

                {state.status === "planning" && (
                  <div className="p-6 text-center space-y-3">
                    <Loader2 className="size-8 text-blue-400 animate-spin mx-auto" />
                    <p className="text-sm text-white/80">Analyzing and planning...</p>
                    <p className="text-xs text-white/40">
                      Classifying task and preparing code changes
                    </p>
                  </div>
                )}

                {state.status === "complete" && (
                  <div className="p-6 space-y-3">
                    <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                      <Code2 className="size-6 text-emerald-400" />
                    </div>
                    <p className="text-sm text-white/80 text-center">Code applied successfully!</p>

                    {state.committedFiles.length > 0 && (
                      <div className="p-2 rounded-lg bg-white/5 space-y-1 max-h-32 overflow-y-auto">
                        {state.committedFiles.map((f) => (
                          <div key={f} className="text-[10px] font-mono text-emerald-300">
                            ✓ {f}
                          </div>
                        ))}
                      </div>
                    )}

                    {state.prUrl && (
                      <a
                        href={state.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        View PR on GitHub
                        <ExternalLink className="size-3" />
                      </a>
                    )}

                    {state.deployUrl && (
                      <a
                        href={state.deployUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        Open deployed app
                        <ExternalLink className="size-3" />
                      </a>
                    )}

                    <button
                      onClick={() => setIsOpen(false)}
                      className="block w-full py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:bg-white/10"
                    >
                      Close
                    </button>
                  </div>
                )}

                {state.status === "error" && (
                  <div className="p-6 space-y-3">
                    <div className="size-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                      <AlertTriangle className="size-6 text-red-400" />
                    </div>
                    <p className="text-sm text-white/80 text-center">Self-coding failed</p>
                    {state.error && (
                      <p className="text-xs text-red-400/80 text-center break-all">
                        {state.error}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setState({ status: "idle", committedFiles: [] });
                        }}
                        className="flex-1 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 hover:bg-amber-500/20"
                      >
                        Try again
                      </button>
                      <button
                        onClick={() => setIsOpen(false)}
                        className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:bg-white/10"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default SelfCodeButton;
