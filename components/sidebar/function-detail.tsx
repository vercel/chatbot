"use client";

/**
 * FunctionDetail — Slide-out panel showing function metadata and reverse references.
 *
 * Renders: description, version, domain, signature stub, dependency list,
 * and "Used by" section showing which connectors/skills/playbooks reference this function.
 */

import {
  ArrowLeftRightIcon,
  BookIcon,
  ExternalLinkIcon,
  GitBranchIcon,
  HashIcon,
  PlugIcon,
  SparklesIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LibraryTreeNode } from "@/app/api/library/tree/route";

// ── Types ──────────────────────────────────────────────────────────────────

export interface FunctionDetailProps {
  /** The selected function node, or null to close */
  node: LibraryTreeNode | null;
  /** Called when the panel is dismissed */
  onClose: () => void;
  className?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function FunctionDetail({ node, onClose, className }: FunctionDetailProps) {
  if (!node) return null;

  const meta = node.metadata;

  return (
    <Sheet open={!!node} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className={cn("w-[380px] sm:w-[440px] overflow-y-auto", className)} side="right">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-2">
            <ZapIcon className="size-5 text-primary" />
            <SheetTitle className="text-base font-mono">{node.name}</SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            {node.description ?? "Function detail"}
          </SheetDescription>
        </SheetHeader>

        {/* Version + Domain badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          {meta?.version && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <GitBranchIcon className="size-3" />
              {meta.version}
            </Badge>
          )}
          {meta?.domain && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <HashIcon className="size-3" />
              {meta.domain.replace(/-/g, " ")}
            </Badge>
          )}
        </div>

        {/* Dependencies */}
        {meta?.dependencies && meta.dependencies.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <ArrowLeftRightIcon className="size-3" />
              Dependencies
            </h4>
            <div className="space-y-1">
              {meta.dependencies.map((dep) => (
                <div
                  className="flex items-center gap-1.5 rounded bg-muted/50 px-2 py-1 text-xs"
                  key={dep}
                >
                  <PlugIcon className="size-3 text-muted-foreground" />
                  <span className="font-mono text-[11px]">{dep}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Also In */}
        {meta?.alsoIn && meta.alsoIn.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Also Used In
            </h4>
            <div className="flex flex-wrap gap-1">
              {meta.alsoIn.map((domain) => (
                <Badge className="text-[10px]" key={domain} variant="outline">
                  {domain.replace(/-/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Used By (reverse refs) */}
        {meta?.usedBy && meta.usedBy.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <SparklesIcon className="size-3" />
              Used By ({meta.usedBy.length})
            </h4>
            <div className="space-y-1">
              {meta.usedBy.map((ref) => (
                <div
                  className="flex items-center gap-1.5 rounded bg-primary/5 px-2 py-1 text-xs border border-primary/10"
                  key={ref}
                >
                  <PlugIcon className="size-3 text-primary/60" />
                  <span className="font-mono text-[11px]">{ref}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Playbooks referencing (placeholder) */}
        {!meta?.usedBy?.length && (
          <div className="mb-4 rounded bg-muted/30 p-3 text-xs text-muted-foreground text-center">
            <BookIcon className="size-4 mx-auto mb-1 opacity-50" />
            No direct references found. This function may be used by playbooks or internal workflows.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
