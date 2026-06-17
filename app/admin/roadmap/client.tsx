"use client";

/**
 * ROADMAP DASHBOARD — Client Component
 * MEGA MASTER OKF ALIGNMENT: Stream 10
 *
 * Interactive visualization of the 17-phase master sprint plan (Phases 34-50).
 * Features: phase cards, timeline, risk heatmap, milestone tracker,
 * OKF compliance, track progress, and dependency graph.
 */

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  PhaseData,
  RiskData,
  TimelineData,
  MilestoneData,
  OKFComplianceData,
} from "./page";
import {
  CheckCircle2Icon,
  ClockIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  TargetIcon,
  LayersIcon,
  TrendingUpIcon,
  ShieldAlertIcon,
  GitBranchIcon,
  CalendarIcon,
  BarChart3Icon,
  ZapIcon,
  FileCheckIcon,
  BookOpenIcon,
  GlobeIcon,
  ExternalLinkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleIcon,
  GanttChartIcon,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface RoadmapStats {
  totalPhases: number;
  completedPhases: number;
  inProgressPhases: number;
  totalBudget: number;
  budgetSpent: number;
  budgetProgressPercent: number;
  phaseProgressPercent: number;
  tracks: Record<
    string,
    {
      phases: number[];
      complete: number;
      inProgress?: number;
      total: number;
    }
  >;
}

interface RoadmapClientProps {
  phases: PhaseData[];
  risks: RiskData[];
  timeline: TimelineData[];
  milestones: MilestoneData[];
  okfCompliance: OKFComplianceData;
  stats: RoadmapStats;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const TRACK_COLORS: Record<string, string> = {
  "Knowledge Layer": "#14B8A6",
  "Twenty CRM": "#3B82F6",
  Platform: "#8B5CF6",
  Ops: "#F59E0B",
  Mobile: "#EC4899",
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: "#EF4444",
  P1: "#F59E0B",
  P2: "#3B82F6",
};

const STATUS_COLORS: Record<string, string> = {
  COMPLETE: "#14B8A6",
  IN_PROGRESS: "#3B82F6",
  PARTIAL: "#F59E0B",
  PLANNED: "#64748B",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  COMPLETE: CheckCircle2Icon,
  IN_PROGRESS: ClockIcon,
  PARTIAL: AlertTriangleIcon,
  PLANNED: CircleIcon,
};

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const PROBABILITY_ORDER: Record<string, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatBudget(t: number): string {
  if (t >= 1000) return `${(t / 1000).toFixed(0)}k`;
  return `${t}`;
}

function trackColor(track: string): string {
  return TRACK_COLORS[track] || "#64748B";
}

function priorityBadgeVariant(p: string): "destructive" | "default" | "secondary" | "outline" {
  if (p === "P0") return "destructive";
  if (p === "P1") return "default";
  return "secondary";
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Phase card with expandable details
 */
function PhaseCard({ phase }: { phase: PhaseData }) {
  const [expanded, setExpanded] = useState(false);
  const StatusIcon = STATUS_ICONS[phase.status] || CircleIcon;

  return (
    <Card
      className="border-border/50 hover:border-border transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <CardHeader className="p-3 pb-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: trackColor(phase.track) }}
            />
            <span className="text-xs font-mono text-muted-foreground">
              P{phase.phase}
            </span>
            <CardTitle className="text-sm font-semibold truncate">
              {phase.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge
              variant={priorityBadgeVariant(phase.priority)}
              className="text-[10px] px-1.5 py-0 h-4"
            >
              {phase.priority}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4"
              style={{
                borderColor: STATUS_COLORS[phase.status],
                color: STATUS_COLORS[phase.status],
              }}
            >
              <StatusIcon className="size-2.5 mr-0.5" />
              {phase.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
          <span>{phase.duration}</span>
          <span>·</span>
          <span>{formatBudget(phase.budget)}t</span>
          <span>·</span>
          <span>{phase.track}</span>
          {expanded ? (
            <ChevronUpIcon className="size-3 ml-auto" />
          ) : (
            <ChevronDownIcon className="size-3 ml-auto" />
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="p-3 pt-0 space-y-2">
          <p className="text-xs text-muted-foreground">{phase.objective}</p>

          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              Deliverables
            </span>
            <ul className="text-[11px] space-y-0.5">
              {phase.deliverables.map((d, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <FileCheckIcon className="size-3 mt-0.5 text-teal-400 shrink-0" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              Acceptance
            </span>
            <ul className="text-[11px] space-y-0.5">
              {phase.acceptanceCriteria.slice(0, 4).map((a, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <CheckCircle2Icon className="size-3 mt-0.5 text-muted-foreground shrink-0" />
                  <span>{a}</span>
                </li>
              ))}
              {phase.acceptanceCriteria.length > 4 && (
                <li className="text-muted-foreground text-[10px] pl-4">
                  +{phase.acceptanceCriteria.length - 4} more
                </li>
              )}
            </ul>
          </div>

          <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
            <span>Depends: {phase.dependsOn}</span>
            <span>Blocks: {phase.blocks}</span>
            <span>Owner: {phase.owner}</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Risk heatmap cell
 */
function RiskHeatmap({ risks }: { risks: RiskData[] }) {
  const grid = useMemo(() => {
    const matrix: Record<string, Record<string, RiskData[]>> = {};
    const sevs = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    const probs = ["HIGH", "MEDIUM", "LOW"];

    for (const s of sevs) {
      matrix[s] = {};
      for (const p of probs) {
        matrix[s][p] = [];
      }
    }

    for (const r of risks) {
      matrix[r.severity][r.probability].push(r);
    }

    return { matrix, sevs, probs };
  }, [risks]);

  const getCellColor = (severity: string, probability: string): string => {
    const s = SEVERITY_ORDER[severity] || 0;
    const p = PROBABILITY_ORDER[probability] || 0;
    const score = s * p;

    if (score >= 9) return "bg-red-500/30 border-red-500/50";
    if (score >= 6) return "bg-orange-500/25 border-orange-500/50";
    if (score >= 4) return "bg-yellow-500/20 border-yellow-500/50";
    return "bg-green-500/15 border-green-500/50";
  };

  return (
    <div className="space-y-2">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `80px repeat(3, 1fr)` }}
      >
        <div className="text-[10px] text-muted-foreground font-semibold" />
        {grid.probs.map((p) => (
          <div
            key={p}
            className="text-[10px] text-muted-foreground font-semibold text-center uppercase"
          >
            {p}
          </div>
        ))}

        {grid.sevs.map((s) => (
          <React.Fragment key={s}>
            <div className="text-[10px] text-muted-foreground font-semibold uppercase flex items-center">
              {s}
            </div>
            {grid.probs.map((p) => (
              <TooltipProvider key={p} delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`border rounded-md p-1.5 text-center min-h-[32px] flex items-center justify-center ${getCellColor(s, p)}`}
                    >
                      {grid.matrix[s][p].length > 0 ? (
                        <span className="text-[10px] font-semibold">
                          {grid.matrix[s][p].length}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/30">
                          —
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  {grid.matrix[s][p].length > 0 && (
                    <TooltipContent side="top" className="max-w-[300px]">
                      <div className="space-y-1">
                        {grid.matrix[s][p].map((r) => (
                          <div key={r.id} className="text-xs">
                            <span className="font-semibold">{r.id}</span>:{" "}
                            {r.risk}
                            <br />
                            <span className="text-[10px] text-muted-foreground">
                              {r.mitigation}
                            </span>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground text-center">
        Severity → | Probability ↓
      </div>
    </div>
  );
}

/**
 * Timeline row — horizontal week bar
 */
function TimelineBar({ timeline }: { timeline: TimelineData[] }) {
  return (
    <div className="space-y-1.5">
      <div className="flex gap-0.5">
        {timeline.map((t) => (
          <TooltipProvider key={t.week} delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`flex-1 h-8 rounded-sm border transition-colors cursor-pointer ${
                    t.status === "COMPLETE"
                      ? "bg-teal-500/30 border-teal-500/40"
                      : t.status === "ACTIVE"
                        ? "bg-blue-500/30 border-blue-500/40 animate-pulse"
                        : "bg-slate-700/30 border-slate-700/40"
                  }`}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className="text-[9px] font-mono">{t.week}</span>
                    {t.phases.length > 0 && (
                      <span className="text-[8px] text-muted-foreground">
                        {t.phases.map((p) => `P${p}`).join(",")}
                      </span>
                    )}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold">Week {t.week}</div>
                  <div>Phases: {t.phases.join(", ") || "—"}</div>
                  <div>Budget: {formatBudget(t.budget)}t</div>
                  <div>Status: {t.status}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground px-0.5">
        <span>Week 1</span>
        <span>Week 10</span>
        <span>Week 20</span>
      </div>
    </div>
  );
}

/**
 * Milestone tracker
 */
function MilestoneTracker({ milestones }: { milestones: MilestoneData[] }) {
  const achieved = milestones.filter((m) => m.status === "ACHIEVED").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold">10 Milestones</span>
        <span className="text-xs text-muted-foreground">
          {achieved}/10 achieved
        </span>
      </div>
      <div className="relative">
        {/* Track line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-2.5">
          {milestones.map((m) => (
            <div key={m.id} className="flex items-start gap-3 relative">
              <div
                className={`size-[22px] rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 z-10 ${
                  m.status === "ACHIEVED"
                    ? "bg-teal-500/20 border-teal-500"
                    : "bg-slate-800 border-slate-600"
                }`}
              >
                {m.status === "ACHIEVED" ? (
                  <CheckCircle2Icon className="size-3 text-teal-400" />
                ) : (
                  <CircleIcon className="size-2 text-slate-500" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{m.name}</span>
                  <Badge
                    variant={m.status === "ACHIEVED" ? "default" : "secondary"}
                    className="text-[9px] px-1 py-0 h-4"
                  >
                    {m.status === "ACHIEVED" ? "✓" : `W${m.week}`}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {m.celebration}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Track progress bars
 */
function TrackProgress({ stats }: { stats: RoadmapStats }) {
  const trackEntries = Object.entries(stats.tracks);

  return (
    <div className="space-y-3">
      {trackEntries.map(([name, data]) => {
        const complete = data.complete || 0;
        const inProg = data.inProgress || 0;
        const total = data.total;
        const pct = Math.round((complete / total) * 100);

        return (
          <div key={name} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div
                  className="size-2 rounded-full"
                  style={{ backgroundColor: trackColor(name) }}
                />
                <span className="text-xs font-medium">{name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {complete}
                {inProg ? ` (+${inProg})` : ""}/{total} phases
              </span>
            </div>
            <div className="flex gap-0.5 h-1.5">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: trackColor(name),
                }}
              />
              {inProg > 0 && (
                <div
                  className="h-full rounded-full animate-pulse"
                  style={{
                    width: `${Math.round((inProg / total) * 100)}%`,
                    backgroundColor: trackColor(name),
                    opacity: 0.4,
                  }}
                />
              )}
              <div className="flex-1 h-full bg-slate-700/50 rounded-full" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Dependency graph — simplified visual using SVG
 */
function DependencyGraph({ phases }: { phases: PhaseData[] }) {
  const phaseMap = new Map(phases.map((p) => [p.phase, p]));

  // Simplified layout: group by track
  const tracks = ["Knowledge Layer", "Twenty CRM", "Platform", "Ops", "Mobile"];
  const trackPhases: Record<string, PhaseData[]> = {};
  for (const t of tracks) {
    trackPhases[t] = phases
      .filter((p) => p.track === t)
      .sort((a, b) => a.phase - b.phase);
  }

  return (
    <div className="space-y-3">
      {tracks.map((track) => {
        const tps = trackPhases[track];
        if (tps.length === 0) return null;

        return (
          <div key={track} className="space-y-1">
            <div className="flex items-center gap-1.5 mb-1">
              <div
                className="size-2 rounded-full"
                style={{ backgroundColor: trackColor(track) }}
              />
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {track}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {tps.map((p, i) => (
                <React.Fragment key={p.phase}>
                  {i > 0 && (
                    <ArrowRightIcon className="size-3 text-muted-foreground shrink-0" />
                  )}
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] cursor-pointer transition-colors ${
                            p.status === "COMPLETE"
                              ? "bg-teal-500/10 border-teal-500/30 text-teal-300"
                              : p.status === "IN_PROGRESS"
                                ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                          }`}
                        >
                          <span className="font-mono text-[10px]">
                            P{p.phase}
                          </span>
                          <span className="truncate max-w-[100px]">
                            {p.name.split(":")[0]}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-xs space-y-0.5">
                          <div className="font-semibold">
                            Phase {p.phase}: {p.name}
                          </div>
                          <div>Status: {p.status}</div>
                          <div>Budget: {formatBudget(p.budget)}t</div>
                          <div>Depends: {p.dependsOn}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </React.Fragment>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * OKF Compliance status
 */
function OKFComplianceCard({ data }: { data: OKFComplianceData }) {
  const checks = [
    {
      label: "Total Files",
      value: data.totalFiles.toString(),
      status: true,
    },
    {
      label: "Conformant",
      value: `${data.conformantFiles}/${data.totalFiles}`,
      status: data.conformantFiles === data.totalFiles,
    },
    {
      label: "index.md Coverage",
      value: data.missingIndexMd === 0 ? "100%" : `${data.missingIndexMd} missing`,
      status: data.missingIndexMd === 0,
    },
    {
      label: "log.md Coverage",
      value: data.missingLogMd === 0 ? "100%" : `${data.missingLogMd} missing`,
      status: data.missingLogMd === 0,
    },
    {
      label: "Type Fields",
      value: data.missingTypeField === 0 ? "All present" : `${data.missingTypeField} missing`,
      status: data.missingTypeField === 0,
    },
    {
      label: "Export Validity",
      value: data.exportValid ? "PASS" : "FAIL",
      status: data.exportValid,
    },
    {
      label: "Spec Published",
      value: data.specPublished ? "Live" : "Pending",
      status: data.specPublished,
    },
    {
      label: "Visualizer Live",
      value: data.visualizerLive ? "Live" : "Pending",
      status: data.visualizerLive,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {checks.map((c) => (
          <div
            key={c.label}
            className="flex items-center justify-between px-2 py-1.5 rounded-md bg-slate-800/50"
          >
            <span className="text-[11px] text-muted-foreground">
              {c.label}
            </span>
            <div className="flex items-center gap-1">
              <span
                className={`text-[11px] font-mono font-semibold ${
                  c.status ? "text-teal-400" : "text-red-400"
                }`}
              >
                {c.value}
              </span>
              {c.status ? (
                <CheckCircle2Icon className="size-3 text-teal-400" />
              ) : (
                <AlertTriangleIcon className="size-3 text-red-400" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Twenty Migration Progress
 */
function TwentyMigrationProgress({ phases }: { phases: PhaseData[] }) {
  const twentyPhases = phases.filter((p) => p.track === "Twenty CRM");
  const complete = twentyPhases.filter((p) => p.status === "COMPLETE").length;
  const inProg = twentyPhases.filter((p) => p.status === "IN_PROGRESS").length;
  const total = twentyPhases.length;
  const pct = Math.round((complete / total) * 100);

  const objects = [
    { name: "Lead", phase: 37, status: "COMPLETE" },
    { name: "VAPI Call", phase: 37, status: "COMPLETE" },
    { name: "Agreement", phase: 38, status: "IN_PROGRESS" },
    { name: "Payment Method", phase: 38, status: "IN_PROGRESS" },
    { name: "Billing Recovery", phase: 39, status: "PLANNED" },
    { name: "Payment Record", phase: 39, status: "PLANNED" },
    { name: "Dispute Letter", phase: 40, status: "PLANNED" },
    { name: "Negative Item", phase: 40, status: "PLANNED" },
    { name: "Credit Report", phase: 40, status: "PLANNED" },
    { name: "Email Message", phase: 41, status: "PLANNED" },
    { name: "SMS Message", phase: 41, status: "PLANNED" },
    { name: "Call Log", phase: 41, status: "PLANNED" },
    { name: "Agent Task", phase: 41, status: "PLANNED" },
    { name: "Document", phase: 42, status: "PLANNED" },
    { name: "Change Log", phase: 41, status: "PLANNED" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">
          Wave Progress: {complete}/{total} complete
        </span>
        <span className="text-xs text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          Custom Objects (15 of 22)
        </span>
        <div className="flex flex-wrap gap-1">
          {objects.map((obj) => (
            <Badge
              key={obj.name}
              variant="outline"
              className={`text-[9px] px-1.5 py-0 h-5 ${
                obj.status === "COMPLETE"
                  ? "border-teal-500/50 text-teal-400 bg-teal-500/10"
                  : obj.status === "IN_PROGRESS"
                    ? "border-blue-500/50 text-blue-400 bg-blue-500/10"
                    : "border-slate-600 text-slate-500"
              }`}
            >
              {obj.name}
              <span className="ml-1 text-[8px] opacity-60">
                P{obj.phase}
              </span>
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function RoadmapClient({
  phases,
  risks,
  timeline,
  milestones,
  okfCompliance,
  stats,
}: RoadmapClientProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");

  const filteredPhases = useMemo(() => {
    if (phaseFilter === "all") return phases;
    return phases.filter((p) => p.status === phaseFilter || p.track === phaseFilter);
  }, [phases, phaseFilter]);

  // Group phases by status for summary
  const completedPhases = phases.filter((p) => p.status === "COMPLETE");
  const inProgressPhases = phases.filter(
    (p) => p.status === "IN_PROGRESS"
  );
  const plannedPhases = phases.filter(
    (p) => p.status === "PLANNED"
  );

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border p-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <TargetIcon className="size-5 text-teal-400" />
              Neptune Roadmap
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Phases 34-50 · 17 phases · 20 weeks · 155,000t · Platform v1.0
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/knowledge"
              target="_blank"
              rel="noopener"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <BookOpenIcon className="size-3" />
              Knowledge
              <ExternalLinkIcon className="size-2.5" />
            </a>
            <a
              href="https://github.com/abhiswami2121/neptune-knowledge-spec"
              target="_blank"
              rel="noopener"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <GitBranchIcon className="size-3" />
              NKS Spec
              <ExternalLinkIcon className="size-2.5" />
            </a>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <Card className="bg-slate-800/30 border-border/30">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">
                  Phases
                </span>
                <LayersIcon className="size-3.5 text-teal-400" />
              </div>
              <div className="mt-1">
                <span className="text-lg font-bold">
                  {stats.completedPhases}
                </span>
                <span className="text-sm text-muted-foreground">
                  /{stats.totalPhases}
                </span>
              </div>
              <div className="h-1 mt-1 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all"
                  style={{ width: `${stats.phaseProgressPercent}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-border/30">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">
                  In Progress
                </span>
                <ClockIcon className="size-3.5 text-blue-400" />
              </div>
              <div className="mt-1">
                <span className="text-lg font-bold text-blue-400">
                  {stats.inProgressPhases}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-border/30">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">
                  Budget Used
                </span>
                <BarChart3Icon className="size-3.5 text-amber-400" />
              </div>
              <div className="mt-1">
                <span className="text-lg font-bold">
                  {formatBudget(stats.budgetSpent)}
                </span>
                <span className="text-sm text-muted-foreground">
                  /{formatBudget(stats.totalBudget)}t
                </span>
              </div>
              <div className="h-1 mt-1 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${stats.budgetProgressPercent}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-border/30">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">
                  Milestones
                </span>
                <TargetIcon className="size-3.5 text-purple-400" />
              </div>
              <div className="mt-1">
                <span className="text-lg font-bold text-purple-400">1</span>
                <span className="text-sm text-muted-foreground">/10</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-border/30">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">
                  OKF Compliance
                </span>
                <FileCheckIcon className="size-3.5 text-teal-400" />
              </div>
              <div className="mt-1">
                <span className="text-lg font-bold text-teal-400">100%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-border/30">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">
                  Risks
                </span>
                <ShieldAlertIcon className="size-3.5 text-red-400" />
              </div>
              <div className="mt-1">
                <span className="text-lg font-bold text-red-400">
                  {risks.filter((r) => r.severity === "CRITICAL").length}
                </span>
                <span className="text-sm text-muted-foreground"> critical</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="px-4 pt-3 border-b border-border/50">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8">
            <TabsTrigger value="overview" className="text-xs h-7">
              Overview
            </TabsTrigger>
            <TabsTrigger value="phases" className="text-xs h-7">
              All Phases
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs h-7">
              Timeline
            </TabsTrigger>
            <TabsTrigger value="risks" className="text-xs h-7">
              Risk Register
            </TabsTrigger>
            <TabsTrigger value="okf" className="text-xs h-7">
              OKF + Twenty
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-auto p-4">
        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div className="space-y-4 max-w-5xl">
            {/* Track progress */}
            <Card>
              <CardHeader className="p-3 pb-1.5">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GanttChartIcon className="size-4 text-teal-400" />
                  Track Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-1.5">
                <TrackProgress stats={stats} />
              </CardContent>
            </Card>

            {/* Active phases */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="p-3 pb-1.5">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ClockIcon className="size-4 text-blue-400" />
                    In Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  {inProgressPhases.map((p) => (
                    <PhaseCard key={p.phase} phase={p} />
                  ))}
                  {inProgressPhases.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      No phases in progress
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3 pb-1.5">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TargetIcon className="size-4 text-purple-400" />
                    Milestones
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <MilestoneTracker milestones={milestones} />
                </CardContent>
              </Card>
            </div>

            {/* Dependency graph */}
            <Card>
              <CardHeader className="p-3 pb-1.5">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitBranchIcon className="size-4 text-teal-400" />
                  Dependency Graph
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <DependencyGraph phases={phases} />
              </CardContent>
            </Card>

            {/* Completed phases — compact */}
            <Card>
              <CardHeader className="p-3 pb-1.5">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2Icon className="size-4 text-teal-400" />
                  Completed Phases ({completedPhases.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {completedPhases.map((p) => (
                    <PhaseCard key={p.phase} phase={p} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── ALL PHASES TAB ── */}
        {activeTab === "phases" && (
          <div className="space-y-3 max-w-5xl">
            {/* Filter chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Filter:</span>
              {[
                { label: "All", value: "all" },
                { label: "Planned", value: "PLANNED" },
                { label: "In Progress", value: "IN_PROGRESS" },
                { label: "Complete", value: "COMPLETE" },
                { label: "Knowledge Layer", value: "Knowledge Layer" },
                { label: "Twenty CRM", value: "Twenty CRM" },
                { label: "Platform", value: "Platform" },
                { label: "Ops", value: "Ops" },
                { label: "P0 Only", value: "P0" },
              ].map((f) => (
                <Badge
                  key={f.value}
                  variant={phaseFilter === f.value ? "default" : "outline"}
                  className="cursor-pointer text-[11px]"
                  onClick={() => setPhaseFilter(f.value === phaseFilter ? "all" : f.value)}
                >
                  {f.label}
                </Badge>
              ))}
            </div>

            {/* P0 filter is special — we filter by priority not status/track */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {phaseFilter === "P0"
                ? phases
                    .filter((p) => p.priority === "P0")
                    .map((p) => <PhaseCard key={p.phase} phase={p} />)
                : filteredPhases.map((p) => (
                    <PhaseCard key={p.phase} phase={p} />
                  ))}
            </div>
          </div>
        )}

        {/* ── TIMELINE TAB ── */}
        {activeTab === "timeline" && (
          <div className="space-y-4 max-w-5xl">
            <Card>
              <CardHeader className="p-3 pb-1.5">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarIcon className="size-4 text-teal-400" />
                  20-Week Timeline
                </CardTitle>
                <CardDescription className="text-xs">
                  Each cell = one week. Hover for details.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-1.5">
                <TimelineBar timeline={timeline} />
                <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="size-2.5 rounded-sm bg-teal-500/30 border border-teal-500/40" />
                    Complete
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="size-2.5 rounded-sm bg-blue-500/30 border border-blue-500/40" />
                    Active
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="size-2.5 rounded-sm bg-slate-700/30 border border-slate-700/40" />
                    Planned
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Week breakdown */}
            <Card>
              <CardHeader className="p-3 pb-1.5">
                <CardTitle className="text-sm">Week-by-Week Budget</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-1.5">
                <div className="space-y-1">
                  {timeline.map((t) => (
                    <div
                      key={t.week}
                      className="flex items-center gap-3 text-xs"
                    >
                      <span className="font-mono text-muted-foreground w-12">
                        W{t.week}
                      </span>
                      <div className="flex-1 h-4 bg-slate-800 rounded-sm overflow-hidden">
                        <div
                          className={`h-full rounded-sm transition-all ${
                            t.status === "COMPLETE"
                              ? "bg-teal-500/50"
                              : t.status === "ACTIVE"
                                ? "bg-blue-500/50"
                                : "bg-slate-700/50"
                          }`}
                          style={{
                            width: `${Math.min(100, (t.budget / 16000) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="font-mono text-muted-foreground w-14 text-right">
                        {formatBudget(t.budget)}t
                      </span>
                      <span className="text-muted-foreground w-24 text-right text-[10px]">
                        {t.phases.length > 0
                          ? t.phases.map((p) => `P${p}`).join(", ")
                          : "buffer"}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Milestones in timeline */}
            <Card>
              <CardHeader className="p-3 pb-1.5">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TargetIcon className="size-4 text-purple-400" />
                  Milestone Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-1.5">
                <MilestoneTracker milestones={milestones} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── RISK REGISTER TAB ── */}
        {activeTab === "risks" && (
          <div className="space-y-4 max-w-5xl">
            <Card>
              <CardHeader className="p-3 pb-1.5">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlertIcon className="size-4 text-red-400" />
                  Risk Heatmap
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-1.5">
                <RiskHeatmap risks={risks} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-1.5">
                <CardTitle className="text-sm">Risk Register (10 risks)</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="space-y-1.5">
                  {[...risks]
                    .sort(
                      (a, b) =>
                        (SEVERITY_ORDER[b.severity] || 0) -
                        (SEVERITY_ORDER[a.severity] || 0)
                    )
                    .map((r) => (
                      <div
                        key={r.id}
                        className="flex items-start gap-3 p-2 rounded-md bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          <Badge
                            variant={
                              r.severity === "CRITICAL"
                                ? "destructive"
                                : r.severity === "HIGH"
                                  ? "default"
                                  : "secondary"
                            }
                            className="text-[9px] px-1.5 py-0 h-4"
                          >
                            {r.severity}
                          </Badge>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold font-mono">
                              {r.id}
                            </span>
                            <span className="text-xs">{r.risk}</span>
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 h-4"
                            >
                              {r.probability}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Mitigation: {r.mitigation}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── OKF + TWENTY TAB ── */}
        {activeTab === "okf" && (
          <div className="space-y-4 max-w-5xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="p-3 pb-1.5">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileCheckIcon className="size-4 text-teal-400" />
                    OKF Compliance Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-1.5">
                  <OKFComplianceCard data={okfCompliance} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3 pb-1.5">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <LayersIcon className="size-4 text-blue-400" />
                    Twenty CRM Migration
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-1.5">
                  <TwentyMigrationProgress phases={phases} />
                </CardContent>
              </Card>
            </div>

            {/* Phase list with OKF compliance detail */}
            <Card>
              <CardHeader className="p-3 pb-1.5">
                <CardTitle className="text-sm">
                  All Phases — Status Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">
                          #
                        </th>
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">
                          Phase
                        </th>
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">
                          Track
                        </th>
                        <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">
                          Budget
                        </th>
                        <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">
                          Priority
                        </th>
                        <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">
                          Status
                        </th>
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">
                          Milestone
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {phases.map((p) => {
                        const StatusIcon =
                          STATUS_ICONS[p.status] || CircleIcon;
                        return (
                          <tr
                            key={p.phase}
                            className="border-b border-border/20 hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-1.5 px-2 font-mono">
                              P{p.phase}
                            </td>
                            <td className="py-1.5 px-2">{p.name}</td>
                            <td className="py-1.5 px-2">
                              <div className="flex items-center gap-1">
                                <div
                                  className="size-1.5 rounded-full"
                                  style={{
                                    backgroundColor: trackColor(p.track),
                                  }}
                                />
                                <span className="text-[10px]">
                                  {p.track}
                                </span>
                              </div>
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono">
                              {formatBudget(p.budget)}t
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <Badge
                                variant={priorityBadgeVariant(p.priority)}
                                className="text-[9px] px-1.5 py-0 h-4"
                              >
                                {p.priority}
                              </Badge>
                            </td>
                            <td className="py-1.5 px-2">
                              <div className="flex items-center justify-center gap-1">
                                <StatusIcon
                                  className="size-3"
                                  style={{
                                    color: STATUS_COLORS[p.status],
                                  }}
                                />
                                <span className="text-[10px]">
                                  {p.status.replace("_", " ")}
                                </span>
                              </div>
                            </td>
                            <td className="py-1.5 px-2 font-mono text-[10px]">
                              {p.milestone}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="sticky bottom-0 border-t border-border/50 bg-background/95 backdrop-blur-sm px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          Master Unified Sprint Plan v1.0 · Last updated 2026-06-17
        </span>
        <span>Augment. Do not compete. Push hard. No ceiling.</span>
      </div>
    </div>
  );
}
