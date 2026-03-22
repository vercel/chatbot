"use client";

import { AnimatePresence, m } from "framer-motion";

import type { UISuggestion } from "@/lib/editor/suggestions";
import { Button } from "../ui/button";
import { CrossIcon, SparklesIcon } from "./icons";

export const SuggestionDialog = ({
  suggestion,
  onApply,
  onClose,
}: {
  suggestion: UISuggestion;
  onApply: () => void;
  onClose: () => void;
}) => {
  return (
    <AnimatePresence>
      <div className="sticky inset-0 z-40 h-full w-full">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onClose();
            }
          }}
          role="presentation"
        />
        <m.div
          animate={{ opacity: 1, scale: 1 }}
          className="absolute left-1/2 top-1/2 z-50 flex w-[min(20rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-2xl border bg-background p-4 font-sans text-sm shadow-xl"
          exit={{ opacity: 0, scale: 0.95 }}
          initial={{ opacity: 0, scale: 0.95 }}
          key={suggestion.id}
          transition={{ duration: 0.15 }}
        >
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center gap-2">
              <div className="flex size-5 items-center justify-center rounded-md bg-muted/60 text-muted-foreground ring-1 ring-border/50">
                <SparklesIcon size={10} />
              </div>
              <div className="font-medium">Suggestion</div>
            </div>
            <button
              className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={onClose}
              type="button"
            >
              <CrossIcon size={12} />
            </button>
          </div>
          <div className="text-muted-foreground leading-relaxed">
            {suggestion.description}
          </div>
          <div className="flex gap-2">
            <Button
              className="w-fit rounded-full px-3 py-1.5"
              onClick={onApply}
              variant="outline"
            >
              Apply
            </Button>
            <Button
              className="w-fit rounded-full px-3 py-1.5"
              onClick={onClose}
              variant="ghost"
            >
              Dismiss
            </Button>
          </div>
        </m.div>
      </div>
    </AnimatePresence>
  );
};
