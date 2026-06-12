/**
 * /library/secrets — U2.7.A Secrets Inventory + Audit Dashboard
 *
 * Admin-only page showing masked secrets across all environments
 * with sync status, drift detection, and rotation tracking.
 *
 * Auth: Regular user session required (next-auth), not guest.
 * Safety: Values ALWAYS masked (first 4 + last 4 chars only).
 */
"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  KeyRound,
  ArrowRightLeft,
  Server,
  Clock,
  ExternalLink,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

interface MaskedSecret {
  envKey: string;
  category: string;
  maskedValue: string | null;
  vercelChat: "present" | "missing" | "placeholder";
  vercelV2: "present" | "missing" | "placeholder";
  vpsDotenv: "present" | "missing" | "placeholder";
  vercelChatType: string | null;
  vercelV2Type: string | null;
  syncStatus:
    | "synced"
    | "drift_chat_only"
    | "drift_v2_only"
    | "drift_value"
    | "vps_only"
    | "unset_all";
  driftDetail: string | null;
  rotationDue: string;
  notes: string;
}

interface DriftReport {
  chatOnly: string[];
  v2Only: string[];
  valueMismatches: { key: string; chatMasked: string; v2Masked: string; resolution?: string }[];
  unsetPlaceholders: string[];
}

interface SecretsData {
  generatedAt: string;
  scannerVersion: string;
  projects: {
    chat: { id: string; envCount: number };
    v2: { id: string; envCount: number };
    vps: { path: string; envCount: number };
  };
  summary: {
    totalUniqueKeys: number;
    synced: number;
    driftChatOnly: number;
    driftV2Only: number;
    driftValue: number;
    vpsOnly: number;
    unsetAll: number;
  };
  secrets: MaskedSecret[];
  driftReport: DriftReport;
}

// ── Color Maps ──────────────────────────────────────────────────────────────

const SYNC_STATUS_COLORS: Record<string, string> = {
  synced: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  drift_chat_only: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  drift_v2_only: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  drift_value: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  vps_only: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  unset_all: "bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400",
};

const PRESENCE_LABELS: Record<string, string> = {
  present: "✅",
  missing: "❌",
  placeholder: "⚠️",
};

