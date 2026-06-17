"use client";

/**
 * Phase 25 — MissionCard: THE HERO component
 *
 * Multi-step mission tracker with 4 visual states:
 *   inline (300px) → expanded (700px) → canvas (full panel) → sandbox-linked (iframe)
 *
 * Features:
 *  - framer-motion spring physics state transitions
 *  - Glass primitives from Phase 22
 *  - Nested child card rendering (recursive)
 *  - SSE-subscribed to /api/missions/[id]/stream
 *  - URL hash sync: ?mission=<id>&state=canvas
 *  - Mobile-first 375px
 *  - useContext + useReducer state machine
 */

import {
  useState,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  createContext,
  useContext,
  type Dispatch,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Minimize2,
  Maximize2,
  X,
  Play,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ExternalLink,
  Save,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SPRING_GENTLE,
  SPRING_SNAPPY,
  FADE_UP,
  staggerEnter,
  STAGGER_ITEM,
} from "@/lib/motion/springs";
import type { MissionSubStep } from "@/lib/ai/tools/create-mission";

// ── Types ──────────────────────────────────────────────────────────────────

export type MissionState = "inline" | "expanded" | "canvas" | "sandbox-linked";

export interface MissionCardData {
  missionId: string;
  title: string;
  status: string;
  steps: MissionSubStep[];
  estimatedCost?: number;
  estimatedTime?: number;
  currentState?: MissionState;
  v2SessionId?: string;
  sandboxUrl?: string;
  /** Phase 32: Link to CRM record on completion */
  crmRecordId?: string;
  crmRecordType?: string;
  /** Phase 32: Error details for failed steps */
  lastError?: string;
}

interface MissionCardProps {
  mission: MissionCardData;
  className?: string;
  onStateChange?: (state: MissionState) => void;
  onSaveAsWorkflow?: () => void;
  /** Phase 32: Navigate the Twenty iframe to a CRM record */
  onViewInCRM?: (recordType: string, recordId: string) => void;
  /** Phase 32: Retry the mission */
  onRetry?: () => void;
}

// ── Action Types ────────────────────────────────────────────────────────────

type MissionAction =
  | { type: "SET_STATE"; state: MissionState }
  | { type: "TOGGLE_EXPANDED" }
  | { type: "OPEN_CANVAS" }
  | { type: "OPEN_SANDBOX" }
  | { type: "COLLAPSE" }
  | { type: "UPDATE_STEPS"; steps: MissionSubStep[] }
  | { type: "SET_STATUS"; status: string }
  | { type: "SET_SANDBOX_URL"; url: string };

interface MissionStateCtx {
  state: MissionState;
  mission: MissionCardData;
}

function missionReducer(
  prev: MissionStateCtx,
  action: MissionAction
): MissionStateCtx {
  switch (action.type) {
    case "SET_STATE":
      return { ...prev, state: action.state };
    case "TOGGLE_EXPANDED":
      return {
        ...prev,
        state: prev.state === "expanded" ? "inline" : "expanded",
      };
    case "OPEN_CANVAS":
      return { ...prev, state: "canvas" };
    case "OPEN_SANDBOX":
      return { ...prev, state: "sandbox-linked" };
    case "COLLAPSE":
      return { ...prev, state: "inline" };
    case "UPDATE_STEPS":
      return {
        ...prev,
        mission: { ...prev.mission, steps: action.steps },
      };
    case "SET_STATUS":
      return {
        ...prev,
        mission: { ...prev.mission, status: action.status },
      };
    case "SET_SANDBOX_URL":
      return {
        ...prev,
        mission: { ...prev.mission, sandboxUrl: action.url },
      };
    default:
      return prev;
  }
}

// ── Context ─────────────────────────────────────────────────────────────────

const MissionCardContext = createContext<{
  ctx: MissionStateCtx;
  dispatch: Dispatch<MissionAction>;
} | null>(null);

