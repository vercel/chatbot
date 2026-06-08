/**
 * GET /api/wiki — List wiki page tree or read a page.
 * POST /api/wiki — Request wiki content by path.
 */
import type { NextRequest } from "next/server";

const WIKI_API_URL =
  process.env.HERMES_API_URL || "http://187.127.250.171:8102";
const WIKI_API_KEY = process.env.HERMES_KEY || "";

/** Static fallback tree for when VPS is unreachable */
const FALLBACK_TREE = {
  schema: [
    { name: "NEPTUNE-WIKI.md", path: "_schema/NEPTUNE-WIKI.md" },
    { name: "index.md", path: "_schema/index.md" },
    { name: "log.md", path: "_schema/log.md" },
  ],
  concepts: [
    { name: "Native Tools First", path: "concepts/native-tools-first.md" },
    { name: "NMI Golden Vault", path: "concepts/nmi-golden-vault.md" },
  ],
  connectors: [
    { name: "Slack", path: "connectors/slack.md" },
    { name: "NMI", path: "connectors/nmi.md" },
    { name: "Base44", path: "connectors/base44.md" },
  ],
  projects: [
    { name: "Neptune Chat", path: "projects/neptune-chat.md" },
    { name: "Neptune V2", path: "projects/neptune-v2.md" },
  ],
  operations: [
    { name: "Rolling Context", path: "operations/rolling-context.md" },
  ],
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.searchParams.get("path");

  // Try VPS bridge first
  if (WIKI_API_KEY) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      if (path) {
        // Read a specific page
        const res = await fetch(`${WIKI_API_URL}/api/wiki/read`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${WIKI_API_KEY}`,
          },
          body: JSON.stringify({ path }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) return Response.json(await res.json());
      } else {
        // List tree
        const res = await fetch(`${WIKI_API_URL}/api/wiki/tree`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${WIKI_API_KEY}`,
          },
          body: JSON.stringify({}),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) return Response.json(await res.json());
      }
    } catch {
      // Fall through to static fallback
    }
  }

  // Fallback: return static catalog
  if (path) {
    return Response.json({
      source: "fallback",
      content: `# ${path}\n\nStatic fallback — VPS bridge unavailable. Connect to view full content.`,
      path,
    });
  }
  return Response.json({
    source: "fallback",
    tree: FALLBACK_TREE,
  });
}