const CATEGORY_COLORS: Record<string, string> = {
  slack: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  nmi: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  hyperswitch: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  base44: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  vercel: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  github: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  vps: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  ai_providers: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  clerk: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  infrastructure: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  neptune_v2: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
  e2b: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  connectors: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  other_services: "bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-300",
  internal: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  webhooks: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  frontend: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

// ── Summary Card ────────────────────────────────────────────────────────────

function SummaryCards({ data }: { data: SecretsData }) {
  const { summary, projects } = data;
  const healthScore = summary.totalUniqueKeys > 0
    ? Math.round((summary.synced / summary.totalUniqueKeys) * 100)
    : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Keys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalUniqueKeys}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Across {projects.chat.envCount} (Chat) + {projects.v2.envCount} (V2) +{" "}
            {projects.vps.envCount} (VPS)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Sync Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            healthScore >= 90 ? "text-emerald-600" :
            healthScore >= 70 ? "text-amber-600" :
            "text-red-600"
          }`}>
            {healthScore}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.synced} of {summary.totalUniqueKeys} keys synced
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Drift
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-2xl font-bold text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            {summary.driftChatOnly + summary.driftV2Only + summary.driftValue}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.driftChatOnly} chat-only · {summary.driftV2Only} v2-only ·{" "}
            {summary.driftValue} value
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Issues
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-2xl font-bold text-red-600">
            <KeyRound className="h-5 w-5" />
            {summary.unsetAll + (data.driftReport.unsetPlaceholders?.length ?? 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.unsetAll} unset · {data.driftReport.unsetPlaceholders?.length ?? 0} placeholders
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Project Summary Bar ─────────────────────────────────────────────────────

function ProjectBar({ data }: { data: SecretsData }) {
  return (
    <div className="flex flex-wrap gap-3 mb-4 text-xs text-muted-foreground">
      <Badge variant="outline" className="gap-1">
        <Server className="h-3 w-3" />
        Chat: {data.projects.chat.id.slice(0, 12)}… ({data.projects.chat.envCount} vars)
      </Badge>
      <Badge variant="outline" className="gap-1">
        <Server className="h-3 w-3" />
        V2: {data.projects.v2.id.slice(0, 12)}… ({data.projects.v2.envCount} vars)
      </Badge>
      <Badge variant="outline" className="gap-1">
        <Server className="h-3 w-3" />
        VPS: {data.projects.vps.envCount} vars
      </Badge>
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        {new Date(data.generatedAt).toLocaleString()}
      </Badge>
    </div>
  );
}

// ── Secrets Table ───────────────────────────────────────────────────────────

function SecretsTable({
  secrets,
  search,
  setSearch,
  filterStatus,
  setFilterStatus,
  refreshing,
  onRefresh,
}: {
  secrets: MaskedSecret[];
  search: string;
  setSearch: (s: string) => void;
  filterStatus: string;
  setFilterStatus: (s: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const filtered = useMemo(() => {
    let list = [...secrets];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.envKey.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    }
    if (filterStatus && filterStatus !== "all") {
      list = list.filter((s) => s.syncStatus === filterStatus);
    }
    return list;
  }, [secrets, search, filterStatus]);

  const statusOptions = [
    { value: "all", label: "All" },
    { value: "synced", label: "Synced" },
    { value: "drift_chat_only", label: "Chat Only" },
    { value: "drift_v2_only", label: "V2 Only" },
    { value: "drift_value", label: "Value Drift" },
    { value: "vps_only", label: "VPS Only" },
    { value: "unset_all", label: "Unset" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          placeholder="Search by key name or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="ml-auto gap-1"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Scanning…" : "Refresh"}
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Key</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Category</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Masked Value</th>
              <th className="text-center px-3 py-2 font-medium whitespace-nowrap">Chat</th>
              <th className="text-center px-3 py-2 font-medium whitespace-nowrap">V2</th>
              <th className="text-center px-3 py-2 font-medium whitespace-nowrap">VPS</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Sync Status</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Rotation</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((secret) => (
              <tr
                key={secret.envKey}
                className="border-b hover:bg-muted/30 transition-colors"
              >
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                  {secret.envKey}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${CATEGORY_COLORS[secret.category] ?? ""}`}
                  >
                    {secret.category}
                  </Badge>
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {secret.maskedValue ? (
                    <span className="flex items-center gap-1">
                      <EyeOff className="h-3 w-3 text-muted-foreground" />
                      {secret.maskedValue}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <span title={secret.vercelChat}>{PRESENCE_LABELS[secret.vercelChat] ?? "—"}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span title={secret.vercelV2}>{PRESENCE_LABELS[secret.vercelV2] ?? "—"}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span title={secret.vpsDotenv}>{PRESENCE_LABELS[secret.vpsDotenv] ?? "—"}</span>
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${SYNC_STATUS_COLORS[secret.syncStatus] ?? ""}`}
                    title={secret.driftDetail ?? undefined}
                  >
                    {secret.syncStatus.replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      secret.rotationDue.startsWith("⚠️")
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        : secret.rotationDue.startsWith("due")
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                    }`}
                  >
                    {secret.rotationDue}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {secrets.length} secrets
      </div>
    </div>
  );
}

// ── Drift View ──────────────────────────────────────────────────────────────

