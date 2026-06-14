"use client";

/**
 * components/canvas/primitives/action-button.tsx — ActionButton primitive.
 *
 * Phase 16.F: Consistent button with icon + label + optional tooltip.
 * Variants: primary (Neptune blue), secondary, ghost, danger.
 * Sizes: sm, md, lg.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ActionButtonProps {
  children?: ReactNode;
  icon?: ReactNode;
  label: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: "button" | "submit";
}

const variantClasses: Record<string, string> = {
  primary:
    "bg-[#0A84FF] text-white hover:bg-[#0070E0] border-transparent shadow-sm",
  secondary:
    "bg-muted/20 text-foreground/80 hover:bg-muted/40 border border-border/30",
  ghost:
    "text-muted-foreground hover:text-foreground hover:bg-muted/20 border-transparent",
  danger:
    "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20",
};

const sizeClasses: Record<string, string> = {
  sm: "px-2.5 py-1.5 text-[11px] gap-1.5 rounded-lg",
  md: "px-3 py-2 text-xs gap-2 rounded-lg",
  lg: "px-4 py-2.5 text-sm gap-2 rounded-xl",
};

export function ActionButton({
  children,
  icon,
  label,
  onClick,
  variant = "secondary",
  size = "md",
  disabled = false,
  loading = false,
  className,
  type = "button",
}: ActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center font-medium",
        "transition-all duration-150",
        "disabled:opacity-40 disabled:pointer-events-none",
        "active:scale-[0.97]",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {label && <span>{label}</span>}
      {children}
    </button>
  );
}
