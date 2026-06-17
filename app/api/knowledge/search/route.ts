/**
 * GET /api/knowledge/search?q=X&type=&domain=&tag=
 * Semantic + fuzzy search across all knowledge files.
 * OKF v0.1 compatible.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

const ROOT = process.cwd();
const KNOWLEDGE_ROOTS = ["connectors", "playbooks", "skills", "shared-skills", "workflows", "jarvis/cortex", "docs", "proofs"];

interface SearchResult {
  path: string;
  name: string;
  type: string;
  description: string;
  domain: string;
  tags: string[];
  updated: string;
  score: number;
  snippet: string;
}

function extractFrontmatter(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    return yaml.load(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Exact match
  if (t === q) return 100;
  // Starts with
  if (t.startsWith(q)) return 80;
  // Contains full query
  if (t.includes(q)) return 60;

  // Word-level matching
  const queryWords = q.split(/\s+/);
  const textWords = t.split(/\s+/);
  let score = 0;

  for (const qw of queryWords) {
    for (const tw of textWords) {
      if (tw === qw) { score += 15; break; }
      if (tw.startsWith(qw)) { score += 10; break; }
      if (tw.includes(qw)) { score += 5; break; }
    }
  }

  return score;
}

function getSnippet(content: string, query: string): string {
  const q = query.toLowerCase();
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.toLowerCase().includes(q)) {
      const trimmed = line.trim();
      if (trimmed.length > 200) return trimmed.slice(0, 197) + "...";
      return trimmed;
    }
  }
  // Return first non-empty, non-heading line
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("---")) {
      return trimmed.slice(0, 200);
    }
  }
  return "";
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();
  const typeFilter = searchParams.get("type");
  const domainFilter = searchParams.get("domain");
  const tagFilter = searchParams.get("tag");

  if (!query) {
    return NextResponse.json({ results: [], total: 0, query: "" });
  }

  const results: SearchResult[] = [];

  for (const root of KNOWLEDGE_ROOTS) {
    const rootPath = path.join(ROOT, root);
    if (!fs.existsSync(rootPath)) continue;

    const walk = (dir: string): void => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith(".")) {
            walk(entryPath);
          } else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))) {
            const fm = extractFrontmatter(entryPath);
            const stat = fs.statSync(entryPath);
            const relPath = path.relative(ROOT, entryPath);

            const fileType = (fm?.type as string) || "concept";
            const domain = relPath.split("/")[0];

            if (typeFilter && fileType !== typeFilter) return;
            if (domainFilter && domain !== domainFilter) return;
            if (tagFilter && !((fm?.tags as string[]) || []).includes(tagFilter)) return;

            const name = (fm?.name as string) || entry.name.replace(/\.mdx?$/, "");
            const desc = (fm?.description as string) || (fm?.headline as string) || "";
            const tags = ((fm?.tags as string[]) || []).join(" ");

            const searchText = `${name} ${desc} ${tags} ${entry.name} ${relPath}`;
            const score = fuzzyScore(query, searchText);

            if (score > 0) {
              const content = fs.readFileSync(entryPath, "utf-8");
              results.push({
                path: relPath,
                name,
                type: fileType,
                description: desc,
                domain,
                tags: (fm?.tags as string[]) || [],
                updated: (fm?.updated as string) || stat.mtime.toISOString().split("T")[0],
                score,
                snippet: getSnippet(content, query),
              });
            }
          }
        }
      } catch {}
    }

    walk(rootPath);
  }

  results.sort((a, b) => b.score - a.score);
  const limited = results.slice(0, 50);

  return NextResponse.json({
    results: limited,
    total: results.length,
    query,
  });
}
