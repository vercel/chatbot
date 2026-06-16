"use client";

/**
 * LibraryClient — Client component for /library OS desktop.
 * Phase 22: Renders the hero landing with glass surfaces, twin view, category cards.
 */

import React, { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Plug, Sparkles, Workflow } from "lucide-react";
import BreadcrumbNav from "@/components/library/breadcrumb-nav";
import CategoryGrid from "@/components/library/category-grid";
import CommandPalette from "@/components/library/command-palette";
import GlassSurface from "@/components/library/glass-surface";
import PageTransition from "@/components/library/page-transition";
import TwinViewToggle, { type TwinViewMode } from "@/components/library/twin-view-toggle";
import { SPRING_BOUNCY } from "@/lib/motion/springs";

interface LibraryClientProps {
  playbookCount: number;
  connectorCount: number;
  skillCount: number;
  workflowCount: number;
}

const QUICK_STATS = [
  { label: "Playbooks", count: 15, icon: BookOpen, color: "text-amber-400" },
  { label: "Connectors", count: 17, icon: Plug, color: "text-cyan-400" },
  { label: "Skills", count: 48, icon: Sparkles, color: "text-emerald-400" },
  { label: "Workflows", count: 12, icon: Workflow, color: "text-violet-400" },
];

export function LibraryClient({
  playbookCount,
  connectorCount,
  skillCount,
  workflowCount,
}: LibraryClientProps) {
  const [mode, setMode] = useState<TwinViewMode>("playbook");

  // Update stat counts from server data
  const stats = QUICK_STATS.map((s) => ({
    ...s,
    count:
      s.label === "Playbooks" ? playbookCount :
      s.label === "Connectors" ? connectorCount :
      s.label === "Skills" ? skillCount :
      workflowCount,
  }));

  return (
    <PageTransition className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <BreadcrumbNav />
        </div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_BOUNCY}
          className="mb-12"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <h1 className="text-display-2 sm:text-display-1">
                Agent OS
              </h1>
              <p className="text-body-l text-muted-foreground max-w-xl">
                Browse playbooks, connectors, skills, and workflows — the complete file system
                for your AI agent library.
              </p>
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-3 sm:gap-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    whileHover={{ scale: 1.05 }}
                    transition={SPRING_BOUNCY}
                    className="flex items-center gap-2 rounded-xl glass-1 px-3 py-2"
                  >
                    <Icon size={15} className={stat.color} />
                    <div>
                      <div className="text-xs font-semibold tabular-nums">{stat.count}</div>
                      <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Twin view toggle */}
          <div className="mt-6">
            <TwinViewToggle mode={mode} onModeChange={setMode} />
          </div>
        </motion.div>

        {/* Category Grid */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-title-1">
              {mode === "playbook" ? "Playbook Library" : "Connector Library"}
            </h2>
          </div>
          <CategoryGrid
            playbookCount={playbookCount}
            connectorCount={connectorCount}
            skillCount={skillCount}
            workflowCount={workflowCount}
          />
        </section>

        {/* Glass surface CTA */}
        <section className="mt-12">
          <GlassSurface elevation="2" refractive className="text-center">
            <div className="max-w-md mx-auto">
              <h3 className="text-title-2 mb-2">Search everything</h3>
              <p className="text-body-m text-muted-foreground mb-4">
                Press{" "}
                <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                  ⌘K
                </kbd>{" "}
                to open the command palette and search across all playbooks, connectors,
                skills, and functions.
              </p>
            </div>
          </GlassSurface>
        </section>
      </div>

      {/* ⌘K Command Palette */}
      <CommandPalette />
    </PageTransition>
  );
}
