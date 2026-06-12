/**
 * Linear Connector — Zod schemas for all tool inputs and outputs.
 *
 * Linear tools call the Linear GraphQL API directly.
 */

import { z } from "zod";

export const listIssuesSchema = {
  input: z.object({
    teamId: z.string().optional(),
    status: z.string().optional(),
    assigneeName: z.string().optional(),
    limit: z.number().default(20),
  }),
  output: z.object({
    issues: z.array(z.record(z.unknown())).optional(),
    count: z.number().optional(),
  }),
};

export const createIssueSchema = {
  input: z.object({
    teamId: z.string().describe("Linear team ID"),
    title: z.string().describe("Issue title"),
    description: z.string().optional().describe("Markdown description"),
    priority: z.number().min(0).max(4).optional().describe("0=urgent, 4=low"),
  }),
  output: z.object({
    id: z.string().optional(),
    identifier: z.string().optional(),
    url: z.string().optional(),
    title: z.string().optional(),
  }),
};

export const searchIssuesSchema = {
  input: z.object({
    query: z.string().describe("Search query or identifier (e.g., 'NMI-123')"),
    limit: z.number().default(10),
  }),
  output: z.object({
    issues: z.array(z.record(z.unknown())).optional(),
    count: z.number().optional(),
  }),
};

export const listProjectsSchema = {
  input: z.object({
    teamId: z.string().optional(),
  }),
  output: z.object({
    projects: z.array(z.record(z.unknown())).optional(),
    count: z.number().optional(),
  }),
};

export type ListIssuesInput = z.infer<typeof listIssuesSchema.input>;
export type CreateIssueInput = z.infer<typeof createIssueSchema.input>;
export type SearchIssuesInput = z.infer<typeof searchIssuesSchema.input>;
export type ListProjectsInput = z.infer<typeof listProjectsSchema.input>;

export const linearSchemas = {
  listIssues: listIssuesSchema,
  createIssue: createIssueSchema,
  searchIssues: searchIssuesSchema,
  listProjects: listProjectsSchema,
} as const;
