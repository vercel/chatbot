import { tool } from "ai";
import { z } from "zod";

const LINEAR_API = "https://api.linear.app/graphql";
const LINEAR_KEY = process.env.LINEAR_API_KEY || "";

async function linearQuery(
  query: string,
  variables: Record<string, unknown> = {}
) {
  if (!LINEAR_KEY) throw new Error("LINEAR_API_KEY not configured");
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINEAR_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(
      `Linear API error: ${json.errors?.[0]?.message || res.status}`
    );
  }
  return json.data;
}

export const listIssues = tool({
  description: "List Linear issues filtered by team, status, or assignee",
  inputSchema: z.object({
    teamId: z
      .string()
      .optional()
      .describe("Filter by team ID (e.g., Engineering Sprint)"),
    status: z
      .string()
      .optional()
      .describe("Filter by status name (e.g., 'In Progress')"),
    assigneeName: z
      .string()
      .optional()
      .describe("Filter by assignee display name"),
    limit: z.number().default(20).describe("Max results"),
  }),
  execute: async ({ teamId, status, assigneeName, limit }) => {
    const filter: Record<string, unknown> = {};
    if (status) filter.state = { name: { eq: status } };
    if (assigneeName) filter.assignee = { name: { contains: assigneeName } };
    if (teamId) filter.team = { id: { eq: teamId } };

    return linearQuery(
      `query ($filter: IssueFilter, $first: Int) {
        issues(filter: $filter, first: $first) {
          nodes { id identifier title state { name } assignee { name } url }
        }
      }`,
      { filter, first: limit }
    );
  },
});

export const createIssue = tool({
  description: "Create a new issue in Linear",
  inputSchema: z.object({
    teamId: z.string().describe("Team ID to create the issue in"),
    title: z.string().describe("Issue title"),
    description: z.string().optional().describe("Issue description (markdown)"),
    priority: z
      .number()
      .min(0)
      .max(4)
      .optional()
      .describe("Priority 0-4 (0=urgent)"),
  }),
  execute: async ({ teamId, title, description, priority }) => {
    return linearQuery(
      `mutation ($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier title url }
        }
      }`,
      { input: { teamId, title, description, priority } }
    );
  },
});

export const searchIssues = tool({
  description: "Search Linear issues by keyword or identifier",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search query (e.g., 'NMI-123' or 'billing bug')"),
    limit: z.number().default(10).describe("Max results"),
  }),
  execute: async ({ query, limit }) => {
    return linearQuery(
      `query ($q: String!, $first: Int) {
        searchIssues(query: $q, first: $first) {
          nodes { id identifier title state { name } assignee { name } url }
        }
      }`,
      { q: query, first: limit }
    );
  },
});

export const listProjects = tool({
  description: "List Linear projects with status",
  inputSchema: z.object({
    teamId: z.string().optional().describe("Filter by team ID"),
  }),
  execute: async ({ teamId }) => {
    const filter: Record<string, unknown> = {};
    if (teamId) filter.team = { id: { eq: teamId } };
    return linearQuery(
      `query ($filter: ProjectFilter) {
        projects(filter: $filter) {
          nodes { id name state description url }
        }
      }`,
      { filter }
    );
  },
});
