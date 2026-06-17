/**
 * components/swarm/SwarmProgressCard.tsx — Phase 38.5 Stream 3
 *
 * Per-agent progress card for swarm dispatch.
 * Shows model name, current tool call, token counter, status badge,
 * and streaming response preview.
 *
 * States: pending → running → complete/failed
 */

"use client";

import React from "react";

export type AgentStatus = "pending" | "running" | "complete" | "failed";

export interface ToolCallEntry {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  result?: unknown;
  durationMs?: number;
  status: "running" | "complete" | "error";
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface SwarmAgentCardData {
  agentId: string;
  modelName: string;
  modelProvider?: string;
  role: string;
  status: AgentStatus;
  tokensUsed: number;
  currentTool?: string;
  toolCalls: ToolCallEntry[];
  responsePreview: string;
  durationMs: number;
  error?: string;
}

interface SwarmProgressCardProps {
  agent: SwarmAgentCardData;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const STATUS_STYLES: Record<AgentStatus, { badge: string; border: string; bg: string }> = {
  pending: { badge: "bg-slate-100 text-slate-600", border: "border-slate-200", bg: "bg-white" },
  running: { badge: "bg-blue-100 text-blue-700", border: "border-blue-300", bg: "bg-blue-50/30" },
  complete: { badge: "bg-emerald-100 text-emerald-700", border: "border-emerald-300", bg: "bg-emerald-50/20" },
  failed: { badge: "bg-red-100 text-red-700", border: "border-red-300", bg: "bg-red-50/20" },
};

const STATUS_EMOJI: Record<AgentStatus, string> = {
  pending: "⏳",
  running: "⚡",
  complete: "✅",
  failed: "❌",
};

const PROVIDER_COLORS: Record<string, string> = {
  deepseek: "#4F46E5",
  anthropic: "#D97706",
  openai: "#10A37F",
  google: "#4285F4",
  moonshot: "#8B5CF6",
  zhipu: "#EC4899",
  meta: "#06B6D4",
};

function providerColor(model: string): string {
  for (const [key, color] of Object.entries(PROVIDER_COLORS)) {
    if (model.toLowerCase().includes(key)) return color;
  }
  return "#64748B";
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export const SwarmProgressCard: React.FC<SwarmProgressCardProps> = ({
  agent,
  expanded = false,
  onToggleExpand,
}) => {
  const styles = STATUS_STYLES[agent.status];
  const isRunning = agent.status === "running";
  const [showDetails, setShowDetails] = React.useState(expanded);

  return (
    <div
      className={`rounded-lg border p-3 transition-all ${styles.border} ${styles.bg} ${
        isRunning ? "animate-pulse" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: providerColor(agent.modelName) }}
          />
          <span className="font-medium text-sm text-slate-800">
            {agent.modelName}
          </span>
          <span className="text-xs text-slate-500">· {agent.role}</span>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles.badge}`}
        >
          {STATUS_EMOJI[agent.status]} {agent.status}
        </span>
      </div>

      {/* Progress */}
      {agent.status === "running" && (
        <div className="mb-2">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  agent.toolCalls.length > 0 ? 67 : 33,
                  95
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Current Tool */}
      {agent.currentTool && agent.status === "running" && (
        <div className="text-xs text-slate-600 mb-1">
          <span className="font-mono text-blue-600">{agent.currentTool}</span>
          <span className="text-slate-400"> · executing...</span>
        </div>
      )}

      {agent.toolCalls.length > 0 && agent.status !== "running" && (
        <div className="text-xs text-slate-500 mb-1">
          {agent.toolCalls.length} tool call
          {agent.toolCalls.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Response Preview */}
      {agent.responsePreview && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded p-2 mb-2 font-mono line-clamp-2">
          {agent.responsePreview.slice(0, 200)}
        </div>
      )}

      {/* Footer Stats */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span>🪙 {formatTokens(agent.tokensUsed)} tokens</span>
          <span>⏱ {formatDuration(agent.durationMs)}</span>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-blue-500 hover:text-blue-700 transition-colors"
        >
          {showDetails ? "▲ Less" : "▼ Details"}
        </button>
      </div>

      {/* Tool Call Details */}
      {showDetails && agent.toolCalls.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-medium text-slate-600 block mb-1">
            Tool Calls
          </span>
          {agent.toolCalls.map((tc) => (
            <div
              key={tc.id}
              className="text-xs text-slate-500 py-1 border-b border-slate-50 last:border-0"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-slate-700">{tc.tool}</span>
                <span className="text-slate-400">
                  {tc.status === "running"
                    ? "···"
                    : tc.status === "error"
                    ? "❌"
                    : "✅"}{" "}
                  {tc.durationMs ? formatDuration(tc.durationMs) : ""}
                </span>
              </div>
              {tc.error && (
                <div className="text-red-500 mt-0.5">{tc.error}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {agent.error && (
        <div className="mt-2 pt-2 border-t border-red-100">
          <div className="text-xs text-red-600 bg-red-50 rounded p-2">
            {agent.error}
          </div>
        </div>
      )}
    </div>
  );
};

export default SwarmProgressCard;
