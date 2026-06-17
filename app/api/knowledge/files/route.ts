/**
 * GET /api/knowledge/files — List all knowledge files with metadata.
 * OKF v0.1 compatible. Supports filtering by type, domain, tags.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

const ROOT = process.cwd();
const KNOWLEDGE_ROOTS = ["connectors", "playbooks", "skills", "shared-skills", "workflows", "jarvis/cortex", "docs", "proofs"];

interface KnowledgeFile {
  path: string;
  name: string;
  type: string;
  description: string;
  version: string;
  updated: string;
  domain: string;
  tags: string[];
  size: number;
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

function collectFiles(): KnowledgeFile[] {
  const files: KnowledgeFile[] = [];

  for (const root of KNOWLEDGE_ROOTS) {
    const rootPath = path.join(ROOT, root);
    if (!fs.existsSync(rootPath)) continue;

    const walk = (dir: string): void => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
            walk(entryPath);
          } else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))) {
            const fm = extractFrontmatter(entryPath);
            const stat = fs.statSync(entryPath);
            const relPath = path.relative(ROOT, entryPath);

            files.push({
              path: relPath,
              name: (fm?.name as string) || (fm?.description as string) || entry.name.replace(/\.mdx?$/, ""),
              type: (fm?.type as string) || "concept",
              description: (fm?.description as string) || (fm?.headline as string) || "",
              version: (fm?.version as string) || "0.1.0",
              updated: (fm?.updated as string) || stat.mtime.toISOString().split("T")[0],
              domain: relPath.split("/")[0],
              tags: (fm?.tags as string[]) || [],
              size: stat.size,
            });
          }
        }
      } catch {}
    }

    walk(rootPath);
  }

  return files;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type");
  const domainFilter = searchParams.get("domain");
  const tagFilter = searchParams.get("tag");
  const limit = parseInt(searchParams.get("limit") || "500");

  let files = collectFiles();

  if (typeFilter) files = files.filter(f => f.type === typeFilter);
  if (domainFilter) files = files.filter(f => f.domain === domainFilter);
  if (tagFilter) files = files.filter(f => f.tags.includes(tagFilter));

  files = files.slice(0, limit);

  return NextResponse.json({
    total: files.length,
    files,
  });
}
