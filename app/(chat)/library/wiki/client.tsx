"use client";

/**
 * WikiClient — Interactive capability wiki with search, filter, and
 * liquid-glass entity cards. Uses Phase 22 components.
 */

import { useState, useMemo } from "react";
import { Search, Filter, ChevronDown, ExternalLink, BookOpen, Cpu, Wrench, Workflow, Braces, Boxes, Layers } from "lucide-react";
import type { WikiData, WikiEntity } from "./page";
import { GlassCard } from "@/components/library/glass-card";
import { FilterBar } from "@/components/library/filter-bar";
import { SearchInput } from "@/components/library/search-input";

// ── Section icons ─────────────────────────────────────────────────────────

const sectionIcons: Record<string, React.ReactNode> = {
  connector: <Cpu className="w-4 h-4" />,
  playbook: <BookOpen className="w-4 h-4" />,
  skill: <Wrench className="w-4 h-4" />,
  function: <Braces className="w-4 h-4" />,
  workflow: <Workflow className="w-4 h-4" />,
  model: <Layers className="w-4 h-4" />,
};

// ── Entity Card ────────────────────────────────────────────────────────────

function EntityCard({ entity }: { entity: WikiEntity }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10 hover:border-white/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white/40">{sectionIcons[entity.type]}</span>
            <h4 className="text-sm font-semibold text-white truncate">{entity.label}</h4>
            <span className="text-[10px] uppercase tracking-wider text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
              {entity.type}
            </span>
          </div>
          <p className="text-xs text-white/50 leading-relaxed line-clamp-2">
            {entity.description || "No description available"}
          </p>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <dl className="grid grid-cols-2 gap-2 text-[11px]">
                {Object.entries(entity.metadata).filter(([, v]) => v !== undefined && v !== null && v !== "" && (!Array.isArray(v) || v.length > 0)).slice(0, 6).map(([key, value]) => (
                  <div key={key} className="flex flex-col">
                    <dt className="text-white/30 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</dt>
                    <dd className="text-white/60 font-mono text-[10px] break-all">
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>
    </div>
  );
}

// ── Section Component ──────────────────────────────────────────────────────

function WikiSection({
  title,
  type,
  entities,
  defaultExpanded,
}: {
  title: string;
  type: string;
  entities: WikiEntity[];
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? true);

  if (entities.length === 0) return null;

  return (
    <section className="space-y-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left group"
      >
        <span className="text-white/40">{sectionIcons[type] || <Boxes className="w-4 h-4" />}</span>
        <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
          {title}
        </h3>
        <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">
          {entities.length}
        </span>
        <ChevronDown
          className={`w-4 h-4 ml-auto text-white/30 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {entities.map((entity) => (
            <EntityCard key={entity.id} entity={entity} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Main Client ────────────────────────────────────────────────────────────

export function WikiClient({ data }: { data: WikiData | null }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredSections = useMemo(() => {
    if (!data) return [];
    return data.sections.map((section) => ({
      ...section,
      entities: section.entities.filter((e) => {
        const matchesSearch =
          !search ||
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.label.toLowerCase().includes(search.toLowerCase()) ||
          e.description.toLowerCase().includes(search.toLowerCase());
        const matchesType = typeFilter === "all" || section.type === typeFilter;
        return matchesSearch && matchesType;
      }),
    }));
  }, [data, search, typeFilter]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="text-white/30 text-6xl mb-4">📚</div>
        <h2 className="text-xl font-bold text-white mb-2">Wiki Unavailable</h2>
        <p className="text-white/50 max-w-md">
          system-capabilities.json hasn't been generated yet. Run{" "}
          <code className="bg-white/10 px-1.5 py-0.5 rounded text-white/70 text-sm">
            pnpm capabilities:regen
          </code>{" "}
          to build the capability index.
        </p>
      </div>
    );
  }

  // Infer type filter options from sections
  const typeOptions = data.sections.map((s) => ({
    id: s.type,
    label: s.title,
    count: s.entities.length,
  }));

  const totalEntities = data.sections.reduce((sum, s) => sum + s.entities.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                System Wiki
              </h1>
              <p className="mt-2 text-sm text-white/50 max-w-xl">
                Auto-generated capability reference. {totalEntities} entities across{" "}
                {data.sections.length} categories. Generated at{" "}
                {new Date(data.generatedAt).toLocaleString()}.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/30">
              <span className="px-2 py-1 rounded bg-white/5">
                v{data.version}
              </span>
              <span className="px-2 py-1 rounded bg-white/5">
                {data.counts.connectors || 0}c/{data.counts.playbooks || 0}p
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-md">
              <SearchInput
                placeholder="Search entities..."
                value={search}
                onChange={setSearch}
              />
            </div>
            <FilterBar
              chips={typeOptions}
              active={typeFilter === "all" ? [] : [typeFilter]}
              onChange={(active) => setTypeFilter(active.length > 0 ? active[0] : "all")}
              multiSelect={false}
            />
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {filteredSections.map((section) => (
          <WikiSection
            key={section.type}
            title={section.title}
            type={section.type}
            entities={section.entities}
          />
        ))}

        {filteredSections.every((s) => s.entities.length === 0) && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-10 h-10 text-white/20 mb-3" />
            <p className="text-white/40">No entities match your search.</p>
            <button
              onClick={() => { setSearch(""); setTypeFilter("all"); }}
              className="mt-3 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-xs text-white/20 text-center">
            Generated from lib/system-capabilities.json — the single source of truth for system capabilities.
            Never hallucinate. Always read the truth file.
          </p>
        </div>
      </div>
    </div>
  );
}
