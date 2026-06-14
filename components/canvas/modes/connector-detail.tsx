"use client";

/**
 * components/canvas/modes/connector-detail.tsx — Connector Detail mode.
 *
 * Phase 16.E: 8-tab segmented control with lazy-loaded panels:
 *   Overview | Skills | Functions | Workflows | KG | Wiki | Eval | SOPs
 *
 * Placeholder for Phase B — full 8-tab implementation in Phase E.
 */

import { useState, type ReactNode } from "react";
import type { ModeProps } from "@/lib/canvas/types";
import { useCanvasSynthesis } from "@/hooks/use-canvas-synthesis";
import { cn } from "@/lib/utils";
import {
  Plug,
  Sparkles,
  FileCode2,
  Workflow,
  GitBranch,
  FileText,
  BarChart3,
  ListOrdered,
  ExternalLink,
} from "lucide-react";

// ── Tab definition ────────────────────────────────────────────────────────────

interface TabDef {
  id: string;
  label: string;
  icon: ReactNode;
}

const TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: <Plug className="h-3.5 w-3.5" /> },
  { id: "skills", label: "Skills", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "functions", label: "Functions", icon: <FileCode2 className="h-3.5 w-3.5" /> },
  { id: "workflows", label: "Workflows", icon: <Workflow className="h-3.5 w-3.5" /> },
  { id: "kg", label: "KG", icon: <GitBranch className="h-3.5 w-3.5" /> },
  { id: "wiki", label: "Wiki", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "eval", label: "Eval", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: "sops", label: "SOPs", icon: <ListOrdered className="h-3.5 w-3.5" /> },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function ConnectorDetail({ context, onNavigate }: ModeProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const connectorName = context.connectorName || "";

  // Lazy-fetch synthesis data via SWR hook (Phase C)
  const { data, isLoading, error } = useCanvasSynthesis("connector", connectorName);

  if (!connectorName) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No connector specified.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Segmented Control Tabbar ───────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-border/30 px-4 pt-4 pb-0">
        <div
          className="flex gap-0.5 overflow-x-auto pb-2 scrollbar-none"
          role="tablist"
          aria-label="Connector detail tabs"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[12px] font-medium whitespace-nowrap",
                "transition-all duration-150",
                activeTab === tab.id
                  ? "bg-background text-foreground border-t border-l border-r border-border/30"
                  : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20",
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Panel ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4" role="tabpanel">
        {isLoading ? (
          <ConnectorTabSkeleton />
        ) : error ? (
          <div className="text-sm text-muted-foreground text-center py-12">
            Failed to load connector data.
          </div>
        ) : (
          <ConnectorTabContent
            tab={activeTab}
            connectorName={connectorName}
            data={data}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </div>
  );
}

// ── Tab Content Router ────────────────────────────────────────────────────────

function ConnectorTabContent({
  tab,
  connectorName,
  data,
  onNavigate,
}: {
  tab: string;
  connectorName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  onNavigate: ModeProps["onNavigate"];
}) {
  switch (tab) {
    case "overview":
      return <OverviewTab connectorName={connectorName} data={data} />;
    case "skills":
      return <SkillsTab connectorName={connectorName} onNavigate={onNavigate} />;
    case "functions":
      return <FunctionsTab connectorName={connectorName} onNavigate={onNavigate} />;
    case "workflows":
      return <WorkflowsTab connectorName={connectorName} onNavigate={onNavigate} />;
    case "kg":
      return <KgTab connectorName={connectorName} onNavigate={onNavigate} />;
    case "wiki":
      return <WikiTab connectorName={connectorName} />;
    case "eval":
      return <EvalTab connectorName={connectorName} />;
    case "sops":
      return <SopsTab connectorName={connectorName} />;
    default:
      return <OverviewTab connectorName={connectorName} data={data} />;
  }
}

// ── Individual Tab Implementations ───────────────────────────────────────────

function OverviewTab({
  connectorName,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data,
}: {
  connectorName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold capitalize">{connectorName}</h3>
        <p className="text-sm text-muted-foreground/60 mt-1">
          {data?.meta?.description
            ? String((data.meta as Record<string, unknown>).description)
            : "Connector overview"}
        </p>
      </div>
      {/* Full MD content from synthesis */}
      {data?.markdown ? (
        <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none">
          <pre className="text-xs whitespace-pre-wrap">{data.markdown}</pre>
        </div>
      ) : (
        <div className="rounded-xl border border-border/30 p-6 text-center">
          <Plug className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground/50">
            Connector overview loading...
          </p>
        </div>
      )}
    </div>
  );
}

function SkillsTab({
  connectorName,
  onNavigate,
}: {
  connectorName: string;
  onNavigate: ModeProps["onNavigate"];
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Skills for {connectorName}</h3>
      <SkillCardPlaceholder
        name="example-skill"
        onNavigate={onNavigate}
        onClick={() => onNavigate("skill-detail", { skillName: "example-skill" })}
      />
      <div className="text-xs text-muted-foreground/40 text-center py-4">
        Skills will be loaded from library_edges
      </div>
    </div>
  );
}

function FunctionsTab({
  connectorName,
  onNavigate,
}: {
  connectorName: string;
  onNavigate: ModeProps["onNavigate"];
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Functions for {connectorName}</h3>
      <FunctionCardPlaceholder
        name="example-function"
        onNavigate={onNavigate}
      />
      <div className="text-xs text-muted-foreground/40 text-center py-4">
        Functions will be loaded from library_edges
      </div>
    </div>
  );
}

function WorkflowsTab({
  connectorName,
  onNavigate,
}: {
  connectorName: string;
  onNavigate: ModeProps["onNavigate"];
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Workflows using {connectorName}</h3>
      <button
        onClick={() => onNavigate("workflow-canvas", { workflowName: "example" })}
        className="w-full rounded-xl border border-border/30 p-4 text-left hover:bg-muted/20 transition-colors"
      >
        <Workflow className="h-5 w-5 text-muted-foreground/40 mb-2" />
        <p className="text-sm font-medium">Example Workflow</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          View in workflow canvas editor
        </p>
      </button>
    </div>
  );
}

function KgTab({
  connectorName,
  onNavigate,
}: {
  connectorName: string;
  onNavigate: ModeProps["onNavigate"];
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Knowledge Graph</h3>
      <button
        onClick={() => onNavigate("kg-explorer", { kgNode: `connector:${connectorName}` })}
        className="w-full rounded-xl border border-border/30 p-6 text-center hover:bg-muted/20 transition-colors"
      >
        <GitBranch className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm font-medium">Open KG Explorer</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          View {connectorName} in the full knowledge graph
        </p>
      </button>
    </div>
  );
}

function WikiTab({ connectorName }: { connectorName: string }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Documentation</h3>
      <div className="rounded-xl border border-border/30 p-6 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground/50">
          Wiki documentation for {connectorName}
        </p>
        <p className="text-xs text-muted-foreground/30 mt-1">
          Loaded from filesystem MD + SDK docs
        </p>
      </div>
    </div>
  );
}

