"use client";

/**
 * Phase 24: Mode Banner — ALWAYS visible during panel runs
 *
 * Council: "🧠 Council mode — deliberating" (accuracy)
 * Swarm: "⚡ Swarm mode — decomposing" (efficiency)
 * Hybrid: "🔄 Hybrid mode — mixed approach" (complex)
 * Single: "🤖 Single mode — direct execution" (speed)
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuitIcon,
  NetworkIcon,
  ZapIcon,
  BotIcon,
  ChevronDownIcon,
  InfoIcon,
} from "lucide-react";
import type { PanelMode } from "@/lib/ai/fusion/types";
import { cn } from "@/lib/utils";

interface ModeBannerProps {
  mode: PanelMode | "single";
  presetName: string;
  agentCount: number;
  confidence?: number; // 0-1
  reasoning?: string;
  onOverride?: (mode: PanelMode | "single") => void;
  className?: string;
}

const MODE_CONFIG: Record<string, {
  icon: React.ReactNode;
  label: string;
  color: string;
  emoji: string;
  description: string;
}> = {
  council: {
    icon: <BrainCircuitIcon className="size-4" />,
    label: "Council",
    emoji: "🧠",
    color: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30",
    description: "Multiple models deliberate on the same task — best for accuracy and consensus",
  },
  swarm: {
    icon: <ZapIcon className="size-4" />,
    label: "Swarm",
    emoji: "⚡",
    color: "from-emerald-500/20 to-green-500/20 border-emerald-500/30",
    description: "Coordinator decomposes task, specialists work in parallel — best for complex multi-step work",
  },
  hybrid: {
    icon: <NetworkIcon className="size-4" />,
    label: "Hybrid",
    emoji: "🔄",
    color: "from-violet-500/20 to-purple-500/20 border-violet-500/30",
    description: "Council for decisions + Swarm for execution — best for mixed analysis and building",
  },
  single: {
    icon: <BotIcon className="size-4" />,
    label: "Single",
    emoji: "🤖",
    color: "from-amber-500/20 to-orange-500/20 border-amber-500/30",
    description: "Single model direct execution — fastest, lowest cost",
  },
};

const OVERRIDE_OPTIONS: { mode: PanelMode | "single"; label: string; emoji: string }[] = [
  { mode: "single", label: "Force Single", emoji: "🤖" },
  { mode: "council", label: "Force Council", emoji: "🧠" },
  { mode: "swarm", label: "Force Swarm", emoji: "⚡" },
  { mode: "hybrid", label: "Force Hybrid", emoji: "🔄" },
];

export function ModeBanner({
  mode,
  presetName,
  agentCount,
  confidence,
  reasoning,
  onOverride,
  className,
}: ModeBannerProps) {
  const [showOverride, setShowOverride] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const config = MODE_CONFIG[mode] || MODE_CONFIG.council;
  const confidencePct = confidence != null ? Math.round(confidence * 100) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-xl",
        "bg-gradient-to-r",
        config.color,
        "text-white/90 text-xs",
        className
      )}
    >
      {/* Emoji + Label */}
      <span className="text-sm">{config.emoji}</span>
      <span className="font-medium">{config.label} mode</span>

      {/* Confidence */}
      {confidencePct != null && (
        <span className={cn(
          "px-1.5 py-0.5 rounded-md text-[10px] font-mono",
          confidencePct >= 80 ? "bg-emerald-500/20 text-emerald-400" :
          confidencePct >= 50 ? "bg-amber-500/20 text-amber-400" :
          "bg-red-500/20 text-red-400"
        )}>
          {confidencePct}% confidence
        </span>
      )}

      {/* Agent count */}
      <span className="text-white/40">{agentCount} agents</span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Why this mode? tooltip */}
      <div className="relative">
        <button
          onClick={() => setShowTooltip(!showTooltip)}
          className="p-1 rounded-md hover:bg-white/10 transition-colors"
          title="Why this mode?"
        >
          <InfoIcon className="size-3.5 text-white/50" />
        </button>
        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute right-0 top-full mt-1 w-64 p-3 rounded-xl bg-[#1A1A2E] border border-white/10
                         shadow-xl backdrop-blur-xl z-50"
            >
              <p className="text-[11px] text-white/60 mb-1">{config.description}</p>
              {reasoning && (
                <p className="text-[11px] text-white/40 italic">"{reasoning}"</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Override dropdown */}
      {onOverride && (
        <div className="relative">
          <button
            onClick={() => setShowOverride(!showOverride)}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-[10px]"
          >
            Override
            <ChevronDownIcon className="size-3" />
          </button>
          <AnimatePresence>
            {showOverride && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute right-0 top-full mt-1 w-40 p-1 rounded-xl bg-[#1A1A2E] border border-white/10
                           shadow-xl backdrop-blur-xl z-50"
              >
                <button
                  onClick={() => { onOverride(mode); setShowOverride(false); }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/10 text-[11px] text-white/60"
                >
                  🤖 Auto (recommended)
                </button>
                {OVERRIDE_OPTIONS.filter(o => o.mode !== mode).map(opt => (
                  <button
                    key={opt.mode}
                    onClick={() => { onOverride(opt.mode); setShowOverride(false); }}
                    className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/10 text-[11px] text-white/60"
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
