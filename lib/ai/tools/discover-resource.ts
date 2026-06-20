/**
 * lib/ai/tools/discover-resource.ts
 *
 * 5-level discovery cascade tool:
 * 1. KG (Knowledge Graph) — fastest, pre-indexed knowledge
 * 2. Playbooks — domain-specific operational guides
 * 3. Skills — connector SKILL.md action catalogs
 * 4. A2A AgentCard — /well-known/agent.json for external discovery
 * 5. Registry — SKILL_REGISTRY + manifest fallback
 *
 * Each level progressively broader and slower.
 * Returns first match with provenance (which level found it).
 */

import { tool } from "ai";
import { z } from "zod";
import { SKILL_REGISTRY } from "@/connectors/neptune/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

type DiscoveryLevel =
  | "kg"
  | "playbooks"
  | "skills"
  | "a2a"
  | "registry"
  | "not-found";

interface DiscoveryResult {
  query: string;
  found: boolean;
  level: DiscoveryLevel;
  resource?: {
    type: string;
    path: string;
    connector?: string;
    actions?: number;
    description?: string;
  };
  cascade: {
    kg: boolean;
    playbooks: boolean;
    skills: boolean;
    a2a: boolean;
    registry: boolean;
  };
  suggestions: string[];
}

const CONNECTORS_ROOT = join(process.cwd(), "connectors");
const PLAYBOOKS_ROOT = join(process.cwd(), "playbooks");

/**
 * Level 1: Search Knowledge Graph.
 * Checks if the query matches any known connector or skill in the SKILL_REGISTRY.
 */
function searchKG(query: string): DiscoveryResult["resource"] | null {
  const lower = query.toLowerCase();

  // Direct connector match
  for (const [connector, info] of Object.entries(SKILL_REGISTRY)) {
    if (lower.includes(connector) || connector.includes(lower)) {
      return {
        type: "connector-skill",
        path: `connectors/neptune/skills/${info.path}`,
        connector,
        actions: info.actions,
        description: `${info.actions} actions for ${connector}`,
      };
    }
  }

  return null;
}

/**
 * Level 2: Search Playbooks.
 * Checks playbooks/ directory for matching operational guides.
 */
function searchPlaybooks(query: string): DiscoveryResult["resource"] | null {
  const lower = query.toLowerCase();

  // Check for domain-specific playbooks
  const domains = [
    "billing",
    "disputes",
    "customer-support",
    "agent-orchestration",
    "engineering",
    "deploy-vercel-github",
    "code-review",
    "newleaf-operations",
    "planning-research",
    "reporting",
    "system-audit",
    "feature-build",
    "migration",
    "debugging-incident",
  ];

  for (const domain of domains) {
    if (
      lower.includes(domain) ||
      domain.includes(lower.replace(/\s+/g, "-"))
    ) {
      const playbookPath = join(PLAYBOOKS_ROOT, domain, "PLAYBOOK.md");
      const indexPath = join(PLAYBOOKS_ROOT, domain, "index.md");

      if (existsSync(playbookPath) || existsSync(indexPath)) {
        return {
          type: "playbook",
          path: `playbooks/${domain}/`,
          description: `Operational playbook for ${domain} domain`,
        };
      }
    }
  }

  // Check engineering playbook specifically
  const engPlaybook = join(PLAYBOOKS_ROOT, "engineering", "PLAYBOOK-ENGINEERING.md");
  if (existsSync(engPlaybook)) {
    const content = readFileSync(engPlaybook, "utf-8").toLowerCase();
    if (content.includes(lower)) {
      return {
        type: "playbook",
        path: "playbooks/engineering/PLAYBOOK-ENGINEERING.md",
        description: "Engineering playbook with operational routines",
      };
    }
  }

  return null;
}

/**
 * Level 3: Search Skills.
 * Deep search SKILL.md files for relevant actions.
 */
