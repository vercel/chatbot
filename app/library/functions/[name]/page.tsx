/**
 * /library/functions/[name] — U2.4.D Function Trace Detail Page
 *
 * Visual trace map for any function:
 *   - Function metadata (name, signature, category, connector)
 *   - Trace through 4-dimensional DAG: connector → playbooks → routines
 *   - Sibling functions in same connector
 *   - Cross-connector functions sharing playbooks
 */
import { notFound } from "next/navigation";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import {
  ArrowLeft,
  Zap,
  Plug,
  BookOpen,
  Sparkles,
  Link2,
  ArrowRightLeft,
  Code,
  Tag,
} from "lucide-react";
import React from "react";

const CWD = process.cwd();

// ── Types ───────────────────────────────────────────────────────────────────

interface FunctionEntry {
  function_name: string;
  execution_signature: string;
  runtime_type: string;
  parent_connector: string;
  parent_skill: string;
  associated_playbooks: string[];
  intent_tags: string[];
  category: string;
}

interface MasterRegistry {
  functions: FunctionEntry[];
}

// ── Page props ──────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ name: string }>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadRegistry(): MasterRegistry | null {
  const p = join(CWD, "functions", "master-registry.json");
  try {
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function loadGraphTag(entityPath: string): Record<string, unknown> | null {
  const parts = entityPath.split("/");
  if (parts.length >= 2) {
    const tagPath = join(CWD, parts[0], parts[1], "GRAPH-TAG.json");
    if (existsSync(tagPath)) {
      try {
        return JSON.parse(readFileSync(tagPath, "utf-8"));
      } catch {
        return null;
      }
    }
  }
  return null;
}

// ── Visual Trace Component (Server) ─────────────────────────────────────────

function TraceNode({
  icon,
  label,
  value,
  href,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  badge?: string;
}) {
  const content = (
    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors min-h-[44px]">
      <div className="text-muted-foreground shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-mono text-sm truncate">{value}</div>
      </div>
      {badge && <Badge variant="outline" className="text-xs shrink-0">{badge}</Badge>}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function FunctionDetailPage({ params }: PageProps) {
  const { name } = await params;
  const registry = loadRegistry();

  if (!registry) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <p className="text-muted-foreground">Master function registry not found.</p>
      </div>
    );
  }

  const fn = registry.functions.find((f) => f.function_name === name);
  if (!fn) {
    notFound();
  }

  // Find siblings
  const siblings = registry.functions
    .filter((f) => f.parent_connector === fn.parent_connector && f.function_name !== fn.function_name)
    .map((f) => f.function_name)
    .slice(0, 10);

  // Find cross-connector functions
  const crossConnector = registry.functions
    .filter(
      (f) =>
        f.parent_connector !== fn.parent_connector &&
        f.associated_playbooks.some((pb) => fn.associated_playbooks.includes(pb))
    )
    .map((f) => ({
      name: f.function_name,
      connector: f.parent_connector.replace("connectors/", ""),
      shared: f.associated_playbooks.filter((pb) => fn.associated_playbooks.includes(pb)),
    }))
    .slice(0, 8);

  // Load connector GRAPH-TAG
  const connectorTag = loadGraphTag(fn.parent_connector);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Back link */}
      <Link
        href="/library"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Library
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Badge className="text-xs bg-emerald-100 text-emerald-800">
            {fn.category}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {fn.runtime_type}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold font-mono tracking-tight">{fn.function_name}</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono bg-muted p-2 rounded-md mt-2">
          {fn.execution_signature}
        </p>
      </div>

      {/* Trace Map */}
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Link2 className="h-4 w-4" />
        Trace Map
      </h2>

      <div className="space-y-3">
        {/* Function → Connector */}
        <TraceNode
          icon={<Zap className="h-4 w-4" />}
          label="Function"
          value={fn.function_name}
          badge="origin"
        />

        <div className="flex justify-center text-muted-foreground">
          <ArrowRightLeft className="h-4 w-4" />
        </div>

        <TraceNode
          icon={<Plug className="h-4 w-4" />}
          label="Parent Connector"
          value={fn.parent_connector}
          href={`/library/${fn.parent_connector}`}
          badge="executes"
        />

        {fn.associated_playbooks.length > 0 && (
          <>
            <div className="flex justify-center text-muted-foreground">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground px-1">Associated Playbooks</div>
              {fn.associated_playbooks.map((pb: string) => (
                <TraceNode
                  key={pb}
                  icon={<BookOpen className="h-4 w-4" />}
                  label="Playbook"
                  value={pb}
                  href={`/library/${pb}`}
                  badge="references"
                />
              ))}
            </div>
          </>
        )}

        {fn.intent_tags.length > 0 && (
          <>
            <div className="flex justify-center text-muted-foreground">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div className="flex flex-wrap gap-1 px-3">
              <Tag className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
              {fn.intent_tags.map((t: string) => (
                <Badge key={t} variant="secondary" className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
          </>
        )}
      </div>

      <Separator className="my-6" />

      {/* Details Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Execution Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Code className="h-4 w-4" />
              Execution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Signature:</span>
              <pre className="mt-1 bg-muted p-2 rounded text-xs font-mono whitespace-pre-wrap break-all">
                {fn.execution_signature}
              </pre>
            </div>
            <div>
              <span className="text-muted-foreground">Runtime:</span>{" "}
              <Badge variant="outline" className="text-xs">{fn.runtime_type}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Category:</span>{" "}
              <Badge className="text-xs">{fn.category}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Connector Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Plug className="h-4 w-4" />
              Connector: {fn.parent_connector.replace("connectors/", "")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Parent Skill:</span>{" "}
              <Link href={`/library/${fn.parent_skill}`} className="text-primary hover:underline">
                {fn.parent_skill}
              </Link>
            </div>
            {connectorTag && (
              <div>
                <span className="text-muted-foreground">Connector Domain:</span>{" "}
                <Badge variant="outline" className="text-xs">
                  {(connectorTag.metadata as Record<string, unknown>)?.domain as string || "N/A"}
                </Badge>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Sibling Functions ({siblings.length}):</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {siblings.map((s) => (
                  <Link key={s} href={`/library/functions/${s}`}>
                    <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-primary/20">
                      {s}
                    </Badge>
                  </Link>
                ))}
                {siblings.length === 0 && (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Playbooks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Associated Playbooks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fn.associated_playbooks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No direct playbook associations.</p>
            ) : (
              <div className="space-y-2">
                {fn.associated_playbooks.map((pb: string) => (
                  <Link
                    key={pb}
                    href={`/library/${pb}`}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors min-h-[44px]"
                  >
                    <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm">{pb}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cross-Connector */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Cross-Connector Functions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {crossConnector.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cross-connector functions found.</p>
            ) : (
              <div className="space-y-2">
                {crossConnector.map((cf) => (
                  <Link
                    key={cf.name}
                    href={`/library/functions/${cf.name}`}
                    className="flex flex-col p-2 rounded hover:bg-muted transition-colors min-h-[44px]"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-sm font-mono">{cf.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {cf.connector}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Shared playbooks: {cf.shared.map((s) => s.replace("playbooks/", "")).join(", ")}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
