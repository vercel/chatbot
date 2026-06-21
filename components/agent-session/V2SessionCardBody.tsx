"use client";

/**
 * V2SessionCardBody — V2-specific UI for AgentSessionCard (lane=v2).
 *
 * Shows:
 *   - Model badge (Opus 4.6 / Claude Sonnet)
 *   - PR creation status with link
 *   - Deploy URL
 *   - File changes + diff preview
 *   - "Open in V2" action link
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { useState, useEffect } from "react";
import { GitBranch, GitPullRequest, ExternalLink, Bot, FileCode, Loader2 } from "lucide-react";
import { SessionProgressBar } from "./SessionProgressBar";
import { FileDiffPreview } from "./FileDiffPreview";
import { DeployStatus } from "./DeployStatus";
import type { FileChange } from "./FileDiffPreview";
import type { DeployState } from "./DeployStatus";
import { cn } from "@/lib/utils";

export interface V2SessionCardBodyProps {
  sessionId: string;
  goal: string;
  status: string;
  progress: number;
  repo?: string;
  branch?: string;
  prUrl?: string;
  deployUrl?: string;
  deployState?: DeployState;
  v2DirectUrl?: string;
  files?: FileChange[];
  model?: string;
  elapsed?: string;
  className?: string;
}

export function V2SessionCardBody({
  sessionId,
  goal,
  status,
  progress,
  repo,
  branch,
  prUrl,
  deployUrl,
  deployState,
  v2DirectUrl,
  files = [],
  model = "Claude Sonnet 4",
  elapsed,
  className,
}: V2SessionCardBodyProps) {
  const isActive = !["complete", "failed"].includes(status);

  const statusLabel = {
    routing: "Routing to V2...",
    spawning: "Spawning V2 session...",
    running: "V2 coding...",
    building: "Building...",
    deploying: "Deploying to Vercel...",
    complete: "V2 complete",
    failed: "V2 failed",
  }[status] || "V2 working...";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Model & repo metadata */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium
                       bg-purple-500/10 border border-purple-500/20 text-purple-400">
          <Bot className="size-2.5" />
          {model}
        </span>
        {repo && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px]
                         bg-white/5 border border-white/10 text-white/50">
            <GitBranch className="size-2.5" />
            {repo}
          </span>
        )}
        {branch && (
          <span className="text-[9px] text-white/30 font-mono">{branch}</span>
        )}
      </div>

      {/* Goal preview */}
      <p className="text-xs text-white/60 truncate">{goal.length > 100 ? goal.slice(0, 100) + "..." : goal}</p>

      {/* Progress bar (active states) */}
      {isActive && (
        <SessionProgressBar
          progress={progress}
          status={status as "spawning" | "running" | "building" | "deploying"}
          stepLabel={statusLabel}
          elapsed={elapsed}
        />
      )}

      {/* PR link */}
      {prUrl && (
        <a
          href={prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs
                     border border-purple-500/20 text-purple-400 hover:bg-purple-500/10 transition-colors"
        >
          <GitPullRequest className="size-3" />
          View Pull Request
          <ExternalLink className="size-3" />
        </a>
      )}

      {/* Deploy status */}
      {(deployState || deployUrl) && (
        <DeployStatus
          state={deployState || "ready"}
          deployUrl={deployUrl}
        />
      )}

      {/* File changes */}
      {files.length > 0 && (
        <FileDiffPreview files={files} maxFiles={5} />
      )}

      {/* V2 direct link (always visible on complete) */}
      {status === "complete" && v2DirectUrl && (
        <a
          href={v2DirectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
        >
          Open in V2
          <ExternalLink className="size-3" />
        </a>
      )}

      {/* Session ID (debug) */}
      <div className="text-[9px] text-white/10 font-mono">
        {sessionId.slice(0, 16)}...
      </div>
    </div>
  );
}
