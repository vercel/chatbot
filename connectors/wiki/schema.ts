/**
 * Wiki (Karpathy Wiki) Connector — Zod schemas for all tool inputs and outputs.
 *
 * Wiki tools proxy through the Hermès API at HERMES_API/api/wiki/{action}.
 */

import { z } from "zod";

const WIKI_CATEGORIES = [
  "concepts", "connectors", "entities", "projects", "operations",
] as const;

export const ingestSourceSchema = {
  input: z.object({
    source: z.string().describe("URL, plain text, or file path to ingest"),
    sourceType: z.enum(["url", "text", "file"]),
    title: z.string().optional(),
    category: z.enum(WIKI_CATEGORIES).optional(),
  }),
  output: z.object({
    ingested: z.boolean().optional(),
    sourceId: z.string().optional(),
    title: z.string().optional(),
  }),
};

export const queryWikiSchema = {
  input: z.object({
    query: z.string().describe("Search query"),
    category: z
      .enum(["all", ...WIKI_CATEGORIES] as [string, ...string[]])
      .default("all"),
    maxResults: z.number().default(5),
  }),
  output: z.object({
    results: z.array(z.record(z.unknown())).optional(),
    totalFound: z.number().optional(),
  }),
};

export const lintWikiSchema = {
  input: z.object({
    fix: z.boolean().default(false),
  }),
  output: z.object({
    issues: z.array(z.record(z.unknown())).optional(),
    fixedCount: z.number().optional(),
    totalIssues: z.number().optional(),
  }),
};

export const writeWikiPageSchema = {
  input: z.object({
    path: z.string().describe("Wiki page path relative to /wiki/"),
    title: z.string().describe("Page title"),
    content: z.string().describe("Markdown content"),
    category: z.enum(WIKI_CATEGORIES),
    tags: z.array(z.string()).optional(),
  }),
  output: z.object({
    written: z.boolean().optional(),
    path: z.string().optional(),
  }),
};

export const updateIndexSchema = {
  input: z.object({
    dryRun: z.boolean().default(false),
  }),
  output: z.object({
    indexed: z.number().optional(),
    updated: z.number().optional(),
  }),
};

export type IngestSourceInput = z.infer<typeof ingestSourceSchema.input>;
export type QueryWikiInput = z.infer<typeof queryWikiSchema.input>;
export type LintWikiInput = z.infer<typeof lintWikiSchema.input>;
export type WriteWikiPageInput = z.infer<typeof writeWikiPageSchema.input>;
export type UpdateIndexInput = z.infer<typeof updateIndexSchema.input>;

export const wikiSchemas = {
  ingestSource: ingestSourceSchema,
  queryWiki: queryWikiSchema,
  lintWiki: lintWikiSchema,
  writeWikiPage: writeWikiPageSchema,
  updateIndex: updateIndexSchema,
} as const;
