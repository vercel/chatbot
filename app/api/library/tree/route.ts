/**
 * GET /api/library/tree — Returns the full library tree structure.
 *
 * Merges data from:
 * 1. skills/registry.json — connectors, functions, capabilities
 * 2. skills/playbook-skills.md — playbook index
 * 3. KG query — playbook entity count
 *
 * Returns 4 top-level categories: connectors, skills, functions, playbooks
 * Each leaf function has "usedBy" reverse refs from connectors and playbooks.
 *
 * Cache: 5-min ETag via Cache-Control
 */
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

const SKILLS_ROOT = "/home/neptune/neptune-chat/skills";
const REGISTRY_PATH = join(SKILLS_ROOT, "registry.json");
const PLAYBOOK_INDEX_PATH = join(SKILLS_ROOT, "playbook-skills.md");

// ── Types ──────────────────────────────────────────────────────────────────

interface RegistryEntry {
  name: string;
  version: string;
  path: string;
  tools?: number;
  primary_domain: string;
  also_in?: string[];
  dependencies?: string[];
}

interface Registry {
  connectors: RegistryEntry[];
  functions: RegistryEntry[];
  capabilities: RegistryEntry[];
  summary: { totalConnectors: number; totalFunctions: number; totalCapabilities: number; totalSkills: number };
}

export interface LibraryTreeNode {
  id: string;
  type: "category" | "connector" | "skill" | "function" | "playbook";
  name: string;
  label: string;
  icon: string;
  description?: string;
  metadata?: {
    version?: string;
    tools?: number;
    domain?: string;
    alsoIn?: string[];
    dependencies?: string[];
    usedBy?: string[];
    skillsCount?: number;
  };
  children?: LibraryTreeNode[];
}

// ── Icon Mapping ───────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  connectors: "Plug",
  skills: "Sparkles",
  functions: "Zap",
  playbooks: "Book",
};

const DOMAIN_ICONS: Record<string, string> = {
  "billing-flow": "CreditCard",
  "credit-disputes": "Scale",
  "customer-enrollment": "UserPlus",
  "compliance-audit": "Shield",
  "support-triage": "LifeBuoy",
  "agent-payments": "DollarSign",
  reporting: "BarChart3",
  "customer-comms": "Mail",
  "lead-flow": "Users",
  "mcp-edits": "Wrench",
  coding: "Code",
  engineering: "Cog",
  comms: "MessageCircle",
  "agent-orchestration": "Brain",
  "planning-research": "Search",
};

// ── Load Registry ──────────────────────────────────────────────────────────

function loadRegistry(): Registry | null {
  try {
    if (!existsSync(REGISTRY_PATH)) return null;
    return JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
  } catch {
    return null;
  }
}

// ── Parse Playbooks from index markdown ────────────────────────────────────

interface PlaybookEntry {
  name: string;
  domain: string;
  path: string;
}

function parsePlaybookIndex(): PlaybookEntry[] {
  const entries: PlaybookEntry[] = [];
  try {
    if (!existsSync(PLAYBOOK_INDEX_PATH)) return entries;
    const content = readFileSync(PLAYBOOK_INDEX_PATH, "utf-8");

    // Parse the playbooks table: | Domain | Path | Playbook File |
    const tableStart = content.indexOf("## 📚 Playbooks");
    if (tableStart < 0) return entries;
    const tableEnd = content.indexOf("## 🔌 Connectors", tableStart);
    const tableContent = content.slice(tableStart, tableEnd > 0 ? tableEnd : undefined);

    // Match markdown table rows: | Name | path/ | playbook-name.md |
    const rowRegex = /\|\s+([\w\s-]+?)\s+\|\s+([\w/.-]+?)\s+\|\s+([\w.-]+)(?:\s+\|.*)?$/gm;
    let match: RegExpExecArray | null;
    while ((match = rowRegex.exec(tableContent)) !== null) {
      const domain = match[1].trim();
      const path = match[2].trim();
      if (domain === "Domain" || domain === "----") continue; // skip header/separator
      entries.push({ name: domain, domain: domain.toLowerCase().replace(/\s+/g, "-"), path });
    }
  } catch {
    // Silent
  }
  return entries;
}

// ── Helper: Convert domain slug to readable label ──────────────────────────

