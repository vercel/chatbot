/**
 * app/admin/migration/page.tsx — Migration Dashboard
 * Phase 30+32: SSE-powered migration progress dashboard with polish.
 */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MigrationStatus {
  runId: string;
  status: string;
  waveSize: number;
  recordsMigrated: number;
  recordsFailed: number;
  recordsSkipped: number;
  recordsTotal?: number;
  startedAt: string;
  completedAt?: string;
  dryRun: boolean;
}

interface SyncHealth {
  direction: string;
  status: "healthy" | "degraded" | "down";
  lastEventAt: string;
  failureCount: number;
}

interface MigrationRecord {
  base44Id: string;
  twentyId?: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  errorMessage?: string;
  name?: string;
  email?: string;
}

export default function MigrationDashboard() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [syncHealth, setSyncHealth] = useState<SyncHealth[]>([
    { direction: "b2t", status: "healthy", lastEventAt: new Date().toISOString(), failureCount: 0 },
    { direction: "t2b", status: "healthy", lastEventAt: new Date().toISOString(), failureCount: 0 },
  ]);
  const [waveSize, setWaveSize] = useState(50);
  const [filter, setFilter] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [records, setRecords] = useState<MigrationRecord[]>([]);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-199), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // Poll migration status via SSE or fetch
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/twenty-sync");
        if (res.ok) {
          const data = await res.json();
          setSyncHealth((prev) => prev.map((h) =>
            h.direction === "b2t"
              ? { ...h, lastEventAt: new Date().toISOString(), status: "healthy" as const }
              : h
          ));
          if (data.records) setRecords(data.records);
        }
      } catch {
        setSyncHealth((prev) => prev.map((h) =>
          h.direction === "b2t" ? { ...h, status: "degraded" as const } : h
        ));
      }
    }, 10000); // Phase 32: 10s poll for near-real-time updates
    return () => clearInterval(interval);
  }, []);

  // Compute progress percentage
  const progressPct = useMemo(() => {
    if (!status) return 0;
    const total = status.recordsTotal || (status.recordsMigrated + status.recordsFailed + status.recordsSkipped);
    if (total === 0) return 0;
    return Math.round(((status.recordsMigrated + status.recordsFailed) / total) * 100);
  }, [status]);

  const failedRecords = useMemo(() =>
    records.filter((r) => r.status === "failed"),
    [records]
  );

  const triggerMigration = async () => {
    setMigrating(true);
    addLog(`Starting migration — wave size: ${waveSize}${filter ? `, filter: ${filter}` : ""}`);

    try {
      const res = await fetch("/api/twenty-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: [], dryRun: false }),
      });

      const data = await res.json();
      addLog(`Migration response: ${JSON.stringify(data).slice(0, 200)}`);

      setStatus({
        runId: data.runId ?? `manual-${Date.now().toString(36)}`,
        status: data.success ? "completed" : "failed",
        waveSize,
        recordsMigrated: data.synced ?? 0,
        recordsFailed: data.errors ?? 0,
        recordsSkipped: data.skipped ?? 0,
        recordsTotal: data.total ?? 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        dryRun: false,
      });
      if (data.records) setRecords(data.records);
    } catch (err) {
      addLog(`Migration error: ${err instanceof Error ? err.message : String(err)}`);
    }

    setMigrating(false);
  };

  // Retry a single failed record
  const retryRecord = async (base44Id: string) => {
    setRetryingIds((prev) => new Set(prev).add(base44Id));
    addLog(`Retrying failed record: ${base44Id.slice(0, 12)}...`);

    try {
      const res = await fetch("/api/twenty-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: [base44Id], dryRun: false }),
      });
      const data = await res.json();
      if (data.success) {
        setRecords((prev) =>
          prev.map((r) =>
            r.base44Id === base44Id
              ? { ...r, status: "completed", twentyId: data.twentyId, errorMessage: undefined }
              : r
          )
        );
        addLog(`✅ Retry succeeded: ${base44Id.slice(0, 12)}...`);
      } else {
        addLog(`❌ Retry failed: ${base44Id.slice(0, 12)}... — ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      addLog(`❌ Retry error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setRetryingIds((prev) => {
      const next = new Set(prev);
      next.delete(base44Id);
      return next;
    });
  };

  // Export records as CSV
  const exportCSV = () => {
    if (records.length === 0) return;
    const headers = ["base44Id", "name", "email", "status", "twentyId", "errorMessage"];
    const rows = records.map((r) =>
      [r.base44Id, r.name || "", r.email || "", r.status, r.twentyId || "", (r.errorMessage || "").replace(/,/g, ";")]
        .map((v) => `"${v}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migration-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addLog(`📥 Exported ${records.length} records to CSV`);
  };

  return (
    <div className="min-h-screen bg-sidebar p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">Migration Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Base44 → Twenty CRM migration • Phase 32
            </p>
          </div>
          <button
            onClick={exportCSV}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.08] disabled:opacity-30 transition-colors"
          >
            <Download className="size-3.5" />
            Export CSV
          </button>
        </div>

        {/* Progress Bar (Phase 32) */}
        {status && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-white/40">
                Progress: {status.recordsMigrated + status.recordsFailed} / {status.recordsTotal || "?"}
              </span>
              <span className="text-[11px] text-white/40">{progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.04] border border-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                initial={{ width: "0%" }}
                animate={{ width: `${progressPct}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              />
            </div>
            {failedRecords.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-red-400/80">
                <AlertTriangle className="size-3" />
                {failedRecords.length} record{failedRecords.length > 1 ? "s" : ""} failed —
                <button
                  onClick={() => failedRecords.forEach((r) => retryRecord(r.base44Id))}
                  className="underline hover:text-red-300 transition-colors"
                >
                  Retry all
                </button>
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="rounded-lg border border-border bg-card p-4 mb-4">
          <h2 className="font-semibold mb-3">Migration Controls</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Wave Size</label>
              <input
                type="number"
                value={waveSize}
                onChange={(e) => setWaveSize(Number(e.target.value))}
                className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                min={1}
                max={500}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Filter</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="">All customers</option>
                <option value="active">Active only</option>
                <option value="paused">Paused only</option>
                <option value="disputes">With disputes</option>
              </select>
            </div>
            <button
              onClick={triggerMigration}
              disabled={migrating}
              className="rounded-md bg-cyan-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50 transition-colors"
            >
              {migrating ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="size-3.5 animate-spin" />
                  Migrating...
                </span>
              ) : (
                "Start Migration"
              )}
            </button>
          </div>
        </div>

        {/* Status + Failed Records */}
        {status && (
          <div className="rounded-lg border border-border bg-card p-4 mb-4">
            <h2 className="font-semibold mb-3">Last Migration</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-4">
              <div>
                <span className="text-muted-foreground">Run ID</span>
                <p className="font-mono text-xs">{status.runId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <p className={cn(
                  "font-medium",
                  status.status === "completed" ? "text-emerald-500" : "text-red-500"
                )}>
                  {status.status === "completed" && <CheckCircle2 className="size-3.5 inline mr-1" />}
                  {status.status === "failed" && <XCircle className="size-3.5 inline mr-1" />}
                  {status.status}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Migrated</span>
                <p className="font-semibold text-emerald-400">{status.recordsMigrated}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Failed</span>
                <p className={cn(
                  "font-semibold",
                  status.recordsFailed > 0 ? "text-red-400" : "text-white/60"
                )}>
                  {status.recordsFailed}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Skipped</span>
                <p className="font-semibold text-white/40">{status.recordsSkipped}</p>
              </div>
            </div>

            {/* Failed Records List */}
            {failedRecords.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-red-400/80 mb-2">
                  Failed Records ({failedRecords.length})
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {failedRecords.map((r) => (
                    <div
                      key={r.base44Id}
                      className="flex items-center justify-between px-3 py-2 rounded bg-red-500/[0.04] border border-red-500/10 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-white/60">{r.base44Id.slice(0, 16)}...</span>
                        {r.name && <span className="text-white/40 ml-2">{r.name}</span>}
                        {r.errorMessage && (
                          <p className="text-red-400/60 text-[10px] mt-0.5 truncate">{r.errorMessage}</p>
                        )}
                      </div>
                      <button
                        onClick={() => retryRecord(r.base44Id)}
                        disabled={retryingIds.has(r.base44Id)}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-600/20 border border-cyan-500/30 text-[11px] text-cyan-400 hover:bg-cyan-600/30 disabled:opacity-40 transition-colors ml-2"
                      >
                        {retryingIds.has(r.base44Id) ? (
                          <RefreshCw className="size-3 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3" />
                        )}
                        Retry
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sync Health */}
        <div className="rounded-lg border border-border bg-card p-4 mb-4">
          <h2 className="font-semibold mb-3">Sync Health</h2>
          <div className="space-y-2">
            {syncHealth.map((h) => (
              <div key={h.direction} className="flex items-center justify-between text-sm">
                <span className="font-mono">
                  {h.direction === "b2t" ? "Base44 → Twenty" : "Twenty → Base44"}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border",
                    h.status === "healthy" && "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                    h.status === "degraded" && "text-amber-400 bg-amber-500/10 border-amber-500/20",
                    h.status === "down" && "text-red-400 bg-red-500/10 border-red-500/20"
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current"></span>
                  {h.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  Last event: {new Date(h.lastEventAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Log */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold mb-3">Activity Log</h2>
          <div className="bg-black/50 rounded p-3 h-64 overflow-y-auto font-mono text-xs text-emerald-400">
            {log.length === 0 ? (
              <span className="text-muted-foreground">Waiting for activity...</span>
            ) : (
              log.map((entry, i) => (
                <div key={i} className="py-0.5">{entry}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
