import { tool } from "ai";
import { z } from "zod";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

async function ghApi(path: string, method = "GET", body?: unknown) {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN not configured");
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(body ? {} : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`GitHub API error: ${res.status} ${err}`);
  }
  return res.json();
}

export const searchCode = tool({
  description: "Search code across NewLeaf repositories on GitHub",
  inputSchema: z.object({
    query: z.string().describe("Search query (GitHub code search syntax)"),
    repo: z
      .string()
      .default("abhiswami2121")
      .describe("Repo to search (owner or owner/repo)"),
  }),
  execute: async ({ query, repo }) => {
    const repoQ = repo.includes("/") ? `repo:${repo}` : `org:${repo}`;
    return ghApi(
      `/search/code?q=${encodeURIComponent(`${query} ${repoQ}`)}&per_page=10`
    );
  },
});

export const getFile = tool({
  description: "Read a file from any abhiswami2121 repository",
  inputSchema: z.object({
    repo: z.string().describe("Repository name (e.g., 'neptune-v2')"),
    path: z.string().describe("File path (e.g., 'README.md')"),
    ref: z.string().default("main").describe("Branch or commit SHA"),
  }),
  execute: async ({ repo, path, ref }) => {
    return ghApi(`/repos/abhiswami2121/${repo}/contents/${path}?ref=${ref}`);
  },
});

export const listPRs = tool({
  description: "List open pull requests across repos",
  inputSchema: z.object({
    repo: z
      .string()
      .optional()
      .describe("Filter by repo (default: all abhiswami2121 repos)"),
    state: z.enum(["open", "closed", "all"]).default("open"),
    limit: z.number().default(10),
  }),
  execute: async ({ repo, state, limit }) => {
    if (repo) {
      return ghApi(
        `/repos/abhiswami2121/${repo}/pulls?state=${state}&per_page=${limit}`
      );
    }
    // Search across repos
    return ghApi(
      `/search/issues?q=is:pr+org:abhiswami2121+state:${state}&per_page=${limit}`
    );
  },
});

export const createPR = tool({
  description: "Open a new pull request on an abhiswami2121 repo",
  inputSchema: z.object({
    repo: z.string().describe("Repository name"),
    title: z.string().describe("PR title"),
    head: z.string().describe("Head branch name"),
    base: z.string().default("main").describe("Base branch"),
    body: z.string().optional().describe("PR description"),
  }),
  execute: async ({ repo, title, head, base, body }) => {
    return ghApi(`/repos/abhiswami2121/${repo}/pulls`, "POST", {
      title,
      head,
      base,
      body: body || "",
    });
  },
});
