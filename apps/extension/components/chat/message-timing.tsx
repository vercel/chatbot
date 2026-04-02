"use client";

import { useMessageTiming } from "@assistant-ui/react";

export function MessageTiming() {
  const timing = useMessageTiming();

  if (!timing?.totalStreamTime) return null;

  const ttftMs = timing.firstTokenTime
    ? Math.max(0, timing.firstTokenTime - timing.streamStartTime)
    : null;
  const totalMs = Math.max(0, timing.totalStreamTime);
  const tps = timing.tokensPerSecond ? timing.tokensPerSecond.toFixed(1) : "—";

  return (
    <span
      title={`TTFT: ${ttftMs ?? "—"}ms • Total: ${totalMs}ms • Chunks: ${
        timing.totalChunks
      } • Tokens/s: ${tps}`}
      style={{ fontSize: 11, color: "#94a3b8" }}
    >
      ⏱ {totalMs}ms
    </span>
  );
}
