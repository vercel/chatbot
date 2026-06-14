"use client";

/**
 * /admin/function-inventory — Enterprise Function Map
 *
 * PHASE 18.H: Searchable, sortable, filterable table of all library functions
 * with connector/skill relationships, 7-day usage stats, and doc status.
 *
 * Click any row to open the function-detail canvas.
 * Export CSV button for data portability.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  DownloadIcon,
  ExternalLinkIcon,
  FileCodeIcon,
  FilterIcon,
  FunctionSquareIcon,
  LayersIcon,
  Loader2Icon,
  SearchIcon,
  TimerIcon,
  TrendingUpIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanvasStore } from "@/lib/canvas/store";

// ── Types ──────────────────────────────────────────────────────────────────

interface FunctionRow {
  function: string;
  signature: string;
  description: string;
  connector: string;
  skill: string;
  domain: string;
  calls7d: number;
  avgLatencyMs: number | null;
  docStatus: "documented" | "minimal";
  filePath: string;
  version: string;
  dependencies: string[];
  alsoIn: string[];
  costPerInvocationUsd: unknown;
}

interface InventoryData {
  rows: FunctionRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  domains: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatLatency(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCalls(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function downloadCSV(rows: FunctionRow[]) {
  const headers = [
    "Function",
    "Signature",
    "Connector",
    "Skill",
    "Domain",
    "Calls (7d)",
    "Avg Latency",
    "Doc Status",
    "Version",
    "Description",
  ];
  const csvRows = [
    headers.join(","),
    ...rows.map((r) =>
      [
        `"${r.function}"`,
        `"${(r.signature || "").replace(/"/g, '""')}"`,
        `"${r.connector}"`,
        `"${r.skill}"`,
        `"${r.domain}"`,
        r.calls7d,
        r.avgLatencyMs ?? "",
        r.docStatus,
        r.version,
        `"${(r.description || "").replace(/"/g, '""')}"`,
      ].join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `function-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ──────────────────────────────────────────────────────────────

export default function FunctionInventoryPage() {
  const canvasOpen = useCanvasStore((s) => s.open);

  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("all");
  const [sort, setSort] = useState("calls");
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (domain !== "all") params.set("domain", domain);
      params.set("sort", sort);
      params.set("page", String(page));

      const res = await fetch(`/api/admin/function-inventory?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [search, domain, sort, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRowClick = useCallback(
    (fn: FunctionRow) => {
      canvasOpen("function-detail", {
        functionName: fn.function,
      });
    },
    [canvasOpen]
  );

  const handleExportCSV = useCallback(async () => {
    // Fetch all rows for export
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (domain !== "all") params.set("domain", domain);
      params.set("sort", sort);
      params.set("page", "1");

      // Fetch with a large page size to get all
      const res = await fetch(
        `/api/admin/function-inventory?${params}&pageSize=${Math.max(
          data?.total || 100,
          200
        )}`
      );
      const json = await res.json();
      downloadCSV(json.rows || []);
    } catch {
      // Fall back to current page
      if (data?.rows) downloadCSV(data.rows);
    }
  }, [search, domain, sort, data]);

  // ── Stats cards ────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!data?.rows.length) return null;
    const totalCalls = data.rows.reduce((s, r) => s + r.calls7d, 0);
    const documented = data.rows.filter((r) => r.docStatus === "documented")
      .length;
    const latencies = data.rows
      .map((r) => r.avgLatencyMs)
      .filter((l): l is number => l !== null);
    const avgLatency =
      latencies.length > 0
        ? Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length)
        : null;
    return { totalCalls, documented, avgLatency, total: data.total };
  }, [data]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Enterprise Function Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete map of all library functions, their connectors, skills,
            usage stats, and documentation status.
          </p>
        </div>
        <Button
          onClick={handleExportCSV}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          <DownloadIcon className="size-4" />
          Export CSV
        </Button>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FunctionSquareIcon className="size-3.5" />
                Total Functions
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <span className="text-2xl font-bold tabular-nums">
                {stats.total}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <TrendingUpIcon className="size-3.5" />
                Calls (7d)
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <span className="text-2xl font-bold tabular-nums">
                {formatCalls(stats.totalCalls)}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <TimerIcon className="size-3.5" />
                Avg Latency
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <span className="text-2xl font-bold tabular-nums">
                {formatLatency(stats.avgLatency)}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FileCodeIcon className="size-3.5" />
                Documented
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <span className="text-2xl font-bold tabular-nums">
                {stats.documented}
                <span className="text-sm text-muted-foreground font-normal">
                  {" "}
                  / {stats.total}
                </span>
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search functions..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <XIcon className="size-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        <Select value={domain} onValueChange={(v) => { setDomain(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <FilterIcon className="size-3.5 mr-1.5" />
            <SelectValue placeholder="All domains" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All domains</SelectItem>
            {data?.domains.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <ArrowUpDown className="size-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="calls">Most used</SelectItem>
            <SelectItem value="latency">Slowest first</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
          <Button
            onClick={fetchData}
            size="sm"
            variant="outline"
            className="ml-3"
          >
            Retry
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Function</TableHead>
              <TableHead className="w-[120px]">Connector</TableHead>
              <TableHead className="w-[120px]">Skill</TableHead>
              <TableHead className="w-[80px] text-right">Calls (7d)</TableHead>
              <TableHead className="w-[100px] text-right">Avg Latency</TableHead>
              <TableHead className="w-[100px]">Doc Status</TableHead>
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !data ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-[80%]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <LayersIcon className="size-8 opacity-30" />
                    <p className="text-sm">No functions found</p>
                    {search && (
                      <p className="text-xs">
                        Try adjusting your search or filters
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data?.rows.map((row) => (
                <TableRow
                  key={row.function}
                  className="cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => handleRowClick(row)}
                >
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm">
                        {row.function}
                      </span>
                      {row.signature && (
                        <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[280px]">
                          {row.signature}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{row.connector}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {row.skill}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs font-medium tabular-nums">
                      {formatCalls(row.calls7d)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs tabular-nums">
                      {formatLatency(row.avgLatencyMs)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.docStatus === "documented" ? "default" : "outline"
                      }
                      className="text-[11px] px-1.5 py-0"
                    >
                      {row.docStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ExternalLinkIcon className="size-3.5 text-muted-foreground opacity-50" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {(data.page - 1) * data.pageSize + 1}–
            {Math.min(data.page * data.pageSize, data.total)} of {data.total}{" "}
            functions
          </span>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Loading overlay for re-fetches */}
      {loading && data && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 shadow-lg text-xs text-muted-foreground">
          <Loader2Icon className="size-3 animate-spin" />
          Loading...
        </div>
      )}
    </div>
  );
}
