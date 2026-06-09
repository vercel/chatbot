"use client";

/**
 * PanelContainer — right-side resizable panel that hosts
 * Connectors, Tools, Wiki, Workflows, Reports, Secrets content.
 *
 * Content swaps based on activePanel state (no page navigation).
 * On mobile, renders as a Sheet drawer.
 *
 * A11y: ARIA roles, focus trap, keyboard dismiss (Escape).
 */
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// PanelId is imported from app-sidebar (single source of truth)
import type { PanelId } from "@/components/chat/app-sidebar";

interface PanelContainerProps {
  activePanel: PanelId;
  onClose: () => void;
  className?: string;
  children?: React.ReactNode;
}

const PANEL_LABELS: Record<NonNullable<PanelId>, string> = {
  chats: "Chats",
  connectors: "Connectors",
  tools: "Tools",
  wiki: "Knowledge Base",
  workflows: "Workflows",
  reports: "Reports",
  secrets: "Secrets",
};

export function PanelContainer({
  activePanel,
  onClose,
  className,
  children,
}: PanelContainerProps) {
  const isMobile = useIsMobile();

  // ── Mobile: Sheet drawer ──────────────────────────────────────
  if (isMobile) {
    return (
      <Sheet onOpenChange={(open) => !open && onClose()} open={!!activePanel}>
        <SheetContent
          aria-label={activePanel ? PANEL_LABELS[activePanel] : "Panel"}
          className="w-full sm:max-w-[100vw] p-0 flex flex-col"
          side="right"
        >
          <SheetHeader className="p-4 border-b flex-shrink-0">
            <SheetTitle className="text-base">
              {activePanel ? PANEL_LABELS[activePanel] : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Desktop: inline panel with animation ──────────────────────
  return (
    <div
      aria-label={activePanel ? `${PANEL_LABELS[activePanel]} panel` : undefined}
      aria-live="polite"
      className={cn(
        "flex h-full flex-col border-l border-border/50 bg-sidebar overflow-hidden",
        className
      )}
      role="region"
    >
      {/* Panel header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 px-4">
        <h2 className="text-sm font-semibold tracking-tight">
          {activePanel ? PANEL_LABELS[activePanel] : ""}
        </h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Close panel"
              className="h-7 w-7"
              onClick={onClose}
              size="icon"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close panel (Esc)</TooltipContent>
        </Tooltip>
      </div>

      {/* Panel content */}
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 overflow-y-auto"
          exit={{ opacity: 0, x: 20 }}
          initial={{ opacity: 0, x: 20 }}
          key={activePanel}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
