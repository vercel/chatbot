"use client";

/**
 * components/canvas/canvas-shell.tsx — Resizable canvas wrapper.
 *
 * Phase 16: Generative Library Canvas — macOS Finder column-view aesthetic.
 *
 * Desktop: inline ResizablePanel on the right side of chat.
 * Mobile:  Vaul drawer (90vh, swipe-down dismiss).
 *
 * A11y: ESC closes. Focus trap in mobile sheet. ARIA region role.
 */
import { useEffect, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft } from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CanvasBreadcrumb } from "@/components/canvas/breadcrumb";
import { ModeRenderer } from "@/components/canvas/mode-renderer";

// ── Props ─────────────────────────────────────────────────────────────────────

interface CanvasShellProps {
  children?: ReactNode;
  className?: string;
}

// ── Mode Labels ───────────────────────────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  "library-overview": "Library",
  "connector-detail": "Connector",
  "skill-detail": "Skill",
  "function-detail": "Function",
  "playbook-detail": "Playbook",
  "workflow-canvas": "Workflow",
  "kg-explorer": "Knowledge Graph",
  "wiki-browser": "Wiki",
  "add-new": "Add New",
};

// ── CanvasShell (Desktop inline + Mobile sheet) ───────────────────────────────

export function CanvasShell({ children, className }: CanvasShellProps) {
  const { isOpen, activeMode, context, close, back, history } =
    useCanvasStore();
  const isMobile = useIsMobile();

  // ── ESC handler ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      // Cmd+[ or backspace with no input focused goes back
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "[" &&
        history.length > 0
      ) {
        e.preventDefault();
        back();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close, back, history.length]);

  // ── Handle navigation from within canvas ───────────────────────────
  const handleNavigate = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mode: any, ctx: any) => {
      useCanvasStore.getState().open(mode, ctx);
    },
    [],
  );

  const headerLabel = MODE_LABELS[activeMode] || activeMode;

  // ── Mobile: Vaul Sheet ──────────────────────────────────────────────
  if (isMobile && isOpen) {
    return (
      <>
        {children}
        <Sheet open onOpenChange={(open) => !open && close()}>
          <SheetContent
            aria-label={`${headerLabel} canvas`}
            className="w-full sm:max-w-[100vw] h-[90vh] p-0 flex flex-col"
            side="bottom"
          >
            <SheetHeader className="p-3 border-b border-border/30 flex-shrink-0">
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <Button
                    aria-label="Go back"
                    onClick={back}
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <SheetTitle className="text-sm font-medium">
                  {headerLabel}
                </SheetTitle>
                <div className="flex-1" />
                <Button
                  aria-label="Close canvas"
                  onClick={close}
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CanvasBreadcrumb />
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <ModeRenderer
                mode={activeMode}
                context={context}
                onNavigate={handleNavigate}
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // ── Desktop: inline content — parent handles ResizablePanelGroup ──
  // CanvasShell renders its content wrapper; the Resizable wiring is
  // done in chat-layout-client.tsx which wraps children with CanvasShell.
  if (isOpen) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="canvas-panel"
          aria-label={`${headerLabel} canvas`}
          aria-live="polite"
          className={cn(
            "flex h-full flex-col border-l border-border/50",
            "bg-background/80 backdrop-blur-xl",
            "overflow-hidden",
            className,
          )}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          role="region"
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ── Header bar ───────────────────────────────────────────── */}
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-4">
            {/* Back button */}
            {history.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Go back"
                    onClick={back}
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Back ({navigator?.platform?.includes("Mac") ? "⌘[" : "Ctrl+["})
                </TooltipContent>
              </Tooltip>
            )}

            {/* Breadcrumb */}
            <CanvasBreadcrumb />

            {/* Header title */}
            <h2 className="text-sm font-semibold tracking-tight flex-1 truncate">
              {headerLabel}
            </h2>

            {/* Close button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Close canvas"
                  onClick={close}
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Close (Esc)</TooltipContent>
            </Tooltip>
          </div>

          {/* ── Content area ─────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            <ModeRenderer
              mode={activeMode}
              context={context}
              onNavigate={handleNavigate}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Canvas closed — render nothing extra ────────────────────────────
  return <>{children}</>;
}