function EvalTab({ connectorName }: { connectorName: string }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Evaluation Metrics</h3>
      <div className="rounded-xl border border-border/30 p-6 text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground/50">
          Eval metrics for {connectorName}
        </p>
        <p className="text-xs text-muted-foreground/30 mt-1">
          Token usage, cost, success rate from usage_logs
        </p>
      </div>
    </div>
  );
}

function SopsTab({ connectorName }: { connectorName: string }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">SOPs</h3>
      <div className="rounded-xl border border-border/30 p-6 text-center">
        <ListOrdered className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground/50">
          Standard Operating Procedures for {connectorName}
        </p>
        <p className="text-xs text-muted-foreground/30 mt-1">
          Displayed as Plan component steps
        </p>
      </div>
    </div>
  );
}

// ── Placeholder Cards ─────────────────────────────────────────────────────────

function SkillCardPlaceholder({
  name,
  onClick,
  onNavigate,
}: {
  name: string;
  onClick: () => void;
  onNavigate: ModeProps["onNavigate"];
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-border/30 p-3 text-left hover:bg-muted/20 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground/40" />
        <span className="text-sm">{name}</span>
        <ExternalLink className="h-3 w-3 text-muted-foreground/30 ml-auto" />
      </div>
    </button>
  );
}

function FunctionCardPlaceholder({
  name,
  onNavigate,
}: {
  name: string;
  onNavigate: ModeProps["onNavigate"];
}) {
  return (
    <button
      onClick={() => onNavigate("function-detail", { functionName: name })}
      className="w-full rounded-lg border border-border/30 p-3 text-left hover:bg-muted/20 transition-colors"
    >
      <div className="flex items-center gap-2">
        <FileCode2 className="h-4 w-4 text-muted-foreground/40" />
        <span className="text-sm font-mono text-xs">{name}</span>
        <ExternalLink className="h-3 w-3 text-muted-foreground/30 ml-auto" />
      </div>
    </button>
  );
}

function ConnectorTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-48 bg-muted/30 rounded-md animate-pulse" />
      <div className="h-4 w-full bg-muted/20 rounded-md animate-pulse" />
      <div className="h-4 w-3/4 bg-muted/20 rounded-md animate-pulse" />
    </div>
  );
}
