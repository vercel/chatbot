import { tool } from "ai";
import { z } from "zod";
import { secrets } from "@/secrets";

const GITHUB_TOKEN = secrets.github.token;

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

/** Parse GitHub Link header to get next page URL */
function parseLinkHeader(link: string | null): string | null {
  if (!link) return null;
  const match = link.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

/** Fetch all pages from a GitHub API endpoint, returning combined results */
async function ghApiPaginate(
  path: string,
  method = "GET",
  body?: unknown,
  perPage = 100
): Promise<unknown[]> {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN not configured");
  const separator = path.includes("?") ? "&" : "?";
  let url = `https://api.github.com${path}${separator}per_page=${perPage}`;
  const allItems: unknown[] = [];
  let pageCount = 0;

  while (url) {
    pageCount++;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      ...(body && method !== "GET" ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(
        `GitHub API error (page ${pageCount}): ${res.status} ${err}`
      );
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      allItems.push(...data);
    }
    // Check Link header for next page
    const linkHeader = res.headers.get("link");
    url = parseLinkHeader(linkHeader) || "";
  }

  return allItems;
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

export const listRepos = tool({
  description:
    "List ALL GitHub repositories for the authenticated user (abhiswami2121). Fetches all pages — returns the complete list including private repos, collaborators, and org repos. Use this when you need to know what repos exist.",
  inputSchema: z.object({
    type: z
      .enum(["all", "owner", "public", "private", "member"])
      .default("all")
      .describe("Filter by repo type. 'all' = everything you can access."),
    sort: z
      .enum(["created", "updated", "pushed", "full_name"])
      .default("updated")
      .describe("Sort order."),
    direction: z
      .enum(["asc", "desc"])
      .default("desc")
      .describe("Sort direction."),
    limit: z
      .number()
      .optional()
      .describe(
        "Max repos to return (for testing). Omit to get ALL repos."
      ),
  }),
  execute: async ({ type, sort, direction, limit }) => {
    const repos = await ghApiPaginate(
      `/user/repos?type=${type}&sort=${sort}&direction=${direction}`
    );
    const sliced = limit ? repos.slice(0, limit) : repos;
    return {
      total_count: repos.length,
      fetched_all: !limit || repos.length <= limit,
      repositories: sliced.map((r: any) => ({
        name: r.name,
        full_name: r.full_name,
        private: r.private,
        description: r.description,
        html_url: r.html_url,
        language: r.language,
        updated_at: r.updated_at,
        default_branch: r.default_branch,
      })),
    };
  },
});
