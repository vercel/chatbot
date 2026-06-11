"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plug,
  Wrench,
  Brain,
  Layers,
  Hash,
  MapPin,
  GitBranch,
  X,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ── Types ──

interface SkillEntry {
  name: string;
  version: string;
  path: string;
  primary_domain: string;
  also_in: string[];
  dependencies: string[];
  tools?: number;
  kind: "connector" | "function" | "capability";
}

interface SkillsData {
  connectors: SkillEntry[];
  functions: SkillEntry[];
  capabilities: SkillEntry[];
  summary: { totalSkills: number; totalConnectors: number; totalFunctions: number; totalCapabilities: number };
}

interface SkillDetail {
  name: string;
  version: string;
  kind: string;
  path: string;
  primary_domain: string;
  also_in: string[];
  tools: number;
  dependencies: string[];
  frontmatter: Record<string, any>;
  documentation: string;
  raw_markdown: string;
}

// ── Helpers ──

const CATEGORY_CONFIG = {
  all: { label: "All", icon: Layers, color: "text-foreground" },
  connector: { label: "Connectors", icon: Plug, color: "text-violet-500" },
  function: { label: "Functions", icon: Wrench, color: "text-emerald-500" },
  capability: { label: "Capabilities", icon: Brain, color: "text-cyan-500" },
} as const;

type CategoryKey = keyof typeof CATEGORY_CONFIG;

const DOMAIN_LABELS: Record<string, string> = {
  "billing-flow": "Billing",
  "credit-disputes": "Disputes",
  "customer-enrollment": "Enrollment",
  "compliance-audit": "Compliance",
  "support-triage": "Support",
  "agent-payments": "Payments",
  reporting: "Reporting",
  "customer-comms": "Comms",
  "lead-flow": "Leads",
  "mcp-edits": "MCP Edits",
  coding: "Coding",
  "agent-orchestration": "Agent Orch.",
};

function domainLabel(d: string) {
  return DOMAIN_LABELS[d] ?? d;
}

// ── Main Component ──

