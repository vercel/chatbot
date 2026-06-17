/**
 * app/admin/audit/page.tsx — CRM Action Audit Trail
 * Phase 31+32: Every CRM action is logged — this page shows the history with polish.
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
  Download,
  Calendar,
  Filter,
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
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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

  // Compute unique action types for dropdown
  const actionTypes = Array.from(new Set(entries.map((e) => e.actionName))).sort();

  const filtered = entries.filter((e) => {
    if (riskFilter !== "all" && e.riskLevel !== riskFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (actionFilter !== "all" && e.actionName !== actionFilter) return false;
    if (dateFrom && new Date(e.createdAt) < new Date(dateFrom)) return false;
    if (dateTo && new Date(e.createdAt) > new Date(dateTo + "T23:59:59")) return false;
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

  // Export CSV
  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ["id", "actionName", "targetType", "targetId", "riskLevel", "status", "userId", "createdAt"];
    const rows = filtered.map((e) =>
      [e.id, e.actionName, e.targetType, e.targetId, e.riskLevel, e.status, e.userId || "", e.createdAt]
        .map((v) => `"${v}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Loading skeleton
  if (loading && entries.length === 0) {
    return (
      <div className="min-h-screen bg-sidebar p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-white/[0.04] rounded" />
            <div className="h-4 w-64 bg-white/[0.02] rounded" />
            <div className="h-10 bg-white/[0.04] rounded-lg" />
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-white/[0.02] rounded-lg" />
              ))}
            </div>
            <div className="h-64 bg-white/[0.02] rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

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
              Every generative CRM action is logged here • Phase 32
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 hover:bg-white/[0.08] disabled:opacity-30 transition-colors"
            >
              <Download className="size-3.5" />
              Export CSV
            </button>
            <button
              onClick={fetchAudit}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/30" />
            <input
              type="text"
              placeholder="Search by action, Person ID, user..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20"
            />
          </div>

          {/* Action Type Filter (Phase 32) */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/60"
          >
            <option value="all">All Actions</option>
            {actionTypes.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

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

          {/* Date Range (Phase 32) */}
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-white/30" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 w-[130px]"
            />
            <span className="text-white/20 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 w-[130px]"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="px-2 py-1.5 text-[10px] text-white/30 hover:text-white/60 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center gap-2">
            <AlertTriangle className="size-4" />
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: "Total", value: entries.length },
            { label: "Completed", value: entries.filter((e) => e.status === "completed").length },
            { label: "Failed", value: entries.filter((e) => e.status === "failed").length },
            { label: "High-Risk", value: entries.filter((e) => e.riskLevel === "high").length },
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

        {/* Results count */}
        {filtered.length !== entries.length && (
          <p className="text-[10px] text-white/30 mb-2">
            Showing {filtered.length} of {entries.length} entries
            {(dateFrom || dateTo || actionFilter !== "all" || riskFilter !== "all" || statusFilter !== "all") &&
              " (filtered)"}
          </p>
        )}

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
                      {loading ? "Loading..." : (
                        <div className="flex flex-col items-center gap-2">
                          <Filter className="size-5 text-white/10" />
                          No audit entries found
                          {(dateFrom || dateTo || actionFilter !== "all" || riskFilter !== "all" || statusFilter !== "all") &&
                            <span className="text-[10px]">Try adjusting your filters</span>}
                        </div>
                      )}
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
                          <span title={entry.targetId}>
                            {entry.targetId?.slice(0, 14) || "—"}...
                          </span>
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
                              <div>
                                <span className="text-white/30">Executed At</span>
                                <p className="font-mono text-white/50 text-[10px]">
                                  {entry.executedAt ? new Date(entry.executedAt).toLocaleString() : "—"}
                                </p>
                              </div>
                              <div className="col-span-2">
                                <span className="text-white/30">Params</span>
                                <pre className="font-mono text-white/40 text-[10px] mt-0.5 bg-black/20 rounded p-1.5 overflow-x-auto max-h-24 overflow-y-auto">
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
                                  <pre className="font-mono text-emerald-400/60 text-[10px] mt-0.5 bg-black/20 rounded p-1.5 overflow-x-auto max-h-24 overflow-y-auto">
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
          Phase 32 • Audit Trail • {entries.length} actions recorded
        </p>
      </div>
    </div>
  );
}
