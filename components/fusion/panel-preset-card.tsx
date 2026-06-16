"use client";

/**
 * Phase 23A: Panel Preset Card — glass card showing preset details
 *
 * Shows: agents avatar stack + judge badge + capabilities + domain + est cost.
 * Reuses Phase 22 GlassCard component + spring physics.
 */

import { motion } from "framer-motion";
import {
  BrainIcon,
  CheckCircleIcon,
  CodeIcon,
  SearchIcon,
  ZapIcon,
} from "lucide-react";
import { GlassCard } from "@/components/library/glass-card";
import type { PanelPreset } from "@/lib/ai/fusion/types";
import { cn } from "@/lib/utils";
import { AgentAvatarStack } from "./agent-avatar-stack";

interface PanelPresetCardProps {
  preset: PanelPreset;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  general: <BrainIcon className="size-3" />,
  coding: <CodeIcon className="size-3" />,
  research: <SearchIcon className="size-3" />,
  reasoning: <ZapIcon className="size-3" />,
};

const CAPABILITY_LABELS: Record<string, string> = {
  council: "Council",
  swarm: "Swarm",
  hybrid: "Hybrid",
};

export function PanelPresetCard({
  preset,
  isSelected,
  onClick,
  className,
}: PanelPresetCardProps) {
  return (
    <GlassCard
      className={cn(
        "relative w-full cursor-pointer p-3 transition-all",
        isSelected && "ring-2 ring-cyan-500/50 border-cyan-500/30",
        className
      )}
      elevation="1"
      interactive
      onClick={onClick}
    >
      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          animate={{ scale: 1 }}
          className="absolute top-2 right-2"
          initial={{ scale: 0 }}
        >
          <CheckCircleIcon className="size-4 text-cyan-500" />
        </motion.div>
      )}

      <div className="flex flex-col gap-2">
        {/* Header: name + cost */}
        <div className="flex items-center justify-between">
          <h4 className="text-[13px] font-semibold text-foreground truncate pr-5">
            {preset.isDefault && "⭐ "}
            {preset.name}
          </h4>
          <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
            ~${preset.estCostMin.toFixed(2)}–${preset.estCostMax.toFixed(2)}
          </span>
        </div>

        {/* Description */}
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
          {preset.description}
        </p>

        {/* Agent + Judge row */}
        <div className="flex items-center justify-between gap-2">
          <AgentAvatarStack
            agents={preset.agents}
            judge={preset.judge}
            size="sm"
          />
          <span className="text-[10px] text-muted-foreground/70">
            {preset.agents.length} agents
          </span>
        </div>

        {/* Capsules: domain + capabilities */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Domain chip */}
          <span className="inline-flex items-center gap-1 rounded-full border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground">
            {DOMAIN_ICONS[preset.domainHint] ?? DOMAIN_ICONS.general}
            {preset.domainHint.charAt(0).toUpperCase() +
              preset.domainHint.slice(1)}
          </span>

          {/* Capability chips */}
          {preset.capabilities.map((cap) => (
            <span
              className="inline-flex items-center rounded-full border border-border/30 bg-muted/30 px-1.5 py-0.5 text-[9px] text-muted-foreground/80"
              key={cap}
            >
              {CAPABILITY_LABELS[cap] ?? cap}
            </span>
          ))}

          {/* Default mode badge */}
          <span className="inline-flex items-center rounded-full bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 text-[9px] text-cyan-600 dark:text-cyan-400">
            {preset.defaultMode === "council"
              ? "Accuracy"
              : preset.defaultMode === "swarm"
                ? "Speed"
                : "Mixed"}
          </span>
        </div>

        {/* Judge label */}
        <p className="text-[10px] text-muted-foreground/60">
          Judge:{" "}
          <span className="font-medium text-muted-foreground/80">
            {preset.judge.name}
          </span>
        </p>
      </div>
    </GlassCard>
  );
}
