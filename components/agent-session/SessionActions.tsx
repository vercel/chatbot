"use client";

/**
 * SessionActions — Action button row for AgentSessionCard.
 *
 * Shows:
 *   - Open in V2 / Open Slack thread (lane-specific)
 *   - View files (toggle expanded)
 *   - Share (copy link)
 *   - Retry (on failure)
 *   - Cancel (on active)
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { useState } from "react";
import {
  ExternalLink,
  FileCode,
  Share2,
  RotateCw,
  XCircle,
  Maximize2,
  Check,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SessionActionsProps {
  lane: "v2" | "vps";
  status: string;
  v2DirectUrl?: string;
  slackThreadTs?: string;
  onExpand?: () => void;
  onViewFiles?: () => void;
  onShare?: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
  isCancelling?: boolean;
  className?: string;
}

export function SessionActions({
  lane,
  status,
  v2DirectUrl,
  slackThreadTs,
  onExpand,
  onViewFiles,
  onShare,
  onRetry,
  onCancel,
  isCancelling = false,
  className,
}: SessionActionsProps) {
  const [copied, setCopied] = useState(false);
  const isActive = !["complete", "failed"].includes(status);

  const slackUrl = slackThreadTs
    ? `https://newleaf-financial.slack.com/archives/C0AQDDC3HAB/p${slackThreadTs.replace(".", "")}`
    : null;

  const handleShare = async () => {
    onShare?.();
    try {
      const url = lane === "v2"
        ? v2DirectUrl || window.location.href
        : slackUrl || window.location.href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap pt-2 border-t border-white/5", className)}>
      {/* Lane-specific primary action */}
      {lane === "v2" && v2DirectUrl && (
        <a
          href={v2DirectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                     border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
        >
          <ExternalLink className="size-3" />
          Open in V2
        </a>
      )}

      {lane === "vps" && slackUrl && (
        <a
          href={slackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                     border border-blue-500/20 text-blue-400 hover:bg-blue-500/10 transition-colors"
        >
          <MessageSquare className="size-3" />
          Open Slack Thread
        </a>
      )}

      {/* View files */}
      {onViewFiles && (
        <button
          onClick={onViewFiles}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs
                     border border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
        >
          <FileCode className="size-3" />
          View Files
        </button>
      )}

      {/* Expand */}
      {onExpand && (
        <button
          onClick={onExpand}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs
                     border border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
        >
          <Maximize2 className="size-3" />
          Expand
        </button>
      )}

      {/* Share */}
      <button
        onClick={handleShare}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs
                   border border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
      >
        {copied ? <Check className="size-3 text-emerald-400" /> : <Share2 className="size-3" />}
        {copied ? "Copied" : "Share"}
      </button>

      {/* Cancel (active only) */}
      {isActive && onCancel && (
        <button
          onClick={onCancel}
          disabled={isCancelling}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ml-auto",
            "border border-red-500/20 text-red-400 hover:bg-red-500/10",
            isCancelling && "opacity-50 cursor-not-allowed"
          )}
        >
          {isCancelling ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <XCircle className="size-3" />
          )}
          Cancel
        </button>
      )}

      {/* Retry (failed only) */}
      {status === "failed" && onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ml-auto
                     border border-amber-500/20 text-amber-400 hover:bg-amber-500/10 transition-colors"
        >
          <RotateCw className="size-3" />
          Retry
        </button>
      )}
    </div>
  );
}
