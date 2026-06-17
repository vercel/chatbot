/**
 * Knowledge Parser — Parse NKS files and OKF bundles
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 — Reference Implementation
 * Parses markdown files with YAML frontmatter and extracts
 * structured data for the knowledge graph visualizer.
 */

import fs from "node:fs";
import path from "node:path";

// ============================================================================
// TYPES
// ============================================================================

export interface KnowledgeFrontmatter {
  type: string;
  name: string;
  description?: string;
  version?: string;
  domain?: string;
  tags?: string[];
  status?: string;
  mcp?: string;
  [key: string]: unknown;
}

export interface KnowledgeNode {
  id: string;
  name: string;
  type: string;
  description: string;
  version: string;
  domain?: string;
  path: string;
  frontmatter: KnowledgeFrontmatter;
  linkCount: number;
  lastModified: Date;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  label: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    byType: Record<string, number>;
    byDomain: Record<string, number>;
    generatedAt: string;
  };
}

export interface SearchResult {
  node: KnowledgeNode;
  score: number;
  matchField: "name" | "description" | "tags" | "domain" | "type";
}

// ============================================================================
// CORTEX ROOT
// ============================================================================

const CORTEX_ROOT = path.resolve(process.cwd(), "jarvis/cortex");

// ============================================================================
// FRONTMATTER PARSER
// ============================================================================

export function parseFrontmatter(
  content: string
): { frontmatter: KnowledgeFrontmatter | null; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)?$/);
  if (!match) {
    return { frontmatter: null, body: content };
  }

  const yamlBlock = match[1];
  const body = match[2] || "";
  const fm: Record<string, unknown> = {};

  const lines = yamlBlock.split("\n");
  let currentKey = "";
  let inList = false;
  const listItems: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("- ")) {
      if (!inList) inList = true;
      listItems.push(trimmed.slice(2).trim());
      continue;
    }

    if (inList && currentKey) {
      fm[currentKey] = [...listItems];
      listItems.length = 0;
      inList = false;
    }

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      currentKey = trimmed.slice(0, colonIdx).trim();
      let value = trimmed.slice(colonIdx + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (value === "true") fm[currentKey] = true;
      else if (value === "false") fm[currentKey] = false;
      else if (!isNaN(Number(value)) && value !== "")
        fm[currentKey] = Number(value);
      else fm[currentKey] = value;
    }
  }

  if (inList && currentKey) {
    fm[currentKey] = [...listItems];
  }

  return { frontmatter: fm as KnowledgeFrontmatter, body };
}

// ============================================================================
// LINK EXTRACTOR
// ============================================================================

export function extractLinks(
  content: string,
  filePath: string
): { target: string; label: string; resolved: string }[] {
  const links: { target: string; label: string; resolved: string }[] = [];
  const regex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const label = match[1];
    const target = match[2];

    // Skip external links and fragment-only links
    if (target.startsWith("http") || target.startsWith("#")) continue;

    const resolved = path.resolve(path.dirname(filePath), target.split("#")[0]);
    links.push({ target, label, resolved });
  }

  return links;
}

// ============================================================================
// GRAPH BUILDER
// ============================================================================

export function buildKnowledgeGraph(
  rootDir: string = CORTEX_ROOT
): KnowledgeGraph {
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];
  const nodeIds = new Set<string>();
  const byType: Record<string, number> = {};
  const byDomain: Record<string, number> = {};

  function walk(dirPath: string, relativePath: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relPath = relativePath
        ? `${relativePath}/${entry.name}`
        : entry.name;

      if (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        !entry.name.startsWith(".")
      ) {
        try {
          const stats = fs.statSync(fullPath);
          const content = fs.readFileSync(fullPath, "utf-8");
          const { frontmatter, body } = parseFrontmatter(content);

          const fm = frontmatter || { type: "concept", name: entry.name.replace(".md", "") };
          const nodeId = relPath;

          if (nodeIds.has(nodeId)) continue;
          nodeIds.add(nodeId);

          // Count links
          const links = extractLinks(content, fullPath);
          const resolvedLinks = links.filter((l) => fs.existsSync(l.resolved));

          for (const link of resolvedLinks) {
            const targetRel = path.relative(rootDir, link.resolved);
            edges.push({
              source: nodeId,
              target: targetRel,
              label: link.label,
            });
          }

          // Track stats
          const type = fm.type || "concept";
          byType[type] = (byType[type] || 0) + 1;

          if (fm.domain) {
            byDomain[fm.domain] = (byDomain[fm.domain] || 0) + 1;
          }

          nodes.push({
            id: nodeId,
            name: fm.name || entry.name.replace(".md", ""),
            type,
            description: fm.description || "",
            version: String(fm.version || "0.1.0"),
            domain: fm.domain as string | undefined,
            path: relPath,
            frontmatter: fm,
            linkCount: resolvedLinks.length,
            lastModified: stats.mtime,
          });
        } catch {
          // Skip unreadable files
        }
      } else if (
        entry.isDirectory() &&
        !entry.name.startsWith(".")
      ) {
        walk(fullPath, relPath);
      }
    }
  }

  walk(rootDir, "");

  return {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      byType,
      byDomain,
      generatedAt: new Date().toISOString(),
    },
  };
}

