/**
 * GitHub Connector — Zod schemas for all tool inputs and outputs.
 */

import { z } from "zod";

export const searchCodeSchema = {
  input: z.object({
    query: z.string().describe("GitHub code search query"),
    repo: z.string().default("abhiswami2121").describe("Repo (owner or owner/repo)"),
  }),
  output: z.object({
    totalCount: z.number().optional(),
    items: z.array(z.record(z.unknown())).optional(),
  }),
};

export const getFileSchema = {
  input: z.object({
    repo: z.string().describe("Repository name (e.g., 'neptune-v2')"),
    path: z.string().describe("File path (e.g., 'README.md')"),
    ref: z.string().default("main").describe("Branch or commit SHA"),
  }),
  output: z.object({
    content: z.string().optional(),
    path: z.string().optional(),
    sha: z.string().optional(),
    size: z.number().optional(),
  }),
};

export const listPRsSchema = {
  input: z.object({
    repo: z.string().optional().describe("Filter by repo (default: all)"),
    state: z.enum(["open", "closed", "all"]).default("open"),
    limit: z.number().default(10),
  }),
  output: z.object({
    prs: z.array(z.record(z.unknown())).optional(),
    count: z.number().optional(),
  }),
};

export const createPRSchema = {
  input: z.object({
    repo: z.string().describe("Repository name"),
    title: z.string().describe("PR title (max 70 chars)"),
    head: z.string().describe("Head branch name"),
    base: z.string().default("main").describe("Base branch"),
    body: z.string().optional().describe("PR description (markdown)"),
  }),
  output: z.object({
    url: z.string().optional(),
    number: z.number().optional(),
    state: z.string().optional(),
  }),
};

export const spawnCodingAgentSchema = {
  input: z.object({
    goal: z.string().describe("Task description for V2 coding agent"),
    repoOwner: z.string().default("abhiswami2121"),
    repoName: z.string().describe("Repository name"),
    baseBranch: z.string().default("main"),
    createPR: z.boolean().default(true),
  }),
  output: z.object({
    sessionId: z.string().optional(),
    sessionUrl: z.string().optional(),
    sseUrl: z.string().optional(),
  }),
};

export const listReposSchema = {
  input: z.object({
    type: z.enum(["all", "owner", "public", "private", "member"]).default("all"),
    sort: z.enum(["created", "updated", "pushed", "full_name"]).default("updated"),
    direction: z.enum(["asc", "desc"]).default("desc"),
    limit: z.number().optional(),
  }),
  output: z.object({
    total_count: z.number(),
    fetched_all: z.boolean(),
    repositories: z.array(
      z.object({
        name: z.string(),
        full_name: z.string(),
        private: z.boolean(),
        description: z.string().nullable(),
        html_url: z.string(),
        language: z.string().nullable(),
        updated_at: z.string(),
        default_branch: z.string(),
      })
    ),
  }),
};

export type SearchCodeInput = z.infer<typeof searchCodeSchema.input>;
export type GetFileInput = z.infer<typeof getFileSchema.input>;
export type ListPRsInput = z.infer<typeof listPRsSchema.input>;
export type CreatePRInput = z.infer<typeof createPRSchema.input>;
export type SpawnCodingAgentInput = z.infer<typeof spawnCodingAgentSchema.input>;
export type ListReposInput = z.infer<typeof listReposSchema.input>;

export const githubSchemas = {
  searchCode: searchCodeSchema,
  getFile: getFileSchema,
  listPRs: listPRsSchema,
  createPR: createPRSchema,
  spawnCodingAgent: spawnCodingAgentSchema,
  listRepos: listReposSchema,
} as const;
