/**
 * Phase 23B: /library/handoffs — V2 Handoff Sessions Page
 *
 * Shows all coding sessions started from chat via spawnCodingAgent.
 * Each card shows: status, source chat, mode badge, target repo,
 * live event counter, and action buttons.
 *
 * Reuses Phase 22 glass card design patterns.
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface V2Handoff {
  id: string;
  v2SessionId: string;
  handoffMode: string;
  targetRepo: string | null;
  goal: string;
  status: string;
  streamUrl: string | null;
  resultUrl: string | null;
  errorMessage: string | null;
  eventCount: number;
  startedAt: string;
  endedAt: string | null;
}

interface Aggregates {
  running: number;
  completed: number;
  failed: number;
}

const STATUS_ICONS: Record<string, string> = {
  pending: "⏳",
  running: "🔴",
  completed: "✅",
  failed: "❌",
  cancelled: "⏹️",
};

const MODE_LABELS: Record<string, string> = {
  new_project: "New Project",
  modify_existing: "Modify Existing",
  investigation: "Investigation",
};

export default function V2HandoffsPage() {
  const [handoffs, setHandoffs] = useState<V2Handoff[]>([]);
  const [aggregates, setAggregates] = useState<Aggregates>({
    running: 0,
    completed: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchHandoffs = useCallback(async () => {
    try {
      const res = await fetch("/api/v2-handoffs?limit=50");
      const data = await res.json();
      setHandoffs(data.handoffs || []);
      setAggregates(data.aggregates || { running: 0, completed: 0, failed: 0 });
    } catch (err) {
      console.error("Failed to fetch handoffs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHandoffs();
    // Poll every 15s for live updates
    const interval = setInterval(fetchHandoffs, 15000);
    return () => clearInterval(interval);
  }, [fetchHandoffs]);

  async function stopHandoff(id: string) {
    try {
      await fetch(`/api/v2-handoffs/${id}/stop`, { method: "POST" });
      fetchHandoffs();
    } catch (err) {
      console.error("Failed to stop handoff:", err);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-emerald-950/20 to-stone-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/library"
            className="text-emerald-400 text-sm hover:text-emerald-300 transition-colors mb-2 inline-block"
          >
            ← Back to Library
          </Link>
          <h1 className="text-3xl font-bold text-white mt-2">V2 Handoffs</h1>
          <p className="text-stone-400 mt-1">
            Coding sessions started from chat. Track live progress and results.
          </p>
        </div>

        {/* Aggregate Stats */}
        <div className="flex gap-4 mb-6">
          <div className="glass-card rounded-xl p-4 flex-1">
            <div className="text-2xl font-bold text-emerald-400">{aggregates.running}</div>
            <div className="text-stone-400 text-sm">Running</div>
          </div>
          <div className="glass-card rounded-xl p-4 flex-1">
            <div className="text-2xl font-bold text-green-400">{aggregates.completed}</div>
            <div className="text-stone-400 text-sm">Completed</div>
          </div>
          <div className="glass-card rounded-xl p-4 flex-1">
            <div className="text-2xl font-bold text-red-400">{aggregates.failed}</div>
            <div className="text-stone-400 text-sm">Failed</div>
          </div>
        </div>

        {/* Handoff Cards */}
        {loading ? (
          <div className="text-stone-400 text-center py-12">Loading handoffs...</div>
        ) : handoffs.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-stone-400">No V2 handoffs yet.</p>
            <p className="text-stone-500 text-sm mt-1">
              Start a coding task from chat and deploy it via V2 to see it here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {handoffs.map((handoff) => (
              <div
                key={handoff.id}
                className="glass-card rounded-xl p-5 transition-all hover:border-emerald-500/30 border border-stone-700/30"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    {/* Status + Name */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{STATUS_ICONS[handoff.status] || "❓"}</span>
                      <span className="font-semibold text-white truncate">
                        {handoff.goal.slice(0, 80)}
                        {handoff.goal.length > 80 ? "..." : ""}
                      </span>
                      {handoff.status === "running" && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400 animate-pulse">
                          LIVE
                        </span>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-3 text-sm text-stone-400">
                      <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300">
                        {MODE_LABELS[handoff.handoffMode] || handoff.handoffMode}
                      </span>
                      {handoff.targetRepo && (
                        <span className="font-mono text-xs text-emerald-400/80">
                          {handoff.targetRepo}
                        </span>
                      )}
                      {handoff.eventCount > 0 && (
                        <span>{handoff.eventCount} events</span>
                      )}
                      <span>
                        {new Date(handoff.startedAt).toLocaleString()}
                      </span>
                    </div>

                    {/* Error message */}
                    {handoff.errorMessage && (
                      <div className="mt-2 text-sm text-red-400 bg-red-400/5 rounded px-3 py-1.5 border border-red-400/20">
                        {handoff.errorMessage}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    {handoff.v2SessionId && (
                      <a
                        href={`https://neptune-v2.vercel.app/agent-sessions/${handoff.v2SessionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 text-sm hover:bg-emerald-600/30 transition-colors"
                      >
                        Open in V2 ↗
                      </a>
                    )}
                    {handoff.status === "completed" && handoff.resultUrl && (
                      <a
                        href={handoff.resultUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-stone-700/50 text-stone-300 text-sm hover:bg-stone-700 transition-colors"
                      >
                        View Result ↗
                      </a>
                    )}
                    {handoff.status === "failed" && (
                      <button
                        onClick={() => fetchHandoffs()}
                        className="px-3 py-1.5 rounded-lg bg-amber-600/20 text-amber-400 text-sm hover:bg-amber-600/30 transition-colors"
                      >
                        Retry
                      </button>
                    )}
                    {handoff.status === "running" && (
                      <button
                        onClick={() => stopHandoff(handoff.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 text-sm hover:bg-red-600/30 transition-colors"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
