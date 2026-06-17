"use client";

/**
 * Phase 25 Stream 4: /library/workflows — Workflow Library
 *
 * Lists saved workflow templates (mine + shared).
 * Shows: name, description, last run, Run button.
 * Filter by tag.
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Share2,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import BreadcrumbNav from "@/components/library/breadcrumb-nav";
import CommandPalette from "@/components/library/command-palette";
import GlassSurface from "@/components/library/glass-surface";
import PageTransition from "@/components/library/page-transition";
import SearchInput from "@/components/library/search-input";
import { SPRING_GENTLE } from "@/lib/motion/springs";

interface WorkflowRun {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: Array<{ name: string; type: string }>;
  isShared: boolean;
  tags: string[];
  createdAt: string;
  lastRun: WorkflowRun | null;
}

function WorkflowCard({
  workflow,
  onRun,
}: {
  workflow: WorkflowTemplate;
  onRun: (id: string) => void;
}) {
  const stepCount = workflow.steps?.length || 0;
  const lastRunStatus = workflow.lastRun?.status;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_GENTLE}
      className={cn(
        "relative overflow-hidden rounded-xl border p-4",
        "border-white/10 bg-white/[0.04] backdrop-blur-xl",
        "hover:bg-white/[0.06] transition-colors"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-white/90 truncate">
                {workflow.name}
              </h3>
              {workflow.isShared && (
                <Share2 className="size-3 text-white/30 shrink-0" />
              )}
            </div>
            {workflow.description && (
              <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">
                {workflow.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-2">
          {workflow.steps?.slice(0, 4).map((step, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.03] border border-white/[0.05] text-white/40"
            >
              {step.name}
            </span>
          ))}
          {stepCount > 4 && (
            <span className="px-1.5 py-0.5 rounded text-[9px] text-white/30">
              +{stepCount - 4} more
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 text-[10px] text-white/30">
            <span>{stepCount} steps</span>
            {workflow.lastRun && (
              <span className="flex items-center gap-1">
                <Clock className="size-2.5" />
                {new Date(workflow.lastRun.startedAt).toLocaleDateString()}
              </span>
            )}
            {lastRunStatus && (
              <span
                className={cn(
                  "flex items-center gap-0.5",
                  lastRunStatus === "completed" ? "text-emerald-400" : "text-red-400"
                )}
              >
                {lastRunStatus === "completed" ? (
                  <CheckCircle2 className="size-2.5" />
                ) : (
                  <XCircle className="size-2.5" />
                )}
              </span>
            )}
            {workflow.tags?.length > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="size-2.5" />
                {workflow.tags.slice(0, 2).join(", ")}
              </span>
            )}
          </div>
          <button
            onClick={() => onRun(workflow.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-400 hover:bg-cyan-500/20 transition-colors font-medium"
          >
            <Play className="size-3" />
            Run
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function WorkflowsClient() {
  const [search, setSearch] = useState("");
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [error, setError] = useState("");

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/workflows");
      const data = await res.json();
      setWorkflows(data.workflows || []);
      setError("");
    } catch {
      setError("Failed to load workflows");
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleRun = async (workflowId: string) => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.missionId) {
        window.location.href = `/?mission=${data.missionId}`;
      } else if (data.message) {
        alert(data.message);
      }
    } catch {
      // ignore
    }
  };

  const filtered = search
    ? workflows.filter(
        (w) =>
          w.name.toLowerCase().includes(search.toLowerCase()) ||
          w.description?.toLowerCase().includes(search.toLowerCase())
      )
    : workflows;

  return (
    <PageTransition className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <BreadcrumbNav />
        <div className="mt-6 mb-8">
          <h1 className="text-display-2 mb-2">Workflows</h1>
          <p className="text-body-l text-muted-foreground">
            Multi-step automation workflows &mdash; save missions as reusable templates.
          </p>
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search workflows by name..."
          className="mb-8"
        />

        {error ? (
          <GlassSurface elevation="2" className="text-center py-12">
            <p className="text-red-400">{error}</p>
          </GlassSurface>
        ) : filtered.length === 0 ? (
          <GlassSurface elevation="2" className="text-center py-12">
            <p className="text-muted-foreground">
              {search
                ? "No workflows match your search."
                : 'No workflows saved yet. Use "Save as Workflow" on any MissionCard to create one.'}
            </p>
          </GlassSurface>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((wf) => (
              <WorkflowCard key={wf.id} workflow={wf} onRun={handleRun} />
            ))}
          </div>
        )}

        <CommandPalette />
      </div>
    </PageTransition>
  );
}
