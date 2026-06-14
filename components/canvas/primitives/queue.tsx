"use client";

/**
 * components/canvas/primitives/queue.tsx — Queue primitive.
 *
 * Phase 16.F: Horizontal scrollable task carousel for "next up" items.
 * Each item is a mini Task card with status indicator.
 */

import type { ReactNode } from "react";
import { Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface QueueItem {
  id: string;
  label: string;
  description?: string;
  status?: "pending" | "in-progress" | "done";
  onClick?: () => void;
}

interface QueueProps {
  items: QueueItem[];
  title?: string;
  className?: string;
  emptyMessage?: string;
  maxVisible?: number;
}

export function Queue({
  items,
  title,
  className,
  emptyMessage = "No items in queue",
  maxVisible = 5,
}: QueueProps) {
  const visibleItems = items.slice(0, maxVisible);
  const remaining = Math.max(0, items.length - maxVisible);

  if (items.length === 0) {
    return (
      <div className={cn("rounded-xl border border-border/30 p-6 text-center", className)}>
        <Clock className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground/50">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {title && (
        <h4 className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider">
          {title}
        </h4>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={cn(
              "flex-shrink-0 w-44 rounded-xl border border-border/30 p-3 text-left",
              "bg-card/60 hover:bg-card/80 hover:shadow-sm",
              "active:scale-[0.98] transition-all duration-150",
            )}
            type="button"
          >
            <div className="flex items-center gap-2 mb-1">
              <StatusDot status={item.status} />
              <p className="text-xs font-medium truncate">{item.label}</p>
            </div>
            {item.description && (
              <p className="text-[11px] text-muted-foreground/50 truncate">
                {item.description}
              </p>
            )}
          </button>
        ))}

        {/* Overflow indicator */}
        {remaining > 0 && (
          <div className="flex-shrink-0 flex items-center justify-center w-16 rounded-xl border border-border/20 bg-muted/10">
            <span className="text-xs text-muted-foreground/50 font-medium">
              +{remaining}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status?: QueueItem["status"] }) {
  const colors = {
    pending: "bg-muted-foreground/20",
    "in-progress": "bg-blue-500 animate-pulse",
    done: "bg-emerald-500",
  };

  return (
    <span
      className={cn(
        "flex-shrink-0 w-2 h-2 rounded-full",
        colors[status || "pending"],
      )}
    />
  );
}
