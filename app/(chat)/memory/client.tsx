"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw,
  Brain,
  BookOpen,
  Target,
  MessageSquare,
  FileText,
  Clock,
  Layers,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ── Types ──

interface MemoryData {
  systemPrompt: {
    source: string;
    size: number;
    lines: number;
    preview: string;
    full: string;
  } | null;
  loadedPlaybook: { title: string; domains: string[] } | null;
  skillsInScope: {
    total: number;
    connectors: number;
    functions: number;
    capabilities: number;
    list: { name: string; kind: string; domain: string }[];
  };
  conversationContext: {
    activeSession: string | null;
    recentMessages: number;
    note: string;
  };
  cortexFiles: { path: string; size: number; modified: string }[];
  refreshedAt: string;
}

// ── Main Component ──

export function MemoryClient() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/memory");
      if (res.ok) setData(await res.json());
    } catch {
      // handle gracefully
    }
    setRefreshing(false);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Loading State ──
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <MemoryHeader refreshing={refreshing} onRefresh={fetchData} />
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col h-full">
        <MemoryHeader refreshing={false} onRefresh={fetchData} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-destructive">Failed to load memory.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <MemoryHeader refreshing={refreshing} onRefresh={fetchData} refreshedAt={data.refreshedAt} />

      {/* Desktop tabs */}
      <div className="hidden sm:block flex-1 overflow-hidden">
        <Tabs defaultValue="system-prompt" className="flex flex-col h-full">
          <TabsList className="mx-4 mt-2 justify-start gap-0.5 bg-transparent border-b rounded-none shrink-0">
            <TabsTrigger value="system-prompt" className="text-xs gap-1.5">
              <Brain className="h-3.5 w-3.5" />
              System Prompt
            </TabsTrigger>
            <TabsTrigger value="playbook" className="text-xs gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Playbook
            </TabsTrigger>
            <TabsTrigger value="skills" className="text-xs gap-1.5">
              <Target className="h-3.5 w-3.5" />
              Skills
            </TabsTrigger>
            <TabsTrigger value="context" className="text-xs gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Context
            </TabsTrigger>
            <TabsTrigger value="cortex" className="text-xs gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Cortex
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="system-prompt" className="p-4 mt-0">
              <SystemPromptSection data={data.systemPrompt} />
            </TabsContent>
            <TabsContent value="playbook" className="p-4 mt-0">
              <PlaybookSection data={data.loadedPlaybook} />
            </TabsContent>
            <TabsContent value="skills" className="p-4 mt-0">
              <SkillsSection data={data.skillsInScope} />
            </TabsContent>
            <TabsContent value="context" className="p-4 mt-0">
              <ContextSection data={data.conversationContext} />
            </TabsContent>
            <TabsContent value="cortex" className="p-4 mt-0">
              <CortexSection data={data.cortexFiles} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>

      {/* Mobile: stacked sections */}
      <div className="sm:hidden flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-xl border bg-card">
          <div className="p-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-violet-500" /> System Prompt
            </h3>
          </div>
          <div className="p-3">
            <SystemPromptSection data={data.systemPrompt} />
          </div>
        </div>
        <div className="rounded-xl border bg-card">
          <div className="p-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-cyan-500" /> Loaded Playbook
            </h3>
          </div>
          <div className="p-3">
            <PlaybookSection data={data.loadedPlaybook} />
          </div>
        </div>
        <div className="rounded-xl border bg-card">
          <div className="p-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Target className="h-4 w-4 text-emerald-500" /> Skills In Scope
            </h3>
          </div>
          <div className="p-3">
            <SkillsSection data={data.skillsInScope} />
          </div>
        </div>
        <div className="rounded-xl border bg-card">
          <div className="p-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-amber-500" /> Context
            </h3>
          </div>
          <div className="p-3">
            <ContextSection data={data.conversationContext} />
          </div>
        </div>
        <div className="rounded-xl border bg-card">
          <div className="p-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-rose-500" /> Cortex Files
            </h3>
          </div>
          <div className="p-3">
            <CortexSection data={data.cortexFiles} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Header ──

function MemoryHeader({
  refreshing,
  onRefresh,
  refreshedAt,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  refreshedAt?: string;
}) {
  return (
    <div className="border-b p-3 sm:p-4 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold">Agent Memory</h1>
        <p className="text-xs text-muted-foreground">
          Current agent state: system prompt, loaded playbook, skills in scope, conversation context
        </p>
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 flex items-center gap-1.5 text-xs"
        title="Refresh memory state"
      >
        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        {refreshedAt && (
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {new Date(refreshedAt).toLocaleTimeString()}
          </span>
        )}
      </button>
    </div>
  );
}

// ── System Prompt Section ──

function SystemPromptSection({ data }: { data: MemoryData["systemPrompt"] }) {
  if (!data) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
        <p>System prompt not available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <Badge variant="secondary" className="text-[10px]">
          <FileText className="h-3 w-3 mr-1" />
          {data.source}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {data.lines} lines
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {(data.size / 1024).toFixed(1)} KB
        </Badge>
      </div>
      <pre className="text-xs p-4 rounded-lg bg-muted/50 overflow-x-auto max-h-[60vh] whitespace-pre-wrap font-mono leading-relaxed">
        {data.preview}
      </pre>
    </div>
  );
}

// ── Playbook Section ──

function PlaybookSection({ data }: { data: MemoryData["loadedPlaybook"] }) {
  if (!data) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
        <p>No playbook loaded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{data.title}</p>
      <div className="flex flex-wrap gap-1.5">
        {data.domains.map((d) => (
          <Badge key={d} variant="outline" className="text-[10px]">
            <Layers className="h-3 w-3 mr-1" />
            {d}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ── Skills Section ──

function SkillsSection({ data }: { data: MemoryData["skillsInScope"] }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <Badge variant="secondary" className="text-[10px]">{data.total} total</Badge>
        <Badge variant="secondary" className="text-[10px]">{data.connectors} connectors</Badge>
        <Badge variant="secondary" className="text-[10px]">{data.functions} functions</Badge>
        <Badge variant="secondary" className="text-[10px]">{data.capabilities} capabilities</Badge>
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {data.list.map((skill) => (
          <div
            key={skill.name}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/30 text-xs"
          >
            <span className="font-mono text-[11px] truncate flex-1">{skill.name}</span>
            <Badge variant="outline" className="text-[10px] capitalize">
              {skill.kind}
            </Badge>
            <span className="text-muted-foreground text-[10px]">{skill.domain}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Context Section ──

function ContextSection({ data }: { data: MemoryData["conversationContext"] }) {
  return (
    <div className="space-y-3">
      <div className="p-4 rounded-lg bg-muted/30 text-center">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">{data.note}</p>
      </div>
      <div className="flex gap-2 text-xs text-muted-foreground">
        <span>Active session: {data.activeSession ?? "none"}</span>
        <span>•</span>
        <span>{data.recentMessages} recent messages</span>
      </div>
    </div>
  );
}

// ── Cortex Section ──

function CortexSection({ data }: { data: MemoryData["cortexFiles"] }) {
  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
        <p>No recent cortex files found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-64 overflow-y-auto">
      {data.map((f) => (
        <div
          key={f.path}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/30 text-xs"
        >
          <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="font-mono text-[11px] truncate flex-1">{f.path}</span>
          <span className="text-muted-foreground text-[10px] tabular-nums">
            {(f.size / 1024).toFixed(1)}KB
          </span>
          <span className="text-muted-foreground text-[10px]">
            {new Date(f.modified).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}
