"use client";

/**
 * StopButton — Always-visible sticky stop button for chat header.
 *
 * Visible only during streaming. Calls AbortController + POST /api/chat/abort
 * + POST /api/v2-bridge/cancel to fully stop server-side work.
 *
 * US-3: There's ALWAYS a 'Stop' button visible (top-right header, sticky)
 * that aborts the current stream + cancels any in-flight V2 session.
 */

import { SquareIcon, Loader2Icon } from "lucide-react";
import React, { useCallback, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StopButtonProps {
  /** Whether the chat is currently streaming */
  isStreaming: boolean;
  /** The chat ID for abort requests */
  chatId?: string;
  /** The V2 session ID (if active) */
  v2SessionId?: string;
  /** Callback after stop completes */
  onStopped?: () => void;
  className?: string;
}

export function StopButton({
  isStreaming,
  chatId,
  v2SessionId,
  onStopped,
  className,
}: StopButtonProps) {
  const [stopping, setStopping] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleStop = useCallback(async () => {
    if (stopping) return;
    setStopping(true);

    try {
      // 1. Abort local stream
      if (abortRef.current) {
        abortRef.current.abort("User stopped generation");
      }

      // 2. Abort chat stream on server
      if (chatId) {
        fetch("/api/chat/abort", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId }),
        }).catch(() => {
          // Best effort
        });
      }

      // 3. Cancel V2 bridge session if active
      if (v2SessionId) {
        fetch(`/api/v2-bridge/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: v2SessionId }),
        }).catch(() => {
          // Best effort
        });
      }
    } finally {
      setStopping(false);
      onStopped?.();
    }
  }, [chatId, v2SessionId, onStopped, stopping]);

  // Register abort controller when streaming starts
  React.useEffect(() => {
    if (isStreaming && !abortRef.current) {
      abortRef.current = new AbortController();
    }
    if (!isStreaming) {
      abortRef.current = null;
    }
  }, [isStreaming]);

  if (!isStreaming) return null;

  return (
    <Button
      className={cn(
        "gap-1.5 bg-red-600 hover:bg-red-700 text-white shadow-md transition-all animate-in fade-in zoom-in-95",
        stopping && "opacity-50",
        className
      )}
      disabled={stopping}
      onClick={handleStop}
      size="sm"
      variant="destructive"
    >
      {stopping ? (
        <Loader2Icon className="size-3.5 animate-spin" />
      ) : (
        <SquareIcon className="size-3.5" />
      )}
      <span className="hidden sm:inline text-xs font-medium">
        {stopping ? "Stopping…" : "Stop"}
      </span>
    </Button>
  );
}
