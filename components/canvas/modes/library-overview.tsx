"use client";

/**
 * components/canvas/modes/library-overview.tsx — Library Overview mode.
 *
 * Phase 16.D: Apple HIG Today aesthetic — hero stats, sparklines, recent items.
 *
 * Placeholder mode for Phase B — full implementation in Phase D.
 */

import type { ModeProps } from "@/lib/canvas/types";
import { Library, Plus, Plug, Sparkles, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LibrarySummary {
  totalNodes: number;
  totalEdges: number;
  byType: Record<string, number>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LibraryOverview({ context, onNavigate }: ModeProps) {
  const [summary, setSummary] = useState<LibrarySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/library/graph");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSummary(data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load library");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // ── Loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <HeaderTitleSkeleton />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <Library className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────
  if (!summary || summary.totalNodes === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
        <Library className="h-10 w-10 text-muted-foreground/20" />
        <div>
          <h3 className="text-sm font-medium text-foreground/70">
            Your library is empty
          </h3>
          <p className="text-xs text-muted-foreground/50 mt-1">
            Add connectors, skills, and functions to populate your library.
          </p>
        </div>
        <button
          onClick={() => onNavigate("add-new")}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-xl",
            "text-sm font-medium",
            "bg-[#0A84FF] text-white",
            "hover:bg-[#0070E0] transition-colors",
          )}
        >
          <Plus className="h-4 w-4" />
          Add Your First Item
        </button>
      </div>
    );
  }

  const byType = summary.byType || {};

  return (
    <div className="space-y-6 p-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-[28px] font-bold tracking-tight leading-tight text-foreground">
          Neptune Library
        </h1>
        <p className="text-sm text-muted-foreground/60 mt-1">
          Your skill operating system
        </p>
      </div>

      {/* ── Hero Stats Grid 2×2 ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <HeroStatCard
          icon={<Plug className="h-5 w-5" />}
          label="Connectors"
          count={byType.connector || 0}
          color="blue"
          onClick={() => {
            // Navigate to first connector if available
            onNavigate("library-overview");
          }}
        />
        <HeroStatCard
          icon={<Sparkles className="h-5 w-5" />}
          label="Skills"
          count={byType.skill || 0}
          color="purple"
          onClick={() => onNavigate("library-overview")}
        />
        <HeroStatCard
          icon={<Library className="h-5 w-5" />}
          label="Functions"
          count={byType.function || 0}
          color="emerald"
          onClick={() => onNavigate("library-overview")}
        />
        <HeroStatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Playbooks"
          count={byType.playbook || 0}
          color="amber"
          onClick={() => onNavigate("library-overview")}
        />
      </div>

      {/* ── Summary ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/30 p-4 space-y-2 bg-card/40">
        <h3 className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider">
          Overview
        </h3>
        <p className="text-sm text-muted-foreground/70">
          {summary.totalNodes} library items across {Object.keys(byType).length} types with{" "}
          {summary.totalEdges} relationships.
        </p>
      </div>

      {/* ── FAB (Add New) ───────────────────────────────────────────── */}
      <button
        onClick={() => onNavigate("add-new")}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "flex items-center justify-center",
          "w-12 h-12 rounded-full",
          "bg-[#0A84FF] text-white shadow-lg",
          "hover:bg-[#0070E0] hover:shadow-xl hover:scale-105",
          "active:scale-95 transition-all duration-150",
        )}
        aria-label="Add new library item"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}

// ── Hero Stat Card ───────────────────────────────────────────────────────────

function HeroStatCard({
  icon,
  label,
  count,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: "blue" | "purple" | "emerald" | "amber";
  onClick?: () => void;
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col gap-3 p-4 rounded-xl",
        "border border-border/30 bg-card/60 backdrop-blur-sm",
        "hover:bg-card/80 hover:shadow-sm",
        "active:scale-[0.98] transition-all duration-150",
        "text-left",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-9 h-9 rounded-lg border",
          colorClasses[color],
        )}
      >
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {count}
        </div>
        <div className="text-xs text-muted-foreground/60 mt-0.5">{label}</div>
      </div>
    </button>
  );
}

function HeaderTitleSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-8 w-48 bg-muted/30 rounded-md animate-pulse" />
      <div className="h-4 w-64 bg-muted/20 rounded-md animate-pulse" />
    </div>
  );
}
