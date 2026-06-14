"use client";

/**
 * components/canvas/primitives/glass-card.tsx — GlassCard primitive.
 *
 * Phase 16.F: Apple HIG glass blur aesthetic card.
 * Shared by all detail modes for content sections.
 *
 * States: default, hover (subtle lift), active (slight scale 0.98),
 *         loading (skeleton), error (red ring + retry).
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  active?: boolean;
  /** Visual variant */
  variant?: "default" | "outline" | "filled";
  /** State */
  loading?: boolean;
  error?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

export function GlassCard({
  children,
  className,
  onClick,
  hover = true,
  active = false,
  variant = "default",
  loading = false,
  error = false,
  errorMessage,
  onRetry,
}: GlassCardProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/30 p-4 space-y-3",
          variant === "filled" && "bg-muted/20",
          className,
        )}
        aria-busy="true"
      >
        <div className="h-5 w-1/3 bg-muted/30 rounded-md animate-pulse" />
        <div className="h-4 w-full bg-muted/20 rounded-md animate-pulse" />
        <div className="h-4 w-2/3 bg-muted/20 rounded-md animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-xl border border-destructive/30 p-4",
          "bg-destructive/5",
          className,
        )}
        role="alert"
      >
        <p className="text-sm font-medium text-destructive/80">Error</p>
        {errorMessage && (
          <p className="text-xs text-destructive/60 mt-1">{errorMessage}</p>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 text-xs font-medium text-primary hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const Component = onClick ? "button" : "div";

  return (
    <Component
      className={cn(
        "rounded-xl text-left",
        // Glass surface
        "bg-card/60 backdrop-blur-sm",
        // Border
        variant === "default" && "border border-border/30",
        variant === "outline" && "border-2 border-border/40",
        variant === "filled" && "bg-muted/30",
        // Padding
        "p-4",
        // Interactive
        onClick &&
          cn(
            "cursor-pointer",
            hover && "hover:bg-card/80 hover:shadow-sm hover:border-border/50",
            active && "active:scale-[0.98]",
            "transition-all duration-150",
          ),
        className,
      )}
      onClick={onClick}
      {...(Component === "button" ? { type: "button" as const } : {})}
    >
      {children}
    </Component>
  );
}
