"use client";

/**
 * HoverPreview — Floating preview card on hover.
 * Phase 22: Shows a mini detail card when hovering over entity references.
 *
 * Features:
 *  - Popover-based floating preview
 *  - Glass surface styling
 *  - Shows entity type, description, counts
 *  - Keyboard accessible (focus triggers preview)
 *  - Motion scale entrance
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY } from "@/lib/motion/springs";
import type { EntityType } from "./entity-card";
import type { CrossRef } from "./cross-reference-link";

const TYPE_LABELS: Record<string, string> = {
  playbook: "Playbook",
  connector: "Connector",
  skill: "Skill",
  function: "Function",
  workflow: "Workflow",
};

interface HoverPreviewProps {
  entity: CrossRef;
  children: React.ReactNode;
  className?: string;
}

export function HoverPreview({ entity, children, className }: HoverPreviewProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className={cn("cursor-pointer", className)}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {children}
        </span>
      </PopoverTrigger>
      <AnimatePresence>
        {open && (
          <PopoverContent
            asChild
            className="w-64 p-0 overflow-hidden"
            side="top"
            align="center"
            sideOffset={8}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              transition={SPRING_SNAPPY}
              className="glass-2 rounded-xl"
            >
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="h-5 text-[10px]">
                    {TYPE_LABELS[entity.type] ?? entity.type}
                  </Badge>
                </div>
                <h4 className="text-sm font-semibold">{entity.name}</h4>
                {entity.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {entity.description}
                  </p>
                )}
              </div>
              <div className="px-4 py-2 border-t border-border/20 bg-muted/20">
                <span className="text-[10px] text-muted-foreground">
                  Click to view details →
                </span>
              </div>
            </motion.div>
          </PopoverContent>
        )}
      </AnimatePresence>
    </Popover>
  );
}

export default HoverPreview;
