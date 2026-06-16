"use client";

/**
 * Phase 23A: Mode Toggle — [Model] [Panel] segmented control
 *
 * INSIDE chat input bar (not separate). Toggles between:
 *  - Model mode: single model, traditional chat
 *  - Panel mode: multi-agent panel container
 *
 * Default for new users: Panel mode
 */

import { motion } from "framer-motion";
import { BrainIcon, UsersIcon } from "lucide-react";
import { SPRING_SNAPPY } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";

export type FusionMode = "model" | "panel";

interface ModeToggleProps {
  mode: FusionMode;
  onModeChange: (mode: FusionMode) => void;
  className?: string;
}

export function ModeToggle({ mode, onModeChange, className }: ModeToggleProps) {
  return (
    <div
      aria-label="Chat mode"
      className={cn(
        "flex items-center rounded-lg border border-border/40 bg-muted/50 p-0.5",
        className
      )}
      role="radiogroup"
    >
      <ToggleOption
        active={mode === "model"}
        icon={<BrainIcon className="size-3" />}
        label="Model"
        onClick={() => onModeChange("model")}
      />
      <ToggleOption
        active={mode === "panel"}
        icon={<UsersIcon className="size-3" />}
        label="Panel"
        onClick={() => onModeChange("panel")}
      />
    </div>
  );
}

function ToggleOption({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      aria-checked={active}
      className={cn(
        "relative flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground/60 hover:text-muted-foreground"
      )}
      onClick={onClick}
      role="radio"
      type="button"
    >
      {active && (
        <motion.div
          className="absolute inset-0 rounded-md bg-background shadow-sm border border-border/20"
          layoutId="fusion-mode-indicator"
          transition={SPRING_SNAPPY}
        />
      )}
      <span className="relative z-10 flex items-center gap-1">
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </span>
    </button>
  );
}
