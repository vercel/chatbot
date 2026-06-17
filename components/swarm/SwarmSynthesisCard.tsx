/**
 * components/swarm/SwarmSynthesisCard.tsx — Phase 38.5 Stream 3
 *
 * Final synthesis card shown after swarm completes.
 * Displays aggregate token usage, total duration, cost estimate,
 * and the synthesis text from the judge model.
 */

"use client";

import React from "react";

interface AgentSummary {
  modelName: string;
  role: string;
  tokens: number;
  durationMs: number;
  success: boolean;
}

interface SwarmSynthesisCardProps {
  swarmId: string;
  agents: AgentSummary[];
  synthesis: string;
  totalTokens: number;
  totalDurationMs: number;
  judgeModel: string;
  success: boolean;
  error?: string;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function estimateCost(tokens: number, modelName: string): string {
  // Rough cost estimates
  const costPer1K: Record<string, number> = {
    "claude-sonnet": 0.003,
    "claude-opus": 0.015,
    "deepseek": 0.0005,
    "kimi": 0.001,
    "glm": 0.0005,
    "gemini": 0.0005,
    "qwen": 0.0003,
    "minimax": 0.0003,
    "step": 0.0003,
  };

  for (const [key, rate] of Object.entries(costPer1K)) {
    if (modelName.toLowerCase().includes(key)) {
      return `$${((tokens / 1000) * rate).toFixed(4)}`;
    }
  }
  return `$${((tokens / 1000) * 0.001).toFixed(4)}`;
}

export const SwarmSynthesisCard: React.FC<SwarmSynthesisCardProps> = ({
  swarmId,
  agents,
  synthesis,
  totalTokens,
  totalDurationMs,
  judgeModel,
  success,
  error,
}) => {
  const [showSynthesis, setShowSynthesis] = React.useState(true);
  const [showAgents, setShowAgents] = React.useState(false);

  return (
    <div
      className={`rounded-lg border-2 p-4 ${
        success
          ? "border-emerald-300 bg-emerald-50/30"
          : "border-red-300 bg-red-50/30"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{success ? "📊" : "⚠️"}</span>
          <span className="font-semibold text-slate-800">
            Swarm {success ? "Complete" : "Failed"}
          </span>
          <span className="text-xs text-slate-400 font-mono">#{swarmId}</span>
        </div>
        <span className="text-xs text-slate-500">
          Judge: {judgeModel}
        </span>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center p-2 bg-white rounded border border-slate-100">
          <div className="text-lg font-bold text-slate-800">
            {agents.length}
          </div>
          <div className="text-xs text-slate-500">Agents</div>
        </div>
        <div className="text-center p-2 bg-white rounded border border-slate-100">
          <div className="text-lg font-bold text-slate-800">
            {formatTokens(totalTokens)}
          </div>
          <div className="text-xs text-slate-500">Tokens</div>
        </div>
        <div className="text-center p-2 bg-white rounded border border-slate-100">
          <div className="text-lg font-bold text-slate-800">
            {formatDuration(totalDurationMs)}
          </div>
          <div className="text-xs text-slate-500">Duration</div>
        </div>
      </div>

      {/* Agent Summary */}
      <div className="mb-3">
        <button
          onClick={() => setShowAgents(!showAgents)}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 mb-2 block"
        >
          {showAgents ? "▲ Hide" : "▼ Show"} Agent Details
        </button>
        {showAgents && (
          <div className="space-y-1">
            {agents.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs py-1.5 px-2 bg-white rounded border border-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span>{a.success ? "✅" : "❌"}</span>
                  <span className="font-medium text-slate-700">
                    {a.modelName}
                  </span>
                  <span className="text-slate-400">· {a.role}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <span>🪙 {formatTokens(a.tokens)}</span>
                  <span>⏱ {formatDuration(a.durationMs)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Synthesis */}
      <div>
        <button
          onClick={() => setShowSynthesis(!showSynthesis)}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 mb-2 block"
        >
          {showSynthesis ? "▲ Hide" : "▼ Show"} Synthesis
        </button>
        {showSynthesis && (
          <div className="text-sm text-slate-700 bg-white rounded border border-slate-100 p-3 max-h-64 overflow-y-auto whitespace-pre-wrap">
            {synthesis || "No synthesis available."}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
          <div className="text-xs text-red-600 font-medium">Error</div>
          <div className="text-xs text-red-500 mt-1">{error}</div>
        </div>
      )}
    </div>
  );
};

export default SwarmSynthesisCard;
