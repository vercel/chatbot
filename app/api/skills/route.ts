/**
 * GET /api/skills — List all skills from shared registry.
 * Reads from /home/neptune/_shared-skills/registry.json
 */
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SHARED_SKILLS_ROOT = "/home/neptune/_shared-skills";
const REGISTRY_PATH = join(SHARED_SKILLS_ROOT, "registry.json");

interface SkillEntry {
  name: string;
  version: string;
  path: string;
  primary_domain: string;
  also_in?: string[];
  tools?: number;
  dependencies?: string[];
}

interface Registry {
  connectors: SkillEntry[];
  functions: SkillEntry[];
  capabilities: SkillEntry[];
  summary: {
    totalConnectors: number;
    totalFunctions: number;
    totalCapabilities: number;
    totalSkills: number;
  };
}

function loadRegistry(): Registry | null {
  try {
    if (!existsSync(REGISTRY_PATH)) return null;
    return JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
  } catch {
    return null;
  }
}

export async function GET() {
  const registry = loadRegistry();

  if (!registry) {
    return NextResponse.json(
      { error: "Skills registry not available" },
      { status: 503 }
    );
  }

  return NextResponse.json({
    connectors: registry.connectors.map((s) => ({
      name: s.name,
      version: s.version,
      path: s.path,
      tools: s.tools,
      primary_domain: s.primary_domain,
      also_in: s.also_in ?? [],
      dependencies: s.dependencies ?? [],
      kind: "connector",
    })),
    functions: registry.functions.map((s) => ({
      name: s.name,
      version: s.version,
      path: s.path,
      primary_domain: s.primary_domain,
      also_in: s.also_in ?? [],
      dependencies: s.dependencies ?? [],
      kind: "function",
    })),
    capabilities: registry.capabilities.map((s) => ({
      name: s.name,
      version: s.version,
      path: s.path,
      primary_domain: s.primary_domain,
      also_in: s.also_in ?? [],
      dependencies: s.dependencies ?? [],
      kind: "capability",
    })),
    summary: registry.summary,
  });
}
