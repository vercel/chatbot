/**
 * DiscoveryRunInline — Twenty Generative UI Component (NEW)
 * Phase 39 Stream 2: Embed discovery engine into Twenty customer view.
 *
 * Allows agents to run mini-discovery workflows directly from a customer
 * record in Twenty CRM. Shows recent discovery results and lets them
 * trigger new runs for the current customer.
 *
 * Reuses Phase 38 Discovery Engine (lib/discovery/).
 */
"use client";

import React, { useState, useEffect } from "react";

interface DiscoveryRunInlineProps {
  personId: string;
  personName?: string;
  base44Id?: string;
}

interface DiscoveryRunSummary {
  runId: string;
  workflowName: string;
  status: "completed" | "running" | "failed";
  startedAt: string;
  completedAt?: string;
  misalignmentsFound: number;
  criticalCount: number;
  reportUrl?: string;
}

const WORKFLOW_TEMPLATES = [
  {
    id: "customer-360-deep-pull",
    name: "Customer 360 Deep Pull",
    description: "Pull all data sources for this customer",
    duration: "~30s",
    icon: "🔍",
  },
  {
    id: "find-misaligned-billing",
    name: "Billing Alignment Check",
    description: "Verify billing status across Base44 + NMI",
    duration: "~20s",
    icon: "💳",
  },
  {
    id: "audit-slack-tickets-last-7d",
    name: "Recent Activity Audit",
    description: "Check Slack mentions + tickets for last 7 days",
    duration: "~45s",
    icon: "📋",
  },
];

export function DiscoveryRunInline({
  personId,
  personName,
  base44Id,
}: DiscoveryRunInlineProps) {
  const [pastRuns, setPastRuns] = useState<DiscoveryRunSummary[]>([]);
  const [running, setRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<string>("");
  const [runResult, setRunResult] = useState<DiscoveryRunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);

  // Load past runs for this customer
  useEffect(() => {
    async function loadPastRuns() {
      try {
        const res = await fetch(`/api/discovery/runs?customerId=${base44Id || personId}`);
        if (res.ok) {
          const data = await res.json();
          setPastRuns(data.runs || []);
        }
      } catch {
        // Past runs not critical - silent fail
      } finally {
        setLoadingRuns(false);
      }
    }
    loadPastRuns();
  }, [personId, base44Id]);

  async function startDiscovery(workflowId: string) {
    setRunning(true);
    setRunProgress("Starting discovery...");
    setError(null);
    setRunResult(null);

    try {
      const res = await fetch("/api/discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId,
          config: {
            customerIds: [base44Id || personId],
            personName,
            source: "twenty-crm",
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Discovery API returned ${res.status}`);
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "step_progress") {
                setRunProgress(event.message || `${event.stepId}: ${event.percent}%`);
              } else if (event.type === "run_complete") {
                setRunResult({
                  runId: event.runId,
                  workflowName: workflowId,
                  status: "completed",
                  startedAt: new Date().toISOString(),
                  completedAt: new Date().toISOString(),
                  misalignmentsFound: event.misalignmentsFound || 0,
                  criticalCount: event.criticalCount || 0,
                  reportUrl: event.reportUrl,
                });
              } else if (event.type === "step_error") {
                setError(event.error || "Step failed");
              }
            } catch { /* skip unparseable events */ }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setRunning(false);
    }
  }

  // Show running state
  if (running) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <span className="animate-spin h-5 w-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Running Discovery</h3>
            <p className="text-xs text-gray-500 mt-0.5">{runProgress}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div className="bg-indigo-500 h-full rounded-full animate-pulse w-2/3" />
        </div>
      </div>
    );
  }

  // Show result
  if (runResult) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-lg">✓</span>
          <h3 className="text-sm font-semibold text-gray-900">Discovery Complete</h3>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-gray-500">Misalignments</span>
              <p className="font-bold text-gray-900">{runResult.misalignmentsFound}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Critical</span>
              <p className="font-bold text-red-600">{runResult.criticalCount}</p>
            </div>
          </div>
          {runResult.reportUrl && (
            <a
              href={runResult.reportUrl}
              target="_blank"
              rel="noopener"
              className="mt-2 inline-block text-xs text-indigo-600 hover:text-indigo-800 underline"
            >
              View full report →
            </a>
          )}
        </div>
        <button
          onClick={() => setRunResult(null)}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Run another discovery
        </button>
      </div>
    );
  }

  // Main view: past runs + start new
  return (
    <div className="p-4 space-y-4">
      {/* Start New Discovery */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Run Discovery for {personName || "Customer"}
        </h3>
        <div className="space-y-2">
          {WORKFLOW_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => startDiscovery(template.id)}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{template.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{template.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {template.duration}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Past Runs */}
      {!loadingRuns && pastRuns.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Past Discovery Runs ({pastRuns.length})
          </h3>
          <div className="space-y-1.5">
            {pastRuns.slice(0, 5).map((run) => (
              <a
                key={run.runId}
                href={run.reportUrl || `/discovery/${run.runId}`}
                target="_blank"
                rel="noopener"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className={
                    run.status === "completed" ? "text-green-500" :
                    run.status === "running" ? "text-blue-500 animate-pulse" :
                    "text-red-500"
                  }>
                    {run.status === "completed" ? "✓" :
                     run.status === "running" ? "⟳" : "✗"}
                  </span>
                  <span className="text-gray-700">
                    {run.workflowName?.replace(/-/g, " ") || "Discovery"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {run.misalignmentsFound > 0 && (
                    <span className="text-orange-600 font-medium">
                      {run.misalignmentsFound} issues
                    </span>
                  )}
                  <span>{new Date(run.startedAt).toLocaleDateString()}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loadingRuns && pastRuns.length === 0 && (
        <div className="text-center py-4 text-sm text-gray-400">
          No discovery runs yet for this customer.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          <p className="font-medium">Discovery failed</p>
          <p className="text-xs mt-1 text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs underline text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading past runs */}
      {loadingRuns && (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-8 bg-gray-100 rounded" />
          <div className="h-8 bg-gray-100 rounded" />
        </div>
      )}
    </div>
  );
}