function useMissionCard() {
  const c = useContext(MissionCardContext);
  if (!c) throw new Error("useMissionCard must be inside MissionCard");
  return c;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StepIcon({ status }: { status: MissionSubStep["status"] }) {
  switch (status) {
    case "complete":
      return <CheckCircle2 className="size-3.5 text-emerald-400" />;
    case "running":
      return <Loader2 className="size-3.5 text-cyan-400 animate-spin" />;
    case "failed":
      return <AlertTriangle className="size-3.5 text-red-400" />;
    default:
      return <Circle className="size-3.5 text-white/20" />;
  }
}

function StepRow({
  step,
  index,
  isActive,
}: {
  step: MissionSubStep;
  index: number;
  isActive: boolean;
}) {
  return (
    <motion.div
      variants={STAGGER_ITEM}
      className={cn(
        "flex items-start gap-2.5 py-2 px-2 -mx-2 rounded-lg transition-colors",
        isActive && "bg-white/[0.04]"
      )}
    >
      <div className="mt-0.5 shrink-0">
        <StepIcon status={step.status} />
      </div>
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-[12px] leading-snug",
            isActive ? "text-white/90" : "text-white/50",
            step.status === "complete" && "text-white/40 line-through"
          )}
        >
          {index + 1}. {step.name}
        </span>
        {step.evidence.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {step.evidence.map((ev, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.04] border border-white/5 text-white/40"
              >
                {ev}
              </span>
            ))}
          </div>
        )}
        {/* Nested child cards */}
        {step.childCards && step.childCards.length > 0 && (
          <div className="mt-2 space-y-1.5 pl-1 border-l border-white/[0.06]">
            {step.childCards.map((card: Record<string, unknown>, ci: number) => (
              <div
                key={ci}
                className="px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04] text-[10px] text-white/40"
              >
                {(card as { type?: string; title?: string }).type ||
                  (card as { type?: string; title?: string }).title ||
                  "Card"}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function MissionCard({
  mission: initialMission,
  className,
  onStateChange,
  onSaveAsWorkflow,
  onViewInCRM,
  onRetry,
}: MissionCardProps) {
  const [ctx, dispatch] = useReducer(missionReducer, {
    state: (initialMission.currentState as MissionState) || "inline",
    mission: initialMission,
  });

  // URL hash sync
  useEffect(() => {
    if (ctx.state === "canvas") {
      window.location.hash = `mission=${ctx.mission.missionId}&state=canvas`;
    } else if (ctx.state !== "inline") {
      window.location.hash = `mission=${ctx.mission.missionId}&state=${ctx.state}`;
    }
  }, [ctx.state, ctx.mission.missionId]);

  // Notify parent
  useEffect(() => {
    onStateChange?.(ctx.state);
  }, [ctx.state, onStateChange]);

  // SSE subscription
  useEffect(() => {
    if (!ctx.mission.missionId) return;
    const eventSource = new EventSource(
      `/api/missions/${ctx.mission.missionId}/stream`
    );
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "step_update" && data.steps) {
          dispatch({ type: "UPDATE_STEPS", steps: data.steps });
        } else if (data.type === "status_change" && data.status) {
          dispatch({ type: "SET_STATUS", status: data.status });
        } else if (data.type === "sandbox_ready" && data.url) {
          dispatch({ type: "SET_SANDBOX_URL", url: data.url });
        }
      } catch {
        // ignore parse errors
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
    };
    return () => eventSource.close();
  }, [ctx.mission.missionId]);

  const { mission, state } = ctx;
  const completedCount = mission.steps.filter(
    (s) => s.status === "complete"
  ).length;
  const runningStep = mission.steps.find((s) => s.status === "running");
  const hasSandbox = state === "sandbox-linked" && !!mission.sandboxUrl;

  // Suggest canvas for deploy steps
  const deployStepActive = mission.steps.some(
    (s) => (s as { type?: string }).type === "deploy" && s.status === "running"
  );

  return (
    <MissionCardContext.Provider value={{ ctx, dispatch }}>
      <motion.div
        initial={FADE_UP.initial}
        animate={FADE_UP.animate}
        transition={SPRING_GENTLE}
        className={cn(
          "relative overflow-hidden rounded-xl border backdrop-blur-xl",
          "border-white/10 bg-white/[0.04]",
          "shadow-[0_4px_24px_rgba(0,0,0,0.08)]",
          "w-full max-w-[375px] sm:max-w-[700px]",
          state === "expanded" && "max-w-[700px] shadow-[0_8px_40px_rgba(0,0,0,0.16)]",
          state === "canvas" && "fixed inset-4 z-50 max-w-none rounded-2xl",
          state === "sandbox-linked" && "fixed inset-4 z-50 max-w-none rounded-2xl",
          className
        )}
        role="region"
        aria-label={`Mission: ${mission.title}`}
      >
        {/* Glass shimmer */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

        <div className="relative">
          {/* ── INLINE STATE ────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {(state === "inline" || state === "expanded") && (
              <motion.div
                key="inline-body"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Header */}
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-7 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                        <Play className="size-3.5 text-cyan-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-semibold text-white/90 truncate">
                          {mission.title}
                        </h3>
                        <p className="text-[10px] text-white/40">
                          {completedCount}/{mission.steps.length} steps ·{" "}
                          {mission.status === "running" ? "In progress" : mission.status}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        dispatch({
                          type:
                            state === "expanded"
                              ? "COLLAPSE"
                              : "TOGGLE_EXPANDED",
                        } as MissionAction)
                      }
                      className="p-1.5 rounded-md hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors shrink-0"
                      aria-label={state === "expanded" ? "Collapse" : "Expand"}
                    >
                      <ChevronRight
                        className={cn(
                          "size-4 transition-transform",
                          state === "expanded" && "rotate-90"
                        )}
                      />
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                      initial={{ width: "0%" }}
                      animate={{
                        width: `${
                          mission.steps.length > 0
                            ? (completedCount / mission.steps.length) * 100
                            : 0
                        }%`,
                      }}
                      transition={SPRING_GENTLE}
                    />
                  </div>

                  {/* Current step */}
                  {runningStep && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-white/50">
                      <Loader2 className="size-3 text-cyan-400 animate-spin" />
                      <span className="truncate">Now: {runningStep.name}</span>
                    </div>
                  )}
                </div>

                {/* ── EXPANDED: Step list ──────────────────────────── */}
                <AnimatePresence>
                  {state === "expanded" && (
                    <motion.div
                      key="expanded-steps"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-white/[0.06]"
                    >
                      <motion.div
                        variants={staggerEnter(20) as any}
                        initial="initial"
                        animate="animate"
                        className="px-3 py-2 space-y-0.5"
                      >
                        {mission.steps.map((step, i) => (
                          <StepRow
                            key={step.id}
                            step={step}
                            index={i}
                            isActive={step.status === "running"}
                          />
                        ))}
                      </motion.div>

                      {/* Action bar */}
                      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/[0.06] flex-wrap">
                        <button
                          onClick={() => dispatch({ type: "OPEN_CANVAS" })}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/60 hover:bg-white/[0.08] transition-colors"
                        >
                          <Maximize2 className="size-3" />
                          Open in Canvas
                        </button>
                        {deployStepActive && (
                          <button
                            onClick={() => dispatch({ type: "OPEN_SANDBOX" })}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                          >
                            <ExternalLink className="size-3" />
                            Sandbox Preview
                          </button>
                        )}
                        {/* Phase 32: Retry on failed */}
                        {mission.status === "failed" && onRetry && (
                          <button
                            onClick={onRetry}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            <RefreshCw className="size-3" />
                            Retry
                          </button>
                        )}
                        {/* Phase 32: View in CRM */}
                        {mission.status === "completed" && mission.crmRecordId && onViewInCRM && (
                          <button
                            onClick={() => onViewInCRM(mission.crmRecordType || "Person", mission.crmRecordId!)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          >
                            <ExternalLink className="size-3" />
                            View in CRM
                          </button>
                        )}
                        <button
                          onClick={onSaveAsWorkflow}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/60 hover:bg-white/[0.08] transition-colors ml-auto"
                        >
                          <Save className="size-3" />
                          Save as Workflow
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── CANVAS STATE ────────────────────────────────────────── */}
          <AnimatePresence>
            {state === "canvas" && !hasSandbox && (
              <motion.div
                key="canvas"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={SPRING_SNAPPY}
                className="p-4 h-full flex flex-col"
              >
                {/* Canvas header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Play className="size-4 text-cyan-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white/90">
                        {mission.title}
                      </h2>
                      <p className="text-[10px] text-white/40">
                        Canvas View · {completedCount}/{mission.steps.length}{" "}
                        complete
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {deployStepActive && (
                      <button
                        onClick={() => dispatch({ type: "OPEN_SANDBOX" })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                      >
                        <ExternalLink className="size-3" />
                        Open Sandbox
                      </button>
                    )}
                    <button
                      onClick={() => dispatch({ type: "COLLAPSE" })}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80"
                      aria-label="Close canvas"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Step list full */}
                <div className="flex-1 overflow-y-auto">
                  <motion.div
                    variants={staggerEnter(30) as any}
                    initial="initial"
                    animate="animate"
                    className="space-y-1"
                  >
                    {mission.steps.map((step, i) => (
                      <motion.div
                        key={step.id}
                        variants={STAGGER_ITEM}
                        className={cn(
                          "p-3 rounded-lg border",
                          step.status === "running"
                            ? "bg-cyan-500/[0.04] border-cyan-500/20"
                            : "bg-white/[0.02] border-white/[0.04]"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <StepIcon status={step.status} />
                          <span
                            className={cn(
                              "text-[12px]",
                              step.status === "running"
                                ? "text-white/90 font-medium"
                                : "text-white/50"
                            )}
                          >
                            {i + 1}. {step.name}
                          </span>
                        </div>
                        {step.evidence.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 pl-6">
                            {step.evidence.map((ev, ei) => (
                              <span
                                key={ei}
                                className="px-2 py-0.5 rounded text-[10px] bg-white/[0.03] border border-white/[0.06] text-white/40 font-mono"
                              >
                                {ev}
                              </span>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                </div>

                {/* Phase 32: Error details */}
                {mission.status === "failed" && mission.lastError && (
                  <div className="mt-3 p-3 rounded-lg bg-red-500/[0.04] border border-red-500/15">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="size-3.5 text-red-400" />
                      <span className="text-[11px] font-medium text-red-400">Error</span>
                    </div>
                    <p className="text-[10px] text-red-400/70 font-mono">{mission.lastError}</p>
                  </div>
                )}

                {/* Canvas footer */}
                <div className="flex gap-2 pt-3 border-t border-white/[0.06] mt-3 flex-wrap">
                  {mission.status === "failed" && onRetry && (
                    <button
                      onClick={onRetry}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <RefreshCw className="size-3.5" />
                      Retry Mission
                    </button>
                  )}
                  {mission.status === "completed" && mission.crmRecordId && onViewInCRM && (
                    <button
                      onClick={() => onViewInCRM(mission.crmRecordType || "Person", mission.crmRecordId!)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[12px] text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      <ExternalLink className="size-3.5" />
                      View in CRM
                    </button>
                  )}
                  <button
                    onClick={onSaveAsWorkflow}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/60 hover:bg-white/[0.08] transition-colors"
                  >
                    <Save className="size-3.5" />
                    Save as Workflow
                  </button>
                  <button
                    onClick={() => dispatch({ type: "COLLAPSE" })}
                    className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/60 hover:bg-white/[0.08] transition-colors"
                  >
                    Back to Chat
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── SANDBOX-LINKED STATE ────────────────────────────────── */}
          <AnimatePresence>
            {(state === "sandbox-linked" || hasSandbox) && (
              <motion.div
                key="sandbox"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full"
              >
                {/* Sandbox header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <ExternalLink className="size-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-[12px] font-medium text-white/80">
                        Sandbox Preview
                      </h3>
                      <p className="text-[10px] text-white/40">
                        {mission.title} · Deploy in progress
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => dispatch({ type: "OPEN_CANVAS" })}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80"
                    >
                      <Minimize2 className="size-3.5" />
                    </button>
                    <button
                      onClick={() => dispatch({ type: "COLLAPSE" })}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sandbox iframe */}
                {mission.sandboxUrl ? (
                  <iframe
                    src={mission.sandboxUrl}
                    className="flex-1 w-full border-0"
                    title="Sandbox preview"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-white/30 text-[12px]">
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Waiting for sandbox...
                  </div>
                )}

                {/* Footer actions */}
                <div className="flex gap-2 px-4 py-3 border-t border-white/[0.06] flex-wrap">
                  <button
                    className="flex-1 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[12px] text-emerald-400 hover:bg-emerald-500/20 transition-colors font-medium"
                  >
                    Merge &amp; Deploy
                  </button>
                  {mission.status === "failed" && onRetry && (
                    <button
                      onClick={onRetry}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <RefreshCw className="size-3.5" />
                      Retry
                    </button>
                  )}
                  {mission.status === "completed" && mission.crmRecordId && onViewInCRM && (
                    <button
                      onClick={() => onViewInCRM(mission.crmRecordType || "Person", mission.crmRecordId!)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[12px] text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      <ExternalLink className="size-3.5" />
                      View in CRM
                    </button>
                  )}
                  <button
                    onClick={() => dispatch({ type: "COLLAPSE" })}
                    className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/60 hover:bg-white/[0.08] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </MissionCardContext.Provider>
  );
}

export default MissionCard;
