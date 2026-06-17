/**
 * app/admin/audit/page.tsx — CRM Action Audit Trail
 * Phase 31: Every CRM action is logged — this page shows the history.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  actionName: string;
  targetType: string;
  targetId: string;
  params: Record<string, unknown>;
  riskLevel: string;
  status: string;
  result?: Record<string, unknown>;
  errorMessage?: string;
  userId?: string;
  confirmedBy?: string;
  createdAt: string;
  executedAt?: string;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audit");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const filtered = entries.filter((e) => {
    if (riskFilter !== "all" && e.riskLevel !== riskFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return (
        e.actionName.toLowerCase().includes(q) ||
        e.targetId.toLowerCase().includes(q) ||
        (e.userId ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const riskColor = (risk: string) =>
    risk === "high"
      ? "text-red-400 bg-red-500/10 border-red-500/20"
      : risk === "medium"
        ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
        : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="size-3.5 text-emerald-400" />;
      case "failed":
        return <XCircle className="size-3.5 text-red-400" />;
      case "executing":
        return <RefreshCw className="size-3.5 text-cyan-400 animate-spin" />;
      default:
        return <Clock className="size-3.5 text-white/30" />;
    }
  };

  return (
    <div className="min-h-screen bg-sidebar p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="size-5 text-cyan-400" />
              CRM Audit Trail
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Every generative CRM action is logged here • Phase 31
            </p>
          </div>
          <button
            onClick={fetchAudit}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/30" />
            <input
              type="text"
              placeholder="Filter by action, target, user..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20"
            />
          </div>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/60"
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/60"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="executing">Executing</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: "Total", value: entries.length },
            {
              label: "Completed",
              value: entries.filter((e) => e.status === "completed").length,
            },
            {
              label: "Failed",
              value: entries.filter((e) => e.status === "failed").length,
            },
            {
              label: "High-Risk",
              value: entries.filter((e) => e.riskLevel === "high").length,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-center"
            >
              <p className="text-[10px] text-white/40">{stat.label}</p>
              <p className="text-lg font-semibold text-white/80">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-lg border border-white/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-white/40 w-8"></th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-white/40">Action</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-white/40">Target</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-white/40">Risk</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-white/40">Status</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-medium text-white/40">Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-white/30 text-sm">
                      {loading ? "Loading..." : "No audit entries found"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((entry) => (
                    <>
                      <tr
                        key={entry.id}
                        onClick={() =>
                          setExpandedId(expandedId === entry.id ? null : entry.id)
                        }
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          {expandedId === entry.id ? (
                            <ChevronDown className="size-3.5 text-white/30" />
                          ) : (
                            <ChevronRight className="size-3.5 text-white/30" />
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[12px] text-white/70">
                          {entry.actionName}
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-white/50 font-mono">
                          {entry.targetId.slice(0, 12)}...
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border",
                              riskColor(entry.riskLevel)
                            )}
                          >
                            {entry.riskLevel}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-[12px]">
                            {statusIcon(entry.status)}
                            <span className="text-white/50">{entry.status}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-[11px] text-white/30 font-mono">
                          {new Date(entry.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                      {/* Expanded detail row */}
                      {expandedId === entry.id && (
                        <tr key={`${entry.id}-detail`} className="bg-white/[0.01] border-b border-white/[0.04]">
                          <td colSpan={6} className="px-6 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                              <div>
                                <span className="text-white/30">Audit ID</span>
                                <p className="font-mono text-white/50 text-[10px]">{entry.id}</p>
                              </div>
                              <div>
                                <span className="text-white/30">User</span>
                                <p className="font-mono text-white/50 text-[10px]">{entry.userId || "—"}</p>
                              </div>
                              <div>
                                <span className="text-white/30">Confirmed By</span>
                                <p className="text-white/50">{entry.confirmedBy || "—"}</p>
                              </div>
                              <div className="col-span-2">
                                <span className="text-white/30">Params</span>
                                <pre className="font-mono text-white/40 text-[10px] mt-0.5 bg-black/20 rounded p-1.5 overflow-x-auto">
                                  {JSON.stringify(entry.params, null, 2)}
                                </pre>
                              </div>
                              {entry.errorMessage && (
                                <div className="col-span-2">
                                  <span className="text-red-400/60">Error</span>
                                  <p className="text-red-400 text-[11px]">{entry.errorMessage}</p>
                                </div>
                              )}
                              {entry.result && (
                                <div className="col-span-2">
                                  <span className="text-white/30">Result</span>
                                  <pre className="font-mono text-emerald-400/60 text-[10px] mt-0.5 bg-black/20 rounded p-1.5 overflow-x-auto">
                                    {JSON.stringify(entry.result, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[10px] text-white/20 text-center mt-4">
          Phase 31 • Audit Trail • {entries.length} actions recorded
        </p>
      </div>
    </div>
  );
}
