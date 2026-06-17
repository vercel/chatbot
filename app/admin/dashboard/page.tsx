"use client";

/**
 * Phase 15.C — Observability Dashboard
 *
 * Real-time KPIs from library_usage_logs + library_model_usage_logs + library_evals.
 * Charts: tokens/day, cost/day, top 10 skills, top 10 models, avg latency, eval pass rate trend.
 * Time selectors: 24h, 7d, 30d, 90d. Filter by org_id. SSE live updates.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ActivityIcon,
  CpuIcon,
  CoinsIcon,
  TimerIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  BarChart3Icon,
  ZapIcon,
  RefreshCwIcon,
  RadioIcon,
  WifiIcon,
  WifiOffIcon,
  RocketIcon,
  XCircleIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  BotIcon,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

interface DashboardKPI {
  tokensTotal: number;
  tokensPerDay: { date: string; tokens: number }[];
  costTotal: number;
  costPerDay: { date: string; cost: number }[];
  topSkills: { name: string; count: number; avgLatencyMs: number }[];
  topModels: { name: string; count: number; avgLatencyMs: number }[];
  avgLatencyMs: number;
  evalPassRate: number;
  evalPassRateTrend: { date: string; rate: number }[];
  totalSessions: number;
  activeModels: number;
  totalSkills: number;
  // Stream 8: Eve observability additions
  missionKPI?: {
    total: number; pending: number; running: number;
    completed: number; failed: number; aborted: number;
    enhancing: number; approved: number; totalEstMinutes: number;
  };
  missionsPerDay?: { date: string; total: number; completed: number }[];
  v2SessionKPI?: {
    total: number; running: number; completed: number; failed: number;
  };
}

interface VPSHealth {
  cpu: number;
  mem: number;
  disk: number;
  uptime: string;
  pm2Status: string;
}

const TIME_RANGES = [
  { label: "24h", value: "24h", hours: 24 },
  { label: "7d", value: "7d", hours: 168 },
  { label: "30d", value: "30d", hours: 720 },
  { label: "90d", value: "90d", hours: 2160 },
];

export default function DashboardPage() {
  const [kpi, setKpi] = useState<DashboardKPI | null>(null);
  const [vps, setVps] = useState<VPSHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");
  const [liveMode, setLiveMode] = useState(false);

  const fetchDashboard = useCallback(async () => {
    const range = TIME_RANGES.find((r) => r.value === timeRange) || TIME_RANGES[1];
    const [kpiRes, vpsRes] = await Promise.allSettled([
      fetch(`/api/admin/dashboard?hours=${range.hours}`),
      fetch("/api/admin/vps-health"),
    ]);

    if (kpiRes.status === "fulfilled" && kpiRes.value.ok) {
      setKpi(await kpiRes.value.json());
    }
    if (vpsRes.status === "fulfilled" && vpsRes.value.ok) {
      setVps(await vpsRes.value.json());
    }
    setLoading(false);
  }, [timeRange]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // SSE live updates
  useEffect(() => {
    if (!liveMode) return;
    const es = new EventSource("/api/admin/dashboard-stream");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "kpi") setKpi(data.payload);
        if (data.type === "vps") setVps(data.payload);
      } catch {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [liveMode]);

  const formatCost = (usd: number) => `$${usd.toFixed(2)}`;
  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const maxTokens = Math.max(...(kpi?.tokensPerDay?.map((d) => d.tokens) || [1]));
  const maxCost = Math.max(...(kpi?.costPerDay?.map((d) => d.cost) || [0.01]));

  return (
    <div className="flex flex-col h-full p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Observability Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time KPIs across library usage, models, and evals
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
            <RefreshCwIcon className="size-3 mr-1" /> Refresh
          </Button>
          <Button
            variant={liveMode ? "default" : "outline"}
            size="sm"
            onClick={() => setLiveMode(!liveMode)}
          >
            {liveMode ? <RadioIcon className="size-3 mr-1" /> : <WifiOffIcon className="size-3 mr-1" />}
            {liveMode ? "Live" : "Live"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-accent/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <ZapIcon className="size-3" /> Tokens
              </div>
              <div className="text-xl font-bold mt-1">{formatTokens(kpi?.tokensTotal || 0)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">total in period</div>
            </CardContent>
          </Card>
          <Card className="bg-accent/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <CoinsIcon className="size-3" /> Cost
              </div>
              <div className="text-xl font-bold mt-1">{formatCost(kpi?.costTotal || 0)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">total in period</div>
            </CardContent>
          </Card>
          <Card className="bg-accent/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <TimerIcon className="size-3" /> Avg Latency
              </div>
              <div className="text-xl font-bold mt-1">{kpi?.avgLatencyMs ?? "-"}ms</div>
              <div className="text-[10px] text-muted-foreground mt-1">p50 across all calls</div>
            </CardContent>
          </Card>
          <Card className="bg-accent/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <BarChart3Icon className="size-3" /> Pass Rate
              </div>
              <div className="text-xl font-bold mt-1 text-emerald-500">{kpi?.evalPassRate ?? 0}%</div>
              <div className="text-[10px] text-muted-foreground mt-1">eval pass rate</div>
            </CardContent>
          </Card>
          <Card className="bg-accent/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <ActivityIcon className="size-3" /> Sessions
              </div>
              <div className="text-xl font-bold mt-1">{kpi?.totalSessions ?? 0}</div>
              <div className="text-[10px] text-muted-foreground mt-1">active sessions</div>
            </CardContent>
          </Card>
          <Card className="bg-accent/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <CpuIcon className="size-3" /> Models
              </div>
              <div className="text-xl font-bold mt-1">{kpi?.activeModels ?? 0}</div>
              <div className="text-[10px] text-muted-foreground mt-1">models used</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tokens/Day chart */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Tokens / Day</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {kpi?.tokensPerDay && kpi.tokensPerDay.length > 0 ? (
              <div className="flex items-end gap-1 h-32">
                {kpi.tokensPerDay.map((d, i) => {
                  const h = maxTokens > 0 ? (d.tokens / maxTokens) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-emerald-500/60 rounded-t" style={{ height: `${Math.max(2, h)}%` }} />
                      <span className="text-[9px] text-muted-foreground rotate-45 origin-left">{d.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-8 text-center">No data for selected range</div>
            )}
          </CardContent>
        </Card>

        {/* Cost/Day chart */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Cost / Day (USD)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {kpi?.costPerDay && kpi.costPerDay.length > 0 ? (
              <div className="flex items-end gap-1 h-32">
                {kpi.costPerDay.map((d, i) => {
                  const h = maxCost > 0 ? (d.cost / maxCost) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-blue-500/60 rounded-t" style={{ height: `${Math.max(2, h)}%` }} />
                      <span className="text-[9px] text-muted-foreground rotate-45 origin-left">{d.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-8 text-center">No data for selected range</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Skills */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Top 10 Skills</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {kpi?.topSkills?.slice(0, 10).map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground tabular-nums w-4">{i + 1}.</span>
                    <span className="font-mono">{s.name.slice(0, 40)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{s.count} calls</span>
                    <span>{s.avgLatencyMs}ms</span>
                  </div>
                </div>
              )) || <div className="text-xs text-muted-foreground py-4 text-center">No data</div>}
            </div>
          </CardContent>
        </Card>

        {/* Top 10 Models */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Top 10 Models</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {kpi?.topModels?.slice(0, 10).map((m, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground tabular-nums w-4">{i + 1}.</span>
                    <span className="font-mono">{m.name.slice(0, 40)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{m.count} calls</span>
                    <span>{m.avgLatencyMs}ms</span>
                  </div>
                </div>
              )) || <div className="text-xs text-muted-foreground py-4 text-center">No data</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* VPS Health */}
      {vps && (
        <Card className="bg-accent/10">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <CpuIcon className="size-4" />
              <CardTitle className="text-sm">VPS Health</CardTitle>
              <Badge variant={vps.pm2Status === "online" ? "default" : "destructive"} className="ml-auto">
                {vps.pm2Status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground">CPU</div>
                <div className="text-lg font-bold">{vps.cpu}%</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Memory</div>
                <div className="text-lg font-bold">{vps.mem}%</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Disk</div>
                <div className="text-lg font-bold">{vps.disk}%</div>
              </div>
            </div>
            <div className="text-center text-[10px] text-muted-foreground mt-2">Uptime: {vps.uptime}</div>
          </CardContent>
        </Card>
      )}

      {/* ── Mission KPIs (Stream 8: Eve Observability) ────────────────── */}
      {kpi?.missionKPI && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <Card className="bg-accent/10">
              <CardContent className="p-3 text-center">
                <div className="text-[10px] text-muted-foreground uppercase">Total</div>
                <div className="text-lg font-bold mt-1">{kpi.missionKPI.total}</div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-500/5">
              <CardContent className="p-3 text-center">
                <div className="text-[10px] text-muted-foreground uppercase">Done</div>
                <div className="text-lg font-bold text-emerald-400 mt-1">{kpi.missionKPI.completed}</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-500/5">
              <CardContent className="p-3 text-center">
                <div className="text-[10px] text-muted-foreground uppercase">Running</div>
                <div className="text-lg font-bold text-yellow-400 mt-1">{kpi.missionKPI.running}</div>
              </CardContent>
            </Card>
            <Card className="bg-cyan-500/5">
              <CardContent className="p-3 text-center">
                <div className="text-[10px] text-muted-foreground uppercase">Enhancing</div>
                <div className="text-lg font-bold text-cyan-400 mt-1">{kpi.missionKPI.enhancing}</div>
              </CardContent>
            </Card>
            <Card className="bg-violet-500/5">
              <CardContent className="p-3 text-center">
                <div className="text-[10px] text-muted-foreground uppercase">Approved</div>
                <div className="text-lg font-bold text-violet-400 mt-1">{kpi.missionKPI.approved}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-500/5">
              <CardContent className="p-3 text-center">
                <div className="text-[10px] text-muted-foreground uppercase">Failed</div>
                <div className="text-lg font-bold text-red-400 mt-1">{kpi.missionKPI.failed}</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-500/5">
              <CardContent className="p-3 text-center">
                <div className="text-[10px] text-muted-foreground uppercase">Aborted</div>
                <div className="text-lg font-bold text-orange-400 mt-1">{kpi.missionKPI.aborted}</div>
              </CardContent>
            </Card>
            <Card className="bg-accent/10">
              <CardContent className="p-3 text-center">
                <div className="text-[10px] text-muted-foreground uppercase">Est. Min</div>
                <div className="text-lg font-bold mt-1">{kpi.missionKPI.totalEstMinutes}m</div>
              </CardContent>
            </Card>
          </div>

          {/* Missions/Day chart */}
          {kpi.missionsPerDay && kpi.missionsPerDay.length > 0 && (
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RocketIcon className="size-3.5" /> Missions / Day
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-end gap-1 h-24">
                  {kpi.missionsPerDay.map((d, i) => {
                    const maxMissions = Math.max(...kpi.missionsPerDay!.map(x => x.total), 1);
                    const h = (d.total / maxMissions) * 100;
                    const ch = (d.completed / maxMissions) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex flex-col-reverse" style={{ height: `${Math.max(2, h)}%` }}>
                          <div className="w-full bg-cyan-500/40 rounded-t" style={{ height: `${Math.max(1, ch)}%` }} />
                          <div className="w-full bg-cyan-500/10" style={{ height: `${Math.max(1, h - ch)}%` }} />
                        </div>
                        <span className="text-[8px] text-muted-foreground rotate-45 origin-left">{d.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── V2 Session Health (Stream 7: V2 alignment) ───────────────── */}
      {kpi?.v2SessionKPI && (
        <Card className="bg-accent/10">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <BotIcon className="size-4" />
              <CardTitle className="text-sm">V2 Session Health</CardTitle>
              <Badge variant={kpi.v2SessionKPI.running > 0 ? "default" : "secondary"} className="ml-auto">
                {kpi.v2SessionKPI.running} running
              </Badge>
            </div>
            <CardDescription className="text-[10px]">
              Neptune V2 coding agent sessions ({kpi.v2SessionKPI.total} total)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <ActivityIcon className="size-3" /> Total
                </div>
                <div className="text-lg font-bold">{kpi.v2SessionKPI.total}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <RadioIcon className="size-3" /> Running
                </div>
                <div className="text-lg font-bold text-yellow-400">{kpi.v2SessionKPI.running}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <CheckCircle2Icon className="size-3" /> Done
                </div>
                <div className="text-lg font-bold text-emerald-400">{kpi.v2SessionKPI.completed}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <XCircleIcon className="size-3" /> Failed
                </div>
                <div className="text-lg font-bold text-red-400">{kpi.v2SessionKPI.failed}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
