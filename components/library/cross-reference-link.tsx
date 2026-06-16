"use client";

/**
 * CrossReferenceLink — Auto-link entities between surfaces.
 * Phase 22: Links references like "nmi" → /library/connectors/nmi.
 *
 * Features:
 *  - Detects connector/playbook references in text
 *  - Renders as clickable glass badges
 *  - Back-reference display ("Used by: billing, support")
 *  - Hover preview tooltip
 *  - Keyboard accessible
 */

import { ArrowRight, ExternalLink, FolderGit2, Plug } from "lucide-react";
import Link from "next/link";
import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type RefType = "playbook" | "connector" | "skill" | "function";

export interface CrossRef {
  id: string;
  name: string;
  type: RefType;
  href: string;
  description?: string;
}

interface CrossReferenceLinkProps {
  ref: CrossRef;
  className?: string;
}

const TYPE_CONFIG: Record<RefType, { icon: React.ComponentType<any>; color: string }> = {
  playbook: { icon: FolderGit2, color: "bg-amber-400/10 text-amber-400 border-amber-400/20" },
  connector: { icon: Plug, color: "bg-cyan-400/10 text-cyan-400 border-cyan-400/20" },
  skill: { icon: ArrowRight, color: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" },
  function: { icon: ArrowRight, color: "bg-violet-400/10 text-violet-400 border-violet-400/20" },
};

export function CrossReferenceLink({ ref, className }: CrossReferenceLinkProps) {
  const config = TYPE_CONFIG[ref.type] ?? TYPE_CONFIG.connector;
  const Icon = config.icon;

  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <Link href={ref.href} className={cn("inline-flex", className)}>
          <Badge
            variant="outline"
            className={cn(
              "h-6 px-2 gap-1.5 cursor-pointer transition-all duration-200",
              "hover:scale-105 hover:shadow-sm",
              config.color
            )}
          >
            <Icon size={11} />
            <span className="text-[11px] font-medium">{ref.name}</span>
            <ExternalLink size={9} className="opacity-40" />
          </Badge>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[200px]">
        {ref.description ?? `View ${ref.name} ${ref.type}`}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Back-references display ────────────────────────────────────────────────

interface BackRefsProps {
  refs: CrossRef[];
  className?: string;
}

export function BackReferences({ refs, className }: BackRefsProps) {
  if (refs.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground font-medium">
        Used by:
      </span>
      {refs.map((ref) => (
        <CrossReferenceLink key={ref.id} ref={ref} />
      ))}
    </div>
  );
}

export default CrossReferenceLink;
