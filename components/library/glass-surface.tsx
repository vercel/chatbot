"use client";

/**
 * GlassSurface — Generic glass container with elevation prop.
 * Phase 22: Non-interactive glass background for sections and panels.
 *
 * Features:
 *  - glass-1/2/3 elevation
 *  - Optional refractive top edge
 *  - Padding and rounded corners as props
 */

import React from "react";
import { cn } from "@/lib/utils";

type GlassElevation = "1" | "2" | "3";

interface GlassSurfaceProps {
  elevation?: GlassElevation;
  refractive?: boolean;
  padded?: boolean;
  className?: string;
  children: React.ReactNode;
}

const ELEVATION_MAP: Record<GlassElevation, string> = {
  "1": "glass-1",
  "2": "glass-2",
  "3": "glass-3",
};

export function GlassSurface({
  elevation = "1",
  refractive = false,
  padded = true,
  className,
  children,
}: GlassSurfaceProps) {
  return (
    <div
      className={cn(
        "rounded-2xl",
        ELEVATION_MAP[elevation],
        refractive && "glass-refractive",
        padded && "p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export default GlassSurface;
