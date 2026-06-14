"use client";

/**
 * components/canvas/mode-renderer.tsx — Routes to the correct canvas mode.
 *
 * Phase 16: Each mode is lazy-loaded + error-bounded.
 * One failed mode does NOT crash other modes or chat.
 */

import { Suspense, lazy, type ComponentType } from "react";
import type { CanvasMode, CanvasContext, ModeProps } from "@/lib/canvas/types";
import { CanvasErrorBoundary } from "@/components/canvas/error-boundary";
import { CanvasModeSkeleton } from "@/components/canvas/mode-skeleton";

// ── Lazy-loaded modes ─────────────────────────────────────────────────────────

const LibraryOverview = lazy(() =>
  import("@/components/canvas/modes/library-overview").then((m) => ({
    default: m.LibraryOverview,
  })),
);
const ConnectorDetail = lazy(() =>
  import("@/components/canvas/modes/connector-detail").then((m) => ({
    default: m.ConnectorDetail,
  })),
);
const SkillDetail = lazy(() =>
  import("@/components/canvas/modes/skill-detail").then((m) => ({
    default: m.SkillDetail,
  })),
);
const FunctionDetail = lazy(() =>
  import("@/components/canvas/modes/function-detail").then((m) => ({
    default: m.FunctionDetail,
  })),
);
const PlaybookDetail = lazy(() =>
  import("@/components/canvas/modes/playbook-detail").then((m) => ({
    default: m.PlaybookDetail,
  })),
);
const WorkflowCanvas = lazy(() =>
  import("@/components/canvas/modes/workflow-canvas-mode").then((m) => ({
    default: m.WorkflowCanvasMode,
  })),
);
const KgExplorer = lazy(() =>
  import("@/components/canvas/modes/kg-explorer").then((m) => ({
    default: m.KgExplorer,
  })),
);
const WikiBrowser = lazy(() =>
  import("@/components/canvas/modes/wiki-browser").then((m) => ({
    default: m.WikiBrowser,
  })),
);
const AddNew = lazy(() =>
  import("@/components/canvas/modes/add-new").then((m) => ({
    default: m.AddNew,
  })),
);

// ── Mode map ──────────────────────────────────────────────────────────────────

const MODE_MAP: Record<CanvasMode, ComponentType<ModeProps>> = {
  "library-overview": LibraryOverview,
  "connector-detail": ConnectorDetail,
  "skill-detail": SkillDetail,
  "function-detail": FunctionDetail,
  "playbook-detail": PlaybookDetail,
  "workflow-canvas": WorkflowCanvas,
  "kg-explorer": KgExplorer,
  "wiki-browser": WikiBrowser,
  "add-new": AddNew,
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface ModeRendererProps {
  mode: CanvasMode;
  context: CanvasContext;
  onNavigate: (mode: CanvasMode, context?: CanvasContext) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ModeRenderer({ mode, context, onNavigate }: ModeRendererProps) {
  const ModeComponent = MODE_MAP[mode];

  if (!ModeComponent) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Unknown mode: {mode}
      </div>
    );
  }

  return (
    <CanvasErrorBoundary mode={mode} onRetry={() => onNavigate(mode, context)}>
      <Suspense fallback={<CanvasModeSkeleton mode={mode} />}>
        <ModeComponent context={context} onNavigate={onNavigate} />
      </Suspense>
    </CanvasErrorBoundary>
  );
}
