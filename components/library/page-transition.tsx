"use client";

/**
 * PageTransition — Smooth page entrance/exit transition.
 * Phase 22: Wraps page content with bouncy entrance animation.
 *
 * Features:
 *  - SPRING_BOUNCY entrance (y: 24 → 0, opacity 0 → 1)
 *  - Exit animation (fade + slight up)
 *  - Configurable direction (up/down/left/right)
 *  - Respects prefers-reduced-motion
 */

import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SPRING_BOUNCY } from "@/lib/motion/springs";

type Direction = "up" | "down" | "left" | "right";

const DIRECTION_OFFSET: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 24 },
  down: { x: 0, y: -24 },
  left: { x: 24, y: 0 },
  right: { x: -24, y: 0 },
};

interface PageTransitionProps {
  children: React.ReactNode;
  direction?: Direction;
  className?: string;
  id?: string;
}

export function PageTransition({
  children,
  direction = "up",
  className,
  id,
}: PageTransitionProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const offset = DIRECTION_OFFSET[direction];

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.15 } }}
      transition={SPRING_BOUNCY}
      className={cn("w-full", className)}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
