"use client";

/**
 * ConnectorDetailClient — Client component for /library/connectors/[name].
 * Phase 22: Detailed connector view with SKILL.md, functions, and back-references.
 */

import { Code2, ExternalLink, Plug } from "lucide-react";
import React from "react";
import ArtifactTabView, { type TabDef } from "@/components/library/artifact-tab-view";
import BreadcrumbNav from "@/components/library/breadcrumb-nav";
import CommandPalette from "@/components/library/command-palette";
import CrossReferenceLink, { BackReferences, type CrossRef } from "@/components/library/cross-reference-link";
import EntityDetail from "@/components/library/entity-detail";
import GlassSurface from "@/components/library/glass-surface";
import MarkdownRenderer from "@/components/library/markdown-renderer";
import PageTransition from "@/components/library/page-transition";

interface ConnectorDetail {
  id: string;
  name: string;
  description: string;
  brandColor: string;
  functionCount: number;
  functions: string[];
  skillMd: string;
  usedBy: { id: string; name: string }[];
}

interface ConnectorDetailClientProps {
  connector: ConnectorDetail;
}

export function ConnectorDetailClient({ connector }: ConnectorDetailClientProps) {
  const backRefs: CrossRef[] = connector.usedBy.map((u) => ({
    id: u.id,
    name: u.name,
    type: "playbook" as const,
    href: `/library/playbooks/${u.id}`,
    description: `${u.name} playbook`,
  }));

  const tabs: TabDef[] = [
    {
      id: "skill",
      label: "SKILL.md",
      content: (
        <GlassSurface elevation="1">
          <MarkdownRenderer content={connector.skillMd} glass={false} />
        </GlassSurface>
      ),
    },
    {
      id: "functions",
      label: "Functions",
      badge: connector.functionCount,
      content: (
        <GlassSurface elevation="1">
          <div className="flex items-center gap-2 mb-4">
            <Code2 size={16} className="text-violet-400" />
            <span className="text-sm font-medium">
              {connector.functionCount} wrapped functions
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {connector.functions.map((fn) => (
              <div
                key={fn}
                className="flex items-center gap-2 rounded-lg border border-border/20 p-2.5 text-sm hover:bg-muted/30 transition-colors cursor-pointer group"
              >
                <Code2 size={13} className="text-muted-foreground group-hover:text-violet-400 transition-colors shrink-0" />
                <span className="truncate font-mono text-[12px]">{fn}</span>
              </div>
            ))}
          </div>
        </GlassSurface>
      ),
    },
    {
      id: "back-refs",
      label: "Used By",
      badge: connector.usedBy.length,
      content: (
        <div className="space-y-4">
          {connector.usedBy.length > 0 ? (
            <GlassSurface elevation="1">
              <h3 className="text-title-2 mb-4">
                Playbooks using {connector.name}
              </h3>
              <div className="space-y-3">
                {connector.usedBy.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-xl border border-border/20 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-amber-400/10 flex items-center justify-center">
                        <Plug size={14} className="text-amber-400" />
                      </div>
                      <span className="text-sm font-medium">{u.name}</span>
                    </div>
                    <CrossReferenceLink
                      ref={backRefs.find((r) => r.id === u.id)!}
                    />
                  </div>
                ))}
              </div>
            </GlassSurface>
          ) : (
            <GlassSurface elevation="1" className="text-center py-8">
              <p className="text-muted-foreground text-sm">
                Not referenced by any playbook yet.
              </p>
            </GlassSurface>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageTransition className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <BreadcrumbNav />

        <div className="mt-6 mb-8">
          <EntityDetail
            title={connector.name}
            type="connector"
            description={connector.description}
            path={`/connectors/${connector.id}`}
            onBack={() => window.history.back()}
          >
            <div className="mt-2">
              <BackReferences refs={backRefs} />
            </div>
            <div className="mt-6">
              <ArtifactTabView tabs={tabs} defaultTab="skill" />
            </div>
          </EntityDetail>
        </div>

        <CommandPalette />
      </div>
    </PageTransition>
  );
}
