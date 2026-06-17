"use client";

/**
 * /missions/[id] — Client Component
 *
 * Fetches mission data via API, subscribes to SSE stream,
 * renders AutonomousMissionCard + StreamProgress components.
 *
 * Phase 38: Autonomous Coding Platform
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FADE_UP, SPRING_GENTLE } from "@/lib/motion/springs";
import { AutonomousMissionCard } from "@/components/autonomous/MissionCard";
import { StreamProgress } from "@/components/autonomous/stream-progress";
import type {
  AutonomousMissionStatus,
  StreamProgressData,
} from "@/components/autonomous/MissionCard";
import type { StreamStep } from "@/components/autonomous/stream-progress";
import type { MissionEvent } from "@/lib/autonomous-mission/runner";

interface MissionDetailClientProps {
  missionId: string;
  user: {
    id?: string;
    name?: string | null;
    email?: string;
  };
}

interface MissionData {
  title: string;
  status: string;
  steps: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    evidence: string[];
    childCards: unknown[];
  }>;
  currentState: string;
  v2SessionId?: string;
  result?: Record<string, unknown>;
  estimatedCost?: string;
  estimatedTimeMin?: number;
  completedAt?: string;
  createdAt?: string;
}

export function MissionDetailClient({ missionId }: MissionDetailClientProps) {
  const router = useRouter();
  const [mission, setMission] = useState<MissionData | null>(null);
  const [events, setEvents] = useState<MissionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Parse mission data into stream progress
  const parseStreams = useCallback((): StreamProgressData[] => {
    if (!mission?.steps) return [];

    // Group steps by their first evidence label (stream name)
    const streamMap = new Map<string, {
      steps: typeof mission.steps;
      streamName: string;
    }>();

    for (const step of mission.steps) {
      const streamName = step.evidence?.[0] || "Unnamed Stream";
      if (!streamMap.has(streamName)) {
        streamMap.set(streamName, { steps: [], streamName });
      }
      streamMap.get(streamName)!.steps.push(step);
    }

    return Array.from(streamMap.entries()).map(([name, group], idx) => {
      const totalSteps = group.steps.length;
      const completedSteps = group.steps.filter(
        s => s.status === "complete",
      ).length;
      const failedSteps = group.steps.filter(
        s => s.status === "failed",
      ).length;

      let streamStatus: StreamProgressData["status"] = "pending";
      if (failedSteps > 0 && completedSteps + failedSteps >= totalSteps) {
        streamStatus = "failed";
      } else if (completedSteps >= totalSteps) {
        streamStatus = "complete";
      } else if (completedSteps > 0 || mission.status === "running") {
        streamStatus = "running";
      }

      const runningStep = group.steps.find(s => s.status === "running");

      return {
        streamId: `stream-${idx + 1}`,
        name: group.streamName,
        status: streamStatus,
        totalSteps,
        completedSteps,
        currentStep: runningStep?.name,
      };
    });
  }, [mission]);

  // Parse steps for stream detail view
  const parseStreamSteps = useCallback(
    (streamName: string): StreamStep[] => {
      if (!mission?.steps) return [];

      return mission.steps
        .filter(s => (s.evidence?.[0] || "Unnamed Stream") === streamName)
        .map(s => ({
          id: s.id,
          type: (s.type as StreamStep["type"]) || "create_file",
          description: s.name,
          status: (s.status as StreamStep["status"]) || "pending",
          filePath: s.evidence?.[1],
        }));
    },
    [mission],
  );

  // Fetch mission data
  useEffect(() => {
    let cancelled = false;

    async function fetchMission() {
      try {
        const res = await fetch(`/api/missions/${missionId}`);
        if (!res.ok) throw new Error(`Failed to fetch mission: ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setMission(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    }

    fetchMission();

    return () => { cancelled = true; };
  }, [missionId]);

  // Subscribe to SSE
  useEffect(() => {
    const eventSource = new EventSource(`/api/missions/${missionId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "init":
          case "step_update":
            if (data.steps) {
              setMission(prev =>
                prev ? { ...prev, steps: data.steps } : prev,
              );
            }
            if (data.status) {
              setMission(prev =>
                prev ? { ...prev, status: data.status } : prev,
              );
            }
            break;

          case "status_change":
            setMission(prev =>
              prev ? { ...prev, status: data.status } : prev,
            );
            break;

          case "mission_event":
            setEvents(prev => [
              ...prev,
              {
                type: data.eventType as MissionEvent["type"],
                missionId,
                timestamp: data.createdAt || new Date().toISOString(),
                data: data.payload,
                message: data.eventType,
              },
            ].slice(-200)); // Keep last 200 events
            break;

          case "completed":
            setMission(prev =>
              prev
                ? {
                    ...prev,
                    status: data.status,
                    result: data.result,
                    completedAt: data.completedAt,
                  }
                : prev,
            );
            eventSource.close();
            break;

          case "heartbeat":
            // Connection alive
            break;

          case "error":
            console.warn("[SSE Error]", data.message);
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      // Reconnect after 3s
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSource.close();
        }
      }, 3000);
    };

    sseRef.current = eventSource;

    return () => {
      eventSource.close();
    };
  }, [missionId]);

  // Intervention handlers
  const handleIntervention = useCallback(
    async (command: Record<string, unknown>) => {
      try {
        await fetch(`/api/missions/${missionId}/control`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
      } catch (err) {
        console.error("Intervention failed:", err);
      }
    },
    [missionId],
  );

  // ─── Loading State ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 text-cyan-400 animate-spin" />
          <span className="text-sm text-white/40">Loading mission...</span>
        </div>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────────────────

  if (error || !mission) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertTriangle className="size-8 text-red-400" />
          <h2 className="text-lg font-semibold text-white/80">
            Mission Not Found
          </h2>
          <p className="text-sm text-white/40">
            {error || "The requested mission could not be loaded."}
          </p>
          <button
            onClick={() => router.push("/command-center")}
            className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/70 hover:bg-white/[0.08] transition-colors"
          >
            Back to Command Center
          </button>
        </div>
      </div>
    );
  }

  const streams = parseStreams();
  const isTerminal = ["completed", "failed", "aborted"].includes(
    mission.status?.toLowerCase() || "",
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-dvh w-full overflow-y-auto bg-background"
    >
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/command-center")}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-white/90 truncate max-w-[400px]">
                {mission.title}
              </h1>
              <p className="text-[10px] text-white/40">
                {streams.length} streams ·{" "}
                {streams.reduce((s, st) => s + st.totalSteps, 0)} steps
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isTerminal && (
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/60 hover:bg-white/[0.08] transition-colors"
              >
                <RefreshCw className="size-3" />
                Refresh
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Mission card + intervention */}
          <div className="lg:col-span-1 space-y-4">
            <AutonomousMissionCard
              missionId={missionId}
              title={mission.title}
              status={(mission.status?.toUpperCase() || "PROPOSED") as AutonomousMissionStatus}
              streams={streams}
              events={events}
              deployUrl={
                mission.result &&
                typeof mission.result === "object" &&
                "url" in mission.result
                  ? (mission.result as Record<string, string>).url
                  : undefined
              }
              commitSha={
                mission.result &&
                typeof mission.result === "object" &&
                "commitSha" in mission.result
                  ? (mission.result as Record<string, string>).commitSha
                  : undefined
              }
              branch={mission.v2SessionId?.startsWith("branch:")
                ? mission.v2SessionId.replace("branch:", "")
                : undefined}
              error={
                mission.result &&
                typeof mission.result === "object" &&
                "error" in mission.result
                  ? (mission.result as Record<string, string>).error
                  : undefined
              }
              startedAt={mission.createdAt}
              onPause={() => handleIntervention({ type: "pause" })}
              onResume={() => handleIntervention({ type: "resume" })}
              onInject={(instruction) =>
                handleIntervention({ type: "inject", instruction })
              }
              onAbort={() =>
                handleIntervention({
                  type: "abort",
                  reason: "User aborted from detail page",
                })
              }
            />
          </div>

          {/* Right column: Streams detail */}
          <div className="lg:col-span-2 space-y-4">
            {streams.length === 0 ? (
              <div className="flex items-center justify-center h-64 rounded-xl border border-white/[0.06] bg-white/[0.01]">
                <div className="text-center">
                  <Loader2 className="size-6 text-cyan-400 animate-spin mx-auto mb-2" />
                  <p className="text-[12px] text-white/40">
                    Waiting for stream data...
                  </p>
                </div>
              </div>
            ) : (
              streams.map((stream) => (
                <StreamProgress
                  key={stream.streamId}
                  streamId={stream.streamId}
                  name={stream.name}
                  budget={5000} // default, PRD-based budget would come from execution plan
                  budgetUsed={stream.completedSteps * 500}
                  status={stream.status}
                  steps={parseStreamSteps(stream.name)}
                  onRetry={(streamId) =>
                    handleIntervention({
                      type: "retry_stream",
                      streamId,
                    })
                  }
                  onSkip={(streamId) =>
                    handleIntervention({
                      type: "skip_stream",
                      streamId,
                    })
                  }
                />
              ))
            )}

            {/* Completed state */}
            {isTerminal && (
              <div
                className={cn(
                  "p-6 rounded-xl border text-center",
                  mission.status === "completed"
                    ? "border-emerald-500/20 bg-emerald-500/[0.02]"
                    : "border-red-500/20 bg-red-500/[0.02]",
                )}
              >
                <h3 className="text-sm font-semibold text-white/80 mb-1">
                  {mission.status === "completed"
                    ? "Mission Complete"
                    : "Mission Ended"}
                </h3>
                <p className="text-[11px] text-white/40">
                  {mission.status === "completed"
                    ? "All streams executed successfully."
                    : "The mission encountered an error and could not complete."}
                </p>
                {mission.result && (
                  <pre className="mt-3 p-3 rounded bg-black/20 border border-white/[0.04] text-[10px] text-white/40 font-mono text-left max-h-[200px] overflow-y-auto">
                    {JSON.stringify(mission.result, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
