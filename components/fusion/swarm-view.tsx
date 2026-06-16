"use client";

/**
 * Phase 23B: Swarm View — full swarm pipeline execution display
 *
 * Pipeline: Coordinator (decompose) → Specialists (parallel) → Integrator (synthesize)
 *
 * Shows:
 *   1. Mode Banner (swarm)
 *   2. Coordinator Card (decomposition result)
 *   3. Specialist Cards (parallel grid — 1-6 sub-tasks)
 *   4. Integrator Card (final synthesis + contribution scores)
 *   5. Cost Meter
 *   6. Cancel Button (if still running)
 *
 * Subscribes to SSE PanelEvents via window messaging.
 * Mobile-first 375px.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import type { PanelEvent, PanelPreset } from "@/lib/ai/fusion/types";
import { FADE_UP, STAGGER_ITEM } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";
import { CancelDeliberation } from "./cancel-deliberation";
import {
  CoordinatorCard,
  type CoordinatorStatus,
  type SubTaskDef,
} from "./coordinator-card";
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

interface SwarmViewProps {
  preset: PanelPreset;
  onCancel?: () => void;
  className?: string;
}

interface CoordinatorState {
  modelId: string;
  name: string;
  provider: string;
  status: CoordinatorStatus;
  strategy?: string;
  subTasks?: SubTaskDef[];
  latency?: number;
  cost?: number;
}

interface SpecialistState {
  modelId: string;
  name: string;
  provider: string;
  status: SpecialistStatus;
  subTask: string;
  subTaskDescription?: string;
  responsePreview?: string;
  latency?: number;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}

interface IntegratorState {
  modelId: string;
  name: string;
  provider: string;
  status: IntegratorStatus;
  fullResponse?: string;
  contributionScores?: Record<string, number>;
  totalCost?: number;
  totalLatency?: number;
  totalTokensIn?: number;
  totalTokensOut?: number;
}

export function SwarmView({
  preset,
  onCancel,
  className,
}: SwarmViewProps) {
  const [coordinator, setCoordinator] = useState<CoordinatorState>({
    modelId: preset.agents[0]?.modelId ?? "",
    name: preset.agents[0]?.name ?? "Coordinator",
    provider: preset.agents[0]?.provider ?? "",
    status: "waiting",
  });

  const [specialists, setSpecialists] = useState<SpecialistState[]>([]);
  const [specialistMap, setSpecialistMap] = useState<
    Record<string, SpecialistState>
  >({});

  const [integrator, setIntegrator] = useState<IntegratorState>({
    modelId: preset.judge.modelId,
    name: preset.judge.name,
    provider: preset.judge.provider,
    status: "waiting",
  });

  const [runningCost, setRunningCost] = useState(0);
  const [allComplete, setAllComplete] = useState(false);

  const handleEvent = useCallback(
    (event: PanelEvent) => {
      switch (event.type) {
        // ── Coordinator ──────────────────────────────────────
        case "coordinator:start":
          setCoordinator((prev) => ({
            ...prev,
            modelId: event.modelId,
            status: "decomposing",
          }));
          break;

        case "coordinator:complete":
          setCoordinator((prev) => ({
            ...prev,
            status: "complete",
            strategy: event.decomposition.strategy,
            subTasks: event.decomposition.subTasks.map((st) => ({
              id: st.id,
              description: st.description,
              assignedTo: st.assignedTo,
              priority: st.priority,
              reasoning: st.reasoning,
            })),
            latency: event.latency,
            cost: event.cost,
          }));

          // Initialize specialist slots from decomposition
          setSpecialists(
            event.decomposition.subTasks.map((st) => ({
              modelId: st.assignedTo,
              name: preset.agents.find((a) => a.modelId === st.assignedTo)
                ?.name ?? st.assignedTo,
              provider:
                preset.agents.find((a) => a.modelId === st.assignedTo)
                  ?.provider ?? "",
              status: "pending" as SpecialistStatus,
              subTask: st.id,
              subTaskDescription: st.description,
            }))
          );
          break;

        // ── Specialists ─────────────────────────────────────
        case "specialist:start":
          setSpecialists((prev) =>
            prev.map((s) =>
              s.subTask === event.subTask
                ? { ...s, status: "running" }
                : s
            )
          );
          break;

        case "specialist:complete":
          setSpecialists((prev) =>
            prev.map((s) =>
              s.subTask === event.subTask
                ? {
                    ...s,
                    status: event.success ? "complete" : "failed",
                    latency: event.latency,
                    tokensIn: event.tokensIn,
                    tokensOut: event.tokensOut,
                    responsePreview: event.response,
                  }
                : s
            )
          );
          break;

        case "specialist:failed":
          setSpecialists((prev) =>
            prev.map((s) =>
              s.subTask === event.subTask
                ? { ...s, status: "failed", error: event.error }
                : s
            )
          );
          break;

        // ── Integrator ──────────────────────────────────────
        case "integrator:start":
          setIntegrator((prev) => ({
            ...prev,
            status: "integrating",
          }));
          break;

        case "integrator:complete":
          setIntegrator((prev) => ({
            ...prev,
            status: "complete",
            fullResponse: event.fullResponse,
            totalCost: event.totalCost,
            totalLatency: event.totalLatency,
          }));
          setRunningCost(event.totalCost);
          setAllComplete(true);
          break;

        case "cost:update":
          setRunningCost(event.runningCost);
          break;
      }
    },
    [preset.agents]
  );

  // Listen for panel events via window messaging
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const t = e.data?.type;
      if (
        t === "coordinator:start" ||
        t === "coordinator:complete" ||
        t === "specialist:start" ||
        t === "specialist:complete" ||
        t === "specialist:failed" ||
        t === "integrator:start" ||
        t === "integrator:complete" ||
        t === "cost:update"
      ) {
        handleEvent(e.data as PanelEvent);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [handleEvent]);

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
        mode="swarm"
        presetName={preset.name}
      />

      {/* Coordinator */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 px-1">
          Decomposition
        </p>
        <CoordinatorCard {...coordinator} />
      </div>

      {/* Specialists Grid */}
      {specialists.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 px-1">
            Specialists ({specialists.filter((s) => s.status === "complete").length}/
            {specialists.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <AnimatePresence mode="popLayout">
              {specialists.map((spec, i) => (
                <motion.div
                  animate="animate"
                  custom={i}
                  initial="initial"
                  key={spec.subTask}
                  variants={STAGGER_ITEM}
                >
                  <SpecialistCard {...spec} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Integrator */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 px-1">
          Synthesis
        </p>
        <IntegratorCard {...integrator} />
      </div>

      {/* Footer: Cost + Cancel */}
      <div className="flex items-center justify-between pt-1">
        <CostMeter
          estCostMax={preset.estCostMax}
          estCostMin={preset.estCostMin}
          runningCost={runningCost}
        />
        {!allComplete && onCancel && <CancelDeliberation onCancel={onCancel} />}
      </div>
    </motion.div>
  );
}
