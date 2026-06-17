/**
 * DiscoveryReportViewer — Tabbed report viewer for completed discovery runs.
 *
 * Tabs: Summary | Findings | Customers | Graph | Download
 * Each tab loads and renders a different format of the report.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  AlertTriangle,
  Table2,
  Share2,
  Download,
  FileSpreadsheet,
  FileJson,
  FileType,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import DiscoveryFindingsList from "./DiscoveryFindingsList";
import DiscoveryCustomerTable from "./DiscoveryCustomerTable";

type TabId = "summary" | "findings" | "customers" | "graph" | "download";

interface ReportData {
  summary?: {
    totalCustomers: number;
    totalMisalignments: number;
    criticalMisalignments: number;
    highMisalignments: number;
    mediumMisalignments: number;
    customersWithIssues: number;
    healthyCustomers: number;
  };
  findings?: Array<{
    id: string;
    customerId: string;
    customerName: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    evidence: string[];
    recommendation: string;
    suggestedAction: { type: string; description: string; entityId: string };
  }>;
  customerReports?: Array<{
    customerId: string;
    name: string;
    phone: string;
    email: string;
    slackMentions: number;
    slackActionRequested: string;
    base44Status: string;
    nmiStatus: string;
    billingState: string;
    alignmentSummary: string;
    flags: string[];
    recommendedAction: string;
    priority: string;
  }>;
  aggregateStats?: Record<string, unknown>;
  recommendations?: Array<{ priority: number; action: string; affectedCustomerCount: number; estimatedImpact: string; suggestedAssignee: string }>;
  graph?: Record<string, unknown>;
}

interface DiscoveryReportViewerProps {
  runId: string;
  className?: string;
}

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "summary", label: "Summary", icon: FileText },
  { id: "findings", label: "Findings", icon: AlertTriangle },
  { id: "customers", label: "Customers", icon: Table2 },
  { id: "graph", label: "Graph", icon: Share2 },
  { id: "download", label: "Download", icon: Download },
];

export default function DiscoveryReportViewer({
  runId,
  className,
}: DiscoveryReportViewerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/discovery/report?runId=${encodeURIComponent(runId)}&format=json`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Report not yet generated");
        } else {
          setError("Failed to load report");
        }
        return;
      }
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Fetch markdown for summary tab
  useEffect(() => {
    if (activeTab === "summary" && !markdownContent) {
      fetch(`/api/discovery/report?runId=${encodeURIComponent(runId)}&format=markdown`)
        .then((res) => res.text())
        .then(setMarkdownContent)
        .catch(() => { /* markdown preview is optional */ });
    }
  }, [activeTab, runId, markdownContent]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-16", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("text-center py-16", className)}>
        <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={fetchReport}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t transition-colors",
              activeTab === tab.id
                ? "bg-muted text-foreground border-b-2 border-primary -mb-[3px]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.id === "findings" && reportData?.findings && (
              <span className="px-1 py-0.5 rounded text-[9px] bg-red-100 text-red-700 ml-0.5">
                {reportData.findings.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "summary" && (
        <SummaryTab reportData={reportData} markdownContent={markdownContent} />
      )}
      {activeTab === "findings" && reportData?.findings && (
        <DiscoveryFindingsList findings={reportData.findings as any} />
      )}
      {activeTab === "customers" && reportData?.customerReports && (
        <DiscoveryCustomerTable customers={reportData.customerReports as any} />
      )}
      {activeTab === "graph" && (
        <GraphTab reportData={reportData} />
      )}
      {activeTab === "download" && (
        <DownloadTab runId={runId} />
      )}
    </div>
  );
}

