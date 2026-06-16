"use client";

/**
 * CategoryGrid — OS desktop home grid with 4 hero cards.
 * Phase 22: The landing grid for /library showing Playbooks, Connectors, Skills, Workflows.
 *
 * Features:
 *  - 4 large glass hero cards with icons + counts
 *  - Spring hover (scale 1.02)
 *  - Staggered entrance animation
 *  - Responsive: 1 col mobile, 2 cols tablet, 4 cols desktop
 */

import {
  FolderGit2,
  FunctionSquare,
  Plug,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SPRING_GENTLE, STAGGER_ITEM, staggerEnter } from "@/lib/motion/springs";

interface CategoryCardData {
  id: string;
  label: string;
  description: string;
  href: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  color: string;
  iconBg: string;
  count?: number;
  countLabel?: string;
}

function buildCategories(playbookCount?: number, connectorCount?: number, skillCount?: number, workflowCount?: number): CategoryCardData[] {
  return [
    {
      id: "playbooks",
      label: "Playbooks",
      description: "Domain-specific agent playbooks with workflows, anti-patterns, and business context",
      href: "/library/playbooks",
      icon: FolderGit2,
      color: "text-amber-400",
      iconBg: "bg-amber-400/10 border-amber-400/20",
      count: playbookCount ?? 15,
      countLabel: "domains",
    },
    {
      id: "connectors",
      label: "Connectors",
      description: "API integrations, MCP bridges, and third-party service connectors",
      href: "/library/connectors",
      icon: Plug,
      color: "text-cyan-400",
      iconBg: "bg-cyan-400/10 border-cyan-400/20",
      count: connectorCount ?? 17,
      countLabel: "connectors",
    },
    {
      id: "skills",
      label: "Skills",
      description: "Reusable agent skills — functions, prompts, and automation patterns",
      href: "/library/skills",
      icon: Sparkles,
      color: "text-emerald-400",
      iconBg: "bg-emerald-400/10 border-emerald-400/20",
      count: skillCount ?? 48,
      countLabel: "skills",
    },
    {
      id: "workflows",
      label: "Workflows",
      description: "Multi-step automation workflows with dependency graphs and triggers",
      href: "/library/workflows",
      icon: Workflow,
      color: "text-violet-400",
      iconBg: "bg-violet-400/10 border-violet-400/20",
      count: workflowCount ?? 12,
      countLabel: "workflows",
    },
  ];
}

interface CategoryGridProps {
  playbookCount?: number;
  connectorCount?: number;
  skillCount?: number;
  workflowCount?: number;
  className?: string;
}

export function CategoryGrid({
  playbookCount,
  connectorCount,
  skillCount,
  workflowCount,
  className,
}: CategoryGridProps) {
  const categories = buildCategories(playbookCount, connectorCount, skillCount, workflowCount);

  return (
    <motion.div
      {...staggerEnter(40)}
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
        className
      )}
    >
      {categories.map((cat) => {
        const Icon = cat.icon;
        return (
          <motion.div key={cat.id} {...STAGGER_ITEM}>
            <Link href={cat.href} className="block group">
              <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                transition={SPRING_GENTLE}
                className={cn(
                  "relative rounded-2xl p-6 h-full",
                  "glass-1 glass-refractive",
                  "hover:shadow-[var(--glass-shadow-2)]",
                  "transition-shadow duration-300",
                  "cursor-pointer"
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "flex size-12 items-center justify-center rounded-xl border mb-4",
                  cat.iconBg
                )}>
                  <Icon size={22} className={cat.color} />
                </div>

                {/* Label + count */}
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-title-2">{cat.label}</h3>
                  {cat.count !== undefined && (
                    <span className={cn("text-sm font-semibold tabular-nums", cat.color)}>
                      {cat.count.toLocaleString()}
                      <span className="text-[10px] font-normal text-muted-foreground ml-1">
                        {cat.countLabel}
                      </span>
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-body-m text-muted-foreground line-clamp-2">
                  {cat.description}
                </p>

                {/* Hover indicator */}
                <div className={cn(
                  "absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity",
                  cat.color
                )}>
                  <FunctionSquare size={14} className="rotate-45" />
                </div>
              </motion.div>
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export default CategoryGrid;
