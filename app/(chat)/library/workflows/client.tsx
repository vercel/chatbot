"use client";

import React, { useState } from "react";
import BreadcrumbNav from "@/components/library/breadcrumb-nav";
import CommandPalette from "@/components/library/command-palette";
import GlassSurface from "@/components/library/glass-surface";
import PageTransition from "@/components/library/page-transition";
import SearchInput from "@/components/library/search-input";

export function WorkflowsClient() {
  const [search, setSearch] = useState("");

  return (
    <PageTransition className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <BreadcrumbNav />
        <div className="mt-6 mb-8">
          <h1 className="text-display-2 mb-2">Workflows</h1>
          <p className="text-body-l text-muted-foreground">
            Multi-step automation workflows with dependency graphs and triggers.
          </p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search workflows..." className="mb-8" />
        <GlassSurface elevation="2" className="text-center py-12">
          <p className="text-muted-foreground">
            Workflow index loads dynamically from the API. Visit /api/workflows for data.
          </p>
        </GlassSurface>
        <CommandPalette />
      </div>
    </PageTransition>
  );
}
