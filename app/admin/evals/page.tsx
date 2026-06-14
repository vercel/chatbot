"use client";

/**
 * Phase 15.B — Evals Leaderboard Page
 *
 * Lists all eval definitions by domain, with run history, pass rates,
 * and a "Run All" button that triggers POST /api/evals/run.
 * READ-ONLY: no production-impacting changes.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PlayIcon,
  RotateCcwIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  Loader2Icon,
  TimerIcon,
  BarChart3Icon,
  TargetIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ZapIcon,
  BrainIcon,
} from "lucide-react";

interface EvalRun {
  id: string;
  evalName: string;
  domain: string;
  status: string;
  qualityGrade: string;
  qualityScore: number;
  latencyMs: number;
  runAt: string;
}

interface DomainStat {
  domain: string;
  total_evals: number;
  passed_runs: number;
  total_runs: number;
  avg_score: number;
  avg_latency_ms: number;
}

interface Leaderboard {
  overall: { total_runs: number; passed_runs: number; avg_score: number; avg_latency_ms: number } | null;
  byDomain: DomainStat[];
  recentRuns: EvalRun[];
}

interface EvalDef {
  id: string;
  evalName: string;
  domain: string;
  query: string;
  severity: string;
  expectedSkills: string[];
  expectedConnectors: string[];
  expectedModel: string | null;
  runSummary: {
    total: number;
    passed: number;
    failed: number;
    lastRun: string | null;
    avgScore: number | null;
  } | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  normal: "bg-blue-500 text-white",
  low: "bg-slate-500 text-white",
};

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-emerald-400", "A": "text-emerald-500", "A-": "text-emerald-600",
  "B+": "text-blue-400", "B": "text-blue-500", "B-": "text-blue-600",
  "C+": "text-yellow-400", "C": "text-yellow-500",
  "D": "text-orange-500", "F": "text-red-500",
};

const DOMAIN_LABELS: Record<string, string> = {
  "billing-flow": "Billing Flow",
  "credit-disputes": "Credit Disputes",
  "customer-enrollment": "Customer Enrollment",
  "compliance-audit": "Compliance Audit",
  "support-triage": "Support Triage",
  "agent-payments": "Agent Payments",
  reporting: "Reporting",
  "customer-comms": "Customer Comms",
  "lead-flow": "Lead Flow",
  "mcp-edits": "MCP Edits",
};

export default function EvalsPage() {
  const [evals, setEvals] = useState<EvalDef[]>([]);
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeDomain, setActiveDomain] = useState("all");
  const [runStatus, setRunStatus] = useState<string>("");

  const fetchData = useCallback(async () => {
    const [evalsRes, lbRes] = await Promise.all([
      fetch("/api/evals"),
      fetch("/api/evals/leaderboard"),
    ]);
    if (evalsRes.ok) {
      const d = await evalsRes.json();
      setEvals(d.evals || []);
    }
    if (lbRes.ok) {
      setLeaderboard(await lbRes.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAllEvals = async () => {
    setRunning(true);
    setRunStatus("Running all evals...");
    try {
      const res = await fetch("/api/evals/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      setRunStatus(`Complete: ${data.ran} evals run in batch.`);
      fetchData();
    } catch (err: any) {
      setRunStatus(`Error: ${err.message}`);
    }
    setRunning(false);
  };

  const domains = Array.from(new Set(evals.map((e) => e.domain)));
  const filteredEvals = activeDomain === "all" ? evals : evals.filter((e) => e.domain === activeDomain);

  const overallPassRate = leaderboard?.overall
    ? Math.round((leaderboard.overall.passed_runs / Math.max(1, leaderboard.overall.total_runs)) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Evals Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated quality grading across 10 domains · READ-ONLY
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RotateCcwIcon className="size-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={runAllEvals} disabled={running}>
            {running ? <Loader2Icon className="size-4 mr-1 animate-spin" /> : <PlayIcon className="size-4 mr-1" />}
            {running ? "Running..." : "Run All"}
          </Button>
        </div>
      </div>

      {runStatus && (
        <div className="text-sm text-muted-foreground bg-accent/50 rounded-lg p-3">{runStatus}</div>
      )}

      {/* Overview cards */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-accent/30">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Evals</div>
              <div className="text-2xl font-bold mt-1">{evals.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-accent/30">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Pass Rate</div>
              <div className="text-2xl font-bold mt-1 text-emerald-500">{overallPassRate}%</div>
            </CardContent>
          </Card>
          <Card className="bg-accent/30">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Avg Score</div>
              <div className="text-2xl font-bold mt-1">{leaderboard?.overall?.avg_score ?? "-"}</div>
            </CardContent>
          </Card>
          <Card className="bg-accent/30">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Avg Latency</div>
              <div className="text-2xl font-bold mt-1">{leaderboard?.overall?.avg_latency_ms ?? "-"}ms</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Domain filter */}
      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={activeDomain === "all" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setActiveDomain("all")}
        >
          All ({evals.length})
        </Badge>
        {domains.map((d) => {
          const count = evals.filter((e) => e.domain === d).length;
          return (
            <Badge
              key={d}
              variant={activeDomain === d ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setActiveDomain(d)}
            >
              {DOMAIN_LABELS[d] || d} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Eval list */}
      <ScrollArea className="flex-1">
        <div className="space-y-3">
          {filteredEvals.map((e) => (
            <Card key={e.id} className="hover:bg-accent/10 transition-colors">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-medium">{e.evalName}</CardTitle>
                      <Badge className={SEVERITY_COLORS[e.severity] || "bg-slate-500"} variant="secondary">
                        {e.severity}
                      </Badge>
                      <Badge variant="outline">{DOMAIN_LABELS[e.domain] || e.domain}</Badge>
                    </div>
                    <CardDescription className="mt-1 text-xs">{e.query.slice(0, 120)}</CardDescription>
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-1">
                    {e.runSummary?.lastRun ? (
                      <>
                        <div className="flex items-center gap-1 justify-end">
                          <TargetIcon className="size-3" />
                          <span>Avg {e.runSummary.avgScore ?? "-"}</span>
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <CheckCircleIcon className="size-3 text-emerald-500" />
                          <span>{e.runSummary.passed} passed</span>
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <XCircleIcon className="size-3 text-red-500" />
                          <span>{e.runSummary.failed} failed</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">Never run</span>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Recent runs */}
      {leaderboard?.recentRuns && leaderboard.recentRuns.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Recent Runs</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {leaderboard.recentRuns.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {r.status === "passed" ? (
                      <CheckCircleIcon className="size-3 text-emerald-500" />
                    ) : r.status === "error" ? (
                      <AlertTriangleIcon className="size-3 text-red-500" />
                    ) : (
                      <XCircleIcon className="size-3 text-red-500" />
                    )}
                    <span>{r.evalName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className={GRADE_COLORS[r.qualityGrade] || ""}>{r.qualityGrade}</span>
                    <span>{r.qualityScore}</span>
                    <span>{r.latencyMs}ms</span>
                    <span>{new Date(r.runAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
