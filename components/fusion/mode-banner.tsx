"use client";

/**
 * Phase 23A: Mode Banner — shows current execution mode at top of deliberation view
 *
 * Council: "🧠 Council mode — deliberating" (accuracy)
 * Swarm: "🔄 Swarm mode — decomposing" (efficiency, Phase 23B)
 * Hybrid: "⚡ Hybrid mode — mixed approach" (complex, Phase 23B)
 */

import { motion } from "framer-motion";
import { BrainCircuitIcon, NetworkIcon, ZapIcon } from "lucide-react";
import type { PanelMode } from "@/lib/ai/fusion/types";
import { FADE_UP } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";

interface ModeBannerProps {
  mode: PanelMode;
  presetName: string;
  agentCount: number;
  className?: string;
}

const MODE_CONFIG: Record<
  PanelMode,
  { icon: React.ReactNode; label: string; color: string }
> = {
  council: {
    icon: <BrainCircuitIcon className="size-4" />,
    label: "Council",
    color:
      "from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-700 dark:text-cyan-300",
  },
  swarm: {
    icon: <ZapIcon className="size-4" />,
    label: "Swarm",
    color:
      "from-emerald-500/20 to-green-500/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  },
  hybrid: {
    icon: <NetworkIcon className="size-4" />,
    label: "Hybrid",
    color:
      "from-violet-500/20 to-purple-500/20 border-violet-500/30 text-violet-700 dark:text-violet-300",
  },
};

export function ModeBanner({
  mode,
  presetName,
  agentCount,
  className,
}: ModeBannerProps) {
  const config = MODE_CONFIG[mode];

  return (
    <motion.div
      {...FADE_UP}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-gradient-to-r px-4 py-2.5 text-[13px]",
        config.color,
        className
      )}
    >
      <motion.span
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      >
        {config.icon}
      </motion.span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="font-semibold whitespace-nowrap">
          {config.label} mode
        </span>
        <span className="text-muted-foreground/60">•</span>
        <span className="truncate text-muted-foreground/80">
          {presetName} · {agentCount} agents
        </span>
      </div>
      <motion.div
        animate={{ opacity: [1, 0.5, 1] }}
        className="flex items-center gap-1"
        transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
      >
        <span className="size-1.5 rounded-full bg-current animate-pulse" />
        <span className="text-[10px] opacity-70">running</span>
      </motion.div>
    </motion.div>
  );
}
