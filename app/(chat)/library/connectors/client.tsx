"use client";

/**
 * ConnectorsClient — Client component for /library/connectors.
 * Phase 22: Connector grid with filter, search, and status indicators.
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

interface Connector {
  id: string;
  name: string;
  description: string;
  brandColor: string;
  functionCount: number;
  tags: string[];
  status: "connected" | "available";
}

interface ConnectorsClientProps {
  connectors: Connector[];
}

export function ConnectorsClient({ connectors }: ConnectorsClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState<string[]>([]);

  const statusChips: FilterChip[] = [
    { id: "connected", label: "Connected", count: connectors.filter((c) => c.status === "connected").length },
    { id: "available", label: "Available", count: connectors.filter((c) => c.status === "available").length },
  ];

  const filtered = useMemo(() => {
    let results = connectors;
    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (activeStatus.length > 0) {
      results = results.filter((c) => activeStatus.includes(c.status));
    }
    return results;
  }, [connectors, search, activeStatus]);

  const entities: EntityData[] = filtered.map((c) => ({
    id: c.id,
    name: c.name,
    type: "connector" as const,
    description: c.description,
    href: `/library/connectors/${c.id}`,
    count: c.functionCount,
    countLabel: "functions",
    tags: c.tags,
    updatedAt: new Date().toISOString(),
  }));

  return (
    <PageTransition className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <BreadcrumbNav />

        <div className="mt-6 mb-8">
          <h1 className="text-display-2 mb-2">Connectors</h1>
          <p className="text-body-l text-muted-foreground">
            {connectors.length} connectors — API integrations, MCP bridges, and service adapters.
          </p>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search connectors..."
            className="flex-1"
          />
        </div>
        <FilterBar
          chips={statusChips}
          active={activeStatus}
          onChange={setActiveStatus}
          label="Status"
          className="mb-8"
          multiSelect
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
            <p className="text-muted-foreground">No connectors match your filters.</p>
          </GlassSurface>
        )}

        <CommandPalette />
      </div>
    </PageTransition>
  );
}
