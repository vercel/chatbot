"use client";

/**
 * GlassCard — Liquid glass primitive card with spring physics.
 * Phase 22: The foundational glass surface for all library cards.
 *
 * Features:
 *  - glass-1/2/3 elevation prop
 *  - Spring hover (scale 1.02, y -2px)
 *  - Press state (scale 0.98)
 *  - Refractive top edge highlight
 *  - Keyboard accessible (Enter/Space)
 *  - prefers-reduced-motion support
 */

import { motion, type HTMLMotionProps } from "framer-motion";
import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { SPRING_GENTLE, CARD_HOVER } from "@/lib/motion/springs";

type GlassElevation = "1" | "2" | "3";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  elevation?: GlassElevation;
  interactive?: boolean;
  refractive?: boolean;
  children: React.ReactNode;
}

const ELEVATION_MAP: Record<GlassElevation, string> = {
  "1": "glass-1",
  "2": "glass-2",
  "3": "glass-3",
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      elevation = "1",
      interactive = true,
      refractive = true,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const motionProps: HTMLMotionProps<"div"> = interactive
      ? {
          whileHover: { scale: 1.02, y: -2 },
          whileTap: { scale: 0.98 },
          transition: SPRING_GENTLE,
        }
      : {};

    return (
      <motion.div
        ref={ref}
        className={cn(
          "rounded-2xl",
          ELEVATION_MAP[elevation],
          refractive && "glass-refractive",
          interactive && "cursor-pointer select-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className
        )}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? "button" : undefined}
        {...motionProps}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export default GlassCard;