function DriftView({ data }: { data: SecretsData }) {
  const { driftReport } = data;

  return (
    <div className="space-y-6">
      {/* Value Mismatches */}
      {driftReport.valueMismatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-red-500" />
              Value Mismatches ({driftReport.valueMismatches.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {driftReport.valueMismatches.map((m) => (
                <div key={m.key} className="p-3 border rounded-lg bg-red-50/50 dark:bg-red-950/20">
                  <div className="font-mono text-sm font-semibold">{m.key}</div>
                  <div className="flex gap-4 mt-1 text-xs">
                    <span>Chat: <code className="bg-muted px-1 py-0.5 rounded">{m.chatMasked}</code></span>
                    <span>V2: <code className="bg-muted px-1 py-0.5 rounded">{m.v2Masked}</code></span>
                  </div>
                  {m.resolution && (
                    <p className="text-xs text-muted-foreground mt-1">{m.resolution}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat-Only Keys */}
      {driftReport.chatOnly.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Chat-Only Keys ({driftReport.chatOnly.length})
              <span className="text-xs font-normal text-muted-foreground">
                Present in neptune-chat but missing from neptune-v2
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {driftReport.chatOnly.map((key) => (
                <Badge key={key} variant="outline" className="bg-amber-50 dark:bg-amber-950/20">
                  {key}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* V2-Only Keys */}
      {driftReport.v2Only.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-violet-500" />
              V2-Only Keys ({driftReport.v2Only.length})
              <span className="text-xs font-normal text-muted-foreground">
                Present in neptune-v2 but missing from neptune-chat
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {driftReport.v2Only.map((key) => (
                <Badge key={key} variant="outline" className="bg-violet-50 dark:bg-violet-950/20">
                  {key}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unset Placeholders */}
      {driftReport.unsetPlaceholders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-gray-500" />
              Unset / Placeholder ({driftReport.unsetPlaceholders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {driftReport.unsetPlaceholders.map((key) => (
                <Badge key={key} variant="outline" className="bg-gray-100 dark:bg-gray-800 text-gray-500">
                  {key}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {driftReport.valueMismatches.length === 0 &&
       driftReport.chatOnly.length === 0 &&
       driftReport.v2Only.length === 0 &&
       driftReport.unsetPlaceholders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
          <p className="text-lg font-medium">All Clear</p>
          <p className="text-sm">No drift detected. All secrets are synced across environments.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function SecretsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [data, setData] = useState<SecretsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [tab, setTab] = useState("overview");

  // Check authorization
  const isAuthorized =
    sessionStatus === "authenticated" && session?.user?.type === "regular";

  // Fetch inventory
  const fetchInventory = async () => {
    try {
      setError(null);
      const res = await fetch("/api/secrets/audit");
      if (res.status === 401) {
        setError("Admin access required. Please sign in with a regular account.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(`Failed to load: ${res.status} ${res.statusText}`);
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (sessionStatus === "authenticated" && session?.user?.type === "regular") {
      fetchInventory();
    } else if (sessionStatus === "unauthenticated") {
      setError("Sign in required.");
      setLoading(false);
    } else if (session?.user?.type === "guest") {
      setError("Guest accounts cannot view secrets. Please sign in as a regular user.");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, session?.user?.type]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/secrets/audit", { method: "POST" });
      if (res.ok) {
        await fetchInventory();
      }
    } finally {
      setRefreshing(false);
    }
  };

  // ── Loading / Error / Unauthorized States ─────────────────────────────────

  if (sessionStatus === "loading" || (loading && !error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Loading secrets inventory…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Shield className="h-12 w-12 text-amber-500 mb-3" />
        <h1 className="text-xl font-semibold mb-2">Secrets Audit</h1>
        <p className="text-muted-foreground text-center max-w-md mb-4">
          {error}
        </p>
        {!isAuthorized && (
          <Button variant="default" asChild>
            <a href="/api/auth/signin">Sign In</a>
          </Button>
        )}
      </div>
    );
  }

  if (!data) return null;

  // ── Authorized Render ─────────────────────────────────────────────────────

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-cyan-500" />
            Secrets Inventory
          </h1>
          <p className="text-sm text-muted-foreground">
            U2.7.A — Masked audit across Chat, V2, and VPS environments
          </p>
        </div>
      </div>

      <ProjectBar data={data} />

      {/* Tab Navigation */}
      <Tabs value={tab} onValueChange={setTab} className="mt-2">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="inventory">Full Inventory ({data.secrets.length})</TabsTrigger>
          <TabsTrigger value="drift">
            Drift Report
            {data.summary.driftChatOnly + data.summary.driftV2Only + data.summary.driftValue > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">
                {data.summary.driftChatOnly + data.summary.driftV2Only + data.summary.driftValue}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <SummaryCards data={data} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sync Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Synced</span>
                    <Badge className={SYNC_STATUS_COLORS.synced}>{data.summary.synced}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Chat Only</span>
                    <Badge className={SYNC_STATUS_COLORS.drift_chat_only}>{data.summary.driftChatOnly}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">V2 Only</span>
                    <Badge className={SYNC_STATUS_COLORS.drift_v2_only}>{data.summary.driftV2Only}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Value Drift</span>
                    <Badge className={SYNC_STATUS_COLORS.drift_value}>{data.summary.driftValue}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">VPS Only</span>
                    <Badge className={SYNC_STATUS_COLORS.vps_only}>{data.summary.vpsOnly}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Unset / Placeholder</span>
                    <Badge className={SYNC_STATUS_COLORS.unset_all}>{data.summary.unsetAll}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Environment Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Chat (prj_bpG5Z…)</span>
                      <span className="font-medium">{data.projects.chat.envCount} vars</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${Math.round((data.projects.chat.envCount / data.summary.totalUniqueKeys) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>V2 (prj_lEoqz…)</span>
                      <span className="font-medium">{data.projects.v2.envCount} vars</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full"
                        style={{ width: `${Math.round((data.projects.v2.envCount / data.summary.totalUniqueKeys) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>VPS (/etc/newleaf/.env)</span>
                      <span className="font-medium">{data.projects.vps.envCount} vars</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.round((data.projects.vps.envCount / data.summary.totalUniqueKeys) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground mt-6 flex items-center gap-1">
            <EyeOff className="h-3 w-3" />
            All values are masked for security. Only the first 4 and last 4 characters are shown.
          </p>
        </TabsContent>

        {/* Full Inventory Tab */}
        <TabsContent value="inventory" className="mt-4">
          <SecretsTable
            secrets={data.secrets}
            search={search}
            setSearch={setSearch}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        {/* Drift Report Tab */}
        <TabsContent value="drift" className="mt-4">
          <DriftView data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
