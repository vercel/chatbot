"use client";

/**
 * components/canvas/primitives/plan.tsx — Plan + Task compound components.
 *
 * Phase 16.F: Ordered step list with status icons + collapse details.
 * For SOPs, playbook steps, workflow plans.
 *
 * Compound pattern: <Plan> <Plan.Task> <Plan.Task> </Plan>
 */

import { useState, createContext, useContext, type ReactNode } from "react";
import { ChevronDown, CheckCircle2, Circle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Plan Context ──────────────────────────────────────────────────────────────

interface PlanContextValue {
  activeStep: number | null;
  setActiveStep: (step: number) => void;
}

const PlanContext = createContext<PlanContextValue>({
  activeStep: null,
  setActiveStep: () => {},
});

// ── Plan (Container) ──────────────────────────────────────────────────────────

interface PlanProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export function Plan({ children, title, className }: PlanProps) {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <PlanContext.Provider value={{ activeStep, setActiveStep }}>
      <div className={cn("space-y-1", className)}>
        {title && (
          <h4 className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider mb-2">
            {title}
          </h4>
        )}
        <ol className="space-y-1">{children}</ol>
      </div>
    </PlanContext.Provider>
  );
}

// ── Task (Single Step) ────────────────────────────────────────────────────────

type TaskStatus = "pending" | "in-progress" | "done" | "error";

interface TaskProps {
  children?: ReactNode;
  label: string;
  description?: string;
  status?: TaskStatus;
  step?: number;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
}

function TaskItem({
  children,
  label,
  description,
  status = "pending",
  step,
  collapsed: controlledCollapsed,
  defaultCollapsed = true,
}: TaskProps) {
  const { activeStep } = useContext(PlanContext);
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed = controlledCollapsed ?? internalCollapsed;
  const hasContent = !!children;

  const statusIcon = {
    pending: <Circle className="h-4 w-4 text-muted-foreground/30" />,
    "in-progress": <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
    done: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    error: <AlertCircle className="h-4 w-4 text-destructive" />,
  }[status];

  const statusColors = {
    pending: "border-border/20",
    "in-progress": "border-blue-500/30 bg-blue-500/[0.03]",
    done: "border-emerald-500/20 bg-emerald-500/[0.03]",
    error: "border-destructive/20 bg-destructive/[0.03]",
  }[status];

  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => hasContent && setInternalCollapsed(!isCollapsed)}
        className={cn(
          "w-full flex items-start gap-3 p-3 rounded-lg text-left",
          "border transition-all duration-150",
          statusColors,
          hasContent && "cursor-pointer hover:bg-muted/10",
          !hasContent && "cursor-default",
        )}
      >
        {/* Step number */}
        {step !== undefined && (
          <span className="text-[11px] font-medium text-muted-foreground/40 w-5 flex-shrink-0 pt-0.5">
            {step}.
          </span>
        )}

        {/* Status icon */}
        <span className="flex-shrink-0 pt-0.5">{statusIcon}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium",
              status === "done" && "text-muted-foreground/60 line-through",
              status === "in-progress" && "text-foreground",
              status === "error" && "text-destructive",
            )}
          >
            {label}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground/50 mt-0.5">
              {description}
            </p>
          )}
        </div>

        {/* Expand chevron */}
        {hasContent && (
          <ChevronDown
            className={cn(
              "h-4 w-4 flex-shrink-0 text-muted-foreground/30 transition-transform duration-150 mt-0.5",
              !isCollapsed && "rotate-180",
            )}
          />
        )}
      </button>

      {/* Collapsible details */}
      {hasContent && !isCollapsed && (
        <div className="ml-[44px] border-l-2 border-border/20 pl-6 py-2">
          <div className="text-sm text-muted-foreground/70">{children}</div>
        </div>
      )}
    </li>
  );
}

// ── Compound component assignment ─────────────────────────────────────────────

Plan.Task = TaskItem;