function searchSkills(query: string): DiscoveryResult["resource"] | null {
  const lower = query.toLowerCase();

  for (const [connector, info] of Object.entries(SKILL_REGISTRY)) {
    const skillPath = join(
      process.cwd(),
      "connectors",
      "neptune",
      "skills",
      info.path
    );

    if (!existsSync(skillPath)) continue;

    try {
      const content = readFileSync(skillPath, "utf-8").toLowerCase();
      if (content.includes(lower)) {
        return {
          type: "skill-doc",
          path: `connectors/neptune/skills/${info.path}`,
          connector,
          actions: info.actions,
          description: `Skill documentation found matching "${query}"`,
        };
      }
    } catch {
      // skip unreadable files
    }
  }

  return null;
}

/**
 * Level 4: Search A2A AgentCard.
 * Checks /.well-known/agent.json for matching capabilities.
 */
async function searchA2A(): Promise<DiscoveryResult["resource"] | null> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/.well-known/agent.json`, {
      signal: AbortSignal.timeout(5_000),
    });

    if (res.ok) {
      const card = await res.json();
      return {
        type: "agent-card",
        path: "/.well-known/agent.json",
        description: `A2A AgentCard v${card.protocolVersion} — ${card.name}`,
      };
    }
  } catch {
    // A2A endpoint not available
  }

  return null;
}

/**
 * Level 5: Registry fallback.
 * Returns the full registry as suggestions.
 */
function searchRegistry(query: string): DiscoveryResult["resource"] | null {
  const allConnectors = Object.keys(SKILL_REGISTRY);
  return {
    type: "registry-fallback",
    path: "connectors/neptune/client.ts",
    description: `Full registry with ${allConnectors.length} connectors: ${allConnectors.join(", ")}`,
  };
}

/**
 * discoverResource tool — 5-level cascade.
 * Registered as an inline tool for agent use.
 */
export const discoverResource = tool({
  description:
    "Discover resources across 5 levels (KG → Playbooks → Skills → A2A → Registry). Finds connectors, skills, playbooks, or documentation matching a query. Returns the first match with provenance of which level found it.",
  inputSchema: z.object({
    query: z.string().describe("What resource to discover (connector name, skill, domain, etc.)"),
    level: z
      .enum(["auto", "kg", "playbooks", "skills", "a2a", "registry"])
      .default("auto")
      .describe("Force a specific discovery level (default: auto cascade)"),
  }),
  execute: async ({ query, level }) => {
    const cascade = {
      kg: false,
      playbooks: false,
      skills: false,
      a2a: false,
      registry: false,
    };

    // Run cascade until we find a match
    if (level === "auto" || level === "kg") {
      cascade.kg = true;
      const kgResult = searchKG(query);
      if (kgResult) {
        return {
          success: true,
          query,
          found: true,
          level: "kg" as DiscoveryLevel,
          resource: kgResult,
          cascade,
          suggestions: [],
        };
      }
    }

    if (level === "auto" || level === "playbooks") {
      cascade.playbooks = true;
      const playbookResult = searchPlaybooks(query);
      if (playbookResult) {
        return {
          success: true,
          query,
          found: true,
          level: "playbooks" as DiscoveryLevel,
          resource: playbookResult,
          cascade,
          suggestions: [],
        };
      }
    }

    if (level === "auto" || level === "skills") {
      cascade.skills = true;
      const skillResult = searchSkills(query);
      if (skillResult) {
        return {
          success: true,
          query,
          found: true,
          level: "skills" as DiscoveryLevel,
          resource: skillResult,
          cascade,
          suggestions: [],
        };
      }
    }

    if (level === "auto" || level === "a2a") {
      cascade.a2a = true;
      const a2aResult = await searchA2A();
      if (a2aResult) {
        return {
          success: true,
          query,
          found: true,
          level: "a2a" as DiscoveryLevel,
          resource: a2aResult,
          cascade,
          suggestions: [],
        };
      }
    }

    // Registry fallback (always run as last resort)
    cascade.registry = true;
    const registryResult = searchRegistry(query);

    return {
      success: true,
      query,
      found: false,
      level: "not-found" as DiscoveryLevel,
      resource: registryResult,
      cascade,
      suggestions: Object.keys(SKILL_REGISTRY).filter((c) =>
        c.toLowerCase().includes(query.toLowerCase())
      ),
    };
  },
});

export default discoverResource;
