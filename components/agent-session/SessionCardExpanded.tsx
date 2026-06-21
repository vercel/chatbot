"use client";

/**
 * SessionCardExpanded — Full-screen overlay for detailed session view.
 *
 * Tabs:
 *   1. Overview — goal, status, progress, results
 *   2. Files — file diff preview with all files
 *   3. Logs — build/deploy log stream
 *   4. Deployment — deploy status + URL
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FileCode,
  Terminal,
  Rocket,
  Info,
  ExternalLink,
  Bot,
  GitBranch,
  Clock,
  MessageSquare,
} from "lucide-react";
import { FileDiffPreview } from "./FileDiffPreview";
import { BuildLogStream } from "./BuildLogStream";
import { DeployStatus } from "./DeployStatus";
import { SessionProgressBar } from "./SessionProgressBar";
import type { FileChange } from "./FileDiffPreview";
import type { LogLine } from "./BuildLogStream";
import type { DeployState } from "./DeployStatus";
import { cn } from "@/lib/utils";

type TabId = "overview" | "files" | "logs" | "deploy";

const TABS: { id: TabId; label: string; icon: typeof Info }[] = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "files", label: "Files", icon: FileCode },
  { id: "logs", label: "Logs", icon: Terminal },
  { id: "deploy", label: "Deploy", icon: Rocket },
];

export interface SessionCardExpandedProps {
  open: boolean;
  onClose: () => void;
  lane: "v2" | "vps";
  sessionId: string;
  goal: string;
  status: string;
  progress: number;
  model?: string;
  repo?: string;
  branch?: string;
  prUrl?: string;
  deployUrl?: string;
  deployState?: DeployState;
  v2DirectUrl?: string;
  slackThreadTs?: string;
  files?: FileChange[];
  logs?: LogLine[];
  elapsed?: string;
  error?: string;
  result?: string;
}

export function SessionCardExpanded({
  open,
  onClose,
  lane,
  sessionId,
  goal,
  status,
  progress,
  model,
  repo,
  branch,
  prUrl,
  deployUrl,
  deployState,
  v2DirectUrl,
  slackThreadTs,
  files = [],
  logs = [],
  elapsed,
  error,
  result,
}: SessionCardExpandedProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const slackUrl = slackThreadTs
    ? `https://newleaf-financial.slack.com/archives/C0AQDDC3HAB/p${slackThreadTs.replace(".", "")}`
    : null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-4 z-50 flex flex-col rounded-2xl border border-white/10
                       bg-[#0A0A0F]/95 backdrop-blur-xl
                       shadow-[0_16px_64px_rgba(0,0,0,0.5)] overflow-hidden
                       md:inset-8 lg:inset-16"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "size-8 rounded-xl flex items-center justify-center",
                  lane === "v2" ? "bg-purple-500/10" : "bg-amber-500/10"
                )}>
                  <Bot className={cn("size-4", lane === "v2" ? "text-purple-400" : "text-amber-400")} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white/90">Agent Session</h2>
                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <span>{lane === "v2" ? "V2 Coding Agent" : "VPS Agent"}</span>
                    {model && <span>· {model}</span>}
                    {repo && (
                      <span className="flex items-center gap-0.5">
                        <GitBranch className="size-2.5" /> {repo}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5 shrink-0">
              {TABS.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      activeTab === tab.id
                        ? "bg-white/10 text-white/80"
                        : "text-white/30 hover:text-white/60"
                    )}
                  >
                    <TabIcon className="size-3" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Overview tab */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Goal</h3>
                    <p className="text-sm text-white/80">{goal}</p>
                  </div>

                  <SessionProgressBar
                    progress={progress}
                    status={status as "spawning" | "running" | "building" | "deploying"}
                    elapsed={elapsed}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-white/5 p-3 bg-white/[0.02]">
                      <span className="text-[10px] text-white/30">Status</span>
                      <p className="text-sm text-white/80 mt-0.5 capitalize">{status}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 p-3 bg-white/[0.02]">
                      <span className="text-[10px] text-white/30">Model</span>
                      <p className="text-sm text-white/80 mt-0.5">{model || "—"}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 p-3 bg-white/[0.02]">
                      <span className="text-[10px] text-white/30">Lane</span>
                      <p className="text-sm text-white/80 mt-0.5 uppercase">{lane}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 p-3 bg-white/[0.02]">
                      <span className="text-[10px] text-white/30">Elapsed</span>
                      <p className="text-sm text-white/80 mt-0.5 flex items-center gap-1">
                        <Clock className="size-3" /> {elapsed || "—"}
                      </p>
                    </div>
                  </div>

                  {result && (
                    <div className="rounded-lg border border-white/5 p-3 bg-white/[0.02]">
                      <span className="text-[10px] text-white/30">Result</span>
                      <p className="text-sm text-white/80 mt-1">{result}</p>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-lg border border-red-500/20 p-3 bg-red-500/5">
                      <span className="text-[10px] text-red-400">Error</span>
                      <p className="text-sm text-red-400/80 mt-1">{error}</p>
                    </div>
                  )}

                  {/* External links */}
                  <div className="flex flex-wrap gap-2">
                    {v2DirectUrl && (
                      <a href={v2DirectUrl} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                                    border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10">
                        <ExternalLink className="size-3" /> Open in V2
                      </a>
                    )}
                    {slackUrl && (
                      <a href={slackUrl} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                                    border border-blue-500/20 text-blue-400 hover:bg-blue-500/10">
                        <MessageSquare className="size-3" /> View Slack Thread
                      </a>
                    )}
                    {prUrl && (
                      <a href={prUrl} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                                    border border-purple-500/20 text-purple-400 hover:bg-purple-500/10">
                        <ExternalLink className="size-3" /> View PR
                      </a>
                    )}
                    {deployUrl && (
                      <a href={deployUrl} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                                    border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10">
                        <Rocket className="size-3" /> Open Deploy
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Files tab */}
              {activeTab === "files" && (
                <FileDiffPreview files={files} maxFiles={50} />
              )}

              {/* Logs tab */}
              {activeTab === "logs" && (
                <BuildLogStream logs={logs} maxHeight="100%" />
              )}

              {/* Deploy tab */}
              {activeTab === "deploy" && (
                <DeployStatus
                  state={deployState || (deployUrl ? "ready" : "pending")}
                  deployUrl={deployUrl}
                  error={status === "failed" ? error : undefined}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
