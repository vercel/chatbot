/**
 * HandoffTile - Inline V2 Session Progress Component (Phase 9)
 *
 * Renders inside chat messages when spawnCodingAgent fires.
 * Connects to /api/v2-bridge/stream/[sid] via EventSource and shows:
 *  - Live status: "V2 working... [tool calls: N, status: running]"
 *  - On complete: summary + "View details" link to /handoff/[id]
 *  - On error: error message + retry suggestion
 */

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Bot,
  Terminal,
  FileCode,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HandoffTileProps {
  sessionId: string;
  goal?: string;
  repo?: string;
  branch?: string;
  className?: string;
}

interface StreamEvent {
  type: string;
  sessionId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export function HandoffTile({
  sessionId,
  goal,
  repo,
  branch,
  className,
}: HandoffTileProps) {
  const [status, setStatus] = useState<
    "connecting" | "running" | "completed" | "failed"
  >("connecting");
  const [toolCalls, setToolCalls] = useState(0);
  const [filesModified, setFilesModified] = useState(0);
  const [lastActivity, setLastActivity] = useState<string>("");
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    function connect() {
      const es = new EventSource(`/api/v2-bridge/stream/${sessionId}`);
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus("running");
      };

      es.onmessage = (e) => {
        try {
          const event: StreamEvent = JSON.parse(e.data);
          setLastActivity(event.type);

          // Count tool calls
          if (
            event.type === "tool_use" ||
            event.type === "code_change"
          ) {
            setToolCalls((prev) => prev + 1);
          }

          // Count file modifications
          if (event.type === "code_change") {
            setFilesModified(
              (prev) =>
                prev + ((event.data.fileCount as number) || 1)
            );
          }

          // Capture PR / deploy URLs
          if (event.data.prUrl) setPrUrl(event.data.prUrl as string);
          if (event.data.deployUrl)
            setDeployUrl(event.data.deployUrl as string);

          // Terminal events
          if (
            event.type === "terminal" ||
            event.type === "completion" ||
            event.type === "session_complete"
          ) {
            setStatus("completed");
            setSummary(
              (event.data.summary as string) ||
                (event.data.result as string) ||
                "Session complete"
            );
            es.close();
          }

          // Error events
          if (event.type === "error") {
            setStatus("failed");
            setError(
              (event.data.message as string) || "Unknown error"
            );
            es.close();
          }
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        if (status !== "completed" && status !== "failed") {
          setStatus("failed");
          setError("Connection lost to V2 session");
        }
        es.close();
      };
    }

    connect();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [sessionId]);

  const statusConfig = {
    connecting: {
      icon: Loader2,
      iconClass: "animate-spin text-blue-500",
      label: "Connecting to V2...",
      bgClass: "bg-blue-500/5 border-blue-500/20",
    },
    running: {
      icon: Bot,
      iconClass: "text-blue-500",
      label: "V2 working...",
      bgClass: "bg-blue-500/5 border-blue-500/20",
    },
    completed: {
      icon: CheckCircle2,
      iconClass: "text-green-500",
      label: "V2 complete",
      bgClass: "bg-green-500/5 border-green-500/20",
    },
    failed: {
      icon: XCircle,
      iconClass: "text-red-500",
      label: "V2 failed",
      bgClass: "bg-red-500/5 border-red-500/20",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 my-2 text-sm",
        config.bgClass,
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4", config.iconClass)} />
        <span className="font-medium text-foreground">
          {config.label}
        </span>
        {goal && (
          <span className="text-muted-foreground truncate flex-1">
            {goal.length > 60 ? goal.slice(0, 60) + "..." : goal}
          </span>
        )}
        {status === "running" && (
          <Loader2 className="w-3 h-3 animate-spin text-blue-400 shrink-0" />
        )}
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
        {repo && (
          <span className="flex items-center gap-1">
            <FileCode size={12} /> {repo}
          </span>
        )}
        {branch && (
          <span className="flex items-center gap-1">
            <Terminal size={12} /> {branch}
          </span>
        )}
        {toolCalls > 0 && <span>Tool calls: {toolCalls}</span>}
        {filesModified > 0 && <span>Files: {filesModified}</span>}
        {lastActivity && status === "running" && (
          <span className="italic">[{lastActivity}]</span>
        )}
      </div>

      {/* Result links - on complete */}
      {status === "completed" && (
        <div className="flex items-center gap-2 mt-2">
          {summary && (
            <span className="text-xs text-muted-foreground mr-2">
              {summary.length > 100
                ? summary.slice(0, 100) + "..."
                : summary}
            </span>
          )}
          {prUrl && (
            <a
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted transition-colors"
            >
              <ExternalLink size={12} /> PR
            </a>
          )}
          {deployUrl && (
            <a
              href={deployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Rocket size={12} /> Deploy
            </a>
          )}
          <Link
            href={`/handoff/${sessionId}`}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted transition-colors ml-auto"
          >
            <ExternalLink size={12} /> View details
          </Link>
        </div>
      )}

      {/* Error display */}
      {status === "failed" && error && (
        <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-1 text-xs text-destructive mb-1">
            <AlertTriangle size={12} />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-xs text-destructive/80">{error}</p>
          <Link
            href={`/handoff/${sessionId}`}
            className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
          >
            <ExternalLink size={12} /> View session details
          </Link>
        </div>
      )}

      {/* Connecting state - show session ID */}
      {status === "connecting" && (
        <div className="text-xs text-muted-foreground mt-1">
          Session: {sessionId.slice(0, 16)}...
        </div>
      )}
    </div>
  );
}
