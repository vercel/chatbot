"use client";

/**
 * components/canvas/modes/workflow-canvas-mode.tsx — Workflow Canvas mode.
 *
 * Phase 16.G: Wraps the existing WorkflowCanvas (@xyflow/react) for
 * create/edit flows. Reuses battle-tested WorkflowCanvas.tsx.
 */

import type { ModeProps } from "@/lib/canvas/types";
import dynamic from "next/dynamic";
import { Workflow } from "lucide-react";

// Lazy-load the heavy WorkflowCanvas component (@xyflow/react is ~200KB)
const WorkflowCanvas = dynamic(
  () => import("@/components/workflow/WorkflowCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    ),
  },
);

export function WorkflowCanvasMode({ context, onNavigate }: ModeProps) {
  const workflowName = context.workflowName || "";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-[#0A84FF]" />
          <h2 className="text-lg font-bold">
            {workflowName ? workflowName : "New Workflow"}
          </h2>
        </div>
        <p className="text-xs text-muted-foreground/50 mt-1">
          Drag nodes from the left palette to build your workflow
        </p>
      </div>

      {/* Canvas area */}
      <div className="flex-1 min-h-0">
        <WorkflowCanvas />
      </div>
    </div>
  );
}