// ============================================================================
// SEARCH
// ============================================================================

export function searchKnowledge(
  graph: KnowledgeGraph,
  query: string
): SearchResult[] {
  if (!query || query.length < 1) return [];

  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const node of graph.nodes) {
    let score = 0;
    let matchField: SearchResult["matchField"] = "name";

    // Exact name match
    if (node.name.toLowerCase() === lowerQuery) {
      score += 100;
      matchField = "name";
    }
    // Name contains
    else if (node.name.toLowerCase().includes(lowerQuery)) {
      score += 50;
      matchField = "name";
    }

    // Type match
    if (node.type.toLowerCase() === lowerQuery) {
      score += 40;
      matchField = "type";
    }

    // Description contains
    if (node.description.toLowerCase().includes(lowerQuery)) {
      score += 20;
      if (matchField === "name") matchField = "description";
    }

    // Domain match
    if (node.domain?.toLowerCase() === lowerQuery) {
      score += 30;
      matchField = "domain";
    }

    // Tag match
    if (node.frontmatter.tags?.some((t) => t.toLowerCase().includes(lowerQuery))) {
      score += 15;
      matchField = "tags";
    }

    // Word boundary match
    const words = node.name.toLowerCase().split(/[\s-_/]+/);
    if (words.some((w) => w === lowerQuery)) {
      score += 60;
    }

    if (score > 0) {
      results.push({ node, score, matchField });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

// ============================================================================
// FILTER
// ============================================================================

export function filterNodes(
  graph: KnowledgeGraph,
  options: {
    type?: string;
    domain?: string;
    tag?: string;
    status?: string;
    searchQuery?: string;
  }
): KnowledgeNode[] {
  let filtered = [...graph.nodes];

  if (options.type && options.type !== "ALL") {
    filtered = filtered.filter((n) => n.type === options.type);
  }

  if (options.domain) {
    filtered = filtered.filter((n) => n.domain === options.domain);
  }

  if (options.tag) {
    filtered = filtered.filter((n) =>
      n.frontmatter.tags?.some((t) => t === options.tag)
    );
  }

  if (options.status) {
    filtered = filtered.filter((n) => n.frontmatter.status === options.status);
  }

  if (options.searchQuery) {
    const searchResults = searchKnowledge(
      { ...graph, nodes: filtered },
      options.searchQuery
    );
    filtered = searchResults.map((r) => r.node);
  }

  return filtered;
}

// ============================================================================
// GET FILE CONTENT
// ============================================================================

export function getKnowledgeFileContent(relativePath: string): {
  content: string;
  frontmatter: KnowledgeFrontmatter | null;
  exists: boolean;
} {
  const fullPath = path.join(CORTEX_ROOT, relativePath);

  if (!fs.existsSync(fullPath)) {
    return { content: "", frontmatter: null, exists: false };
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(content);

  return {
    content: body,
    frontmatter,
    exists: true,
  };
}

// ============================================================================
// NODE STATS
// ============================================================================

export function getNodeStats(node: KnowledgeNode, graph: KnowledgeGraph): {
  incomingLinks: KnowledgeEdge[];
  outgoingLinks: KnowledgeEdge[];
  relatedNodes: KnowledgeNode[];
} {
  const incomingLinks = graph.edges.filter((e) => e.target === node.id);
  const outgoingLinks = graph.edges.filter((e) => e.source === node.id);

  const relatedIds = new Set<string>();
  for (const e of incomingLinks) relatedIds.add(e.source);
  for (const e of outgoingLinks) relatedIds.add(e.target);

  const relatedNodes = graph.nodes.filter((n) => relatedIds.has(n.id));

  return { incomingLinks, outgoingLinks, relatedNodes };
}
