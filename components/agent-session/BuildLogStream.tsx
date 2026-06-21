"use client";

/**
 * BuildLogStream — Auto-following log viewer for build/deploy output.
 *
 * Features:
 *   - Auto-scrolls to newest log line
 *   - Color-coded log levels (error=red, warn=yellow, info=cyan, etc.)
 *   - Truncated at 2000 lines, oldest lines dropped
 *   - Search/filter toggle
 *   - Copy log button
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Terminal, Copy, Check, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LogLine {
  timestamp?: string;
  level?: "info" | "warn" | "error" | "debug" | "build" | "deploy";
  message: string;
  id?: string;
}

export interface BuildLogStreamProps {
  logs: LogLine[];
  maxLines?: number;
  maxHeight?: string;
  autoFollow?: boolean;
  className?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  error: "text-red-400",
  warn: "text-amber-400",
  info: "text-white/60",
  debug: "text-white/30",
  build: "text-purple-400",
  deploy: "text-cyan-400",
};

const LEVEL_BADGES: Record<string, string> = {
  error: "bg-red-500/10 text-red-400 border-red-500/20",
  warn: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  debug: "bg-white/5 text-white/30 border-white/10",
  build: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  deploy: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

export function BuildLogStream({
  logs,
  maxLines = 2000,
  maxHeight = "300px",
  autoFollow = true,
  className,
}: BuildLogStreamProps) {
  const [copied, setCopied] = useState(false);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAutoFollowing = useRef(autoFollow);

  const displayLogs = logs.slice(-maxLines);
  const filteredLogs = showErrorsOnly
    ? displayLogs.filter((l) => l.level === "error" || l.level === "warn")
    : displayLogs;

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current && isAutoFollowing.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [logs.length, scrollToBottom]);

  // Detect manual scroll away
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    isAutoFollowing.current = isAtBottom;
  }, []);

  const handleCopy = async () => {
    const text = filteredLogs.map((l) => l.message).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  if (!logs.length) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground py-2", className)}>
        <Terminal className="size-3" />
        <span>Waiting for logs...</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Terminal className="size-3 text-muted-foreground" />
          <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">
            Build Log ({displayLogs.length} lines)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowErrorsOnly(!showErrorsOnly)}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border transition-colors",
              showErrorsOnly
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-white/5 text-white/30 hover:text-white/60"
            )}
          >
            <Filter className="size-2.5" />
            {showErrorsOnly ? "Errors only" : "All"}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border border-white/5 text-white/30 hover:text-white/60 transition-colors"
          >
            {copied ? (
              <Check className="size-2.5 text-emerald-400" />
            ) : (
              <Copy className="size-2.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Log container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="bg-black/20 rounded-lg border border-white/5 overflow-y-auto font-mono text-[10px] leading-relaxed p-2"
        style={{ maxHeight }}
      >
        {filteredLogs.map((log, i) => (
          <div
            key={log.id || i}
            className={cn(
              "flex gap-2 py-px",
              LEVEL_COLORS[log.level || "info"]
            )}
          >
            {log.timestamp && (
              <span className="text-white/20 shrink-0 select-none">
                {log.timestamp}
              </span>
            )}
            {log.level && (
              <span
                className={cn(
                  "text-[8px] px-1 py-0.5 rounded shrink-0 self-start mt-0.5",
                  LEVEL_BADGES[log.level]
                )}
              >
                {log.level.toUpperCase()}
              </span>
            )}
            <span className="truncate">{log.message}</span>
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div className="text-white/20 italic p-2">No log entries to display</div>
        )}
        {!isAutoFollowing.current && displayLogs.length > 0 && (
          <button
            onClick={() => {
              isAutoFollowing.current = true;
              scrollToBottom();
            }}
            className="sticky bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-[9px] text-cyan-400"
          >
            ↓ Follow
          </button>
        )}
      </div>
    </div>
  );
}
