"use client";

import { useState } from "react";

import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import { isProductionEnvironment } from "@/lib/constants";
import { BookmarkIcon, ChevronDown } from "lucide-react";

export interface CheckpointCardProps {
  summary: string;
  className?: string;
}

export function CheckpointCard({ summary, className }: CheckpointCardProps) {
  const [open, setOpen] = useState(false);

  // In production, show only the separator line (no expand/collapse)
  if (isProductionEnvironment) {
    return (
      <div className={cn("mt-6 mb-2 flex items-center gap-0.5 w-full text-muted-foreground", className)}>
        <BookmarkIcon className="size-4 shrink-0" />
        <span className="shrink-0 px-2 text-xs">Conversation checkpoint</span>
        <Separator className="flex-1 min-w-0" />
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("mt-6 mb-2", className)}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-0.5 w-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <BookmarkIcon className="size-4 shrink-0" />
          <span className="shrink-0 px-2 text-xs">Conversation checkpoint</span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 transition-transform",
              open && "rotate-180"
            )}
          />
          <Separator className="flex-1 min-w-0" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-xl border border-accent bg-background p-4 text-xs text-muted-foreground leading-relaxed [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-xs [&_h2]:font-semibold [&_h3]:text-xs [&_h3]:font-medium [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1">
          <Markdown>{summary}</Markdown>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