function domainLabel(domain: string): string {
  return domain
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Build reverse refs map (connector name → function names it depends on) ──

function buildReverseRefs(registry: Registry): Map<string, string[]> {
  // Map: functionName → [connectorName/skillName that use it]
  const refs = new Map<string, string[]>();

  // Connectors that depend on functions
  for (const c of registry.connectors) {
    for (const dep of c.dependencies ?? []) {
      const existing = refs.get(dep) ?? [];
      existing.push(c.name);
      refs.set(dep, existing);
    }
  }

  // Functions that depend on other functions
  for (const f of registry.functions) {
    for (const dep of f.dependencies ?? []) {
      const existing = refs.get(dep) ?? [];
      existing.push(f.name);
      refs.set(dep, existing);
    }
  }

  return refs;
}

// ── Build Tree ─────────────────────────────────────────────────────────────

function buildTree(registry: Registry, playbooks: PlaybookEntry[]): LibraryTreeNode[] {
  const refs = buildReverseRefs(registry);
  const allAlsoIn: Set<string> = new Set();

  // Category: Connectors
  const connectorNodes: LibraryTreeNode[] = registry.connectors.map((c) => {
    // Collect "used by" — which functions depend on this connector
    const usedBy: string[] = [];
    for (const f of registry.functions) {
      if (f.dependencies?.includes(c.name)) {
        usedBy.push(f.name);
      }
    }
    // Build skill children (capabilities/functions that depend on this connector)
    const connectorSkills: LibraryTreeNode[] = [
      ...registry.capabilities
        .filter((cap) => cap.dependencies?.includes(c.name))
        .map((cap) => ({
          id: `skill:${cap.name}`,
          type: "skill" as const,
          name: cap.name,
          label: domainLabel(cap.name.replace(/-/g, " ")),
          icon: "Sparkles",
          metadata: { domain: cap.primary_domain },
        })),
      ...registry.functions
        .filter((f) => f.dependencies?.includes(c.name))
        .map((f) => ({
          id: `function:${f.name}`,
          type: "function" as const,
          name: f.name,
          label: domainLabel(f.name.replace(/-/g, " ")),
          icon: "Zap",
          metadata: {
            version: f.version,
            domain: f.primary_domain,
            usedBy: refs.get(f.name) ?? [],
          },
        })),
    ];

    for (const ai of c.also_in ?? []) allAlsoIn.add(ai);

    return {
      id: `connector:${c.name}`,
      type: "connector" as const,
      name: c.name,
      label: c.name.replace(/-connector$/, "").replace(/-/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()),
      icon: DOMAIN_ICONS[c.primary_domain] ?? "Plug",
      description: `${c.tools ?? 0} tools · ${domainLabel(c.primary_domain)}`,
      metadata: {
        version: c.version,
        tools: c.tools,
        domain: c.primary_domain,
        alsoIn: c.also_in,
        dependencies: c.dependencies,
        skillsCount: connectorSkills.length,
      },
      children: connectorSkills.length > 0 ? connectorSkills : undefined,
    };
  });

  // Category: Skills (capabilities + domain functions)
  const skillNodes: LibraryTreeNode[] = registry.capabilities.map((cap) => ({
    id: `skill:${cap.name}`,
    type: "skill" as const,
    name: cap.name,
    label: domainLabel(cap.name.replace(/-/g, " ")),
    icon: "Sparkles",
    description: domainLabel(cap.primary_domain),
    metadata: {
      version: cap.version,
      domain: cap.primary_domain,
    },
  }));

  // Category: Functions
  const functionNodes: LibraryTreeNode[] = registry.functions.map((f) => ({
    id: `function:${f.name}`,
    type: "function" as const,
    name: f.name,
    label: domainLabel(f.name.replace(/-/g, " ")),
    icon: "Zap",
    description: domainLabel(f.primary_domain),
    metadata: {
      version: f.version,
      domain: f.primary_domain,
      alsoIn: f.also_in,
      dependencies: f.dependencies,
      usedBy: refs.get(f.name) ?? [],
    },
  }));

  // Category: Playbooks
  const playbookNodes: LibraryTreeNode[] = playbooks.map((p) => ({
    id: `playbook:${p.domain}`,
    type: "playbook" as const,
    name: p.domain,
    label: p.name,
    icon: "Book",
    description: p.path,
    metadata: { domain: p.domain },
  }));

  return [
    {
      id: "category:connectors",
      type: "category",
      name: "connectors",
      label: "Connectors",
      icon: "Plug",
      metadata: { skillsCount: registry.summary.totalConnectors },
      children: connectorNodes,
    },
    {
      id: "category:skills",
      type: "category",
      name: "skills",
      label: "Skills",
      icon: "Sparkles",
      metadata: { skillsCount: registry.summary.totalCapabilities },
      children: skillNodes,
    },
    {
      id: "category:functions",
      type: "category",
      name: "functions",
      label: "Functions",
      icon: "Zap",
      metadata: { skillsCount: registry.summary.totalFunctions },
      children: functionNodes,
    },
    {
      id: "category:playbooks",
      type: "category",
      name: "playbooks",
      label: "Playbooks",
      icon: "Book",
      metadata: { skillsCount: playbooks.length },
      children: playbookNodes,
    },
  ];
}

// ── Handler ────────────────────────────────────────────────────────────────

export const GET = requireAllowlist(async () => {
  const registry = loadRegistry();
  if (!registry) {
    return NextResponse.json(
      { error: "Registry not found. Run neptune:bootstrap first." },
      { status: 500 },
    );
  }

  const playbooks = parsePlaybookIndex();
  const tree = buildTree(registry, playbooks);

  return NextResponse.json(
    { tree },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
        ETag: `"${Date.now().toString(36)}"`,
      },
    },
  );
});
