/**
 * spawn-coding-agent tool — Handoff complex coding tasks to neptune-v2.
 *
 * V2 is a sandbox coding agent (E2B-backed) that can:
 * - Clone any abhiswami2121 repo via GITHUB_TOKEN
 * - Write/edit code, run tests
 * - Commit changes, create branches, open pull requests
 * - Deploy to Vercel (via VERCEL_TOKEN)
 *
 * Chat → spawnCodingAgent → neptune-v2 sandbox → git commit → PR → deploy
 */
import { tool } from "ai";
import { z } from "zod";

const OPEN_AGENTS_URL =
  process.env.OPEN_AGENTS_URL || "https://neptune-v2.vercel.app";
const OPEN_AGENTS_API_KEY = process.env.OPEN_AGENTS_API_KEY || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

interface V2SandboxResponse {
  sandboxId: string;
  status: string;
  streamUrl?: string;
  sessionId?: string;
  prUrl?: string;
  branchName?: string;
}

export const spawnCodingAgent = tool({
  description:
    "Hand off a complex multi-step coding task to the neptune-v2 coding agent. " +
    "V2 has full sandbox access, git, and browser tools. It can clone any abhiswami2121 repo, " +
    "make changes, commit, open pull requests, and deploy to Vercel. " +
    "Use this for: fixing bugs across repos, adding features, refactoring, " +
    "or any task that requires git operations or sandbox execution.",
  inputSchema: z.object({
    goal: z
      .string()
      .describe(
        "Natural language description of what to build/fix. Be specific."
      ),
    repoOwner: z
      .string()
      .default("abhiswami2121")
      .describe("GitHub repo owner (default: abhiswami2121)"),
    repoName: z
      .string()
      .describe(
        "Target repository name (e.g. 'neptune-v2', 'neptune-chat', 'newleaf-financial')"
      ),
    baseBranch: z
      .string()
      .default("main")
      .describe("Base branch to branch from (default: main)"),
    runtime: z
      .enum(["node", "python"])
      .default("node")
      .describe("Runtime to use"),
    sessionId: z
      .string()
      .optional()
      .describe("Existing v2 session ID to resume"),
    createPR: z
      .boolean()
      .default(true)
      .describe("Whether to create a pull request after changes"),
    deployToVercel: z
      .boolean()
      .default(false)
      .describe("Whether to deploy to Vercel after PR is opened"),
  }),
  execute: async ({
    goal,
    repoOwner,
    repoName,
    baseBranch,
    runtime,
    sessionId,
    createPR,
    deployToVercel,
  }) => {
    const body: Record<string, unknown> = {
      goal,
      runtime,
      repo: {
        owner: repoOwner,
        name: repoName,
        baseBranch,
      },
      context: {
        githubToken: GITHUB_TOKEN,
        vercelToken: process.env.VERCEL_TOKEN || "",
        createPR,
        deployToVercel,
      },
    };

    if (sessionId) {
      body.sessionId = sessionId;
    }

    const res = await fetch(`${OPEN_AGENTS_URL}/api/sandbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPEN_AGENTS_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `V2 coding agent startup failed: ${res.status} ${errorText}`
      );
    }

    const data: V2SandboxResponse = await res.json();

    return {
      sandboxId: data.sandboxId,
      sessionId: data.sessionId || data.sandboxId,
      status: data.status,
      repo: `${repoOwner}/${repoName}`,
      branch: data.branchName || "pending",
      prUrl: data.prUrl || null,
      streamUrl:
        data.streamUrl ||
        `${OPEN_AGENTS_URL}/api/sandbox/status?sandboxId=${data.sandboxId}`,
      message:
        `V2 coding agent spawned for ${repoOwner}/${repoName}. ` +
        (createPR ? "Will create a PR when complete. " : "") +
        "Track progress via the stream URL.",
    };
  },
});
