"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import AnimatedGrid from "@/components/library/animated-grid";
import BreadcrumbNav from "@/components/library/breadcrumb-nav";
import CommandPalette from "@/components/library/command-palette";
import EntityCard, { type EntityData } from "@/components/library/entity-card";
import GlassSurface from "@/components/library/glass-surface";
import PageTransition from "@/components/library/page-transition";
import SearchInput from "@/components/library/search-input";

export function SkillsClient() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  return (
    <PageTransition className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <BreadcrumbNav />
        <div className="mt-6 mb-8">
          <h1 className="text-display-2 mb-2">Skills</h1>
          <p className="text-body-l text-muted-foreground">
            Reusable agent skills — functions, prompts, and automation patterns.
          </p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search skills..." className="mb-8" />
        <GlassSurface elevation="2" className="text-center py-12">
          <p className="text-muted-foreground">
            Skills index loads dynamically from the API. Visit /api/skills for data.
          </p>
        </GlassSurface>
        <CommandPalette />
      </div>
    </PageTransition>
  );
}
