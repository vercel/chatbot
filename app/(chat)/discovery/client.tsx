/**
 * discovery/client.tsx — Client-side discovery dashboard.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Zap,
  History,
  Plus,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import DiscoveryWorkflowPicker from "@/app/discovery/DiscoveryWorkflowPicker";
import DiscoveryRunCard from "@/app/discovery/DiscoveryRunCard";
import DiscoveryLiveProgress from "@/app/discovery/DiscoveryLiveProgress";
import { useDiscoverySSE } from "@/app/discovery/useDiscoverySSE";
import { useRouter } from "next/navigation";

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  steps: { id: string; name: string; type: string }[];
  estimatedDuration: string;
  outputs: string[];
}

interface RunData {
  id: string;
  workflowId: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  steps: Array<{
    stepId: string;
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    name?: string;
    error?: string;
  }>;
  error?: string;
}

export function DiscoveryClient({ hasSession }: { hasSession: boolean }) {
  const router = useRouter();
  const [view, setView] = useState<"picker" | "runs">("picker");
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);

  // SSE hook for active run
  const sse = useDiscoverySSE({
    runId: activeRunId,
    enabled: !!activeRunId,
    onComplete: () => {
      fetchRuns(); // Refresh run list on completion
    },
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discovery/run");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setTemplates(data.templates || []);
      setRuns(data.runs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/discovery/run");
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (hasSession) fetchData();
  }, [hasSession, fetchData]);

  // Poll for run updates every 5s when we have active runs
  useEffect(() => {
    const hasActive = runs.some((r) => r.status === "running" || r.status === "pending");
    if (!hasActive) return;
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, [runs, fetchRuns]);

  const handleRun = async (template: WorkflowTemplate) => {
    setRunLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: template.id }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to start run");
      }
      const data = await res.json();
      setActiveRunId(data.runId);
      setView("runs");
      await fetchRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start run");
    } finally {
      setRunLoading(false);
    }
  };

  const handleSelectRun = (runId: string) => {
    router.push(`/discovery/${runId}`);
  };

  const activeRuns = runs.filter((r) => r.status === "running" || r.status === "pending");
  const completedRuns = runs.filter((r) => r.status === "completed" || r.status === "failed");

  if (!hasSession) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Search className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">Sign in to use Discovery Workflows</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Discovery Workflows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Audit Slack, cross-reference CRM, find misalignments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={view === "picker" ? "secondary" : "ghost"}
            onClick={() => setView("picker")}
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
          <Button
            size="sm"
            variant={view === "runs" ? "secondary" : "ghost"}
            onClick={() => setView("runs")}
          >
            <History className="h-4 w-4 mr-1" />
            Runs
            {activeRuns.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px]">
                {activeRuns.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Live progress for active run */}
      {activeRunId && sse.connected && !sse.isComplete && (
        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10">
          <DiscoveryLiveProgress
            events={sse.events}
            isComplete={sse.isComplete}
            error={sse.error}
          />
        </div>
      )}

      {/* View: Picker */}
      {view === "picker" && (
        <>
          {selectedTemplate && (
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>
                ← Back to all templates
              </Button>
              <span className="text-sm font-medium text-muted-foreground">
                {selectedTemplate.name}
              </span>
            </div>
          )}
          <DiscoveryWorkflowPicker
            templates={templates}
            onSelect={setSelectedTemplate}
            onRun={handleRun}
            loading={runLoading}
            activeRunId={activeRunId}
          />
        </>
      )}

      {/* View: Runs */}
      {view === "runs" && (
        <div className="space-y-6">
          {/* Active runs */}
          {activeRuns.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500" />
                Active Runs ({activeRuns.length})
              </h2>
              {activeRuns.map((run) => {
                const template = templates.find((t) => t.id === run.workflowId);
                return (
                  <DiscoveryRunCard
                    key={run.id}
                    runId={run.id}
                    workflowName={template?.name || run.workflowId}
                    status={run.status}
                    startedAt={run.startedAt}
                    completedAt={run.completedAt}
                    steps={run.steps.map((s) => ({
                      ...s,
                      name: template?.steps.find((ts) => ts.id === s.stepId)?.name,
                    }))}
                    onClick={() => handleSelectRun(run.id)}
                  />
                );
              })}
            </div>
          )}

          {/* Completed runs */}
          {completedRuns.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Completed Runs ({completedRuns.length})
              </h2>
              {completedRuns.map((run) => {
                const template = templates.find((t) => t.id === run.workflowId);
                return (
                  <DiscoveryRunCard
                    key={run.id}
                    runId={run.id}
                    workflowName={template?.name || run.workflowId}
                    status={run.status}
                    startedAt={run.startedAt}
                    completedAt={run.completedAt}
                    steps={run.steps.map((s) => ({
                      ...s,
                      name: template?.steps.find((ts) => ts.id === s.stepId)?.name,
                    }))}
                    onClick={() => handleSelectRun(run.id)}
                  />
                );
              })}
            </div>
          )}

          {activeRuns.length === 0 && completedRuns.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <Search className="h-12 w-12 mx-auto text-muted-foreground/20" />
              <p className="text-muted-foreground text-sm">No runs yet</p>
              <Button variant="secondary" size="sm" onClick={() => setView("picker")}>
                <Plus className="h-4 w-4 mr-1" />
                Start a Discovery Run
              </Button>
            </div>
          )}

          {/* Refresh button */}
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={fetchRuns} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Local import to avoid circular
import { cn } from "@/lib/utils";
