/**
 * Motion Spring Physics — Liquid Glass OS
 * Phase 22: Premium spring constants for 60fps interactions.
 *
 * Usage:
 *   import { SPRING_GENTLE, SPRING_BOUNCY, SPRING_SNAPPY } from "@/lib/motion/springs";
 *   <motion.div transition={SPRING_GENTLE} whileHover={{ scale: 1.02 }} />
 */

import type { Transition, Easing } from "framer-motion";

// ── Spring Presets ──────────────────────────────────────────────────────────

/** Gentle, subtle spring — card hovers, list item enter */
export const SPRING_GENTLE: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 30,
  mass: 0.8,
};

/** Bouncy, energetic spring — page transitions, modals, detail entrance */
export const SPRING_BOUNCY: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
  mass: 1,
};

/** Snappy, fast spring — tab switches, toggle flips */
export const SPRING_SNAPPY: Transition = {
  type: "spring",
  stiffness: 600,
  damping: 35,
  mass: 0.6,
};

// ── Easing Presets ──────────────────────────────────────────────────────────

/** Smooth exponential ease-out — modals, sheets, overlays */
export const EASE_OUT_EXPO: Easing = [0.16, 1, 0.3, 1];

/** Slight overshoot ease-out — attention-grabbing entrances */
export const EASE_OUT_BACK: Easing = [0.34, 1.56, 0.64, 1];

// ── Common Variants ─────────────────────────────────────────────────────────

/** Standard card hover: gentle lift + subtle scale */
export const CARD_HOVER = {
  whileHover: { scale: 1.02, y: -2, transition: SPRING_GENTLE },
  whileTap: { scale: 0.98, transition: SPRING_GENTLE },
};

/** Stagger children entrance with configurable delay */
export function staggerEnter(delayMs = 30) {
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: {
      staggerChildren: delayMs / 1000,
      ...SPRING_GENTLE,
    },
  };
}

/** Stagger child item */
export const STAGGER_ITEM = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

/** Page entrance — bouncy slide up */
export const PAGE_ENTER = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: SPRING_BOUNCY },
  exit: { opacity: 0, y: -12, transition: { duration: 0.15 } },
};

/** Fade in from below — subtle */
export const FADE_UP = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: SPRING_GENTLE },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

/** Scale in from center — modals, popovers */
export const SCALE_IN = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: SPRING_SNAPPY },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.12 } },
};

// ── Accessibility ────────────────────────────────────────────────────────────

/**
 * Returns motion variants that respect prefers-reduced-motion.
 * When reduced motion is preferred, returns instant transitions (duration 0).
 */
export function withReducedMotion<T extends Record<string, unknown>>(
  variants: T,
  prefersReducedMotion: boolean
): T {
  if (!prefersReducedMotion) return variants;
  return Object.fromEntries(
    Object.entries(variants).map(([key, value]) => {
      if (typeof value === "object" && value !== null && "transition" in (value as object)) {
        return [key, { ...(value as object), transition: { duration: 0 } }];
      }
      return [key, value];
    })
  ) as T;
}
