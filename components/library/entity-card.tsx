"use client";

/**
 * EntityCard — Unified card for all library entity types.
 * Phase 22: Handles playbooks, connectors, skills, functions, workflows.
 *
 * Features:
 *  - Type-specific color, icon, and badge
 *  - Glass surface with hover spring
 *  - Description, counts, domain tags
 *  - Click handler + keyboard accessible
 *  - Stagger entrance compatible
 */

import {
  BookOpen,
  Code2,
  ExternalLink,
  FolderGit2,
  FunctionSquare,
  MoreHorizontal,
  Play,
  Plug,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SPRING_GENTLE, STAGGER_ITEM } from "@/lib/motion/springs";

export type EntityType = "playbook" | "connector" | "skill" | "function" | "workflow";

const TYPE_META: Record<EntityType, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  label: string;
  color: string;
  iconBg: string;
}> = {
  playbook: {
    icon: FolderGit2, label: "Playbook",
    color: "text-amber-400", iconBg: "bg-amber-400/10 border-amber-400/20",
  },
  connector: {
    icon: Plug, label: "Connector",
    color: "text-cyan-400", iconBg: "bg-cyan-400/10 border-cyan-400/20",
  },
  skill: {
    icon: Sparkles, label: "Skill",
    color: "text-emerald-400", iconBg: "bg-emerald-400/10 border-emerald-400/20",
  },
  function: {
    icon: FunctionSquare, label: "Function",
    color: "text-violet-400", iconBg: "bg-violet-400/10 border-violet-400/20",
  },
  workflow: {
    icon: Workflow, label: "Workflow",
    color: "text-orange-400", iconBg: "bg-orange-400/10 border-orange-400/20",
  },
};

export interface EntityData {
  id: string;
  name: string;
  type: EntityType;
  description?: string;
  href: string;
  count?: number;
  countLabel?: string;
  domain?: string;
  tags?: string[];
  updatedAt?: string;
}

interface EntityCardProps {
  entity: EntityData;
  index?: number;
  onView?: (entity: EntityData) => void;
  className?: string;
}

export function EntityCard({ entity, index = 0, onView, className }: EntityCardProps) {
  const meta = TYPE_META[entity.type] ?? TYPE_META.playbook;
  const Icon = meta.icon;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onView?.(entity);
    }
  };

  return (
    <motion.div {...STAGGER_ITEM} transition={{ delay: index * 0.04 }}>
      <motion.div
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={SPRING_GENTLE}
        className={cn(
          "rounded-2xl p-4 glass-1",
          "cursor-pointer select-none",
          "hover:shadow-[var(--glass-shadow-2)] transition-shadow duration-300",
          className
        )}
        onClick={() => onView?.(entity)}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`${entity.name} — ${meta.label}`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          {/* Icon + type badge */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg border",
              meta.iconBg
            )}>
              <Icon size={16} className={meta.color} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold truncate">{entity.name}</h4>
              <Badge
                variant="outline"
                className={cn(
                  "h-4.5 px-1.5 text-[10px] font-medium mt-0.5",
                  meta.iconBg, meta.color
                )}
              >
                {meta.label}
              </Badge>
            </div>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView?.(entity); }}>
                <ExternalLink size={14} className="mr-2" /> View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                <Play size={14} className="mr-2" /> Execute
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {entity.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
            {entity.description}
          </p>
        )}

        {/* Footer: count + domain + date */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            {entity.count !== undefined && (
              <span className="flex items-center gap-1">
                <Code2 size={11} />
                {entity.count} {entity.countLabel ?? ""}
              </span>
            )}
            {entity.domain && (
              <span className="flex items-center gap-1">
                <BookOpen size={11} />
                {entity.domain}
              </span>
            )}
          </div>
          {entity.updatedAt && (
            <span className="tabular-nums">
              {new Date(entity.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>

        {/* Tags */}
        {entity.tags && entity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {entity.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="h-4.5 text-[9px] px-1 py-0">
                {tag}
              </Badge>
            ))}
            {entity.tags.length > 3 && (
              <Badge variant="secondary" className="h-4.5 text-[9px] px-1 py-0">
                +{entity.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default EntityCard;