export function SkillsLibraryClient() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [selectedSkill, setSelectedSkill] = useState<{
    entry: SkillEntry;
    detail?: SkillDetail | null;
    loadingDetail: boolean;
  } | null>(null);

  // Fetch skills list
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/skills");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // All skills flattened
  const allSkills = useMemo(() => {
    if (!data) return [];
    return [
      ...data.connectors,
      ...data.functions,
      ...data.capabilities,
    ];
  }, [data]);

  // Filtered skills
  const filtered = useMemo(() => {
    let skills = allSkills;
    if (category !== "all") {
      skills = skills.filter((s) => s.kind === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.primary_domain.toLowerCase().includes(q) ||
          s.also_in.some((d) => d.toLowerCase().includes(q))
      );
    }
    return skills;
  }, [allSkills, category, search]);

  // Fetch skill detail
  const openSkillDetail = async (entry: SkillEntry) => {
    setSelectedSkill({ entry, loadingDetail: true });
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(entry.name)}`);
      if (res.ok) {
        const detail: SkillDetail = await res.json();
        setSelectedSkill({ entry, detail, loadingDetail: false });
      } else {
        setSelectedSkill({ entry, detail: null, loadingDetail: false });
      }
    } catch {
      setSelectedSkill({ entry, detail: null, loadingDetail: false });
    }
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <SkillsHeader />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error || !data) {
    return (
      <div className="flex flex-col h-full">
        <SkillsHeader />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-destructive font-medium mb-2">Failed to load skills</p>
            <p className="text-sm text-muted-foreground">{error || "Unknown error"}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty State ──
  if (filtered.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <SkillsHeader search={search} onSearchChange={setSearch} category={category} onCategoryChange={setCategory} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium mb-1">No skills found</p>
            <p className="text-sm text-muted-foreground">
              {search
                ? `No results for "${search}"`
                : `No ${category !== "all" ? CATEGORY_CONFIG[category].label : "skills"} available`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Content ──
  return (
    <div className="flex flex-col h-full">
      <SkillsHeader
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        total={allSkills.length}
        filtered={filtered.length}
      />

      {/* Skill Card Grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {filtered.map((skill) => (
            <SkillCard
              key={skill.name}
              skill={skill}
              onClick={() => openSkillDetail(skill)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Detail Sheet */}
      {selectedSkill && (
        <SkillDetailSheet
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
        />
      )}
    </div>
  );
}

// ── Header ──

function SkillsHeader({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  total,
  filtered,
}: {
  search?: string;
  onSearchChange?: (v: string) => void;
  category?: CategoryKey;
  onCategoryChange?: (v: CategoryKey) => void;
  total?: number;
  filtered?: number;
}) {
  return (
    <div className="border-b p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Skills Library</h1>
          <p className="text-xs text-muted-foreground">
            {total != null && filtered != null && total > 0 ? (
              <span>
                <span className="font-medium text-foreground">{filtered}</span> of{" "}
                <span className="font-medium">{total}</span> skills
              </span>
            ) : (
              "Browse all registered skills"
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or domain…"
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Category Tabs */}
      {category != null && onCategoryChange && (
        <Tabs
          value={category}
          onValueChange={(v) => onCategoryChange(v as CategoryKey)}
          className="w-full"
        >
          <TabsList className="h-8 w-full justify-start overflow-x-auto">
            {(Object.entries(CATEGORY_CONFIG) as [CategoryKey, typeof CATEGORY_CONFIG["all"]][]).map(
              ([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <TabsTrigger key={key} value={key} className="text-xs gap-1.5 py-0.5">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{cfg.label}</span>
                  </TabsTrigger>
                );
              }
            )}
          </TabsList>
        </Tabs>
      )}
    </div>
  );
}

// ── Skill Card ──

function SkillCard({ skill, onClick }: { skill: SkillEntry; onClick: () => void }) {
  const catCfg = CATEGORY_CONFIG[skill.kind] ?? CATEGORY_CONFIG.all;
  const Icon = catCfg.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left rounded-xl border bg-card p-4 transition-all",
        "hover:border-primary/40 hover:shadow-sm active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {/* Top row: name + kind badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-sm truncate">{skill.name}</p>
        <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 shrink-0", catCfg.color)}>
          <Icon className="h-3 w-3 mr-1 inline" />
          {catCfg.label}
        </Badge>
      </div>

      {/* Domain */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        <MapPin className="h-3 w-3 shrink-0" />
        <span>{domainLabel(skill.primary_domain)}</span>
      </div>

      {/* Also in domains */}
      {skill.also_in.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {skill.also_in.slice(0, 3).map((d) => (
            <Badge key={d} variant="outline" className="text-[10px] px-1.5 py-0">
              {domainLabel(d)}
            </Badge>
          ))}
          {skill.also_in.length > 3 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              +{skill.also_in.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Bottom row: tools + deps */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
        {skill.tools != null && (
          <span className="flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            {skill.tools} tool{skill.tools !== 1 ? "s" : ""}
          </span>
        )}
        {skill.dependencies.length > 0 && (
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            {skill.dependencies.length} dep{skill.dependencies.length !== 1 ? "s" : ""}
          </span>
        )}
        <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-auto">
          v{skill.version}
        </Badge>
      </div>
    </button>
  );
}

// ── Detail Sheet ──

function SkillDetailSheet({
  skill,
  onClose,
}: {
  skill: { entry: SkillEntry; detail?: SkillDetail | null; loadingDetail: boolean };
  onClose: () => void;
}) {
  const { entry, detail, loadingDetail } = skill;
  const catCfg = CATEGORY_CONFIG[entry.kind] ?? CATEGORY_CONFIG.all;
  const Icon = catCfg.icon;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0">
        <SheetHeader className="border-b p-4 sticky top-0 bg-background z-10">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", catCfg.color)} />
            <SheetTitle className="text-base truncate">{entry.name}</SheetTitle>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <Badge variant="secondary" className="text-[10px]">
              v{entry.version}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {domainLabel(entry.primary_domain)}
            </Badge>
            {entry.tools != null && (
              <Badge variant="outline" className="text-[10px]">
                {entry.tools} tools
              </Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="p-4 space-y-4">
              {/* Frontmatter table */}
              {detail.frontmatter && Object.keys(detail.frontmatter).length > 0 && (
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                    Frontmatter
                  </p>
                  <div className="space-y-1">
                    {Object.entries(detail.frontmatter).map(([k, v]) => (
                      <div key={k} className="flex items-start gap-2 text-xs">
                        <span className="font-mono text-muted-foreground shrink-0">{k}:</span>
                        <span className="font-mono break-all">
                          {Array.isArray(v) ? v.join(", ") : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documentation */}
              {detail.documentation && (
                <div>
                  <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                    Documentation
                  </p>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                    <MarkdownRenderer md={detail.documentation} />
                  </div>
                </div>
              )}

              {/* Raw MD collapsible */}
              {detail.raw_markdown && (
                <details className="mt-4">
                  <summary className="text-xs font-medium text-muted-foreground cursor-pointer">
                    Raw SKILL.md
                  </summary>
                  <pre className="mt-2 text-[11px] p-3 rounded-lg bg-muted overflow-x-auto max-h-64">
                    {detail.raw_markdown.slice(0, 2000)}
                    {detail.raw_markdown.length > 2000 && "\n\n... (truncated)"}
                  </pre>
                </details>
              )}

              {/* Dependencies */}
              {detail.dependencies.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">
                    Dependencies
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {detail.dependencies.map((d) => (
                      <Badge key={d} variant="outline" className="text-[10px]">
                        <GitBranch className="h-3 w-3 mr-1 inline" />
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Also in */}
              {detail.also_in.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">
                    Also Used In
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {detail.also_in.map((d) => (
                      <Badge key={d} variant="secondary" className="text-[10px]">
                        <MapPin className="h-3 w-3 mr-1 inline" />
                        {domainLabel(d)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Could not load skill details.</p>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ── Simple Markdown Renderer ──

function MarkdownRenderer({ md }: { md: string }) {
  const lines = md.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="text-sm font-semibold mt-4 mb-1">
          {line.slice(4)}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold mt-5 mb-2 text-foreground border-b pb-1">
          {line.slice(3)}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="text-base font-bold mt-5 mb-2">
          {line.slice(2)}
        </h2>
      );
      i++;
      continue;
    }

    // Table row
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={i} className="overflow-x-auto my-2 text-[11px]">
          <table className="w-full border-collapse">
            <tbody>
              {tableLines.map((tr, ri) => {
                const cells = tr.split("|").filter((c) => c.trim());
                const isHeader = tr.includes("---");
                if (isHeader) return null;
                const maybeHeader = ri === 0 && tableLines.length > 1 && tableLines[1]?.includes("---");
                return (
                  <tr key={ri} className={maybeHeader ? "font-semibold" : ""}>
                    {cells.map((td, ci) => {
                      const Tag = maybeHeader ? "th" : "td";
                      return (
                        <Tag key={ci} className="border px-2 py-1 text-left">
                          {td.trim()}
                        </Tag>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Code blocks
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={i} className="text-[11px] p-3 rounded-lg bg-muted overflow-x-auto my-2">
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote key={i} className="border-l-2 border-primary/40 pl-3 my-2 text-xs text-muted-foreground italic">
          {quoteLines.map((ql, qi) => (
            <p key={qi}>{ql}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // List items
    if (/^[\s]*[-*+]\s/.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length && /^[\s]*[-*+]\s/.test(lines[i])) {
        listLines.push(lines[i].replace(/^[\s]*[-*+]\s/, ""));
        i++;
      }
      elements.push(
        <ul key={i} className="list-disc pl-5 my-1.5 text-xs space-y-0.5">
          {listLines.map((li, liIdx) => (
            <li key={liIdx}>{li}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-xs my-1.5 leading-relaxed">
        {line}
      </p>
    );
    i++;
  }

  return <>{elements}</>;
}
