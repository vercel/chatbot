import { tool } from "ai";
import { z } from "zod";

const WIKI_API = process.env.HERMES_API_URL || "http://187.127.250.171:8102";
const WIKI_KEY = process.env.HERMES_KEY || "";

async function wikiApiCall(
  action: string,
  payload: Record<string, unknown> = {}
) {
  const res = await fetch(`${WIKI_API}/api/wiki/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WIKI_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "Unknown error");
    throw new Error(`Wiki API error (${action}): ${res.status} ${err}`);
  }
  return res.json();
}

/** Ingest a URL, text, or file into the wiki */
export const ingestSource = tool({
  description:
    "Ingest a source (URL, text, or file path) into the Karpathy Wiki. The agent will synthesize a summary page, update the index, and log the operation.",
  inputSchema: z.object({
    source: z
      .string()
      .describe("URL, plain text content, or file path to ingest"),
    sourceType: z.enum(["url", "text", "file"]).describe("Type of the source"),
    title: z
      .string()
      .optional()
      .describe("Optional title for the generated page"),
    category: z
      .enum(["concepts", "connectors", "entities", "projects", "operations"])
      .optional()
      .describe("Wiki category to file under"),
  }),
  execute: async ({ source, sourceType, title, category }) => {
    return wikiApiCall("ingest", { source, sourceType, title, category });
  },
});

/** Query the wiki and return relevant pages */
export const queryWiki = tool({
  description:
    "Query the Karpathy Wiki for relevant pages. Returns matching pages with content summaries and cross-references.",
  inputSchema: z.object({
    query: z.string().describe("Search query for the wiki"),
    category: z
      .enum([
        "all",
        "concepts",
        "connectors",
        "entities",
        "projects",
        "operations",
      ])
      .default("all")
      .describe("Category to search in"),
    maxResults: z.number().default(5).describe("Maximum number of results"),
  }),
  execute: async ({ query, category, maxResults }) => {
    return wikiApiCall("query", { query, category, maxResults });
  },
});

/** Lint the wiki for issues */
export const lintWiki = tool({
  description:
    "Lint the Karpathy Wiki for contradictions, stale pages (>90 days), orphan pages, and schema compliance issues.",
  inputSchema: z.object({
    fix: z
      .boolean()
      .default(false)
      .describe("If true, attempt to fix minor issues automatically"),
  }),
  execute: async ({ fix }) => {
    return wikiApiCall("lint", { fix });
  },
});

/** Write or update a wiki page */
export const writeWikiPage = tool({
  description:
    "Create or update a page in the Karpathy Wiki. Updates the index and log automatically.",
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        "Wiki page path relative to /home/hermes/knowledge-base/wiki/ (e.g., concepts/my-page.md)"
      ),
    title: z.string().describe("Page title"),
    content: z.string().describe("Page content in markdown"),
    category: z
      .enum(["concepts", "connectors", "entities", "projects", "operations"])
      .describe("Wiki category"),
    tags: z.array(z.string()).optional().describe("Tags for the page"),
  }),
  execute: async ({ path, title, content, category, tags }) => {
    return wikiApiCall("write", {
      path,
      title,
      content,
      category,
      tags: tags || [],
    });
  },
});

/** Rebuild index.md from filesystem scan */
export const updateIndex = tool({
  description:
    "Rebuild the wiki index catalog by scanning the filesystem. Updates index.md with all current pages and one-line summaries.",
  inputSchema: z.object({
    dryRun: z
      .boolean()
      .default(false)
      .describe("If true, preview changes without writing"),
  }),
  execute: async ({ dryRun }) => {
    return wikiApiCall("update-index", { dryRun });
  },
});
