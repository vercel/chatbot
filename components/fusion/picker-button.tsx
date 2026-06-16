"use client";

/**
 * Phase 23A: Picker Button — mode-aware label
 *
 * Model mode: "🔥 DeepSeek V4 Pro ▾"
 * Panel mode: "🧠 Chinese Frontier ▾"
 *
 * Click opens the chooser sheet (drawer on mobile, popover on desktop).
 */

import { ChevronDownIcon } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { FusionMode } from "./mode-toggle";

interface PickerButtonProps {
  mode: FusionMode;
  label: string;
  onClick: () => void;
  className?: string;
}

export const PickerButton = forwardRef<HTMLButtonElement, PickerButtonProps>(
  function PickerButton({ mode, label, onClick, className }, ref) {
    const isPanel = mode === "panel";
    const icon = isPanel ? "🧠" : "🔥";

    return (
      <button
        aria-label={
          isPanel
            ? `Panel: ${label} — click to change`
            : `Model: ${label} — click to change`
        }
        className={cn(
          "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
          "border border-border/30 bg-background/50 hover:bg-background/80",
          "transition-colors duration-150",
          "max-w-[180px] truncate",
          className
        )}
        onClick={onClick}
        ref={ref}
        type="button"
      >
        <span aria-hidden className="mr-0.5 text-xs">
          {icon}
        </span>
        <span className="truncate text-muted-foreground">{label}</span>
        <ChevronDownIcon className="ml-0.5 size-3 shrink-0 text-muted-foreground/50" />
      </button>
    );
  }
);
