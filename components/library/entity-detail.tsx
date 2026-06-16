"use client";

/**
 * EntityDetail — Detail panel shell for viewing entity information.
 * Phase 22: Premium detail view with header, metadata, and content slots.
 *
 * Features:
 *  - Glass-2 elevation with refractive edge
 *  - Header with icon, title, type badge, description
 *  - Metadata row (domain, path, updated)
 *  - Content slot for tabs or custom content
 *  - Close/back button
 *  - Motion entrance (SPRING_BOUNCY)
 */

import { ArrowLeft, Calendar, FileText, Hash, X } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SPRING_BOUNCY } from "@/lib/motion/springs";
import type { EntityType } from "./entity-card";

const TYPE_META: Record<EntityType, {
  label: string;
  color: string;
  iconBg: string;
}> = {
  playbook: { label: "Playbook", color: "text-amber-400", iconBg: "bg-amber-400/10 border-amber-400/20" },
  connector: { label: "Connector", color: "text-cyan-400", iconBg: "bg-cyan-400/10 border-cyan-400/20" },
  skill: { label: "Skill", color: "text-emerald-400", iconBg: "bg-emerald-400/10 border-emerald-400/20" },
  function: { label: "Function", color: "text-violet-400", iconBg: "bg-violet-400/10 border-violet-400/20" },
  workflow: { label: "Workflow", color: "text-orange-400", iconBg: "bg-orange-400/10 border-orange-400/20" },
};

interface EntityDetailProps {
  title: string;
  type: EntityType;
  description?: string;
  domain?: string;
  path?: string;
  updatedAt?: string;
  icon?: React.ReactNode;
  onBack?: () => void;
  className?: string;
  children: React.ReactNode;
}

export function EntityDetail({
  title,
  type,
  description,
  domain,
  path,
  updatedAt,
  icon,
  onBack,
  className,
  children,
}: EntityDetailProps) {
  const router = useRouter();
  const meta = TYPE_META[type] ?? TYPE_META.playbook;
  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_BOUNCY}
      className={cn("rounded-2xl glass-2 glass-refractive overflow-hidden", className)}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {/* Back button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Go back"
            >
              <ArrowLeft size={16} />
            </Button>

            {/* Title area */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-title-1 truncate">{title}</h1>
                <Badge
                  variant="outline"
                  className={cn("h-5 px-2 text-[11px]", meta.iconBg, meta.color)}
                >
                  {meta.label}
                </Badge>
              </div>
              {description && (
                <p className="text-body-m text-muted-foreground mt-1 line-clamp-2">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
          {domain && (
            <span className="flex items-center gap-1.5">
              <Hash size={12} />
              {domain}
            </span>
          )}
          {path && (
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <FileText size={12} />
              {path}
            </span>
          )}
          {formattedDate && (
            <span className="flex items-center gap-1.5">
              <Calendar size={12} />
              {formattedDate}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {children}
      </div>
    </motion.div>
  );
}

export default EntityDetail;
