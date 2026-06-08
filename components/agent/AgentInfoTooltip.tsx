/**
 * AgentInfoTooltip.tsx — Displays Neptune Chat agent capabilities.
 *
 * Shows the 5 intent modes, current model, available tools, and routing info.
 * Designed to be rendered as both a hover tooltip and an inline info panel.
 *
 * PRD ref: Mission 14, Section 4 — AgentInfo tooltips in both surfaces.
 */
'use client';

import React from 'react';
import {
  INTENT_LABELS,
  INTENT_DESCRIPTIONS,
  type IntentMode,
} from '@/lib/intent-classifier';
import type { ChatModel } from '@/lib/ai/models';

// ── Mode Icons ────────────────────────────────────────────────────────
const MODE_ICONS: Record<IntentMode, string> = {
  chat: '💬',
  reasoning: '🧠',
  tool_call: '🔍',
  code_handoff: '🔧',
  workflow: '🔄',
};

const MODE_ORDER: IntentMode[] = ['chat', 'reasoning', 'tool_call', 'code_handoff', 'workflow'];

// ── Component Props ───────────────────────────────────────────────────

export interface AgentInfoTooltipProps {
  /** Current selected model */
  currentModel?: ChatModel;
  /** Detected intent mode */
  intentMode?: IntentMode;
  /** Available tool names */
  availableTools?: string[];
  /** Compact mode (sidebar/bottom bar) vs full mode (modal/panel) */
  compact?: boolean;
  /** Additional class for styling */
  className?: string;
}

// ── Sub-components ───────────────────────────────────────────────────

function ModeRow({ mode, isActive }: { mode: IntentMode; isActive?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
        isActive
          ? 'bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-medium'
          : 'text-zinc-600 dark:text-zinc-400'
      }`}
      title={INTENT_DESCRIPTIONS[mode]}
    >
      <span className="text-base">{MODE_ICONS[mode]}</span>
      <span>{INTENT_LABELS[mode]}</span>
    </div>
  );
}

function ToolChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
      {name}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export function AgentInfoTooltip({
  currentModel,
  intentMode,
  availableTools,
  compact = false,
  className = '',
}: AgentInfoTooltipProps) {
  if (compact) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        {currentModel && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {currentModel.provider}/{currentModel.name}
            {currentModel.routeType === 'direct' && (
              <span className="ml-1 text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-1 rounded">
                direct
              </span>
            )}
          </div>
        )}
        {intentMode && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Intent: {MODE_ICONS[intentMode]} {INTENT_LABELS[intentMode]}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-3 p-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">🤖</span>
        <div>
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Neptune Agent
          </h4>
          {currentModel && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {currentModel.name} · {currentModel.provider}
              {currentModel.routeType === 'direct' && ' · direct key'}
            </p>
          )}
        </div>
      </div>

      {/* Intent Modes */}
      <div>
        <h5 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
          Capabilities
        </h5>
        <div className="space-y-0.5">
          {MODE_ORDER.map((mode) => (
            <ModeRow
              key={mode}
              mode={mode}
              isActive={intentMode === mode}
            />
          ))}
        </div>
      </div>

      {/* Available Tools */}
      {availableTools && availableTools.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
            Tools
          </h5>
          <div className="flex flex-wrap gap-1">
            {availableTools.map((tool) => (
              <ToolChip key={tool} name={tool} />
            ))}
          </div>
        </div>
      )}

      {/* Model Info */}
      {currentModel && (
        <div>
          <h5 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
            Model
          </h5>
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            {currentModel.description || currentModel.name}
          </p>
          {currentModel.gatewayOrder && currentModel.gatewayOrder.length > 0 && (
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              Gateway fallback: {currentModel.gatewayOrder.join(' → ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Hook-friendly version: returns props ready for AgentInfoTooltip.
 * Consumed by chat UI components to display live agent state.
 */
export function useAgentInfoDisplay(props: {
  model?: ChatModel;
  intentMode?: IntentMode;
  tools?: string[];
}) {
  return {
    currentModel: props.model,
    intentMode: props.intentMode,
    availableTools: props.tools ?? [
      'getWeather',
      'createDocument',
      'editDocument',
      'updateDocument',
      'requestSuggestions',
    ],
  };
}
