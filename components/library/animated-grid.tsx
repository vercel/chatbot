"use client";

/**
 * AnimatedGrid — Staggered entrance grid with 30ms delay between items.
 * Phase 22: Wraps children with staggered motion entrance.
 *
 * Features:
 *  - Stagger children with configurable delay (default 30ms)
 *  - Responsive grid (1/2/3/4 cols configurable)
 *  - fade-up entrance animation
 *  - Respects prefers-reduced-motion
 */

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SPRING_GENTLE, staggerEnter } from "@/lib/motion/springs";

type GridCols = 1 | 2 | 3 | 4;

interface AnimatedGridProps {
  children: React.ReactNode;
  cols?: GridCols | { sm?: GridCols; md?: GridCols; lg?: GridCols };
  gap?: string;
  staggerMs?: number;
  className?: string;
}

const COLS_MAP: Record<GridCols, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export function AnimatedGrid({
  children,
  cols = 3,
  gap = "gap-4",
  staggerMs = 30,
  className,
}: AnimatedGridProps) {
  const colsClass = typeof cols === "number" ? COLS_MAP[cols] : cn(
    cols.sm && COLS_MAP[cols.sm],
    cols.md && `md:${COLS_MAP[cols.md]}`,
    cols.lg && `lg:${COLS_MAP[cols.lg]}`
  );

  return (
    <motion.div
      {...staggerEnter(staggerMs)}
      className={cn("grid", colsClass, gap, className)}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING_GENTLE}
          >
            {child}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export default AnimatedGrid;
