"use client";

/**
 * Phase 23B: Hybrid View — full hybrid pipeline execution display
 *
 * Pipeline: Plan → Council (decisions) → Swarm (execution) → Final Judge
 *
 * Shows:
 *   1. Mode Banner (hybrid)
 *   2. Plan Overview — council vs swarm sub-task split
 *   3. Council Section — deliberation results (decisions made)
 *   4. Swarm Section — specialist execution (with dependsOn chains)
 *   5. Final Judge Card — synthesis of council + swarm outputs
 *   6. Cost Meter + Cancel
 *
 * Hybrid is the most complex mode — combines council deliberation with
 * parallel swarm execution, where swarm subtasks may depend on council decisions.
 *
 * Mobile-first 375px.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { ArrowRightIcon, BrainCircuitIcon, GavelIcon } from "lucide-react";
import type { PanelEvent, PanelPreset } from "@/lib/ai/fusion/types";
import { FADE_UP, STAGGER_ITEM } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";
import { type AgentStatus, AgentStatusCard } from "./agent-status-card";
import { CancelDeliberation } from "./cancel-deliberation";
import { CostMeter } from "./cost-meter";
import {
  IntegratorCard,
  type IntegratorStatus,
} from "./integrator-card";
import { ModeBanner } from "./mode-banner";
import {
  SpecialistCard,
  type SpecialistStatus,
} from "./specialist-card";

interface HybridViewProps {
  preset: PanelPreset;
  onCancel?: () => void;
  className?: string;
}

interface CouncilAgent {
  modelId: string;
  name: string;
  provider: string;
  status: AgentStatus;
  question: string;
  responsePreview?: string;
  latency?: number;
  tokensIn?: number;
  tokensOut?: number;
}

interface SwarmSubTask {
  id: string;
  description: string;
  assignedTo: string;
  dependsOn: string[];
  status: SpecialistStatus;
  responsePreview?: string;
  latency?: number;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}

interface PlanData {
  councilSubTasks: Array<{ id: string; question: string; why: string }>;
  swarmSubTasks: Array<{
    id: string;
    description: string;
    dependsOn: string[];
    assignedTo: string;
  }>;
}

type Phase = "planning" | "council" | "swarm" | "judging" | "complete";

export function HybridView({
  preset,
  onCancel,
  className,
}: HybridViewProps) {
  const [phase, setPhase] = useState<Phase>("planning");
  const [plan, setPlan] = useState<PlanData | null>(null);

  const [councilAgents, setCouncilAgents] = useState<CouncilAgent[]>([]);
  const [swarmSubTasks, setSwarmSubTasks] = useState<SwarmSubTask[]>([]);

  const [judgeStatus, setJudgeStatus] = useState<IntegratorStatus>("waiting");
  const [judgeName, setJudgeName] = useState(preset.judge.name);
  const [judgeProvider, setJudgeProvider] = useState(preset.judge.provider);
  const [judgeResponse, setJudgeResponse] = useState<string>();
  const [judgeCost, setJudgeCost] = useState(0);
  const [judgeLatency, setJudgeLatency] = useState(0);

  const [runningCost, setRunningCost] = useState(0);

  const handleEvent = useCallback(
    (event: PanelEvent) => {
      switch (event.type) {
        // ── Plan ────────────────────────────────────────────
        case "hybrid:plan":
          setPlan({
            councilSubTasks: event.councilSubTasks,
            swarmSubTasks: event.swarmSubTasks,
          });
          // Initialize council agents
          setCouncilAgents(
            event.councilSubTasks.map((cst) => ({
              modelId: preset.agents[0]?.modelId ?? "",
              name:
                preset.agents.find(
                  () => true // all agents participate in council
                )?.name ?? "Agent",
              provider: preset.agents[0]?.provider ?? "",
              status: "waiting" as AgentStatus,
              question: cst.question,
            }))
          );
          // Initialize swarm sub-tasks
          setSwarmSubTasks(
            event.swarmSubTasks.map((sst) => ({
              id: sst.id,
              description: sst.description,
              assignedTo: sst.assignedTo,
              dependsOn: sst.dependsOn,
              status: "pending" as SpecialistStatus,
            }))
          );
          setPhase("council");
          break;

        // ── Council agents ─────────────────────────────────
        case "agent:start":
          if (phase === "council") {
            setCouncilAgents((prev) =>
              prev.map((a) =>
                a.modelId === event.modelId
                  ? { ...a, status: "running" }
                  : a
              )
            );
          }
          break;

        case "agent:complete":
          if (phase === "council") {
            setCouncilAgents((prev) =>
              prev.map((a) =>
                a.modelId === event.modelId
                  ? {
                      ...a,
                      status: event.success ? "complete" : "failed",
                      responsePreview: event.response,
                      latency: event.latency,
                      tokensIn: event.tokensIn,
                      tokensOut: event.tokensOut,
                    }
                  : a
              )
            );
          }
          break;

        // ── Swarm specialists ──────────────────────────────
        case "specialist:start":
          setPhase("swarm");
          setSwarmSubTasks((prev) =>
            prev.map((s) =>
              s.id === event.subTask
                ? { ...s, status: "running" }
                : s
            )
          );
          break;

        case "specialist:complete":
          setSwarmSubTasks((prev) =>
            prev.map((s) =>
              s.id === event.subTask
                ? {
                    ...s,
                    status: event.success ? "complete" : "failed",
                    responsePreview: event.response,
                    latency: event.latency,
                    tokensIn: event.tokensIn,
                    tokensOut: event.tokensOut,
                  }
                : s
            )
          );
          break;

        case "specialist:failed":
          setSwarmSubTasks((prev) =>
            prev.map((s) =>
              s.id === event.subTask
                ? { ...s, status: "failed", error: event.error }
                : s
            )
          );
          break;

        // ── Final Judge ────────────────────────────────────
        case "final-judge:start":
          setPhase("judging");
          setJudgeStatus("integrating");
          break;

        case "final-judge:complete":
          setPhase("complete");
          setJudgeStatus("complete");
          setJudgeResponse(event.fullResponse);
          setJudgeCost(event.totalCost);
          setJudgeLatency(event.totalLatency);
          setRunningCost(event.totalCost);
          break;

        case "cost:update":
          setRunningCost(event.runningCost);
          break;
      }
    },
    [phase, preset.agents]
  );

  // Listen for panel events via window messaging
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const t = e.data?.type;
      if (
        t &&
        (t.startsWith("hybrid:") ||
          t.startsWith("agent:") ||
          t.startsWith("specialist:") ||
          t.startsWith("final-judge:") ||
          t === "cost:update")
      ) {
        handleEvent(e.data as PanelEvent);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [handleEvent]);

  const councilDone = councilAgents.every(
    (a) => a.status === "complete" || a.status === "failed"
  );
  const swarmDone = swarmSubTasks.every(
    (s) => s.status === "complete" || s.status === "failed"
  );

  return (
    <motion.div
      className={cn(
        "w-full space-y-3 rounded-2xl border border-border/20 bg-background/80 p-3 sm:p-4",
        "shadow-lg shadow-black/5",
        className
      )}
      {...FADE_UP}
    >
      {/* Mode Banner */}
      <ModeBanner
        agentCount={preset.agents.length}
        mode="hybrid"
        presetName={preset.name}
      />

      {/* Phase indicator */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 px-1">
        <span className={cn(phase === "planning" && "text-purple-400")}>
          Plan
        </span>
        <ArrowRightIcon className="size-2.5" />
        <span
          className={cn(
            phase === "council" && "text-amber-400",
            councilDone && "text-emerald-400"
          )}
        >
          Council
        </span>
        <ArrowRightIcon className="size-2.5" />
        <span
          className={cn(
            phase === "swarm" && "text-cyan-400",
            swarmDone && "text-emerald-400"
          )}
        >
          Swarm
        </span>
        <ArrowRightIcon className="size-2.5" />
        <span
          className={cn(
            phase === "judging" && "text-amber-400",
            phase === "complete" && "text-emerald-400"
          )}
        >
          Judge
        </span>
      </div>

      {/* Plan Summary (shown during planning) */}
      {plan && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <GavelIcon className="size-3.5 text-amber-500" />
            <span className="text-[11px] text-muted-foreground">
              <strong className="text-amber-500">
                {plan.councilSubTasks.length}
              </strong>{" "}
              council decisions
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
            <BrainCircuitIcon className="size-3.5 text-cyan-500" />
            <span className="text-[11px] text-muted-foreground">
              <strong className="text-cyan-500">
                {plan.swarmSubTasks.length}
              </strong>{" "}
              execution tasks
            </span>
          </div>
        </div>
      )}

      {/* ── Council Section ──────────────────────────────── */}
      {councilAgents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <GavelIcon className="size-3 text-amber-500/70" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
              Council —{" "}
              {councilDone ? "Decisions reached" : "Deliberating..."}
            </p>
          </div>
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {councilAgents.map((agent, i) => (
                <motion.div
                  animate="animate"
                  custom={i}
                  initial="initial"
                  key={`council-${agent.modelId}-${i}`}
                  variants={STAGGER_ITEM}
                >
                  <AgentStatusCard
                    modelId={agent.modelId}
                    name={agent.name}
                    provider={agent.provider}
                    status={agent.status}
                    latency={agent.latency}
                    tokensIn={agent.tokensIn}
                    tokensOut={agent.tokensOut}
                    responsePreview={agent.responsePreview}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Swarm Section ────────────────────────────────── */}
      {swarmSubTasks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <BrainCircuitIcon className="size-3 text-cyan-500/70" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
              Swarm —{" "}
              {swarmDone ? "Execution complete" : "Executing..."} (
              {swarmSubTasks.filter((s) => s.status === "complete").length}/
              {swarmSubTasks.length})
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <AnimatePresence mode="popLayout">
              {swarmSubTasks.map((sst, i) => {
                const spec = preset.agents.find(
                  (a) => a.modelId === sst.assignedTo
                );
                return (
                  <motion.div
                    animate="animate"
                    custom={i}
                    initial="initial"
                    key={sst.id}
                    variants={STAGGER_ITEM}
                  >
                    {/* Dependency badge */}
                    {sst.dependsOn.length > 0 && (
                      <div className="flex items-center gap-1 mb-1 px-1">
                        <span className="text-[9px] text-muted-foreground/40">
                          depends on:
                        </span>
                        {sst.dependsOn.map((dep) => (
                          <span
                            className="text-[9px] font-mono bg-muted/50 px-1 rounded"
                            key={dep}
                          >
                            {dep}
                          </span>
                        ))}
                      </div>
                    )}
                    <SpecialistCard
                      modelId={sst.assignedTo}
                      name={spec?.name ?? sst.assignedTo}
                      provider={spec?.provider ?? ""}
                      status={sst.status}
                      subTask={sst.id}
                      subTaskDescription={sst.description}
                      responsePreview={sst.responsePreview}
                      latency={sst.latency}
                      tokensIn={sst.tokensIn}
                      tokensOut={sst.tokensOut}
                      error={sst.error}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Final Judge ──────────────────────────────────── */}
      {(phase === "judging" || phase === "complete") && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 px-1">
            Final Synthesis
          </p>
          <IntegratorCard
            modelId={preset.judge.modelId}
            name={judgeName}
            provider={judgeProvider}
            status={judgeStatus}
            fullResponse={judgeResponse}
            totalCost={judgeCost}
            totalLatency={judgeLatency}
          />
        </div>
      )}

      {/* Footer: Cost + Cancel */}
      <div className="flex items-center justify-between pt-1">
        <CostMeter
          estCostMax={preset.estCostMax}
          estCostMin={preset.estCostMin}
          runningCost={runningCost}
        />
        {phase !== "complete" && onCancel && (
          <CancelDeliberation onCancel={onCancel} />
        )}
      </div>
    </motion.div>
  );
}
