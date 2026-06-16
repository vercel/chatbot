"use client";

/**
 * DomainDetailClient — Client component for /library/playbooks/[domain].
 * Phase 22: 5-tab detailed playbook view.
 */

import React from "react";
import { AlertTriangle, BookOpen, Workflow, Zap } from "lucide-react";
import ArtifactTabView, { type TabDef } from "@/components/library/artifact-tab-view";
import BreadcrumbNav from "@/components/library/breadcrumb-nav";
import CommandPalette from "@/components/library/command-palette";
import CrossReferenceLink, { BackReferences, type CrossRef } from "@/components/library/cross-reference-link";
import EntityDetail from "@/components/library/entity-detail";
import GlassSurface from "@/components/library/glass-surface";
import ManifestViewer from "@/components/library/manifest-viewer";
import MarkdownRenderer from "@/components/library/markdown-renderer";
import PageTransition from "@/components/library/page-transition";
import { Badge } from "@/components/ui/badge";

interface DomainData {
  id: string;
  name: string;
  description: string;
  domain: string;
  connectors: { id: string; name: string }[];
  skills: { id: string; name: string }[];
  workflows: { name: string; description: string }[];
  antiPatterns: { name: string; description: string; severity: "critical" | "high" | "medium" }[];
}

interface DomainDetailClientProps {
  domain: DomainData;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/20",
  high: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  medium: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

const MANIFEST_TEMPLATE = (id: string, name: string, connectorsCount: number, skillsCount: number) => `---
domain: ${id}
version: 1.0.0
status: active
last_updated: 2026-06-15
---

playbook:
  name: ${name}
  type: domain-playbook
  connectors: ${connectorsCount}
  skills: ${skillsCount}

dependencies:
  runtime:
    - base44_api
    - knowledge_graph
  optional:
    - slack_notifications
    - reporting_hub

artifacts:
  - playbook.md
  - manifest.yaml
  - workflows/
  - anti-patterns/

lifecycle:
  review: monthly
  owner: agent-operations
  sla: P0-24h
`;

export function DomainDetailClient({ domain }: DomainDetailClientProps) {
  const connectorRefs: CrossRef[] = domain.connectors.map((c) => ({
    id: c.id,
    name: c.name,
    type: "connector" as const,
    href: `/library/connectors/${c.id}`,
    description: `${c.name} connector`,
  }));

  const tabs: TabDef[] = [
    {
      id: "overview",
      label: "Overview",
      badge: domain.skills.length + domain.connectors.length,
      content: (
        <div className="space-y-6">
          {/* Description */}
          <GlassSurface elevation="1">
            <h3 className="text-title-2 mb-3">Business Context</h3>
            <MarkdownRenderer
              content={`## ${domain.name}\n\n${domain.description}\n\n### Key Capabilities\n\n${domain.skills.slice(0, 5).map((s) => `- **${s.name}**`).join("\n")}\n${domain.skills.length > 5 ? `\n- *+${domain.skills.length - 5} more skills*` : ""}`}
            />
          </GlassSurface>

          {/* Connectors */}
          <GlassSurface elevation="1">
            <h3 className="text-title-2 mb-3">Connectors ({domain.connectors.length})</h3>
            <div className="flex flex-wrap gap-2">
              {connectorRefs.map((ref) => (
                <CrossReferenceLink key={ref.id} ref={ref} />
              ))}
              {domain.connectors.length === 0 && (
                <p className="text-sm text-muted-foreground">No connectors configured.</p>
              )}
            </div>
          </GlassSurface>

          {/* Skills */}
          <GlassSurface elevation="1">
            <h3 className="text-title-2 mb-3">Skills ({domain.skills.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {domain.skills.map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-center gap-2 rounded-lg border border-border/30 p-2.5 text-sm hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <Zap size={14} className="text-emerald-400 shrink-0" />
                  <span className="truncate">{skill.name}</span>
                </div>
              ))}
            </div>
          </GlassSurface>
        </div>
      ),
    },
    {
      id: "dependencies",
      label: "Deps",
      badge: domain.connectors.length,
      content: (
        <div className="space-y-6">
          {/* Connector deps */}
          <GlassSurface elevation="1">
            <h3 className="text-title-2 mb-4">Connector Dependencies</h3>
            <div className="space-y-3">
              {domain.connectors.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-border/20 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-cyan-400/10 flex items-center justify-center">
                      <BookOpen size={14} className="text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        /library/connectors/{c.id}
                      </div>
                    </div>
                  </div>
                  <CrossReferenceLink
                    ref={connectorRefs.find((r) => r.id === c.id)!}
                  />
                </div>
              ))}
            </div>
          </GlassSurface>

          {/* Manifest preview */}
          <ManifestViewer
            content={MANIFEST_TEMPLATE(domain.id, domain.name, domain.connectors.length, domain.skills.length)}
            title={`${domain.id}.manifest.yaml`}
            collapsed={false}
          />
        </div>
      ),
    },
    {
      id: "workflows",
      label: "Workflows",
      badge: domain.workflows.length,
      content: (
        <div className="space-y-4">
          {domain.workflows.length > 0 ? (
            domain.workflows.map((w) => (
              <GlassSurface key={w.name} elevation="1">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-lg bg-violet-400/10 border border-violet-400/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Workflow size={16} className="text-violet-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">{w.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{w.description}</p>
                  </div>
                </div>
              </GlassSurface>
            ))
          ) : (
            <GlassSurface elevation="1" className="text-center py-8">
              <p className="text-muted-foreground text-sm">No workflows defined yet.</p>
            </GlassSurface>
          )}
        </div>
      ),
    },
    {
      id: "anti-patterns",
      label: "Anti-Patterns",
      badge: domain.antiPatterns.length,
      content: (
        <div className="space-y-4">
          {domain.antiPatterns.map((ap) => (
            <GlassSurface key={ap.name} elevation="1">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-red-400/10 border border-red-400/20 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle size={16} className="text-red-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="text-sm font-semibold">{ap.name}</h4>
                    <Badge
                      variant="outline"
                      className={SEVERITY_COLORS[ap.severity] ?? ""}
                    >
                      {ap.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{ap.description}</p>
                </div>
              </div>
            </GlassSurface>
          ))}
          {domain.antiPatterns.length === 0 && (
            <GlassSurface elevation="1" className="text-center py-8">
              <p className="text-muted-foreground text-sm">No anti-patterns recorded.</p>
            </GlassSurface>
          )}
        </div>
      ),
    },
    {
      id: "logs",
      label: "Logs",
      badge: 0,
      content: (
        <GlassSurface elevation="1" className="text-center py-12">
          <p className="text-muted-foreground">
            Activity logs are aggregated from the reporting hub. Integration coming in Phase 23.
          </p>
        </GlassSurface>
      ),
    },
  ];

  return (
    <PageTransition className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <BreadcrumbNav />

        <div className="mt-6 mb-8">
          <EntityDetail
            title={domain.name}
            type="playbook"
            description={domain.description}
            domain={domain.domain}
            path={`/playbooks/${domain.id}`}
            onBack={() => window.history.back()}
          >
            <div className="mt-2">
              <BackReferences refs={connectorRefs} />
            </div>
            <div className="mt-6">
              <ArtifactTabView tabs={tabs} defaultTab="overview" />
            </div>
          </EntityDetail>
        </div>

        <CommandPalette />
      </div>
    </PageTransition>
  );
}
