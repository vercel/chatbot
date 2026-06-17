/**
 * GET /api/knowledge/graph — Returns knowledge graph nodes + edges.
 * Integrates with existing Graphify/Graphiti data for live KG relationships.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

const ROOT = process.cwd();

interface GraphNode {
  id: string;
  label: string;
  type: string;
  domain: string;
  path: string;
  size: number;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
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

function extractLinks(content: string): string[] {
  const links: string[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const url = match[2];
    if (!url.startsWith("http") && (url.endsWith(".md") || url.endsWith(".mdx"))) {
      links.push(url);
    }
  }
  return links;
}

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  const knowledgeRoots = ["connectors", "playbooks", "skills", "shared-skills", "workflows", "jarvis/cortex", "docs", "proofs"];

  for (const root of knowledgeRoots) {
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
            const content = fs.readFileSync(entryPath, "utf-8");

            const nodeId = relPath;
            nodeIds.add(nodeId);

            nodes.push({
              id: nodeId,
              label: (fm?.name as string) || entry.name.replace(/\.mdx?$/, ""),
              type: (fm?.type as string) || "concept",
              domain: relPath.split("/")[0],
              path: relPath,
              size: stat.size,
            });

            // Extract edges from cross-links
            const links = extractLinks(content);
            for (const link of links) {
              const resolved = path.normalize(path.join(path.dirname(relPath), link));
              edges.push({
                source: nodeId,
                target: resolved,
                relation: "references",
              });
            }

            // Extract edges from YAML frontmatter relationships
            const relatedSkills = fm?.associated_skills as string[] | undefined;
            const relatedConnectors = fm?.scope_connectors as string[] | undefined;

            if (relatedSkills) {
              for (const skill of relatedSkills) {
                edges.push({
                  source: nodeId,
                  target: `connectors/${skill}/SKILL.md`,
                  relation: "uses",
                });
              }
            }
            if (relatedConnectors) {
              for (const conn of relatedConnectors) {
                edges.push({
                  source: nodeId,
                  target: `connectors/${conn}/SKILL.md`,
                  relation: "depends-on",
                });
              }
            }
          }
        }
      } catch {}
    }

    walk(rootPath);
  }

  // Filter edges to only include valid targets
  const validEdges = edges.filter(e => nodeIds.has(e.target));

  return NextResponse.json({
    nodes,
    edges: validEdges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: validEdges.length,
      domains: Array.from(new Set(nodes.map(n => n.domain))),
    },
  });
}
