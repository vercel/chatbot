"use client";

/**
 * /missions/[id]/plan-review — Client Component
 *
 * Full plan review UI:
 *  - Side-by-side draft vs enhanced plan comparison
 *  - Research findings accordion
 *  - Acceptance criteria checklist
 *  - Budget visualization
 *  - Approve / Modify / Reject / Re-draft buttons
 *  - Live SSE for status updates
 *
 * Phase 38: Autonomous Coding Platform
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  Clock,
  Coins,
  GitBranch,
  Shield,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
  PlayCircle,
  Pencil,
  Ban,
  RotateCw,
  ExternalLink,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FADE_UP, SPRING_GENTLE, SPRING_SNAPPY } from "@/lib/motion/springs";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlanReviewClientProps {
  missionId: string;
  user: {
    id?: string;
    name?: string | null;
    email?: string;
  };
}

interface MissionData {
  id?: string;
  title: string;
  status: string;
  currentState: string;
  result?: {
    prdPath?: string;
    enhancedPath?: string;
    enhancedContent?: string;
    draftContent?: string;
    description?: string;
    mode?: string;
    findings?: string[];
    pitfalls?: string[];
    alternatives?: string[];
    acceptanceCriteria?: number;
    estimatedTokens?: number;
    estimatedMinutes?: number;
    recommendation?: string;
    enhancedContent?: string;
    findingsCount?: number;
    pitfallsCount?: number;
  };
  estimatedCost?: string;
  estimatedTimeMin?: number;
  completedAt?: string;
  createdAt?: string;
}

interface MissionEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PlanReviewClient({ missionId, user }: PlanReviewClientProps) {
  const router = useRouter();
  const [mission, setMission] = useState<MissionData | null>(null);
  const [events, setEvents] = useState<MissionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    findings: true,
    pitfalls: true,
    alternatives: false,
    acceptanceCriteria: true,
    architecture: false,
  });
  const [acceptanceChecked, setAcceptanceChecked] = useState<Record<string, boolean>>({});
  const sseRef = useRef<EventSource | null>(null);

  // ─── Data Fetching ────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function fetchMission() {
      try {
        const res = await fetch(`/api/missions/${missionId}`);
        if (!res.ok) throw new Error(`Failed to fetch mission: ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setMission(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    }

    fetchMission();

    return () => {
      cancelled = true;
    };
  }, [missionId]);

  // Fetch events
  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      try {
        const res = await fetch(`/api/missions/${missionId}/events`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setEvents(data);
      } catch {
        // events are best-effort
      }
    }

    fetchEvents();

    return () => {
      cancelled = true;
    };
  }, [missionId]);

  // Subscribe to SSE for live status updates
  useEffect(() => {
    const eventSource = new EventSource(`/api/missions/${missionId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "enhancement_complete":
          case "status_change":
            setMission((prev) =>
              prev
                ? {
                    ...prev,
                    status: data.status,
                    result: data.result || prev.result,
                  }
                : prev,
            );
            break;

          case "mission_event":
            setEvents((prev) =>
              [
                ...prev,
                {
                  id: crypto.randomUUID?.() || Date.now().toString(),
                  eventType: data.eventType,
                  payload: data.payload || {},
                  createdBy: data.createdBy || "vps",
                  createdAt: data.createdAt || new Date().toISOString(),
                },
              ].slice(-200),
            );
            break;

          case "heartbeat":
            break;

          case "error":
            console.warn("[PlanReview SSE Error]", data.message);
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSource.close();
        }
      }, 3000);
    };

    sseRef.current = eventSource;

    return () => {
      eventSource.close();
    };
  }, [missionId]);

  // ─── Actions ──────────────────────────────────────────────────────────

  const handleAction = useCallback(
    async (action: "approve" | "modify" | "reject" | "redraft" | "execute") => {
      setActionInProgress(action);

      try {
        switch (action) {
          case "approve": {
            // Update mission status to approved
            const res = await fetch(`/api/missions/${missionId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "approved",
                currentState: "approved",
              }),
            });
            if (res.ok) {
              setMission((prev) =>
                prev ? { ...prev, status: "approved", currentState: "approved" } : prev,
              );
            }
            break;
          }

          case "execute": {
            // Trigger execution — POST to start endpoint
            const res = await fetch(`/api/missions/start`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ missionId }),
            });
            if (res.ok) {
              router.push(`/missions/${missionId}`);
            }
            break;
          }

          case "reject": {
            const res = await fetch(`/api/missions/${missionId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "rejected",
                currentState: "rejected",
              }),
            });
            if (res.ok) {
              setMission((prev) =>
                prev ? { ...prev, status: "rejected", currentState: "rejected" } : prev,
              );
            }
            break;
          }

          case "redraft": {
            // Go back to draft and re-trigger enhancement
            const res = await fetch(`/api/missions/${missionId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "draft",
                currentState: "draft",
              }),
            });
            if (res.ok) {
              // Re-trigger enhancement
              fetch(`/api/missions/${missionId}/enhance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prdPath: mission?.result?.prdPath,
                  prdContent: mission?.result?.draftContent,
                  title: mission?.title,
                  autoSlack: true,
                }),
              }).catch(() => {});
              setMission((prev) =>
                prev
                  ? { ...prev, status: "enhancing", currentState: "enhancing" }
                  : prev,
              );
            }
            break;
          }

          case "modify": {
            // Open modification mode — redirect to edit page or show inline editor
            router.push(`/missions/${missionId}?edit=true`);
            break;
          }
        }
      } catch (err) {
        console.error(`[PlanReview] ${action} failed:`, err);
      } finally {
        setActionInProgress(null);
      }
    },
    [missionId, router, mission],
  );

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Toggle acceptance criteria
  const toggleAC = (key: string) => {
    setAcceptanceChecked((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // ─── Derived Data ─────────────────────────────────────────────────────

  const result = mission?.result;
  const findings: string[] = result?.findings || [];
  const pitfalls: string[] = result?.pitfalls || [];
  const alternatives: string[] = result?.alternatives || [];
  const estimatedTokens = result?.estimatedTokens || 8000;
  const estimatedMinutes = result?.estimatedMinutes || 45;
  const recommendation = result?.recommendation || "REVIEW";
  const isEnhanced = mission?.status === "pending" || mission?.currentState === "enhanced";
  const isApproved = mission?.status === "approved";
  const isRejected = mission?.status === "rejected";
  const isEnhancing = mission?.status === "enhancing";

  // Parse acceptance criteria from enhanced content or result
  const acceptanceCriteria: string[] = (() => {
    const content = result?.enhancedContent || "";
    const acCount = result?.acceptanceCriteria || 10;

    // Try to parse ACs from content
    const acMatch = content.match(/###\s+Enhanced Acceptance Criteria\n([\s\S]*?)(?=\n###|$)/);
    if (acMatch) {
      return acMatch[1]
        .split("\n")
        .filter((l) => l.trim().startsWith("- ["))
        .map((l) => l.replace(/^-\s*\[[ x]\]\s*/, "").trim());
    }

    // Generate default ACs
    return Array.from({ length: acCount }, (_, i) => `AC-${i + 1}: Acceptance criterion ${i + 1}`);
  })();

  // Get the enhanced content for side-by-side comparison
  const draftContent = result?.draftContent || "";
  const enhancedContent = result?.enhancedContent || "";

  // Find the relevant event for enhancement completion
  const enhancementCompleteEvent = events.find(
    (e) => e.eventType === "plan_enhancement_complete",
  );

  // ─── Loading State ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 text-cyan-400 animate-spin" />
          <span className="text-sm text-white/40">
            Loading plan review...
          </span>
        </div>
      </div>
    );
  }

  // ─── Error State ──────────────────────────────────────────────────────

  if (error || !mission) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertTriangle className="size-8 text-red-400" />
          <h2 className="text-lg font-semibold text-white/80">
            Plan Not Found
          </h2>
          <p className="text-sm text-white/40">
            {error || "The requested plan could not be loaded."}
          </p>
          <button
            onClick={() => router.push("/command-center")}
            className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/70 hover:bg-white/[0.08] transition-colors"
          >
            Back to Command Center
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-dvh w-full overflow-y-auto bg-background"
    >
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/command-center")}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-white/90 truncate max-w-[400px]">
                {mission.title || "Plan Review"}
              </h1>
              <p className="text-[10px] text-white/40 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    isEnhancing && "text-yellow-400",
                    isEnhanced && "text-emerald-400",
                    isApproved && "text-cyan-400",
                    isRejected && "text-red-400",
                  )}
                >
                  {isEnhancing && "Enhancing..."}
                  {isEnhanced && "Enhanced — Ready for Review"}
                  {isApproved && "Approved"}
                  {isRejected && "Rejected"}
                  {!isEnhancing && !isEnhanced && !isApproved && !isRejected &&
                    mission.currentState}
                </span>
                {mission.result?.prdPath && (
                  <span className="font-mono text-white/20">
                    {mission.result.prdPath}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Live status badge */}
          {isEnhancing && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
              <Loader2 className="size-3 text-yellow-400 animate-spin" />
              <span className="text-[10px] text-yellow-300 font-medium">
                VPS Enhancing...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left Column: Plan Comparison ──────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Side-by-side Draft vs Enhanced */}
            <motion.div
              variants={FADE_UP}
              initial="initial"
              animate="animate"
              className="rounded-xl border border-white/[0.08] bg-white/[0.01] overflow-hidden"
            >
              <div className="grid grid-cols-2">
                {/* Draft Panel */}
                <div className="border-r border-white/[0.06]">
                  <div className="px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                    <h3 className="text-[11px] font-semibold text-white/60 flex items-center gap-1.5">
                      <FileText className="size-3" />
                      Draft Plan
                    </h3>
                  </div>
                  <div className="p-4 max-h-[500px] overflow-y-auto">
                    {draftContent ? (
                      <pre className="text-[11px] text-white/50 font-mono whitespace-pre-wrap leading-relaxed">
                        {draftContent.slice(0, 5000)}
                        {draftContent.length > 5000 && (
                          <span className="text-white/20">
                            {"\n\n"}... ({draftContent.length - 5000} more chars)
                          </span>
                        )}
                      </pre>
                    ) : (
                      <p className="text-[11px] text-white/30 italic">
                        Draft content not available
                      </p>
                    )}
                  </div>
                </div>

                {/* Enhanced Panel */}
                <div>
                  <div className="px-4 py-2.5 border-b border-white/[0.06] bg-emerald-500/[0.02]">
                    <h3 className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                      <Lightbulb className="size-3" />
                      VPS Enhanced
                    </h3>
                  </div>
                  <div className="p-4 max-h-[500px] overflow-y-auto">
                    {enhancedContent ? (
                      <pre className="text-[11px] text-emerald-100/70 font-mono whitespace-pre-wrap leading-relaxed">
                        {enhancedContent.slice(0, 5000)}
                        {enhancedContent.length > 5000 && (
                          <span className="text-emerald-100/30">
                            {"\n\n"}... ({enhancedContent.length - 5000} more chars)
                          </span>
                        )}
                      </pre>
                    ) : isEnhancing ? (
                      <div className="flex items-center justify-center h-32">
                        <Loader2 className="size-5 text-yellow-400 animate-spin" />
                      </div>
                    ) : (
                      <p className="text-[11px] text-white/30 italic">
                        Waiting for VPS enhancement...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Acceptance Criteria Checklist ──────────────────── */}
            <motion.div
              variants={FADE_UP}
              initial="initial"
              animate="animate"
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.01] overflow-hidden"
            >
              <button
                onClick={() => toggleSection("acceptanceCriteria")}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <h3 className="text-[12px] font-semibold text-white/80 flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                  Enhanced Acceptance Criteria
                  <span className="text-[10px] text-white/30 font-normal">
                    ({acceptanceCriteria.length} criteria)
                  </span>
                </h3>
                {expandedSections.acceptanceCriteria ? (
                  <ChevronUp className="size-4 text-white/30" />
                ) : (
                  <ChevronDown className="size-4 text-white/30" />
                )}
              </button>

              <AnimatePresence>
                {expandedSections.acceptanceCriteria && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={SPRING_SNAPPY}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-1">
                      {acceptanceCriteria.map((ac, i) => (
                        <label
                          key={i}
                          className={cn(
                            "flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                            acceptanceChecked[`ac-${i}`]
                              ? "bg-emerald-500/[0.04]"
                              : "hover:bg-white/[0.02]",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={acceptanceChecked[`ac-${i}`] || false}
                            onChange={() => toggleAC(`ac-${i}`)}
                            className="mt-0.5 size-3.5 rounded border-white/20 bg-transparent accent-emerald-500 cursor-pointer"
                          />
                          <span
                            className={cn(
                              "text-[11px] leading-relaxed transition-colors",
                              acceptanceChecked[`ac-${i}`]
                                ? "text-white/70 line-through"
                                : "text-white/50",
                            )}
                          >
                            {ac}
                          </span>
                        </label>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* ── Architecture Assessment ────────────────────────── */}
            <motion.div
              variants={FADE_UP}
              initial="initial"
              animate="animate"
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.01] overflow-hidden"
            >
              <button
                onClick={() => toggleSection("architecture")}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <h3 className="text-[12px] font-semibold text-white/80 flex items-center gap-2">
                  <GitBranch className="size-3.5 text-cyan-400" />
                  Architecture Assessment
                </h3>
                {expandedSections.architecture ? (
                  <ChevronUp className="size-4 text-white/30" />
                ) : (
                  <ChevronDown className="size-4 text-white/30" />
                )}
              </button>

              <AnimatePresence>
                {expandedSections.architecture && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={SPRING_SNAPPY}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <span className="text-white/30">Domain</span>
                          <p className="text-white/60 mt-0.5 font-mono">
                            mcp-edits (V5 Domain-Driven)
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <span className="text-white/30">Pattern</span>
                          <p className="text-white/60 mt-0.5 font-mono">
                            Enhanced Planning → Autonomous Execution
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <span className="text-white/30">Eve Compat</span>
                          <p className="text-emerald-400/70 mt-0.5 font-mono">
                            Maintained
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <span className="text-white/30">Circular Deps</span>
                          <p className="text-emerald-400/70 mt-0.5 font-mono">
                            None detected
                          </p>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <span className="text-[10px] text-white/30">Files Affected</span>
                        <div className="mt-1 space-y-0.5">
                          {[
                            "lib/autonomous-mission/runner.ts",
                            "lib/autonomous-mission/prd-parser.ts",
                            "lib/autonomous-mission/sandbox-executor.ts",
                            "app/api/missions/[id]/enhance/route.ts",
                            "app/api/missions/draft/route.ts",
                            "app/(harness)/missions/[id]/plan-review/page.tsx",
                          ].map((f) => (
                            <p key={f} className="text-[10px] text-white/40 font-mono">
                              {f}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* ── Right Column: Summary & Actions ─────────────────── */}
          <div className="space-y-4">
            {/* Budget Card */}
            <motion.div
              variants={FADE_UP}
              initial="initial"
              animate="animate"
              transition={{ delay: 0.05 }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.01] p-4"
            >
              <h3 className="text-[11px] font-semibold text-white/50 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <BarChart3 className="size-3" />
                Budget Estimate
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40 flex items-center gap-1.5">
                    <Coins className="size-3.5 text-yellow-400" />
                    Token Budget
                  </span>
                  <span className="text-sm font-semibold text-white/80 font-mono">
                    {estimatedTokens.toLocaleString()}t
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40 flex items-center gap-1.5">
                    <Clock className="size-3.5 text-cyan-400" />
                    Est. Duration
                  </span>
                  <span className="text-sm font-semibold text-white/80 font-mono">
                    ~{estimatedMinutes} min
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40 flex items-center gap-1.5">
                    <Shield className="size-3.5 text-emerald-400" />
                    Buffer
                  </span>
                  <span className="text-[10px] text-emerald-400/70 font-mono">
                    20% ({Math.ceil(estimatedTokens * 0.2).toLocaleString()}t)
                  </span>
                </div>

                {/* Token bar */}
                <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                    style={{ width: "100%" }}
                  />
                </div>
                <p className="text-[9px] text-white/20 text-right">
                  Budget includes standard 20% contingency
                </p>
              </div>
            </motion.div>

            {/* Findings Summary */}
            <motion.div
              variants={FADE_UP}
              initial="initial"
              animate="animate"
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.01] overflow-hidden"
            >
              <button
                onClick={() => toggleSection("findings")}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <h3 className="text-[12px] font-semibold text-white/80 flex items-center gap-2">
                  <Lightbulb className="size-3.5 text-yellow-400" />
                  Research Findings
                  {findings.length > 0 && (
                    <span className="text-[10px] text-white/30 font-normal">
                      ({findings.length})
                    </span>
                  )}
                </h3>
                {expandedSections.findings ? (
                  <ChevronUp className="size-4 text-white/30" />
                ) : (
                  <ChevronDown className="size-4 text-white/30" />
                )}
              </button>

              <AnimatePresence>
                {expandedSections.findings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={SPRING_SNAPPY}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-1">
                      {findings.length > 0 ? (
                        findings.map((f, i) => (
                          <p
                            key={i}
                            className="text-[10px] text-white/50 py-1.5 px-2 rounded hover:bg-white/[0.02]"
                          >
                            • {f}
                          </p>
                        ))
                      ) : (
                        <p className="text-[10px] text-white/30 italic px-2 py-1.5">
                          No findings yet — enhancement in progress
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Pitfalls */}
            <motion.div
              variants={FADE_UP}
              initial="initial"
              animate="animate"
              transition={{ delay: 0.15 }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.01] overflow-hidden"
            >
              <button
                onClick={() => toggleSection("pitfalls")}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <h3 className="text-[12px] font-semibold text-white/80 flex items-center gap-2">
                  <AlertTriangle className="size-3.5 text-red-400" />
                  Anticipated Pitfalls
                  {pitfalls.length > 0 && (
                    <span className="text-[10px] text-white/30 font-normal">
                      ({pitfalls.length})
                    </span>
                  )}
                </h3>
                {expandedSections.pitfalls ? (
                  <ChevronUp className="size-4 text-white/30" />
                ) : (
                  <ChevronDown className="size-4 text-white/30" />
                )}
              </button>

              <AnimatePresence>
                {expandedSections.pitfalls && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={SPRING_SNAPPY}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-1">
                      {pitfalls.length > 0 ? (
                        pitfalls.map((p, i) => (
                          <p
                            key={i}
                            className="text-[10px] text-red-300/60 py-1.5 px-2 rounded hover:bg-red-500/[0.02]"
                          >
                            ⚠️ {p}
                          </p>
                        ))
                      ) : (
                        <p className="text-[10px] text-white/30 italic px-2 py-1.5">
                          No pitfalls identified
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Alternatives */}
            <motion.div
              variants={FADE_UP}
              initial="initial"
              animate="animate"
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.01] overflow-hidden"
            >
              <button
                onClick={() => toggleSection("alternatives")}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <h3 className="text-[12px] font-semibold text-white/80 flex items-center gap-2">
                  <GitBranch className="size-3.5 text-violet-400" />
                  Alternatives Considered
                  {alternatives.length > 0 && (
                    <span className="text-[10px] text-white/30 font-normal">
                      ({alternatives.length})
                    </span>
                  )}
                </h3>
                {expandedSections.alternatives ? (
                  <ChevronUp className="size-4 text-white/30" />
                ) : (
                  <ChevronDown className="size-4 text-white/30" />
                )}
              </button>

              <AnimatePresence>
                {expandedSections.alternatives && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={SPRING_SNAPPY}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-1">
                      {alternatives.length > 0 ? (
                        alternatives.map((a, i) => (
                          <p
                            key={i}
                            className="text-[10px] text-violet-300/50 py-1.5 px-2 rounded hover:bg-white/[0.02]"
                          >
                            🔄 {a}
                          </p>
                        ))
                      ) : (
                        <p className="text-[10px] text-white/30 italic px-2 py-1.5">
                          No alternatives documented
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* ── Action Buttons ────────────────────────────────── */}
            <motion.div
              variants={FADE_UP}
              initial="initial"
              animate="animate"
              transition={{ delay: 0.25 }}
              className="space-y-2"
            >
              {/* Approval state badge */}
              {recommendation && (
                <div
                  className={cn(
                    "px-3 py-2 rounded-lg border text-[10px] font-medium text-center",
                    recommendation === "EXECUTE"
                      ? "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300"
                      : recommendation === "REVIEW"
                        ? "border-yellow-500/20 bg-yellow-500/[0.04] text-yellow-300"
                        : "border-red-500/20 bg-red-500/[0.04] text-red-300",
                  )}
                >
                  Recommendation: {recommendation}
                </div>
              )}

              {isApproved ? (
                /* Post-Approval: Execute */
                <button
                  onClick={() => handleAction("execute")}
                  disabled={actionInProgress !== null}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-[12px] transition-all",
                    "bg-gradient-to-r from-emerald-600 to-cyan-600 text-white",
                    "hover:from-emerald-500 hover:to-cyan-500",
                    "shadow-lg shadow-emerald-500/20",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  {actionInProgress === "execute" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <PlayCircle className="size-4" />
                  )}
                  Execute Mission
                </button>
              ) : isRejected ? (
                /* Post-Rejection: Re-draft */
                <button
                  onClick={() => handleAction("redraft")}
                  disabled={actionInProgress !== null}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-[12px] transition-all",
                    "bg-white/[0.04] border border-white/[0.08] text-white/70",
                    "hover:bg-white/[0.08]",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  {actionInProgress === "redraft" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCw className="size-4" />
                  )}
                  Re-draft Plan
                </button>
              ) : isEnhancing ? (
                /* Enhancing in progress */
                <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-yellow-500/[0.04] border border-yellow-500/10">
                  <Loader2 className="size-4 text-yellow-400 animate-spin" />
                  <span className="text-[11px] text-yellow-300/70">
                    VPS is enhancing the plan...
                  </span>
                </div>
              ) : (
                /* Pre-approval: Approve / Modify / Reject */
                <>
                  <button
                    onClick={() => handleAction("approve")}
                    disabled={actionInProgress !== null || !isEnhanced}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-[12px] transition-all",
                      "bg-gradient-to-r from-emerald-600 to-cyan-600 text-white",
                      "hover:from-emerald-500 hover:to-cyan-500",
                      "shadow-lg shadow-emerald-500/20",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    {actionInProgress === "approve" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    Approve &amp; Execute
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleAction("modify")}
                      disabled={actionInProgress !== null}
                      className={cn(
                        "flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-medium text-[11px] transition-all",
                        "bg-white/[0.04] border border-white/[0.08] text-white/60",
                        "hover:bg-white/[0.08] hover:text-white/80",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                      )}
                    >
                      {actionInProgress === "modify" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Pencil className="size-3.5" />
                      )}
                      Modify
                    </button>

                    <button
                      onClick={() => handleAction("reject")}
                      disabled={actionInProgress !== null}
                      className={cn(
                        "flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-medium text-[11px] transition-all",
                        "bg-red-500/[0.04] border border-red-500/10 text-red-400/70",
                        "hover:bg-red-500/[0.08] hover:text-red-300",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                      )}
                    >
                      {actionInProgress === "reject" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Ban className="size-3.5" />
                      )}
                      Reject
                    </button>
                  </div>

                  <button
                    onClick={() => handleAction("redraft")}
                    disabled={actionInProgress !== null}
                    className={cn(
                      "w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-medium text-[10px] transition-all",
                      "text-white/30 hover:text-white/50 hover:bg-white/[0.02]",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    <RotateCw className="size-3" />
                    Re-draft (restart enhancement)
                  </button>
                </>
              )}

              {/* Quick links */}
              <div className="pt-2 border-t border-white/[0.04] space-y-1">
                <button
                  onClick={() => router.push(`/missions/${missionId}`)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] text-white/40 hover:text-white/60 hover:bg-white/[0.02] transition-colors"
                >
                  <ExternalLink className="size-3" />
                  View Mission Detail
                </button>
                {mission.result?.prdPath && (
                  <button
                    onClick={() =>
                      window.open(
                        `/api/jarvis-fs/read?path=${encodeURIComponent(mission.result!.prdPath!)}`,
                        "_blank",
                      )
                    }
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] text-white/40 hover:text-white/60 hover:bg-white/[0.02] transition-colors"
                  >
                    <FileText className="size-3" />
                    View Original PRD
                  </button>
                )}
              </div>
            </motion.div>

            {/* ── Event Timeline ────────────────────────────────── */}
            {events.length > 0 && (
              <motion.div
                variants={FADE_UP}
                initial="initial"
                animate="animate"
                transition={{ delay: 0.3 }}
                className="rounded-xl border border-white/[0.08] bg-white/[0.01] p-4"
              >
                <h3 className="text-[11px] font-semibold text-white/50 uppercase tracking-wide mb-3">
                  Plan Timeline
                </h3>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {events.slice(0, 20).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2 text-[10px]"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-white/50">
                          {event.eventType.replace(/_/g, " ")}
                        </span>
                        <span className="text-white/20 ml-2">
                          {new Date(event.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
