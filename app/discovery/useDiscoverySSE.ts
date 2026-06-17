/**
 * app/discovery/useDiscoverySSE.ts
 * Hook for streaming discovery run progress via Server-Sent Events.
 *
 * Usage:
 *   const { events, connected, error } = useDiscoverySSE(runId);
 *
 * Events arrive as { type, stepId?, data, timestamp } and are accumulated
 * in an array. The hook auto-disconnects on terminal events.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface DiscoveryEvent {
  type: "step_start" | "step_progress" | "step_complete" | "step_error" | "step_skip" | "run_complete" | "run_error" | "connected" | "stream_end" | "stream_timeout";
  runId: string;
  stepId?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

interface UseDiscoverySSEOptions {
  runId: string | null;
  onComplete?: (events: DiscoveryEvent[]) => void;
  onError?: (error: string) => void;
  enabled?: boolean;
}

export function useDiscoverySSE({
  runId,
  onComplete,
  onError,
  enabled = true,
}: UseDiscoverySSEOptions) {
  const [events, setEvents] = useState<DiscoveryEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const addEvent = useCallback((event: DiscoveryEvent) => {
    setEvents((prev) => [...prev, event]);
  }, []);

  useEffect(() => {
    if (!runId || !enabled) return;

    // Reset state for new run
    setEvents([]);
    setConnected(false);
    setError(null);
    setIsComplete(false);

    const url = `/api/discovery/sse?runId=${encodeURIComponent(runId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("connected", (e) => {
      try {
        const data = JSON.parse(e.data);
        addEvent({ type: "connected", runId: data.runId, data, timestamp: new Date().toISOString() });
        setConnected(true);
      } catch { /* ignore parse errors */ }
    });

    const eventTypes = [
      "step_start", "step_progress", "step_complete",
      "step_error", "step_skip", "run_complete", "run_error",
    ];

    for (const type of eventTypes) {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          addEvent(parsed as DiscoveryEvent);

          if (type === "run_complete") {
            setIsComplete(true);
            onComplete?.([...events, parsed as DiscoveryEvent]);
          }
          if (type === "run_error") {
            setError(parsed.data?.error as string || "Run failed");
            setIsComplete(true);
            onError?.(parsed.data?.error as string || "Run failed");
          }
        } catch { /* ignore parse errors */ }
      });
    }

    es.addEventListener("stream_end", () => {
      es.close();
      setConnected(false);
    });

    es.addEventListener("stream_timeout", (e) => {
      try {
        const data = JSON.parse(e.data);
        setError(data.message || "Run timed out");
      } catch { /* ignore */ }
      es.close();
      setConnected(false);
    });

    es.onerror = () => {
      // EventSource auto-reconnects; only set error if it was never connected
      if (!connected) {
        setError("Failed to connect to event stream");
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, enabled]);

  // Compute current step progress from events
  const currentStep = events
    .filter((e) => e.type === "step_start" || e.type === "step_complete" || e.type === "step_error")
    .slice(-1)[0]?.data as { stepId?: string; name?: string; currentStep?: number; totalSteps?: number } | undefined;

  const stepProgress = events
    .filter((e) => e.type === "step_progress")
    .slice(-1)[0]?.data as { current?: number; total?: number; message?: string; percent?: number } | undefined;

  return {
    events,
    connected,
    error,
    isComplete,
    currentStep,
    stepProgress,
  };
}

// Polling fallback for browsers without EventSource
export function useDiscoveryPolling(runId: string | null, intervalMs = 2000) {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!runId) return;

    let active = true;

    async function poll() {
      if (!active) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/discovery/run?id=${encodeURIComponent(runId)}`);
        if (res.ok) {
          const data = await res.json();
          if (active) setStatus(data);
        }
      } catch {
        // Silently retry next interval
      } finally {
        if (active) setLoading(false);
      }
    }

    poll();
    const interval = setInterval(poll, intervalMs);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [runId, intervalMs]);

  return { status, loading };
}
