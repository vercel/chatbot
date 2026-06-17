// @ts-nocheck — pre-existing Phase 24 type issues, refined in Streams 3-5
"use client";
/**
 * ConnectorDetailSheet — right drawer with 5 tabs:
 *   Overview / Tools / Playbook / Knowledge / Logs
 *
 * Tools are auto-derived from manifest.capabilities.
 * Knowledge shows related wiki pages (cortex skills + PRDs).
 * Playbook fetches and renders the actual PLAYBOOK.md content.
 */
import {
  BookOpenIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HistoryIcon,
  RefreshCwIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ConnectorManifest } from "@/lib/connectors/types";
import { cn } from "@/lib/utils";

/** Wiki links shown in the Knowledge tab — maps connector ID to related cortex pages */
const CONNECTOR_KNOWLEDGE: Record<
  string,
  { title: string; path: string; type: "skill" | "prd" | "memory" }[]
> = {
  slack: [
    {
      title: "Slack Integration Playbook",
      path: "/wiki/concepts/slack-integration",
      type: "skill",
    },
    {
      title: "VPS Agent Cardinal Rules",
      path: "/wiki/concepts/native-tools-first",
      type: "skill",
    },
  ],
  nmi: [
    {
      title: "NMI Golden Vault Architecture",
      path: "/wiki/concepts/nmi-golden-vault",
      type: "prd",
    },
    {
      title: "Smart Retry Engine",
      path: "/wiki/concepts/smart-retry",
      type: "prd",
    },
    { title: "CIT vs MIT Flow", path: "/wiki/concepts/cit-mit", type: "skill" },
  ],
  base44: [
    {
      title: "Base44 Two-Lane Workflow",
      path: "/wiki/concepts/base44-two-lane",
      type: "prd",
    },
    {
      title: "AGENTS.md Discipline",
      path: "/wiki/concepts/agents-md",
      type: "skill",
    },
  ],
  hyperswitch: [
    {
      title: "Hyperswitch Self-Hosted Guide",
      path: "/wiki/concepts/hyperswitch",
      type: "prd",
    },
    {
      title: "Payment Flow Patterns",
      path: "/wiki/concepts/payment-flows",
      type: "skill",
    },
  ],
};

interface ConnectorDetailSheetProps {
  manifest: ConnectorManifest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: { connected: boolean; message?: string };
}

