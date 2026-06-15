/**
 * swarm-panel.tsx — Phase 21 V3: Swarm Dispatch UI Panel
 *
 * Extends the MultiSessionPanel pattern to render swarm dispatches as a row
 * of agent cards showing role, model, progress, and result preview.
 * Synthesizer card at bottom.
 *
 * Used when swarmDispatch tool is invoked — shows N agents as parallel cards,
 * auto-collapses when all agents complete.
 */

"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────

export interface SwarmAgentState {
  role: string;
  model: string;
  status: "pending" | "running" | "done" | "error";
  progress?: number; // 0–100
  resultPreview?: string;
  durationMs?: number;
  tokensUsed?: number;
  error?: string;
}

export interface SwarmPanelProps {
  swarmId: string;
  goal: string;
  swarmType: string;
  agents: SwarmAgentState[];
  synthesizerModel: string;
  onComplete?: () => void;
  className?: string;
}

// ── Status Badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SwarmAgentState["status"] }) {
  const config: Record<SwarmAgentState["status"], { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-secondary text-muted-foreground" },
    running: { label: "Running", className: "bg-blue-500/20 text-blue-500 animate-pulse" },
    done: { label: "Done", className: "bg-emerald-500/20 text-emerald-500" },
    error: { label: "Error", className: "bg-red-500/20 text-red-500" },
  };

  const c = config[status];
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", c.className)}>
      {c.label}
    </span>
  );
}

// ── Agent Card ───────────────────────────────────────────────────────────

function AgentCard({ agent, index }: { agent: SwarmAgentState; index: number }) {
  return (
    <div
      className={cn(
        "border rounded-lg p-4 transition-all duration-300",
        agent.status === "done" && "border-emerald-500/30",
        agent.status === "error" && "border-red-500/30",
        agent.status === "running" && "border-blue-500/30 shadow-blue-500/10 shadow-md"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">
            #{index + 1}
          </span>
          <h4 className="font-medium text-sm">{agent.role}</h4>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      <p className="text-xs text-muted-foreground mb-2">{agent.model}</p>

      {/* Progress bar */}
      {agent.status === "running" && (
        <div className="w-full bg-secondary rounded-full h-1.5 mb-2 overflow-hidden">
          <div
            className="bg-blue-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${agent.progress ?? 30}%` }}
          />
        </div>
      )}

      {/* Result preview */}
      {agent.resultPreview && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
          {agent.resultPreview}
        </p>
      )}

      {/* Metrics */}
      {(agent.durationMs || agent.tokensUsed) && (
        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
          {agent.durationMs && <span>{(agent.durationMs / 1000).toFixed(1)}s</span>}
          {agent.tokensUsed && <span>{agent.tokensUsed.toLocaleString()} tokens</span>}
        </div>
      )}

      {/* Error */}
      {agent.error && (
        <p className="text-xs text-red-500 mt-1">{agent.error}</p>
      )}
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────

export function SwarmPanel({
  swarmId,
  goal,
  swarmType,
  agents,
  synthesizerModel,
  onComplete,
  className,
}: SwarmPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const allDone = agents.every((a) => a.status === "done" || a.status === "error");
  const successCount = agents.filter((a) => a.status === "done").length;
  const errorCount = agents.filter((a) => a.status === "error").length;

  useEffect(() => {
    if (allDone && onComplete) {
      const timer = setTimeout(onComplete, 500);
      return () => clearTimeout(timer);
    }
  }, [allDone, onComplete]);

  return (
    <div className={cn("border rounded-xl overflow-hidden", className)}>
      {/* Header */}
      <div
        className="px-4 py-3 bg-secondary/30 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm">🐝 Swarm</span>
            <span className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">
              {swarmType}
            </span>
            <span className="text-xs text-muted-foreground">{swarmId}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{goal}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs">
            <span className="text-emerald-500 font-medium">{successCount}</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{agents.length}</span>
            {errorCount > 0 && (
              <>
                <span className="text-muted-foreground"> · </span>
                <span className="text-red-500 font-medium">{errorCount} err</span>
              </>
            )}
          </div>
          <span className={cn("text-xs transform transition-transform", collapsed && "rotate-180")}>
            ▼
          </span>
        </div>
      </div>

      {/* Agent Cards */}
      {!collapsed && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((agent, i) => (
              <AgentCard key={agent.role} agent={agent} index={i} />
            ))}
          </div>

          {/* Synthesizer card */}
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>🧠 Synthesizer:</span>
              <code className="bg-secondary px-1 rounded">{synthesizerModel}</code>
              <span className={cn(allDone ? "text-emerald-500" : "text-amber-500")}>
                {allDone ? "✓ Complete" : "Waiting for agents..."}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hook: useSwarmState ───────────────────────────────────────────────────

export function useSwarmState(initialAgents: SwarmAgentState[]) {
  const [agents, setAgents] = useState<SwarmAgentState[]>(initialAgents);

  const updateAgent = (role: string, update: Partial<SwarmAgentState>) => {
    setAgents((prev) =>
      prev.map((a) => (a.role === role ? { ...a, ...update } : a))
    );
  };

  return { agents, updateAgent, setAgents };
}

export default SwarmPanel;
