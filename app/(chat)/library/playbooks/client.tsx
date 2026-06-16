"use client";

/**
 * PlaybooksClient — Client component for /library/playbooks.
 * Phase 22: Domain grid with search, filter, and animated cards.
 */

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AnimatedGrid from "@/components/library/animated-grid";
import BreadcrumbNav from "@/components/library/breadcrumb-nav";
import CommandPalette from "@/components/library/command-palette";
import EntityCard, { type EntityData } from "@/components/library/entity-card";
import FilterBar, { type FilterChip } from "@/components/library/filter-bar";
import GlassSurface from "@/components/library/glass-surface";
import PageTransition from "@/components/library/page-transition";
import SearchInput from "@/components/library/search-input";

interface Domain {
  id: string;
  name: string;
  description: string;
  domain: string;
  connectorCount: number;
  skillCount: number;
}

interface PlaybooksClientProps {
  domains: Domain[];
}

export function PlaybooksClient({ domains }: PlaybooksClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeDomains, setActiveDomains] = useState<string[]>([]);

  const domainChips: FilterChip[] = useMemo(() => {
    const domainCounts = new Map<string, number>();
    for (const d of domains) {
      domainCounts.set(d.domain, (domainCounts.get(d.domain) ?? 0) + 1);
    }
    return Array.from(domainCounts.entries()).map(([domain, count]) => ({
      id: domain,
      label: domain.charAt(0).toUpperCase() + domain.slice(1),
      count,
    }));
  }, [domains]);

  const filtered = useMemo(() => {
    let results = domains;
    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q)
      );
    }
    if (activeDomains.length > 0) {
      results = results.filter((d) => activeDomains.includes(d.domain));
    }
    return results;
  }, [domains, search, activeDomains]);

  const entities: EntityData[] = filtered.map((d) => ({
    id: d.id,
    name: d.name,
    type: "playbook" as const,
    description: d.description,
    href: `/library/playbooks/${d.id}`,
    domain: d.domain,
    count: d.connectorCount,
    countLabel: "connectors",
    tags: [d.domain],
  }));

  return (
    <PageTransition className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <BreadcrumbNav />

        <div className="mt-6 mb-8">
          <h1 className="text-display-2 mb-2">Playbooks</h1>
          <p className="text-body-l text-muted-foreground">
            {domains.length} domain-specific playbooks — click to explore workflows, dependencies, and anti-patterns.
          </p>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search playbooks..."
            className="flex-1"
          />
        </div>
        <FilterBar
          chips={domainChips}
          active={activeDomains}
          onChange={setActiveDomains}
          label="Domain"
          className="mb-8"
        />

        {/* Grid */}
        {entities.length > 0 ? (
          <AnimatedGrid cols={3} gap="gap-4">
            {entities.map((entity, i) => (
              <EntityCard
                key={entity.id}
                entity={entity}
                index={i}
                onView={() => router.push(entity.href)}
              />
            ))}
          </AnimatedGrid>
        ) : (
          <GlassSurface elevation="2" className="text-center py-12">
            <p className="text-muted-foreground">No playbooks match your filters.</p>
          </GlassSurface>
        )}

        <CommandPalette />
      </div>
    </PageTransition>
  );
}
