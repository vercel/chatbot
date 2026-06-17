"use client";

/**
 * Phase 24: Send to V2 Button
 *
 * Auto-detects on response render when code blocks > 50 lines
 * OR keywords like 'create file', 'multi-file', 'refactor entire' appear.
 *
 * Shows a modal to select target repo + mode, then triggers spawnCodingAgent
 * with the response context.
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket,
  GitBranch,
  Code2,
  X,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────

interface SendToV2Props {
  /** The full message/response content to detect code from */
  content: string;
  /** Optional session context */
  sessionId?: string;
  className?: string;
}

type TargetRepo =
  | "neptune-chat"
  | "neptune-v2"
  | "newleaf-financial"
  | "portal"
  | "pay";

interface RepoOption {
  id: TargetRepo;
  label: string;
  description: string;
  icon: string;
}

const REPO_OPTIONS: RepoOption[] = [
  {
    id: "neptune-chat",
    label: "Neptune Chat",
    description: "The main chat application",
    icon: "💬",
  },
  {
    id: "neptune-v2",
    label: "Neptune V2",
    description: "Coding agent backend",
    icon: "🤖",
  },
  {
    id: "newleaf-financial",
    label: "NewLeaf Financial",
    description: "Main business app",
    icon: "🏦",
  },
  {
    id: "portal",
    label: "Portal",
    description: "Customer portal",
    icon: "🏠",
  },
  {
    id: "pay",
    label: "Pay",
    description: "Payment microservice",
    icon: "💳",
  },
];

const V2_TRIGGER_KEYWORDS = [
  "create file",
  "create a file",
  "multi-file",
  "multi file",
  "refactor entire",
  "refactor the entire",
  "rewrite the",
  "migration script",
  "database migration",
  "add new endpoint",
  "build a new",
  "scaffold",
  "bootstrap",
];

const CODE_LINE_THRESHOLD = 50;
const CONTENT_LENGTH_THRESHOLD = 2000;

// ── Detection ────────────────────────────────────────────────────────

function shouldShowV2Button(content: string): boolean {
  if (!content || content.length < 50) return false;

  // Check keyword triggers
  const lower = content.toLowerCase();
  for (const keyword of V2_TRIGGER_KEYWORDS) {
    if (lower.includes(keyword)) return true;
  }

  // Check code block size
  const codeBlockMatch = content.match(/```[\s\S]*?```/g);
  if (codeBlockMatch) {
    for (const block of codeBlockMatch) {
      const lines = block.split("\n").length;
      if (lines > CODE_LINE_THRESHOLD) return true;
    }
  }

  // Check overall content length (large responses likely benefit from V2)
  if (content.length > CONTENT_LENGTH_THRESHOLD) return true;

  return false;
}

// ── Component ────────────────────────────────────────────────────────

export function SendToV2Button({
  content,
  sessionId,
  className,
}: SendToV2Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<TargetRepo | null>(null);
  const [mode, setMode] = useState<"auto" | "guided">("auto");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    sessionId: string;
    url: string;
  } | null>(null);

  const showButton = useMemo(() => shouldShowV2Button(content), [content]);

  if (!showButton) return null;

  const handleSubmit = async () => {
    if (!selectedRepo) return;
    setIsSubmitting(true);

    try {
      // Call spawnCodingAgent tool
      const response = await fetch("/api/spawn-coding-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: selectedRepo,
          mode,
          context: content.slice(0, 8000),
          sessionId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult({
          sessionId: data.sessionId || "pending",
          url: data.handoffUrl || "",
        });
      }
    } catch (err) {
      console.error("[send-to-v2] Failed to spawn:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Trigger button */}
      <motion.button
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium",
          "bg-gradient-to-r from-cyan-500/10 to-emerald-500/10",
          "border border-cyan-500/20 hover:border-cyan-500/40",
          "text-cyan-400 hover:text-cyan-300",
          "transition-all duration-200",
          "shadow-[0_0_12px_rgba(6,182,212,0.1)]",
          className
        )}
      >
        <Rocket className="size-3" />
        Send to V2
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => !isSubmitting && setIsOpen(false)}
            />

            {/* Dialog */}
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
                    <Rocket className="size-4 text-cyan-400" />
                    <span className="text-sm font-semibold text-white/90">
                      Send to V2
                    </span>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80"
                    disabled={isSubmitting}
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {result ? (
                  /* Success state */
                  <div className="p-6 text-center space-y-3">
                    <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                      <Code2 className="size-6 text-emerald-400" />
                    </div>
                    <p className="text-sm text-white/80">
                      V2 session spawned!
                    </p>
                    <p className="text-xs text-white/40 font-mono">
                      {result.sessionId}
                    </p>
                    {result.url && (
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        View in V2
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        setResult(null);
                        setSelectedRepo(null);
                      }}
                      className="block w-full mt-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:bg-white/10"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  /* Selection state */
                  <div className="p-4 space-y-4">
                    {/* Repo selection */}
                    <div>
                      <label className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-2 block">
                        Target Repository
                      </label>
                      <div className="space-y-1">
                        {REPO_OPTIONS.map((repo) => (
                          <button
                            key={repo.id}
                            onClick={() => setSelectedRepo(repo.id)}
                            className={cn(
                              "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all",
                              "border",
                              selectedRepo === repo.id
                                ? "border-cyan-500/30 bg-cyan-500/5"
                                : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                            )}
                          >
                            <span className="text-lg">{repo.icon}</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-white/80 block">
                                {repo.label}
                              </span>
                              <span className="text-[10px] text-white/30">
                                {repo.description}
                              </span>
                            </div>
                            {selectedRepo === repo.id && (
                              <ChevronRight className="size-3 text-cyan-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Mode */}
                    <div>
                      <label className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-2 block">
                        Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["auto", "guided"] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={cn(
                              "px-3 py-2 rounded-lg text-xs border transition-all",
                              mode === m
                                ? "border-cyan-500/30 bg-cyan-500/5 text-cyan-400"
                                : "border-white/5 bg-white/[0.02] text-white/50 hover:bg-white/[0.04]"
                            )}
                          >
                            {m === "auto" ? "🤖 Auto" : "🧭 Guided"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Submit */}
                    <button
                      onClick={handleSubmit}
                      disabled={!selectedRepo || isSubmitting}
                      className={cn(
                        "w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
                        selectedRepo && !isSubmitting
                          ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-[0_4px_16px_rgba(6,182,212,0.25)]"
                          : "bg-white/5 text-white/20 cursor-not-allowed"
                      )}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="size-3 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                          Spawning...
                        </>
                      ) : (
                        <>
                          <Rocket className="size-4" />
                          Spawn V2 Session
                        </>
                      )}
                    </button>
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
