/**
 * GET /api/skills/[name] — Skill detail with full SKILL.md documentation
 * Session-authenticated for the chat app frontend
 */
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SHARED_SKILLS_ROOT = "/home/neptune/_shared-skills";
const REGISTRY_PATH = join(SHARED_SKILLS_ROOT, "registry.json");

/** Simple YAML frontmatter parser (avoids gray-matter dependency) */
function parseFrontmatter(md: string): { data: Record<string, any>; content: string } {
  if (!md.startsWith("---")) return { data: {}, content: md };
  const end = md.indexOf("---", 3);
  if (end === -1) return { data: {}, content: md };
  const yamlBlock = md.slice(3, end).trim();
  const content = md.slice(end + 3).trim();
  const data: Record<string, any> = {};
  for (const line of yamlBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: any = line.slice(colonIdx + 1).trim();
    // Parse arrays like [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1).split(",").map((s: string) => s.trim());
    }
    data[key] = value;
  }
  return { data, content };
}

function loadRegistry(): Record<string, any> | null {
  try {
    if (!existsSync(REGISTRY_PATH)) return null;
    return JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function findSkill(name: string): { entry: any; kind: string; skillPath: string } | null {
  const registry = loadRegistry();
  if (!registry) return null;

  for (const kind of ["connectors", "functions", "capabilities"] as const) {
    const entry = registry[kind]?.find((e: any) => e.name === name);
    if (entry) {
      return {
        entry,
        kind: kind.slice(0, -1),
        skillPath: join(SHARED_SKILLS_ROOT, entry.path),
      };
    }
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const skill = findSkill(name);

  if (!skill) {
    return NextResponse.json(
      { error: `Skill not found: ${name}` },
      { status: 404 }
    );
  }

  // Read SKILL.md
  let frontmatter: Record<string, any> = {};
  let body = "";
  let skillMdRaw = "";

  try {
    const mdPath = join(skill.skillPath, "SKILL.md");
    if (existsSync(mdPath)) {
      skillMdRaw = readFileSync(mdPath, "utf-8");
      const parsed = parseFrontmatter(skillMdRaw);
      frontmatter = parsed.data;
      body = parsed.content;
    }
  } catch {
    // Non-critical
  }

  return NextResponse.json({
    name: skill.entry.name,
    version: skill.entry.version,
    kind: skill.kind,
    path: skill.entry.path,
    primary_domain: skill.entry.primary_domain,
    also_in: skill.entry.also_in ?? [],
    tools: skill.entry.tools ?? 0,
    dependencies: skill.entry.dependencies ?? [],
    frontmatter,
    documentation: body,
    raw_markdown: skillMdRaw,
  });
}