function SummaryTab({
  reportData,
  markdownContent,
}: {
  reportData: ReportData | null;
  markdownContent: string | null;
}) {
  const s = reportData?.summary;
  if (!s) return null;

  const healthPct = s.totalCustomers > 0
    ? Math.round((s.healthyCustomers / s.totalCustomers) * 100)
    : 100;

  return (
    <div className="space-y-4">
      {/* Key metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Customers"
          value={s.totalCustomers}
          subtitle={`${s.customersWithIssues} with issues`}
          color={s.customersWithIssues > 0 ? "amber" : "emerald"}
        />
        <MetricCard
          label="Health Score"
          value={`${healthPct}%`}
          subtitle={`${s.healthyCustomers} healthy`}
          color={healthPct >= 90 ? "emerald" : healthPct >= 70 ? "amber" : "red"}
        />
        <MetricCard
          label="Critical"
          value={s.criticalMisalignments}
          subtitle="Needs immediate action"
          color={s.criticalMisalignments > 0 ? "red" : "emerald"}
        />
        <MetricCard
          label="High Priority"
          value={s.highMisalignments}
          subtitle="Needs attention soon"
          color={s.highMisalignments > 0 ? "orange" : "emerald"}
        />
      </div>

      {/* Alignment breakdown */}
      {reportData?.aggregateStats && (
        <AlignmentBreakdown stats={reportData.aggregateStats} />
      )}

      {/* Top recommendations */}
      {reportData?.recommendations && reportData.recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Top Recommendations
          </h4>
          {reportData.recommendations.slice(0, 5).map((rec, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20"
            >
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                {rec.priority}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{rec.action}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {rec.affectedCustomerCount} customers · {rec.estimatedImpact} · → {rec.suggestedAssignee}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Markdown preview (collapsible) */}
      {markdownContent && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            View full Markdown report
          </summary>
          <pre className="mt-2 p-3 rounded-lg bg-muted/30 text-[11px] font-mono whitespace-pre-wrap max-h-96 overflow-y-auto border border-border">
            {markdownContent.slice(0, 10000)}
            {markdownContent.length > 10000 && "\n\n... (truncated)"}
          </pre>
        </details>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: string | number;
  subtitle: string;
  color: "red" | "orange" | "amber" | "emerald";
}) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    red: { bg: "bg-red-50 dark:bg-red-950/20", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
    orange: { bg: "bg-orange-50 dark:bg-orange-950/20", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
    amber: { bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  };
  const c = colors[color];

  return (
    <div className={cn("p-3 rounded-lg border", c.bg, c.border)}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn("text-xl font-bold mt-0.5", c.text)}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

function AlignmentBreakdown({ stats }: { stats: Record<string, unknown> }) {
  const alignmentByCategory = stats.alignmentByCategory as Record<string, { aligned: number; misaligned: number; unknown: number }> | undefined;
  if (!alignmentByCategory) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Alignment by Category
      </h4>
      <div className="space-y-1.5">
        {Object.entries(alignmentByCategory).map(([cat, counts]) => {
          const total = (counts.aligned + counts.misaligned + counts.unknown) || 1;
          const alignedPct = Math.round((counts.aligned / total) * 100);
          return (
            <div key={cat} className="flex items-center gap-2">
              <span className="text-xs capitalize w-24 flex-shrink-0">{cat.replace(/_/g, " ")}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${alignedPct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-8 text-right">{alignedPct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GraphTab({ reportData }: { reportData: ReportData | null }) {
  const g = reportData?.graph as Record<string, unknown> | undefined;
  const summary = g?.summary as Record<string, unknown> | undefined;

  if (!summary) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <Share2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
        Graph data not available in report
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Knowledge Graph Summary
      </h4>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {summary.nodeCounts && Object.entries(summary.nodeCounts as Record<string, number>).map(([type, count]) => (
          <div key={type} className="p-3 rounded-lg border border-border bg-muted/10">
            <p className="text-xs text-muted-foreground capitalize">{type}</p>
            <p className="text-lg font-bold">{count}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border border-border bg-muted/10">
          <p className="text-xs text-muted-foreground">Cycles Detected</p>
          <p className="text-lg font-bold">{String(summary.cycleCount || 0)}</p>
          <p className="text-[10px] text-red-500">{String(summary.criticalCycles || 0)} critical</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-muted/10">
          <p className="text-xs text-muted-foreground">Action Chains</p>
          <p className="text-lg font-bold">{String(summary.chainCount || 0)}</p>
          <p className="text-[10px] text-amber-500">{String(summary.stalledChains || 0)} stalled</p>
        </div>
      </div>

      {/* Top connected customers */}
      {summary.topConnectedCustomers && Array.isArray(summary.topConnectedCustomers) && (
        <div className="space-y-1">
          <h5 className="text-[11px] font-medium text-muted-foreground">Most Connected Customers</h5>
          {(summary.topConnectedCustomers as Array<{ label: string; connections: number }>).slice(0, 5).map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-4">{i + 1}.</span>
              <span className="flex-1">{c.label}</span>
              <span className="text-muted-foreground">{c.connections} connections</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DownloadTab({ runId }: { runId: string }) {
  const formats = [
    { ext: "md", label: "Markdown", icon: FileText, mime: "text/markdown" },
    { ext: "csv", label: "CSV Spreadsheet", icon: FileSpreadsheet, mime: "text/csv" },
    { ext: "json", label: "JSON Data", icon: FileJson, mime: "application/json" },
    { ext: "pdf", label: "PDF Report", icon: FileType, mime: "application/pdf" },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Download the full report in your preferred format:
      </p>
      {formats.map(({ ext, label, icon: Icon, mime }) => (
        <a
          key={ext}
          href={`/api/discovery/report?runId=${encodeURIComponent(runId)}&format=${ext === "md" ? "markdown" : ext}`}
          download={`${runId}.${ext}`}
          className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/20 transition-colors"
        >
          <Icon className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-[11px] text-muted-foreground">{mime}</p>
          </div>
          <Download className="h-4 w-4 text-muted-foreground" />
        </a>
      ))}
    </div>
  );
}