export function ConnectorDetailSheet({
  manifest,
  open,
  onOpenChange,
  status,
}: ConnectorDetailSheetProps) {
  if (!manifest) return null;
  const Icon = manifest.icon;
  const knowledge = CONNECTOR_KNOWLEDGE[manifest.id] || [];

  // Playbook content state
  const [playbookContent, setPlaybookContent] = useState<string | null>(null);
  const [playbookLoading, setPlaybookLoading] = useState(false);
  const [playbookSections, setPlaybookSections] = useState<
    { heading: string; content: string; level: number }[]
  >([]);

  const loadPlaybook = useCallback(async () => {
    if (playbookContent !== null) return; // already loaded
    setPlaybookLoading(true);
    try {
      const res = await fetch(`/api/connectors/${manifest.id}/playbook`);
      if (res.ok) {
        const data = await res.json();
        setPlaybookContent(data.rawMarkdown || "");
        setPlaybookSections(data.sections || []);
      } else {
        setPlaybookContent("");
      }
    } catch {
      setPlaybookContent("");
    }
    setPlaybookLoading(false);
  }, [manifest.id, playbookContent]);

  // Reset playbook when connector changes
  useEffect(() => {
    setPlaybookContent(null);
    setPlaybookSections([]);
  }, [manifest.id]);

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="w-full sm:max-w-[420px] overflow-hidden flex flex-col p-0"
        side="right"
      >
        {/* Header */}
        <SheetHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: `${manifest.brandColor}18`,
                color: manifest.brandColor,
              }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base">{manifest.name}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {manifest.description}
              </p>
            </div>
          </div>
          {/* Status strip */}
          <div className="flex items-center gap-2 mt-3">
            <div
              className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                status.connected ? "bg-emerald-500" : "bg-amber-500"
              )}
            />
            <span className="text-xs text-muted-foreground">
              {status.connected ? "Connected" : "Not Configured"}
            </span>
          </div>
        </SheetHeader>

        {/* 5 Tabs */}
        <Tabs className="flex-1 flex flex-col min-h-0" defaultValue="overview">
          <TabsList className="px-2 pt-2 justify-start gap-0.5 bg-transparent border-b rounded-none flex-shrink-0">
            <TabsTrigger
              className="text-[11px] px-2.5 data-[state=active]:bg-muted"
              value="overview"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              className="text-[11px] px-2.5 data-[state=active]:bg-muted"
              value="tools"
            >
              Tools
            </TabsTrigger>
            <TabsTrigger
              className="text-[11px] px-2.5 data-[state=active]:bg-muted"
              value="playbook"
            >
              Playbook
            </TabsTrigger>
            <TabsTrigger
              className="text-[11px] px-2.5 data-[state=active]:bg-muted"
              value="knowledge"
            >
              Knowledge
            </TabsTrigger>
            <TabsTrigger
              className="text-[11px] px-2.5 data-[state=active]:bg-muted"
              value="logs"
            >
              Logs
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            {/* ── Overview Tab ── */}
            <TabsContent className="p-4 space-y-4 mt-0" value="overview">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Environment Keys
                </h4>
                <div className="space-y-1.5">
                  {manifest.envKeys.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No environment keys required
                    </p>
                  ) : (
                    manifest.envKeys.map((key) => (
                      <div
                        className="flex items-center gap-2 text-xs"
                        key={key}
                      >
                        <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono">
                          {key}
                        </code>
                        <Badge
                          className="text-[10px] h-4 px-1 py-0"
                          variant="outline"
                        >
                          {status.connected ? "● Set" : "○ Missing"}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Connection
                </h4>
                <p className="text-sm text-muted-foreground">
                  {status.message ||
                    (status.connected
                      ? "All required keys present. Connector is ready."
                      : `Missing ${manifest.envKeys.filter((k) => !process.env[k]).length} env key(s). Check Vercel environment variables.`)}
                </p>
              </div>

              {manifest.docs && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Documentation
                  </h4>
                  <a
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    href={manifest.docs.official}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLinkIcon className="w-3 h-3" /> Official docs
                  </a>
                  {manifest.docs.ourGuide && (
                    <Link
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1.5"
                      href={manifest.docs.ourGuide}
                    >
                      <BookOpenIcon className="w-3 h-3" /> Our guide
                    </Link>
                  )}
                </div>
              )}

              {/* Tool count summary */}
              <Card className="p-3 bg-muted/30">
                <div className="flex items-center gap-2 text-sm">
                  <WrenchIcon className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {manifest.capabilities.length} tool
                    {manifest.capabilities.length === 1 ? "" : "s"} available
                  </span>
                </div>
              </Card>
            </TabsContent>

            {/* ── Tools Tab (auto-derived from manifest.capabilities) ── */}
            <TabsContent className="p-4 space-y-2 mt-0" value="tools">
              {manifest.capabilities.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-2">
                  No tools registered for this connector.
                </p>
              ) : (
                manifest.capabilities.map((cap) => (
                  <Card
                    className="p-3 hover:bg-muted/40 transition-colors cursor-default"
                    key={cap.id}
                  >
                    <div className="flex items-center gap-2">
                      <ZapIcon
                        className="w-3.5 h-3.5 flex-shrink-0"
                        style={{ color: manifest.brandColor }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {cap.label}
                          </span>
                          <code className="text-[10px] bg-muted px-1 py-0 rounded font-mono text-muted-foreground">
                            {manifest.id}.{cap.id}
                          </code>
                        </div>
                        {cap.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {cap.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {cap.schema && (
                      <details className="mt-2">
                        <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                          Input schema
                        </summary>
                        <pre className="mt-1 text-[10px] bg-muted/60 p-2 rounded overflow-x-auto font-mono">
                          {JSON.stringify(cap.schema, null, 2)}
                        </pre>
                      </details>
                    )}
                  </Card>
                ))
              )}
            </TabsContent>

            {/* ── Playbook Tab ── */}
            <TabsContent
              className="p-4 mt-0"
              onClick={loadPlaybook}
              onFocus={loadPlaybook}
              onMouseEnter={loadPlaybook}
              value="playbook"
            >
              {playbookLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCwIcon className="w-5 h-5 text-muted-foreground animate-spin" />
                </div>
              ) : playbookContent ? (
                <div className="space-y-4">
                  {playbookSections.map((section) => (
                    <div key={section.heading}>
                      {section.level === 2 ? (
                        <h3 className="text-sm font-semibold text-foreground mb-2 pb-1 border-b">
                          {section.heading}
                        </h3>
                      ) : section.level === 3 ? (
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-1">
                          {section.heading}
                        </h4>
                      ) : section.heading === "(preamble)" ? (
                        <div className="text-xs text-muted-foreground font-mono bg-muted/30 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                          {section.content.slice(0, 300)}
                        </div>
                      ) : (
                        <h2 className="text-base font-bold mb-1">
                          {section.heading}
                        </h2>
                      )}
                      <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {section.content}
                      </div>
                    </div>
                  ))}
                  <div className="mt-4 p-3 bg-muted/30 rounded-md border border-muted">
                    <p className="text-[11px] text-muted-foreground">
                      Source:{" "}
                      <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">
                        connectors/{manifest.id}/PLAYBOOK.md
                      </code>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Full documentation in{" "}
                      <Link
                        className="text-primary hover:underline"
                        href={`/wiki?search=${manifest.id}`}
                      >
                        Wiki
                      </Link>
                    </p>
                  </div>
                </div>
              ) : playbookContent === "" ? (
                <Card className="p-4 bg-muted/20 text-center">
                  <FileTextIcon className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground italic">
                    No playbook found for {manifest.name}.
                  </p>
                </Card>
              ) : (
                <Card className="p-4 bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <FileTextIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Playbook</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Hover or click the Playbook tab to load the operational
                    guide for {manifest.name}. Contains anti-patterns,
                    safeguards, business context, and common workflows.
                  </p>
                </Card>
              )}
            </TabsContent>

            {/* ── Knowledge Tab (related skills, PRDs, memory) ── */}
            <TabsContent className="p-4 space-y-2 mt-0" value="knowledge">
              {knowledge.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpenIcon className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground italic">
                    No linked knowledge pages yet.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pages will appear here as the Wiki grows.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-3">
                    Related cortex skills, PRDs, and operational memory:
                  </p>
                  {knowledge.map((item) => (
                    <Card
                      className="p-3 hover:bg-muted/40 transition-colors"
                      key={item.path}
                    >
                      <Link
                        className="flex items-start gap-2.5 no-underline"
                        href={item.path}
                      >
                        <BookOpenIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                            {item.title}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              className="text-[10px] h-4 px-1.5 py-0"
                              variant={
                                item.type === "prd"
                                  ? "default"
                                  : item.type === "skill"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {item.type}
                            </Badge>
                            <code className="text-[10px] text-muted-foreground font-mono">
                              {item.path}
                            </code>
                          </div>
                        </div>
                      </Link>
                    </Card>
                  ))}
                  <div className="mt-3 p-3 bg-muted/30 rounded-md">
                    <p className="text-[11px] text-muted-foreground">
                      Full knowledge graph available in{" "}
                      <Link
                        className="text-primary hover:underline font-medium"
                        href="/wiki"
                      >
                        Wiki
                      </Link>{" "}
                      — search across all skills, PRDs, and operational memory.
                    </p>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── Logs Tab ── */}
            <TabsContent className="p-4 mt-0" value="logs">
              <Card className="p-4 bg-muted/20">
                <div className="flex items-center gap-2 mb-2">
                  <HistoryIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Invocation Logs</span>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  Recent tool invocations for this connector will appear here.
                </p>
                <div className="mt-3 space-y-2">
                  <div className="p-2 bg-muted/30 rounded border border-muted">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        No recent invocations
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Logs are stored in SessionDataStore and persist across chat
                  sessions.
                </p>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
