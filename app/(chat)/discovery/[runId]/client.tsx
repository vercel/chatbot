/**
 * discovery/[runId]/client.tsx — Run detail with live progress + report viewer.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  Layers,
  AlertTriangle,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DiscoveryLiveProgress from "@/app/discovery/DiscoveryLiveProgress";
import DiscoveryReportViewer from "@/app/discovery/DiscoveryReportViewer";
import DiscoveryActionPanel from "@/app/discovery/DiscoveryActionPanel";
import { useDiscoverySSE, useDiscoveryPolling } from "@/app/discovery/useDiscoverySSE";

interface RunDetail {
  run: {
    id: string;
    workflowId: string;
    status: "pending" | "running" | "completed" | "failed";
    startedAt: string;
    completedAt?: string;
    steps: Array<{
      stepId: string;
      status: "pending" | "running" | "completed" | "failed" | "skipped";
      error?: string;
    }>;
    error?: string;
  };
  lastEvent?: {
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
  };
}

export function RunDetailClient({
  runId,
  hasSession,
}: {
  runId: string;
  hasSession: boolean;
}) {
  const [runData, setRunData] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // SSE for live progress
  const sse = useDiscoverySSE({
    runId,
    enabled: hasSession,
    onComplete: () => fetchRunData(),
  });

  // Polling fallback
  const polling = useDiscoveryPolling(runId, 3000);

  const fetchRunData = useCallback(async () => {
    try {
      const res = await fetch(`/api/discovery/run?id=${encodeURIComponent(runId)}`);
      if (res.ok) {
        const data = await res.json();
        setRunData(data);
      }
    } catch { /* silent */ }
  }, [runId]);

  useEffect(() => {
    if (!hasSession) return;
    setLoading(true);
    fetchRunData().finally(() => setLoading(false));
  }, [hasSession, fetchRunData]);

  // Poll status if running
  useEffect(() => {
    if (!runData || runData.run.status === "completed" || runData.run.status === "failed") return;
    const interval = setInterval(fetchRunData, 3000);
    return () => clearInterval(interval);
  }, [runData, fetchRunData]);

  if (!hasSession) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Sign in to view run details</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const run = runData?.run;
  const isRunning = run?.status === "running" || run?.status === "pending";
  const isCompleted = run?.status === "completed" || run?.status === "failed";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Link href="/discovery">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Discovery
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {run && (
        <>
          {/* Run header */}
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold">{run.workflowId}</h1>
                <p className="text-sm text-muted-foreground font-mono">{run.id}</p>
              </div>
              <StatusBadge status={run.status} />
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Started {new Date(run.startedAt).toLocaleTimeString()}
              </span>
              {run.completedAt && (
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {formatElapsed(run.startedAt, run.completedAt)}
                </span>
              )}
              <span className="flex items-center gap-1">
                {run.steps.filter((s) => s.status === "completed").length}/{run.steps.length} steps
              </span>
            </div>

            {run.error && (
              <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-950/20 text-xs text-red-700 dark:text-red-300">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                {run.error}
              </div>
            )}
          </div>

          {/* Live progress (during execution) */}
          {isRunning && sse.connected && (
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10">
              <DiscoveryLiveProgress
                events={sse.events}
                isComplete={sse.isComplete}
                error={sse.error}
              />
            </div>
          )}

          {/* Progress or report toggle */}
          {isRunning && !sse.connected && (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Waiting for live progress...</span>
            </div>
          )}

          {/* Report viewer (completed runs) */}
          {isCompleted && (
            <DiscoveryReportViewer runId={runId} />
          )}
        </>
      )}

      {!run && !loading && (
        <div className="text-center py-16 space-y-3">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/20" />
          <p className="text-muted-foreground text-sm">Run not found: {runId}</p>
          <Link href="/discovery">
            <Button variant="secondary" size="sm">Back to Discovery</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    running: { label: "Running", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
    failed: { label: "Failed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  };
  const c = config[status] || config.pending;
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", c.className)}>
      {c.label}
    </span>
  );
}

function formatElapsed(start: string, end: string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
