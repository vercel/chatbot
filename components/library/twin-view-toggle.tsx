"use client";

/**
 * TwinViewToggle — Animated toggle between Playbook View and Connector View.
 * Phase 22: Segmented control with spring-animated indicator.
 *
 * Features:
 *  - Two options: Playbook View / Connector View
 *  - Animated selection indicator (motion layoutId)
 *  - Glass surface styling
 *  - Keyboard accessible (← →)
 *  - ARIA: role="radiogroup"
 */

import {
  FolderGit2,
  Plug,
} from "lucide-react";
import React, { useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY } from "@/lib/motion/springs";

export type TwinViewMode = "playbook" | "connector";

interface TwinViewToggleProps {
  mode: TwinViewMode;
  onModeChange: (mode: TwinViewMode) => void;
  className?: string;
}

export function TwinViewToggle({ mode, onModeChange, className }: TwinViewToggleProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        onModeChange(mode === "playbook" ? "connector" : "playbook");
      }
    },
    [mode, onModeChange]
  );

  return (
    <div
      role="radiogroup"
      aria-label="Library view mode"
      className={cn(
        "relative inline-flex rounded-xl p-0.5",
        "glass-1",
        className
      )}
      onKeyDown={handleKeyDown}
    >
      {/* Animated active indicator */}
      <motion.div
        layoutId="twin-view-active"
        transition={SPRING_SNAPPY}
        className={cn(
          "absolute top-0.5 bottom-0.5 rounded-[10px]",
          "bg-background/80 backdrop-blur-sm",
          "shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
          mode === "playbook" ? "left-0.5 w-[calc(50%-2px)]" : "left-[calc(50%+1px)] w-[calc(50%-2px)]"
        )}
      />

      {/* Playbook option */}
      <button
        role="radio"
        aria-checked={mode === "playbook"}
        onClick={() => onModeChange("playbook")}
        className={cn(
          "relative z-10 flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium transition-colors",
          "min-h-[40px]",
          mode === "playbook"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <FolderGit2 size={15} />
        <span>Playbooks</span>
      </button>

      {/* Connector option */}
      <button
        role="radio"
        aria-checked={mode === "connector"}
        onClick={() => onModeChange("connector")}
        className={cn(
          "relative z-10 flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium transition-colors",
          "min-h-[40px]",
          mode === "connector"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Plug size={15} />
        <span>Connectors</span>
      </button>
    </div>
  );
}

export default TwinViewToggle;
