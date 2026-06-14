"use client";

/**
 * FunctionDetail — Slide-out panel showing function metadata and reverse references.
 *
 * Renders: description, version, domain, signature stub, dependency list,
 * and "Used by" section showing which connectors/skills/playbooks reference this function.
 *
 * Phase 12.F: "Used By" now fetches actual edges from library_edges DB via
 * /api/library/reverse-refs instead of relying on hardcoded registry.json data.
 */

import {
  ArrowLeftRightIcon,
  BookIcon,
  ExternalLinkIcon,
  GitBranchIcon,
  HashIcon,
  LinkIcon,
  Loader2Icon,
  PlugIcon,
  SparklesIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

interface EdgeRef {
  from: string;
  fromType: string;
  edgeType: string;
  weight: number;
}

const EDGE_LABELS: Record<string, string> = {
  uses: "Uses",
  exposes: "Exposes",
  routes_to: "Routes to",
  implements: "Implements",
  depends_on: "Depends on",
  called_by: "Called by",
  also_in: "Also in",
};

// ── Component ──────────────────────────────────────────────────────────────

export function FunctionDetail({ node, onClose, className }: FunctionDetailProps) {
  const [dbEdges, setDbEdges] = useState<EdgeRef[] | null>(null);
  const [edgesLoading, setEdgesLoading] = useState(false);

  // Phase 12.F: Fetch actual edges from library_edges DB on open
  useEffect(() => {
    if (!node) {
      setDbEdges(null);
      return;
    }
    setEdgesLoading(true);
    setDbEdges(null);

    const nodeType = node.type;
    const nodeName = node.name;

    fetch(`/api/library/reverse-refs/${nodeType}/${encodeURIComponent(nodeName)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setDbEdges(data.refs || []);
      })
      .catch(() => {
        setDbEdges([]);
      })
      .finally(() => {
        setEdgesLoading(false);
      });
  }, [node]);

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

        {/* Phase 12.F: Used By — from DB (library_edges) */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <LinkIcon className="size-3" />
            Used By {dbEdges ? `(${dbEdges.length})` : ""}
            {edgesLoading && <Loader2Icon className="size-3 animate-spin ml-1" />}
          </h4>

          {edgesLoading ? (
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-full rounded" />
              <Skeleton className="h-6 w-3/4 rounded" />
            </div>
          ) : dbEdges && dbEdges.length > 0 ? (
            <div className="space-y-1">
              {dbEdges.map((ref, i) => (
                <div
                  className="flex items-center gap-1.5 rounded bg-primary/5 px-2 py-1 text-xs border border-primary/10"
                  key={`${ref.from}-${ref.edgeType}-${i}`}
                >
                  <PlugIcon className="size-3 text-primary/60" />
                  <span className="font-mono text-[11px]">{ref.from}</span>
                  <Badge className="text-[9px] py-0 px-1 h-4 ml-auto" variant="outline">
                    {EDGE_LABELS[ref.edgeType] || ref.edgeType}
                  </Badge>
                  {ref.weight > 1 && (
                    <span className="text-[9px] text-muted-foreground/60">w:{ref.weight}</span>
                  )}
                </div>
              ))}
            </div>
          ) : meta?.usedBy && meta.usedBy.length > 0 ? (
            // Fallback: show registry.json usedBy if DB has no edges
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
          ) : (
            <div className="rounded bg-muted/30 p-3 text-xs text-muted-foreground text-center">
              <BookIcon className="size-4 mx-auto mb-1 opacity-50" />
              No reverse references found in the relational graph.
            </div>
          )}
        </div>

        {/* Playbooks referencing (placeholder) */}
        {!meta?.usedBy?.length && !dbEdges?.length && !edgesLoading && (
          <div className="mb-4 rounded bg-muted/30 p-3 text-xs text-muted-foreground text-center">
            <BookIcon className="size-4 mx-auto mb-1 opacity-50" />
            No references found. This node may be referenced by playbooks or internal workflows.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
