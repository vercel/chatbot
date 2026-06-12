/**
 * /library — U2.4.D 4-Library Tab View
 *
 * Tabs: Playbooks | Connectors | Skills | Functions
 * Each tab is sortable + filterable with shadcn components.
 * Mobile-optimized: 44px touch targets, responsive table.
 */
"use client";

import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  BookOpen,
  Plug,
  Sparkles,
  Zap,
  Search,
  ArrowUpDown,
  ExternalLink,
  Shield,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

interface PlaybookEntry {
  domain: string;
  path: string;
  priority: string;
  routines_count: number;
  connectors: string[];
  description: string;
  intent_tags: string[];
}

interface ConnectorEntry {
  name: string;
  path: string;
  version: string;
  tools: number;
  primary_domain: string;
  description: string;
  mcp: boolean;
  custom_client: boolean;
  also_in: string[];
  dependencies: string[];
}

interface SkillEntry {
  name: string;
  version: string;
  path: string;
  primary_domain: string;
  also_in: string[];
  dependencies: string[];
  kind: string;
}

interface FunctionEntry {
  function_name: string;
  category: string;
  parent_connector: string;
  associated_playbooks: string[];
}

// ── Data Fetching ───────────────────────────────────────────────────────────

function usePlaybooks() {
  const [data, setData] = useState<PlaybookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((skillsData) => {
        // Build playbook list from what we know
        const playbooks: PlaybookEntry[] = [
          { domain: "Billing", path: "playbooks/billing", priority: "P0", routines_count: 4, connectors: ["nmi","hyperswitch","base44","slack","ghl"], description: "Payment processing, refunds, CoF health audits", intent_tags: ["refund","charge","payment","decline"] },
          { domain: "Customer Support", path: "playbooks/customer-support", priority: "P0", routines_count: 2, connectors: ["base44","slack","ghl","vapi","linear","nmi","hyperswitch"], description: "Customer 360, ticket triage, escalations", intent_tags: ["ticket","support","look up","customer"] },
          { domain: "Disputes", path: "playbooks/disputes", priority: "P0", routines_count: 2, connectors: ["forth","base44","slack"], description: "Credit disputes, FCRA letters, evidence submission", intent_tags: ["dispute","credit report","fcra","bureau"] },
          { domain: "Agent Orchestration", path: "playbooks/agent-orchestration", priority: "P1", routines_count: 3, connectors: ["base44","github","vercel","slack"], description: "Agent routing, dispatch, multi-agent coordination", intent_tags: ["orchestrate","dispatch","handoff"] },
          { domain: "Deploy (Vercel+GitHub)", path: "playbooks/deploy-vercel-github", priority: "P1", routines_count: 2, connectors: ["github","vercel","slack"], description: "Vercel deployments, GitHub PR workflows", intent_tags: ["ship","deploy","merge","release"] },
          { domain: "Engineering", path: "playbooks/engineering", priority: "P1", routines_count: 3, connectors: ["github","vercel","wiki"], description: "Code review, refactoring, PRDs, architecture", intent_tags: ["code review","architecture","PRD"] },
          { domain: "Reporting", path: "playbooks/reporting", priority: "P1", routines_count: 3, connectors: ["base44","slack","wiki"], description: "Operational dashboards, morning pulse", intent_tags: ["reporting","dashboard","analytics"] },
          { domain: "Vercel Discipline", path: "playbooks/vercel-discipline", priority: "P1", routines_count: 3, connectors: ["vercel","github"], description: "Vercel deployment standards, security patterns", intent_tags: ["vercel","deploy","env","build"] },
          { domain: "VPS Ops", path: "playbooks/vps-ops", priority: "P1", routines_count: 3, connectors: ["base44","slack"], description: "VPS management, pm2, nginx, Cloudflare", intent_tags: ["VPS","pm2","server","health"] },
          { domain: "HR", path: "playbooks/HR", priority: "P2", routines_count: 2, connectors: ["slack","wiki","base44"], description: "Team management, onboarding, compliance", intent_tags: ["HR","team","personnel"] },
          { domain: "Marketing", path: "playbooks/marketing", priority: "P2", routines_count: 2, connectors: ["ghl","slack","vapi","base44"], description: "Campaigns, lead nurture, content strategy", intent_tags: ["marketing","campaign","lead"] },
        ];
        setData(playbooks);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  return { data, loading };
}

function useConnectors() {
  const [data, setData] = useState<ConnectorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((json) => {
        setData(json.connectors || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  return { data, loading };
}

function useSkills() {
  const [data, setData] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((json) => {
        const all = [
          ...(json.connectors || []).map((c: SkillEntry) => ({ ...c, kind: "connector" })),
          ...(json.functions || []).map((f: SkillEntry) => ({ ...f, kind: "function" })),
          ...(json.capabilities || []).map((c: SkillEntry) => ({ ...c, kind: "capability" })),
        ];
        setData(all);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  return { data, loading };
}

function useFunctions() {
  const [data, setData] = useState<FunctionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/function-registry?limit=200")
      .then((r) => r.json())
      .then((json) => {
        setData(json.functions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  return { data, loading };
}

// ── Priority Badge ──────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    P0: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    P1: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    P2: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };
  return (
    <Badge variant="outline" className={colors[priority] || ""}>
      {priority}
    </Badge>
  );
}

// ── Tab Components ──────────────────────────────────────────────────────────

function PlaybooksTab() {
  const { data, loading } = usePlaybooks();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof PlaybookEntry>("priority");

  const filtered = useMemo(() => {
    let list = [...data];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.domain.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.intent_tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    const sortOrder = ["P0", "P1", "P2"];
    list.sort((a, b) => {
      if (sortKey === "priority") return sortOrder.indexOf(a.priority) - sortOrder.indexOf(b.priority);
      if (sortKey === "routines_count") return b.routines_count - a.routines_count;
      return a.domain.localeCompare(b.domain);
    });
    return list;
  }, [data, search, sortKey]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading playbooks...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          placeholder="Filter playbooks by name, description, or intent..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((pb) => (
          <Link key={pb.domain} href={`/library/${pb.path}`}>
            <Card className="hover:border-primary transition-colors cursor-pointer h-full min-h-[44px]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    {pb.domain}
                  </CardTitle>
                  <PriorityBadge priority={pb.priority} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">{pb.description}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {pb.routines_count} routines
                  </Badge>
                  {pb.connectors.slice(0, 3).map((c) => (
                    <Badge key={c} variant="outline" className="text-xs">
                      {c}
                    </Badge>
                  ))}
                  {pb.connectors.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{pb.connectors.length - 3}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-muted-foreground p-4">No playbooks match your filter.</p>
      )}
    </div>
  );
}

function ConnectorsTab() {
  const { data, loading } = useConnectors();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.primary_domain.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    );
  }, [data, search]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading connectors...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          placeholder="Filter connectors by name, domain, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <Link key={c.name} href={`/library/connectors/${c.name.replace("-connector", "")}`}>
            <Card className="hover:border-primary transition-colors cursor-pointer h-full min-h-[44px]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Plug className="h-4 w-4" />
                    {c.name.replace("-connector", "")}
                  </CardTitle>
                  <div className="flex gap-1">
                    {c.mcp && <Badge className="text-xs bg-purple-100 text-purple-800">MCP</Badge>}
                    {c.custom_client && (
                      <Badge className="text-xs bg-emerald-100 text-emerald-800">Client</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  {c.description || `${c.tools} tools for ${c.primary_domain}`}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {c.tools} tools
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    v{c.version}
                  </Badge>
                  {c.also_in?.slice(0, 2).map((d: string) => (
                    <Badge key={d} variant="outline" className="text-xs">
                      {d}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SkillsTab() {
  const { data, loading } = useSkills();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let list = data;
    if (kindFilter !== "all") list = list.filter((s) => s.kind === kindFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.primary_domain.toLowerCase().includes(q) ||
          s.path.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, search, kindFilter]);

  const kindIcons: Record<string, React.ReactNode> = {
    connector: <Plug className="h-4 w-4" />,
    function: <Zap className="h-4 w-4" />,
    capability: <Sparkles className="h-4 w-4" />,
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading skills...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          placeholder="Filter skills by name, domain, or path..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <div className="flex gap-1 ml-auto">
          {["all", "connector", "function", "capability"].map((k) => (
            <Badge
              key={k}
              variant={kindFilter === k ? "default" : "outline"}
              className="cursor-pointer capitalize"
              onClick={() => setKindFilter(k)}
            >
              {k}
            </Badge>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => (
          <Link key={s.name + s.kind} href={`/library/${s.path}`}>
            <Card className="hover:border-primary transition-colors cursor-pointer h-full min-h-[44px]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {kindIcons[s.kind] || <Sparkles className="h-4 w-4" />}
                    {s.name}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs capitalize">
                    {s.kind}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  Domain: {s.primary_domain}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs">
                    v{s.version}
                  </Badge>
                  {s.also_in?.slice(0, 2).map((d: string) => (
                    <Badge key={d} variant="outline" className="text-xs">
                      {d}
                    </Badge>
                  ))}
                  {s.dependencies?.slice(0, 2).map((d: string) => (
                    <Badge key={d} variant="outline" className="text-xs">
                      dep: {d.replace("-connector", "")}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function FunctionsTab() {
  const { data, loading } = useFunctions();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let list = data;
    if (categoryFilter !== "all") list = list.filter((f) => f.category === categoryFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.function_name.toLowerCase().includes(q));
    }
    return list;
  }, [data, search, categoryFilter]);

  const categories = useMemo(() => {
    const cats = new Set(data.map((f) => f.category));
    return Array.from(cats);
  }, [data]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading functions...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          placeholder="Search 199+ functions by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <div className="flex gap-1 flex-wrap">
          <Badge
            variant={categoryFilter === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setCategoryFilter("all")}
          >
            all
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="text-left px-3 py-2 font-medium">Function</th>
                <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Category</th>
                <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Connector</th>
                <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">Playbooks</th>
                <th className="text-right px-3 py-2 font-medium w-12">Trace</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((f) => (
                <tr key={f.function_name} className="border-t hover:bg-muted/50 min-h-[44px]">
                  <td className="px-3 py-2 font-mono text-xs">{f.function_name}</td>
                  <td className="px-3 py-2 hidden sm:table-cell">
                    <Badge variant="outline" className="text-xs">{f.category}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs hidden md:table-cell">
                    {f.parent_connector.replace("connectors/", "")}
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {f.associated_playbooks?.slice(0, 2).map((pb: string) => (
                        <Badge key={pb} variant="secondary" className="text-xs">
                          {pb.replace("playbooks/", "")}
                        </Badge>
                      ))}
                      {(f.associated_playbooks?.length || 0) > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{f.associated_playbooks.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/library/functions/${f.function_name}`}
                      className="inline-flex items-center text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t">
            Showing first 100 of {filtered.length} functions. Use search to narrow down.
          </div>
        )}
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-muted-foreground text-center">
            No functions match your filter.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Library Page ───────────────────────────────────────────────────────

export default function LibraryPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Library</h1>
        <p className="text-muted-foreground mt-1">
          4-Dimensional Relational Graph — Playbooks · Connectors · Skills · Functions
        </p>
      </div>

      <Tabs defaultValue="playbooks" className="w-full">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="playbooks" className="min-h-[44px]">
            <BookOpen className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Playbooks</span>
            <Badge variant="secondary" className="ml-2 text-xs">11</Badge>
          </TabsTrigger>
          <TabsTrigger value="connectors" className="min-h-[44px]">
            <Plug className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Connectors</span>
            <Badge variant="secondary" className="ml-2 text-xs">14</Badge>
          </TabsTrigger>
          <TabsTrigger value="skills" className="min-h-[44px]">
            <Sparkles className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Skills</span>
            <Badge variant="secondary" className="ml-2 text-xs">28</Badge>
          </TabsTrigger>
          <TabsTrigger value="functions" className="min-h-[44px]">
            <Zap className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Functions</span>
            <Badge variant="secondary" className="ml-2 text-xs">199</Badge>
          </TabsTrigger>
          <TabsTrigger value="secrets" className="min-h-[44px]" asChild>
            <Link href="/library/secrets">
              <Shield className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Secrets</span>
              <Badge variant="secondary" className="ml-2 text-xs">🔒</Badge>
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="playbooks">
          <PlaybooksTab />
        </TabsContent>

        <TabsContent value="connectors">
          <ConnectorsTab />
        </TabsContent>

        <TabsContent value="skills">
          <SkillsTab />
        </TabsContent>

        <TabsContent value="functions">
          <FunctionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
