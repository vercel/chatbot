/**
 * GET /api/skill/[name] — Skill info bridge
 *
 * V2 consumes this to discover skill metadata, tool lists, and dependencies.
 * Auth: Bearer NEPTUNE_INTERNAL_TOKEN
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

function loadRegistry(): { connectors: SkillEntry[]; functions: SkillEntry[]; capabilities: SkillEntry[] } | null {
  try {
    if (!existsSync(REGISTRY_PATH)) return null;
    return JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function findSkill(name: string): { entry: SkillEntry; kind: string; skillPath: string } | null {
  const registry = loadRegistry();
  if (!registry) return null;

  for (const kind of ["connectors", "functions", "capabilities"] as const) {
    const entry = (registry as any)[kind]?.find(
      (e: SkillEntry) => e.name === name
    );
    if (entry) {
      return { entry, kind: kind.slice(0, -1), skillPath: join(SHARED_SKILLS_ROOT, entry.path) };
    }
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // Auth
  const authHeader = _request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const expectedToken = process.env.NEPTUNE_INTERNAL_TOKEN ?? "";
  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const skill = findSkill(name);
  if (!skill) {
    return NextResponse.json(
      { error: `Skill not found: ${name}` },
      { status: 404 }
    );
  }

  // Read SKILL.md for full documentation
  let skillMd = "";
  try {
    const mdPath = join(skill.skillPath, "SKILL.md");
    if (existsSync(mdPath)) {
      skillMd = readFileSync(mdPath, "utf-8");
    }
  } catch {
    // Non-critical — return what we have
  }

  return NextResponse.json({
    name: skill.entry.name,
    version: skill.entry.version,
    kind: skill.kind,
    primary_domain: skill.entry.primary_domain,
    also_in: skill.entry.also_in ?? [],
    tools: skill.entry.tools ?? 0,
    dependencies: skill.entry.dependencies ?? [],
    documentation: skillMd,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // Auth
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const expectedToken = process.env.NEPTUNE_INTERNAL_TOKEN ?? "";
  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const skill = findSkill(name);
  if (!skill) {
    return NextResponse.json(
      { error: `Skill not found: ${name}` },
      { status: 404 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Connector skills: delegate to existing connector tools
  if (skill.kind === "connector") {
    try {
      // Dynamically import connector tools
      const connectorPath = `@/lib/connectors/${name.replace("-connector", "")}/tools`;
      // Hide dynamic import from Turbopack bundler tracing
      const tools = await new Function('p', 'return import(p)')(connectorPath);
      const action = body.action as string;

      if (action && typeof (tools as any)[action] === "function") {
        const result = await (tools as any)[action](body.params ?? {});
        return NextResponse.json({ success: true, result });
      }

      // List available tools
      const toolNames = Object.keys(tools).filter(
        (k) => typeof (tools as any)[k] === "function"
      );
      return NextResponse.json({
        success: true,
        availableActions: toolNames,
      });
    } catch (err) {
      return NextResponse.json(
        { error: `Connector tools not available: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  // Function and capability skills return their documentation
  return NextResponse.json({
    success: true,
    message: `Skill ${name} is type ${skill.kind}. Invoke via agent context.`,
    documentation: skill.entry,
  });
}
