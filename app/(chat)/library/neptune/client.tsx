"use client";

/**
 * NeptuneClient — Client component for /library/neptune.
 * Phase 22: Agent-as-connector special view.
 */

import {
  Bot,
  BrainCircuit,
  Code2,
  FileText,
  Plug,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import React from "react";
import ArtifactTabView, { type TabDef } from "@/components/library/artifact-tab-view";
import BreadcrumbNav from "@/components/library/breadcrumb-nav";
import CommandPalette from "@/components/library/command-palette";
import CrossReferenceLink, { type CrossRef } from "@/components/library/cross-reference-link";
import DependencyGraph, { type DepEdge, type DepNode } from "@/components/library/dependency-graph";
import EntityDetail from "@/components/library/entity-detail";
import GlassSurface from "@/components/library/glass-surface";
import PageTransition from "@/components/library/page-transition";
import { cn } from "@/lib/utils";

const NATIVE_SKILLS = [
  { name: "agent-payments", description: "Payment processing and commission tracking" },
  { name: "billing-flow", description: "NMI billing operations" },
  { name: "credit-disputes", description: "Credit report dispute management" },
  { name: "customer-enrollment", description: "Client onboarding" },
  { name: "compliance-audit", description: "FCRA/FDCPA compliance" },
  { name: "support-triage", description: "Customer support routing" },
  { name: "reporting", description: "Operational reporting" },
  { name: "customer-comms", description: "SMS, email, Slack communications" },
  { name: "lead-flow", description: "Lead intake and nurturing" },
  { name: "mcp-edits", description: "Code editing and PR management" },
];

const CUSTOM_SKILLS = [
  { name: "opendesign", description: "Design system component generation" },
  { name: "spreadsheet-creator", description: "Generate spreadsheets from data" },
  { name: "playbook-skills", description: "Playbook management and versioning" },
  { name: "vercel-deploy", description: "Vercel deployment automation" },
  { name: "notebooklm-research", description: "AI research and podcast generation" },
];

const AI_SDK_TOOLS = [
  { name: "Read", description: "Read files from the filesystem" },
  { name: "Write", description: "Write files to the filesystem" },
  { name: "Edit", description: "Edit files with string replacement" },
  { name: "Bash", description: "Execute shell commands" },
  { name: "Grep", description: "Search code with regex" },
  { name: "Glob", description: "Find files by pattern" },
  { name: "WebFetch", description: "Fetch and analyze web content" },
  { name: "Agent", description: "Spawn sub-agents for complex tasks" },
];

const DEP_NODES: DepNode[] = [
  { id: "neptune", label: "Neptune", type: "connector" },
  { id: "base44", label: "Base44", type: "connector" },
  { id: "slack", label: "Slack", type: "connector" },
  { id: "nmi", label: "NMI", type: "connector" },
  { id: "github", label: "GitHub", type: "connector" },
  { id: "vercel", label: "Vercel", type: "connector" },
];

const DEP_EDGES: DepEdge[] = [
  { from: "neptune", to: "base44", label: "Core data" },
  { from: "neptune", to: "slack", label: "Comms" },
  { from: "neptune", to: "nmi", label: "Billing" },
  { from: "neptune", to: "github", label: "Code" },
  { from: "neptune", to: "vercel", label: "Deploy" },
];

const CROSS_REFS: CrossRef[] = [
  { id: "base44", name: "Base44", type: "connector", href: "/library/connectors/base44", description: "Core data engine" },
  { id: "slack", name: "Slack", type: "connector", href: "/library/connectors/slack", description: "Communication bridge" },
  { id: "nmi", name: "NMI", type: "connector", href: "/library/connectors/nmi", description: "Payment gateway" },
  { id: "github", name: "GitHub", type: "connector", href: "/library/connectors/github", description: "Source control" },
];

export function NeptuneClient() {
  const tabs: TabDef[] = [
    {
      id: "native",
      label: "Native Skills",
      badge: NATIVE_SKILLS.length,
      content: (
        <GlassSurface elevation="1">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-emerald-400" />
            <span className="text-sm font-medium">10 domain-specific playbook skills</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {NATIVE_SKILLS.map((skill) => (
              <div
                key={skill.name}
                className="flex items-start gap-3 rounded-xl border border-border/20 p-3 hover:bg-muted/30 transition-colors cursor-pointer group"
              >
                <div className="size-8 rounded-lg bg-emerald-400/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap size={14} className="text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{skill.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{skill.description}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassSurface>
      ),
    },
    {
      id: "custom",
      label: "Custom Skills",
      badge: CUSTOM_SKILLS.length,
      content: (
        <GlassSurface elevation="1">
          <div className="flex items-center gap-2 mb-4">
            <Code2 size={16} className="text-violet-400" />
            <span className="text-sm font-medium">5 custom-built skills</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CUSTOM_SKILLS.map((skill) => (
              <div
                key={skill.name}
                className="flex items-start gap-3 rounded-xl border border-border/20 p-3 hover:bg-muted/30 transition-colors cursor-pointer group"
              >
                <div className="size-8 rounded-lg bg-violet-400/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Code2 size={14} className="text-violet-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{skill.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{skill.description}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassSurface>
      ),
    },
    {
      id: "ai-sdk",
      label: "AI SDK Tools",
      badge: AI_SDK_TOOLS.length,
      content: (
        <GlassSurface elevation="1">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit size={16} className="text-blue-400" />
            <span className="text-sm font-medium">8 core AI SDK tools</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AI_SDK_TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="flex items-start gap-3 rounded-xl border border-border/20 p-3 hover:bg-muted/30 transition-colors cursor-pointer group"
              >
                <div className="size-8 rounded-lg bg-blue-400/10 flex items-center justify-center shrink-0 mt-0.5">
                  <BrainCircuit size={14} className="text-blue-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium font-mono">{tool.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{tool.description}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassSurface>
      ),
    },
    {
      id: "connections",
      label: "Connections",
      badge: CROSS_REFS.length,
      content: (
        <div className="space-y-6">
          <DependencyGraph
            nodes={DEP_NODES}
            edges={DEP_EDGES}
            title="Agent Dependency Graph"
          />
          <GlassSurface elevation="1">
            <h3 className="text-title-2 mb-4">Connected Integrations</h3>
            <div className="grid grid-cols-2 gap-2">
              {CROSS_REFS.map((ref) => (
                <CrossReferenceLink key={ref.id} ref={ref} />
              ))}
            </div>
          </GlassSurface>
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
            title="Neptune"
            type="connector"
            description="The AI agent — native skills for all 10 domains, custom skills for design and data, plus 8 AI SDK tools for filesystem, shell, code search, and sub-agent orchestration."
            domain="ai"
            path="/neptune"
            onBack={() => window.history.back()}
            icon={
              <div className="size-10 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
                <Bot size={20} className="text-white" />
              </div>
            }
          >
            <div className="mt-6">
              <ArtifactTabView tabs={tabs} defaultTab="native" />
            </div>
          </EntityDetail>
        </div>

        <CommandPalette />
      </div>
    </PageTransition>
  );
}
