/**
 * app/(chat)/playbook-architecture/page.tsx
 * Phase 21 V3: Browsable Playbook Architecture KB
 *
 * Server component that reads /docs/playbook-architecture/ and renders
 * all 12 KB documents with YAML frontmatter parsing.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Playbook Architecture KB",
  description: "Fractal Library + Router-as-Map — complete architecture knowledge base",
};

interface KBDoc {
  slug: string;
  title: string;
  version: string;
  lastUpdated: string;
  status: string;
  content: string;
  size: number;
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const [key, ...rest] = line.split(":");
    if (key && rest.length > 0) {
      result[key.trim()] = rest.join(":").trim().replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

function loadKBDocs(): KBDoc[] {
  const docsDir = join(process.cwd(), "docs", "playbook-architecture");
  const docs: KBDoc[] = [];

  try {
    const files = readdirSync(docsDir)
      .filter((f) => f.endsWith(".md"))
      .sort();

    for (const file of files) {
      const content = readFileSync(join(docsDir, file), "utf-8");
      const frontmatter = parseFrontmatter(content);
      const bodyContent = content.replace(/^---\n[\s\S]*?\n---\n?/, "");

      docs.push({
        slug: file.replace(".md", ""),
        title: frontmatter.title ?? file.replace(".md", ""),
        version: frontmatter.version ?? "1.0.0",
        lastUpdated: frontmatter.last_updated ?? "2026-06-15",
        status: frontmatter.status ?? "ACTIVE",
        content: bodyContent,
        size: content.length,
      });
    }
  } catch {
    return [];
  }

  return docs;
}

export default function PlaybookArchitecturePage() {
  const docs = loadKBDocs();

  if (docs.length === 0) {
    return notFound();
  }

  const totalSize = docs.reduce((sum, d) => sum + d.size, 0);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Playbook Architecture Knowledge Base
        </h1>
        <p className="text-muted-foreground">
          Fractal Library + Router-as-Map + Swarm Mode | Phase 21 V3
        </p>
        <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
          <span>{docs.length} documents</span>
          <span>{(totalSize / 1024).toFixed(1)} KB total</span>
          <span>Updated: 2026-06-15</span>
        </div>
      </div>

      {/* Document Cards */}
      <div className="grid gap-6">
        {docs.map((doc) => (
          <div
            key={doc.slug}
            className="border rounded-lg p-6 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-xl font-semibold">{doc.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  v{doc.version} · {doc.lastUpdated} · {doc.status}
                </p>
              </div>
              <span className="text-xs bg-secondary px-2 py-1 rounded">
                {(doc.size / 1024).toFixed(1)} KB
              </span>
            </div>

            {/* Content Preview */}
            <div className="prose prose-sm dark:prose-invert max-w-none max-h-64 overflow-hidden relative">
              <div
                dangerouslySetInnerHTML={{
                  __html: doc.content
                    .split("\n")
                    .slice(0, 20)
                    .join("\n")
                    .replace(/^###? /gm, "**")
                    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                    .replace(/`(.+?)`/g, "<code>$1</code>")
                    .replace(/\n/g, "<br/>"),
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent" />
            </div>

            {/* Link to raw doc */}
            <a
              href={`https://raw.githubusercontent.com/abhiswami2121/neptune-chat/main/docs/playbook-architecture/${doc.slug}.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline mt-3 inline-block"
            >
              View raw →
            </a>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-8 p-4 bg-secondary/30 rounded-lg text-sm text-muted-foreground">
        <p>
          <strong>Canonical entry point:</strong>{" "}
          <code className="bg-secondary px-1 rounded">
            connectors/neptune/skills/custom-skills/playbook-skills/PLAYBOOK-ROUTER.md
          </code>
        </p>
        <p className="mt-1">
          Triple-mirrored: Repository · Cortex (jarvis/cortex/playbook-architecture/) · Chat (this page)
        </p>
        <p className="mt-1">
          Knowledge graph: POST each doc to{" "}
          <code className="bg-secondary px-1 rounded">/api/wiki/ingest</code> for queryable entities
        </p>
      </div>
    </div>
  );
}
