"use client";

/**
 * lib/canvas/store.ts — Zustand store for the Library Canvas.
 *
 * Phase 16: Generative Library Canvas
 *
 * Manages: open/close state, active mode, navigation context, history stack,
 * and canvas width (persisted to localStorage).
 *
 * ESC handler is wired in CanvasShell via useEffect (not here) to avoid
 * hydration mismatches with persist middleware.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CanvasMode,
  CanvasContext,
  CanvasHistoryEntry,
} from "@/lib/canvas/types";

// ── State Interface ───────────────────────────────────────────────────────────

export interface CanvasState {
  // State
  isOpen: boolean;
  width: number; // percentage (20-60)
  activeMode: CanvasMode;
  context: CanvasContext;
  history: CanvasHistoryEntry[];

  // Actions
  open: (mode: CanvasMode, context?: CanvasContext) => void;
  close: () => void;
  resize: (width: number) => void;
  back: () => void;
  push: (mode: CanvasMode, context?: CanvasContext) => void;
  goToHistoryIndex: (index: number) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────
      isOpen: false,
      width: 40,
      activeMode: "library-overview",
      context: {},
      history: [],

      // ── open — opens the canvas to a specific mode ─────────────────
      open: (mode, context = {}) => {
        const current = get();
        // If canvas is already open and showing a non-overview mode,
        // push the current view onto history before navigating
        if (
          current.isOpen &&
          current.activeMode !== "library-overview" &&
          current.activeMode !== mode
        ) {
          set({
            history: [
              ...current.history,
              {
                mode: current.activeMode,
                context: { ...current.context },
                ts: Date.now(),
              },
            ],
          });
        }
        set({
          isOpen: true,
          activeMode: mode,
          context,
        });
      },

      // ── close — dismisses the canvas entirely ──────────────────────
      close: () =>
        set({
          isOpen: false,
          history: [],
          activeMode: "library-overview",
          context: {},
        }),

      // ── resize — updates canvas width percentage ───────────────────
      resize: (width) => set({ width }),

      // ── back — navigates to previous history entry ─────────────────
      back: () => {
        const { history } = get();
        if (history.length === 0) {
          // No history — close the canvas
          set({ isOpen: false, history: [], activeMode: "library-overview", context: {} });
          return;
        }
        const prev = history[history.length - 1];
        set({
          history: history.slice(0, -1),
          activeMode: prev.mode,
          context: prev.context,
        });
      },

      // ── push — manually push a new entry (without open side-effects) ─
      push: (mode, context = {}) => {
        const current = get();
        set({
          history: [
            ...current.history,
            {
              mode: current.activeMode,
              context: { ...current.context },
              ts: Date.now(),
            },
          ],
          activeMode: mode,
          context,
        });
      },

      // ── goToHistoryIndex — jump to a specific history position ─────
      goToHistoryIndex: (index) => {
        const { history } = get();
        if (index < 0 || index >= history.length) return;
        const entry = history[index];
        set({
          history: history.slice(0, index),
          activeMode: entry.mode,
          context: entry.context,
        });
      },
    }),
    {
      name: "neptune-library-canvas",
      // Only persist isOpen + width; mode/context/history are ephemeral
      partialize: (state) => ({
        isOpen: state.isOpen,
        width: state.width,
      }),
    },
  ),
);
