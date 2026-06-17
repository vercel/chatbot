"use client";

/**
 * Phase 24: Live Deliberation View
 *
 * Shows during active panel execution:
 *   1. Mode Banner (ALWAYS visible — council/swarm/hybrid/single)
 *   2. Agent Status Cards (per-agent progress)
 *   3. Judge Card (synthesis status)
 *   4. Cost Meter (running cost)
 *   5. Cancel Button
 *
 * Phase 24 enhancements:
 *   - ModeBanner is ALWAYS rendered (not conditionally)
 *   - Passes confidence + reasoning from task analysis
 *   - Handles onOverride callback for mode switching
 *
 * Subscribes to SSE events from the panel execution.
 * Animates with SPRING physics.
 *
 * Mobile-first 375px.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import type { PanelEvent, PanelMode, PanelPreset } from "@/lib/ai/fusion/types";
import { FADE_UP, STAGGER_ITEM } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";
import { type AgentStatus, AgentStatusCard } from "./agent-status-card";
import { CancelDeliberation } from "./cancel-deliberation";
import { CostMeter } from "./cost-meter";
import { JudgeCard } from "./judge-card";
import { ModeBanner } from "./mode-banner";

interface DeliberationViewProps {
  preset: PanelPreset;
  mode: PanelMode;
  onCancel?: () => void;
  onModeOverride?: (mode: PanelMode | "single") => void;
  className?: string;
  taskReasoning?: string;
  taskConfidence?: number;
}

interface AgentState {
  modelId: string;
  name: string;
  provider: string;
  status: AgentStatus;
  latency?: number;
  tokensIn?: number;
  tokensOut?: number;
  responsePreview?: string;
}

interface JudgeState {
  name: string;
  provider: string;
  status: "waiting" | "synthesizing" | "complete" | "failed";
  responsePreview?: string;
  latency?: number;
}

export function DeliberationView({
  preset,
  mode,
  onCancel,
  onModeOverride,
  className,
  taskReasoning,
  taskConfidence,
}: DeliberationViewProps) {
  const [agentStates, setAgentStates] = useState<AgentState[]>(
    preset.agents.map((a) => ({
      modelId: a.modelId,
      name: a.name,
      provider: a.provider,
      status: "waiting",
    }))
  );
  const [judgeState, setJudgeState] = useState<JudgeState>({
    name: preset.judge.name,
    provider: preset.judge.provider,
    status: "waiting",
  });
  const [runningCost, setRunningCost] = useState(0);
  const [currentMode, setCurrentMode] = useState<PanelMode | "single">(mode);
  const [allComplete, setAllComplete] = useState(false);

  // Handle panel events
  const handleEvent = useCallback((event: PanelEvent) => {
    switch (event.type) {
      case "panel:start":
        // Phase 24: extract confidence + reasoning from task analysis if provided
        if (event.taskAnalysis) {
          // confidence and reasoning are consumed via props or overridden
        }
        break;

      case "agent:start":
        setAgentStates((prev) =>
          prev.map((a) =>
            a.modelId === event.modelId ? { ...a, status: "running" } : a
          )
        );
        break;

      case "agent:complete":
        setAgentStates((prev) =>
          prev.map((a) =>
            a.modelId === event.modelId
              ? {
                  ...a,
                  status: event.success ? "complete" : "failed",
                  latency: event.latency,
                  tokensIn: event.tokensIn,
                  tokensOut: event.tokensOut,
                  responsePreview: event.response.slice(0, 200),
                }
              : a
          )
        );
        break;

      case "judge:start":
        setJudgeState((prev) => ({
          ...prev,
          status: "synthesizing",
        }));
        break;

      case "judge:complete":
        setJudgeState((prev) => ({
          ...prev,
          status: "complete",
          responsePreview: event.fullResponse,
          latency: event.totalLatency,
        }));
        setRunningCost(event.totalCost);
        setAllComplete(true);
        break;

      case "cost:update":
        setRunningCost(event.runningCost);
        break;
    }
  }, []);

  // Expose event handler for parent to call
  // In practice, events are pushed by the chat stream
  useEffect(() => {
    // Listen for custom fusion events via window messaging
    const handler = (e: MessageEvent) => {
      if (
        e.data?.type?.startsWith("panel:") ||
        e.data?.type?.startsWith("agent:") ||
        e.data?.type?.startsWith("judge:")
      ) {
        handleEvent(e.data as PanelEvent);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [handleEvent]);

  const handleOverride = useCallback((newMode: PanelMode | "single") => {
    setCurrentMode(newMode);
    onModeOverride?.(newMode);
  }, [onModeOverride]);

  return (
    <motion.div
      className={cn(
        "w-full space-y-3 rounded-2xl border border-border/20 bg-background/80 p-3 sm:p-4",
        "shadow-lg shadow-black/5",
        className
      )}
      {...FADE_UP}
    >
      {/* Phase 24: Mode Banner — ALWAYS visible, not conditionally */}
      <ModeBanner
        mode={currentMode}
        presetName={preset.name}
        agentCount={preset.agents.length}
        confidence={taskConfidence ?? (currentMode === mode ? undefined : 1.0)}
        reasoning={taskReasoning}
        onOverride={handleOverride}
      />

      {/* Agent Cards */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 px-1">
          Agents
        </p>
        <AnimatePresence mode="popLayout">
          {agentStates.map((agent, i) => (
            <motion.div
              animate="animate"
              custom={i}
              initial="initial"
              key={agent.modelId}
              variants={STAGGER_ITEM}
            >
              <AgentStatusCard {...agent} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Judge Card */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 px-1">
          Judge
        </p>
        <JudgeCard
          latency={judgeState.latency}
          name={judgeState.name}
          provider={judgeState.provider}
          responsePreview={judgeState.responsePreview}
          status={judgeState.status}
        />
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
