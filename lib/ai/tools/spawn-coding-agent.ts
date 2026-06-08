/**
 * spawn-coding-agent tool — Handoff complex coding tasks to neptune-v2,
 * OR create brand-new projects with GitHub + Vercel deployment.
 *
 * Modes:
 *   - modify_existing: V2 sandbox clones repo, edits, commits, opens PR, deploys
 *   - new_project: Create GitHub repo, scaffold from template, push, deploy to Vercel
 *
 * Chat → spawnCodingAgent → (V2 sandbox | direct GitHub + Vercel REST) → live URL
 */
import { tool } from "ai";
import { z } from "zod";
import { readFile } from "fs/promises";
import path from "path";

const OPEN_AGENTS_URL =
  process.env.OPEN_AGENTS_URL || "https://neptune-v2.vercel.app";
const OPEN_AGENTS_API_KEY = process.env.OPEN_AGENTS_API_KEY || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_API = "https://api.github.com";
const VERCEL_API = "https://api.vercel.com";
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || "";
const TEMPLATE_DIR = "/home/neptune/templates/nextjs-16-shadcn";

interface V2SandboxResponse {
  sandboxId: string;
  status: string;
  streamUrl?: string;
  sessionId?: string;
  prUrl?: string;
  branchName?: string;
}

interface NewProjectResult {
  repoUrl: string;
  vercelProjectId: string;
  deploymentUrl: string | null;
  projectName: string;
}

// ─── Template Helpers ──────────────────────────────────────────────────────

const TEMPLATE_FILES = [
  "package.json",
  "tsconfig.json",
  "next.config.js",
  "postcss.config.mjs",
  ".gitignore",
  "README.md",
  "app/globals.css",
  "app/layout.tsx",
  "app/page.tsx",
  "lib/utils.ts",
];

interface TemplateVar {
  key: string;
  value: string;
}

function applyTemplateVars(content: string, vars: TemplateVar[]): string {
  let result = content;
  for (const v of vars) {
    result = result.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, "g"), v.value);
  }
  return result;
}

// ─── GitHub Helpers ────────────────────────────────────────────────────────

function githubHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

interface CreateRepoParams {
  name: string;
  description?: string;
  private?: boolean;
}

async function createGitHubRepo(params: CreateRepoParams): Promise<{
  htmlUrl: string;
  cloneUrl: string;
  owner: string;
  name: string;
}> {
  const body: Record<string, unknown> = {
    name: params.name,
    private: params.private ?? false,
    auto_init: true,
  };
  if (params.description) {
    body.description = params.description;
  }

  // Get authenticated user first
  const userRes = await fetch(`${GITHUB_API}/user`, {
    headers: githubHeaders(),
  });
  if (!userRes.ok) {
    throw new Error(
      `GitHub user fetch failed: ${userRes.status} ${await userRes.text()}`
    );
  }
  const userData = (await userRes.json()) as { login: string };
  const owner = userData.login;

  const res = await fetch(`${GITHUB_API}/user/repos`, {
    method: "POST",
    headers: githubHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub create repo failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    html_url: string;
    clone_url: string;
    name: string;
    owner: { login: string };
  };

  return {
    htmlUrl: data.html_url,
    cloneUrl: data.clone_url,
    owner: data.owner.login,
    name: data.name,
  };
}

async function uploadFileToRepo(params: {
  owner: string;
  repo: string;
  filePath: string;
  content: string;
  commitMessage?: string;
}): Promise<void> {
  const { owner, repo, filePath, content, commitMessage } = params;
  const encoded = Buffer.from(content, "utf-8").toString("base64");

  const body = {
    message: commitMessage || `Add ${filePath}`,
    content: encoded,
  };

  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method: "PUT",
      headers: githubHeaders(),
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `GitHub upload ${filePath} failed: ${res.status} ${err}`
    );
  }
}

// ─── Vercel Helpers ───────────────────────────────────────────────────────

function vercelHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function createVercelProject(params: {
  name: string;
  gitRepoOwner: string;
  gitRepoName: string;
  framework?: string;
}): Promise<{ id: string; link: string }> {
  const body: Record<string, unknown> = {
    name: params.name,
    framework: params.framework || "nextjs",
    gitRepository: {
      type: "github",
      repo: `${params.gitRepoOwner}/${params.gitRepoName}`,
    },
  };

  const res = await fetch(`${VERCEL_API}/v10/projects`, {
    method: "POST",
    headers: vercelHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel create project failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { id: string; link: string };
  return { id: data.id, link: data.link };
}

async function pollDeployReady(
  projectId: string,
  maxWaitMs: number = 120000
): Promise<{ url: string | null; state: string }> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `${VERCEL_API}/v7/deployments?projectId=${projectId}&limit=1`,
      { headers: vercelHeaders() }
    );
    if (!res.ok) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    const data = (await res.json()) as {
      deployments: Array<{ url: string; state: string }>;
    };
    const latest = data.deployments?.[0];
    if (!latest) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    if (latest.state === "READY") {
      return { url: latest.url, state: "READY" };
    }
    if (latest.state === "ERROR") {
      return { url: latest.url, state: "ERROR" };
    }

    await new Promise((r) => setTimeout(r, 5000));
  }

  return { url: null, state: "TIMEOUT" };
}

// ─── Main Tool ─────────────────────────────────────────────────────────────

