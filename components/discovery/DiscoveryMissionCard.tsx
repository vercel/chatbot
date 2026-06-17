/**
 * components/discovery/DiscoveryMissionCard.tsx — Phase 38.5 Stream 5
 *
 * Live Discovery Engine mission card that replaces the boring "running..."
 * message. Shows workflow steps with real-time progress via SSE.
 *
 * Connects to /api/discovery/sse for live updates.
 * Each step shows: pending → running → complete/failed/skipped
 * Click to expand and navigate to /discovery/[runId]
 */

"use client";

import React, { useState, useEffect, useRef } from "react";

interface DiscoveryStep {
  stepId: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface DiscoveryMissionCardProps {
  runId: string;
  workflowName: string;
  estimatedDuration?: string;
  sseUrl: string;
  confidence?: number;
  reasoning?: string;
  onComplete?: (findings: number, misalignments: number) => void;
}

const STEP_EMOJI: Record<string, string> = {
  pending: "⏳",
  running: "🔄",
  completed: "✅",
  failed: "❌",
  skipped: "⏭️",
};

const STEP_COLORS: Record<string, string> = {
  pending: "text-slate-300",
  running: "text-blue-500 animate-pulse",
  completed: "text-emerald-500",
  failed: "text-red-500",
  skipped: "text-slate-400",
};

export const DiscoveryMissionCard: React.FC<DiscoveryMissionCardProps> = ({
  runId,
  workflowName,
  estimatedDuration,
  sseUrl,
  confidence,
  reasoning,
  onComplete,
}) => {
  const [steps, setSteps] = useState<DiscoveryStep[]>([]);
  const [status, setStatus] = useState<string>("connecting");
  const [findings, setFindings] = useState(0);
  const [misalignments, setMisalignments] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!runId || !sseUrl) return;

    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.addEventListener("connected", () => {
      setConnected(true);
      setStatus("running");
    });

    es.addEventListener("step_start", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setSteps((prev) => {
          const existing = prev.find((s) => s.stepId === data.stepId);
          if (existing) {
            return prev.map((s) =>
              s.stepId === data.stepId
                ? { ...s, status: "running" as const, startedAt: data.timestamp }
                : s
            );
          }
          return [
            ...prev,
            {
              stepId: data.stepId || data.data?.stepId || "",
              name: data.data?.name || data.stepId || "",
              status: "running",
              startedAt: data.timestamp,
            },
          ];
        });
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener("step_progress", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const msg = data.data?.message || "";
        const current = data.data?.current;
        const total = data.data?.total;

        if (msg.includes("message")) {
          const match = msg.match(/(\d+)\s+messages?/);
          if (match) setMessageCount(Number.parseInt(match[1], 10));
        }
        if (msg.includes("customer") || msg.includes("Pulled")) {
          const match = msg.match(/(\d+)\s+customer/);
          if (match) setCustomerCount(Number.parseInt(match[1], 10));
        }
      } catch { /* ignore */ }
    });

    es.addEventListener("step_complete", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setSteps((prev) =>
          prev.map((s) =>
            s.stepId === (data.stepId || data.data?.stepId)
              ? { ...s, status: "completed", completedAt: data.timestamp }
              : s
          )
        );
        if (data.data?.result) {
          if (data.data.result.customerCount) {
            setCustomerCount(data.data.result.customerCount);
          }
          if (data.data.result.messageCount) {
            setMessageCount(data.data.result.messageCount);
          }
        }
      } catch { /* ignore */ }
    });

    es.addEventListener("step_error", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setSteps((prev) =>
          prev.map((s) =>
            s.stepId === (data.stepId || data.data?.stepId)
              ? {
                  ...s,
                  status: data.data?.recoverable ? "skipped" : "failed",
                  error: (data.data?.error as string) || "Step failed",
                }
              : s
          )
        );
      } catch { /* ignore */ }
    });

    es.addEventListener("run_complete", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setStatus("completed");
        setFindings(data.data?.customerCount || customerCount);
        setMisalignments(data.data?.misalignments || 0);
        onComplete?.(data.data?.customerCount || 0, data.data?.misalignments || 0);
      } catch { /* ignore */ }
    });

    es.addEventListener("run_error", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setStatus("failed");
        setError((data.data?.error as string) || "Run failed");
      } catch { /* ignore */ }
    });

    es.addEventListener("stream_end", () => {
      es.close();
    });

    es.onerror = () => {
      if (!connected) {
        setError("Failed to connect to event stream");
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId, sseUrl, connected, customerCount, onComplete]);

  const totalSteps = steps.length;
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="rounded-lg border-2 border-cyan-200 bg-gradient-to-br from-cyan-50/50 to-white p-4 my-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {status === "completed" ? "✅" : status === "failed" ? "❌" : "🔍"}
          </span>
          <span className="font-semibold text-slate-800 text-sm">
            Discovery: {workflowName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">#{runId}</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {status === "running" && totalSteps > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>
              Step {completedSteps + 1}/{totalSteps}
            </span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.max(progressPercent, 5)}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps */}
      {expanded && steps.length > 0 && (
        <div className="space-y-1 mb-3">
          {steps.map((step) => (
            <div
              key={step.stepId}
              className="flex items-center gap-2 text-xs py-1"
            >
              <span className={STEP_COLORS[step.status]}>
                {STEP_EMOJI[step.status]}
              </span>
              <span
                className={`flex-1 ${
                  step.status === "completed"
                    ? "text-slate-600"
                    : step.status === "running"
                    ? "text-blue-700 font-medium"
                    : step.status === "failed"
                    ? "text-red-600"
                    : "text-slate-400"
                }`}
              >
                {step.name}
              </span>
              {step.error && (
                <span className="text-red-400 text-xs truncate max-w-[120px]">
                  {step.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Live Stats */}
      <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
        {messageCount > 0 && <span>📨 {messageCount} messages</span>}
        {customerCount > 0 && <span>👤 {customerCount} customers</span>}
        {findings > 0 && <span>🔍 {findings} findings</span>}
        {misalignments > 0 && (
          <span className="text-amber-600 font-medium">
            ⚠️ {misalignments} misalignments
          </span>
        )}
        {estimatedDuration && status === "running" && (
          <span>⏱ ~{estimatedDuration}</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {confidence !== undefined && confidence > 0 && (
            <span className="text-xs text-slate-400">
              Confidence: {(confidence * 100).toFixed(0)}%
            </span>
          )}
          {connected && status === "running" && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === "completed" && (
            <a
              href={`/discovery/${runId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1 bg-cyan-600 text-white rounded-full hover:bg-cyan-700 transition-colors"
            >
              Open Full Report →
            </a>
          )}
          {status === "running" && (
            <button
              onClick={() => {
                eventSourceRef.current?.close();
                setStatus("cancelled");
              }}
              className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
          <div className="text-xs text-red-600">{error}</div>
        </div>
      )}
    </div>
  );
};

export default DiscoveryMissionCard;