export const spawnCodingAgent = tool({
  description:
    "Hand off a complex multi-step coding task. Two modes: " +
    "'modify_existing' sends to neptune-v2 sandbox to clone repo, fix, commit, open PR, deploy. " +
    "'new_project' creates a GitHub repo, scaffolds Next.js 16 + shadcn, pushes, and deploys to Vercel — " +
    "returns repoUrl, vercelProjectId, and deploymentUrl.",
  inputSchema: z.object({
    mode: z
      .enum(["modify_existing", "new_project"])
      .default("modify_existing")
      .describe(
        "Operation mode: 'modify_existing' for existing repos, 'new_project' to create and deploy a brand-new project"
      ),

    // ── modify_existing params ──
    goal: z
      .string()
      .describe("Natural language description of what to build/fix."),
    repoOwner: z
      .string()
      .default("abhiswami2121")
      .describe("GitHub repo owner"),
    repoName: z
      .string()
      .optional()
      .describe("Target repository name (for modify_existing)"),
    baseBranch: z
      .string()
      .default("main")
      .describe("Base branch to branch from"),
    createPR: z
      .boolean()
      .default(true)
      .describe("Whether to create a pull request"),
    deployToVercel: z
      .boolean()
      .default(false)
      .describe("Whether to deploy to Vercel"),

    // ── new_project params ──
    projectName: z
      .string()
      .optional()
      .describe("Name for the new project/repo (for new_project mode)"),
    projectTitle: z
      .string()
      .optional()
      .describe("Human-readable project title (for template)"),
    projectDescription: z
      .string()
      .optional()
      .describe("Short description for the project README and GitHub repo"),
    stack: z
      .enum(["nextjs-16"])
      .default("nextjs-16")
      .describe("Tech stack template to use"),
    isPrivate: z
      .boolean()
      .default(false)
      .describe("Whether the new repo should be private"),

    // ── Shared ──
    runtime: z
      .enum(["node", "python"])
      .default("node")
      .describe("Runtime to use"),
    sessionId: z
      .string()
      .optional()
      .describe("Existing v2 session ID to resume"),
  }),
  execute: async (params) => {
    const mode = params.mode || "modify_existing";

    // ── MODIFY_EXISTING — V2 Sandbox Handoff ──────────────────────────
    if (mode === "modify_existing") {
      const { goal, repoOwner, repoName, baseBranch, createPR, deployToVercel, runtime, sessionId } = params;

      if (!repoName) {
        throw new Error("repoName is required for modify_existing mode");
      }

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
          vercelToken: VERCEL_TOKEN,
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
        mode: "modify_existing",
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
    }

    // ── NEW_PROJECT — Direct GitHub + Vercel API ──────────────────────
    const {
      goal,
      projectName,
      projectTitle,
      projectDescription,
      stack,
      isPrivate,
    } = params;

    const safeProjectName =
      projectName ||
      goal
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50) ||
      "neptune-project";

    const safeTitle = projectTitle || goal.slice(0, 80) || safeProjectName;
    const safeDescription =
      projectDescription ||
      `A Next.js project scaffolded by Neptune Chat: ${goal.slice(0, 100)}`;

    console.log(
      `[spawnCodingAgent] new_project: ${safeProjectName} — "${safeTitle}"`
    );

    // 1. Create GitHub repo
    const repo = await createGitHubRepo({
      name: safeProjectName,
      description: safeDescription,
      private: isPrivate,
    });

    console.log(`[spawnCodingAgent] Repo created: ${repo.htmlUrl}`);

    // 2. Upload template files
    const templateVars: TemplateVar[] = [
      { key: "PROJECT_NAME", value: safeProjectName },
      { key: "PROJECT_TITLE", value: safeTitle },
      { key: "PROJECT_DESCRIPTION", value: safeDescription },
      { key: "PAGE_HEADING", value: safeTitle },
      { key: "PAGE_SUBTITLE", value: safeDescription },
      { key: "GITHUB_OWNER", value: repo.owner },
    ];

    const templateRoot = path.join(TEMPLATE_DIR);

    for (const filePath of TEMPLATE_FILES) {
      try {
        const fullPath = path.join(templateRoot, filePath);
        let content = await readFile(fullPath, "utf-8");
        content = applyTemplateVars(content, templateVars);

        await uploadFileToRepo({
          owner: repo.owner,
          repo: repo.name,
          filePath,
          content,
          commitMessage: `Scaffold: ${filePath} from Next.js 16 + shadcn template`,
        });

        console.log(`[spawnCodingAgent] Uploaded: ${filePath}`);
      } catch (err) {
        console.error(
          `[spawnCodingAgent] Failed to upload ${filePath}:`,
          err
        );
      }
    }

    // 3. Create Vercel project linked to GitHub
    let vercelProjectId = "";
    let deploymentUrl: string | null = null;

    try {
      const vercelProject = await createVercelProject({
        name: safeProjectName,
        gitRepoOwner: repo.owner,
        gitRepoName: repo.name,
        framework: "nextjs",
      });
      vercelProjectId = vercelProject.id;

      console.log(
        `[spawnCodingAgent] Vercel project created: ${vercelProjectId} — ${vercelProject.link}`
      );

      // 4. Poll for first deploy (Vercel auto-deploys on git push)
      const deployResult = await pollDeployReady(vercelProjectId);
      deploymentUrl = deployResult.url
        ? `https://${deployResult.url}`
        : null;
    } catch (err) {
      console.error(
        "[spawnCodingAgent] Vercel project creation failed (non-fatal):",
        err
      );
    }

    const result: NewProjectResult = {
      repoUrl: repo.htmlUrl,
      vercelProjectId,
      deploymentUrl,
      projectName: safeProjectName,
    };

    return {
      mode: "new_project",
      ...result,
      message:
        `New project "${safeTitle}" created!\n` +
        `📁 GitHub: ${repo.htmlUrl}\n` +
        (vercelProjectId
          ? `🚀 Vercel: ${deploymentUrl || "deploying..."}`
          : `⚠️ Vercel project creation failed — deploy manually at ${repo.htmlUrl}`),
    };
  },
});
