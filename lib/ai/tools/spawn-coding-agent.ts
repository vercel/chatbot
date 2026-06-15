/**
 * spawn-coding-agent tool — v2 (Phase 19): Handoff complex coding tasks to neptune-v2,
 * OR create brand-new projects with GitHub + Vercel deployment.
 *
 * v2 NEW (Phase 19):
 *   - planId: Link to a planSession plan for context + tracking
 *   - skills: Array of skill names to inject into V2 system prompt
 *   - parallel: Fire multiple V2 sessions for large scopes (max 4)
 *   - validation_steps: Required V2 post-edit checks (build, lint, test, smoke-deploy)
 *
 * Modes:
 *   - modify_existing: V2 sandbox clones repo, edits, commits, opens PR, deploys
 *   - new_project: Create GitHub repo, scaffold from template, push, deploy to Vercel
 *
 * Chat → spawnCodingAgent → (V2 sandbox | direct GitHub + Vercel REST) → live URL
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { tool } from "ai";
import { z } from "zod";
import { readFile } from "fs/promises";
import path from "path";
import { handoffToV2 } from "@/lib/v2/bridge";
import { safeToolCall, toolError, type StructuredToolResult } from "@/lib/v2/retry";
import { secrets } from "@/secrets";
import { loadSkillsByName, formatSkillsForSystemPrompt } from "@/lib/v2/skills-loader";
import { libraryV2Session } from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils";

const dbClient = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(dbClient);

const OPEN_AGENTS_URL =
  secrets.neptuneV2.openAgentsUrl || "https://neptune-v2.vercel.app";
const OPEN_AGENTS_API_KEY = secrets.neptuneV2.openAgentsApiKey;
const GITHUB_TOKEN = secrets.github.token;
const GITHUB_API = "https://api.github.com";
const VERCEL_API = "https://api.vercel.com";
const VERCEL_TOKEN = secrets.vercel.token;
const VERCEL_TEAM_ID = secrets.vercel.teamId;
const TEMPLATE_DIR = "/home/neptune/templates/nextjs-16-shadcn";

// ─── Token Validation ─────────────────────────────────────────────────────

interface TokenStatus {
  configured: boolean;
  missing: string[];
}

function checkTokens(mode: "modify_existing" | "new_project"): TokenStatus {
  const missing: string[] = [];

  if (mode === "modify_existing") {
    // handoffToV2 uses NEPTUNE_INTERNAL_TOKEN || NEPTUNE_V2_HANDOFF_SECRET
    const hasInternalToken = !!(secrets.vps.internalToken || secrets.neptuneV2.handoffSecret);
    if (!hasInternalToken) missing.push("NEPTUNE_INTERNAL_TOKEN or NEPTUNE_V2_HANDOFF_SECRET");
  }

  if (mode === "new_project") {
    if (!GITHUB_TOKEN) missing.push("GITHUB_TOKEN");
    if (!VERCEL_TOKEN) missing.push("VERCEL_TOKEN");
    if (!VERCEL_TEAM_ID) missing.push("VERCEL_TEAM_ID");
  }

  return {
    configured: missing.length === 0,
    missing,
  };
}

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
  maxWaitMs: number = 120000,
  onProgress?: (state: string, elapsedMs: number) => void
): Promise<{ url: string | null; state: string }> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `${VERCEL_API}/v7/deployments?projectId=${projectId}&limit=1`,
      { headers: vercelHeaders() }
    );
    if (!res.ok) {
      onProgress?.("checking", Date.now() - start);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    const data = (await res.json()) as {
      deployments: Array<{ url: string; state: string }>;
    };
    const latest = data.deployments?.[0];
    if (!latest) {
      onProgress?.("queued", Date.now() - start);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    // U1.2: Send progress event every poll cycle (prevents client thinking stream died)
    onProgress?.(latest.state, Date.now() - start);

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

    // ── Phase 19 v2: Planning + Skills + Multi-Session ──
    planId: z
      .string()
      .optional()
      .describe("UUID of a planSession plan to link this task to. Injects plan context into V2 prompt."),
    skills: z
      .array(z.string())
      .optional()
      .describe("Array of skill names to load and inject into V2 system prompt (e.g., ['nextjs-shadcn-ai-elements-design-mastery'])."),
    parallel: z
      .boolean()
      .default(false)
      .describe("If true, spawn multiple V2 sessions for parallel work (max 4). Returns array of sessionIds."),
    parallelCount: z
      .number()
      .min(1)
      .max(4)
      .optional()
      .describe("Number of parallel V2 sessions to spawn when parallel=true (default 2, max 4)."),
    validationSteps: z
      .array(z.enum(["build", "lint", "type-check", "test", "smoke-deploy"]))
      .optional()
      .describe("Validation steps V2 must run after edits. Default: ['build', 'lint']."),
  }),
  execute: async (params) => {
    try {
    const mode = params.mode || "modify_existing";

    // Validate required tokens before attempting any operations
    const tokenStatus = checkTokens(mode);
    if (!tokenStatus.configured) {
      return {
        success: false,
        error: {
          code: "MISSING_TOKENS",
          message: `Missing required environment variables for "${mode}" mode: ${tokenStatus.missing.join(", ")}`,
          retryable: false,
          suggestion: `Set these in your Vercel project environment variables (Settings → Environment Variables). See .env.example for the full list.`,
        },
      };
    }

    // ── MODIFY_EXISTING — V2 Handoff via Bridge ────────────────────────
    if (mode === "modify_existing") {
      const {
        goal, repoOwner, repoName, baseBranch, createPR, deployToVercel,
        runtime, sessionId,
        // Phase 19 v2 params
        planId, skills: skillNames, parallel, parallelCount, validationSteps,
      } = params;

      if (!repoName) {
        return {
          success: false,
          error: {
            code: "MISSING_PARAM",
            message: "repoName is required for modify_existing mode",
            retryable: false,
            suggestion: "Provide the target repository name.",
          },
        };
      }

      // Phase 19 v2: Load skills if provided
      let skillsBlock = "";
      const loadedSkills: string[] = [];
      if (skillNames && skillNames.length > 0) {
        try {
          const skills = await loadSkillsByName(skillNames);
          skillsBlock = formatSkillsForSystemPrompt(skills);
          loadedSkills.push(...skills.map((s) => s.name));
          console.log(`[spawnCodingAgent v2] Loaded ${skills.length} skills: ${loadedSkills.join(", ")}`);
        } catch (err) {
          console.warn("[spawnCodingAgent v2] Skills load failed (non-fatal):", (err as Error).message);
        }
      }

      // Phase 19 v2: Inject plan context if planId provided
      let planContext = "";
      if (planId) {
        planContext = `\n\n## Linked Plan\nPlan ID: ${planId}\nFollow the plan phases and acceptance criteria from this plan.`;
      }

      // Phase 19 v2: Validation steps
      const validations = validationSteps || ["build", "lint"];
      const validationBlock = `\n\n## Required Validation Steps\nAfter completing all edits, run these checks:\n${validations.map((v) => `- ${v}`).join("\n")}`;

      // Build enhanced context with skills + plan + validation
      const context = [
        `Repository: ${repoOwner}/${repoName}`,
        `Base branch: ${baseBranch}`,
        `Runtime: ${runtime}`,
        createPR ? "Create a PR when done." : "",
        deployToVercel ? "Deploy to Vercel when done." : "",
        `GitHub token available: ${GITHUB_TOKEN ? "yes" : "no"}`,
        `Vercel token available: ${VERCEL_TOKEN ? "yes" : "no"}`,
        planContext,
        validationBlock,
      ].filter(Boolean).join("\n");

      // Full system context = skills + repo context
      const fullContext = skillsBlock
        ? `${skillsBlock}\n\n${context}`
        : context;

      // Phase 19 v2: Handle parallel spawns
      const spawnCount = parallel ? Math.min(parallelCount || 2, 4) : 1;

      const spawnResults: Array<{
        sessionId: string;
        sandboxId?: string;
        sseUrl?: string;
      }> = [];

      for (let i = 0; i < spawnCount; i++) {
        const parallelTag = spawnCount > 1 ? ` [Session ${i + 1}/${spawnCount}]` : "";
        const sessionGoal = spawnCount > 1
          ? `${goal}${parallelTag}`
          : goal;

        const handoffResult = await handoffToV2(sessionGoal, fullContext, "deepseek-v4-pro", sessionId);

        if (!handoffResult.success) {
          // Determine if retryable
          const isRetryable =
            handoffResult.error?.includes("timeout") ||
            handoffResult.error?.includes("503") ||
            handoffResult.error?.includes("502") ||
            handoffResult.error?.includes("unreachable") ||
            handoffResult.error?.includes("ECONNREFUSED") ||
            handoffResult.error?.includes("AbortError");

          // If one parallel spawn fails, continue with others
          if (spawnCount > 1) {
            console.warn(`[spawnCodingAgent v2] Parallel spawn ${i + 1}/${spawnCount} failed: ${handoffResult.error}`);
            continue;
          }

          return {
            success: false,
            error: {
              code: "V2_HANDOFF_FAILED",
              message: handoffResult.error || "Unknown error",
              retryable: !!isRetryable,
              suggestion: isRetryable
                ? "V2 is temporarily unreachable. You can retry in a few seconds, or use direct sandbox tools instead."
                : "V2 handoff is not available. Try using direct sandbox tools or manually creating the changes.",
            },
          };
        }

        spawnResults.push({
          sessionId: handoffResult.sessionId || "",
          sandboxId: handoffResult.sessionId,
          sseUrl: handoffResult.sseUrl || handoffResult.sessionUrl || "",
        });

        // Phase 19 v2: Record in library_v2_sessions
        const v2SessionId = generateUUID();
        try {
          await db.insert(libraryV2Session).values({
            id: v2SessionId,
            planId: planId || null,
            sessionId: handoffResult.sessionId || "",
            status: "spawning",
            progress: 0,
            skillsLoaded: loadedSkills,
            parallelGroup: spawnCount > 1 ? `p19-${planId || "direct"}` : null,
            streamUrl: handoffResult.sseUrl || "",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } catch (dbErr) {
          console.warn("[spawnCodingAgent v2] DB record failed (non-fatal):", (dbErr as Error).message);
        }
      }

      if (spawnResults.length === 0) {
        return {
          success: false,
          error: {
            code: "V2_ALL_SPAWNS_FAILED",
            message: `All ${spawnCount} parallel V2 spawns failed`,
            retryable: true,
            suggestion: "V2 is temporarily unreachable. Retry or use direct sandbox tools.",
          },
        };
      }

      const first = spawnResults[0];
      return {
        success: true,
        mode: "modify_existing",
        sandboxId: first.sessionId,
        sessionId: first.sessionId,
        sessionIds: spawnResults.map((s) => s.sessionId),
        status: "started",
        repo: `${repoOwner}/${repoName}`,
        branch: baseBranch || "pending",
        prUrl: null,
        streamUrl: first.sseUrl || "",
        parallel: spawnCount > 1,
        spawnCount: spawnResults.length,
        planId: planId || null,
        skillsLoaded: loadedSkills,
        validationPlan: validations,
        message:
          `V2 coding agent${spawnCount > 1 ? "(s)" : ""} spawned for ${repoOwner}/${repoName}. ` +
          (spawnCount > 1 ? `${spawnResults.length} sessions running in parallel. ` : "") +
          `Session${spawnCount > 1 ? "s" : ""}: ${spawnResults.map((s) => s.sessionId?.slice(0, 12)).join(", ")}. ` +
          (planId ? `Linked to plan ${planId.slice(0, 8)}. ` : "") +
          (loadedSkills.length > 0 ? `${loadedSkills.length} skills loaded. ` : "") +
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
    try {
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

      // 4. Poll for first deploy with progress (U1.2: prevents client thinking stream died)
      const deployResult = await pollDeployReady(
        vercelProjectId,
        120000,
        (state, elapsed) => {
          if (elapsed % 15000 < 5000) {
            console.log(
              `[spawnCodingAgent] Deploy status: ${state} after ${Math.round(elapsed / 1000)}s`
            );
          }
        }
      );
      deploymentUrl = deployResult.url
        ? `https://${deployResult.url}`
        : null;
    } catch (err) {
      console.error(
        "[spawnCodingAgent] Vercel project creation failed (non-fatal):",
        err
      );
    }

    return {
      success: true,
      mode: "new_project",
      repoUrl: repo.htmlUrl,
      vercelProjectId,
      deploymentUrl,
      projectName: safeProjectName,
      message:
        `New project "${safeTitle}" created!\n` +
        `📁 GitHub: ${repo.htmlUrl}\n` +
        (vercelProjectId
          ? `🚀 Vercel: ${deploymentUrl || "deploying..."}`
          : `⚠️ Vercel project creation failed — deploy manually at ${repo.htmlUrl}`),
    };
    } catch (ghErr) {
      return {
        success: false,
        error: {
          code: "NEW_PROJECT_FAILED",
          message: ghErr instanceof Error ? ghErr.message : String(ghErr),
          retryable: true,
          suggestion: "GitHub repo creation or template upload failed. Check GitHub token permissions and try again.",
        },
      };
    }

    // ── Unexpected mode — should not happen with zod validation ──────
    return {
      success: false,
      error: {
        code: "INVALID_MODE",
        message: `Invalid mode: ${params.mode || "undefined"}`,
        retryable: false,
        suggestion: "Use 'modify_existing' or 'new_project'.",
      },
    };
    } catch (err) {
      // U1.2: Outer safety net — tool NEVER throws unhandled
      const message = err instanceof Error ? err.message : String(err);
      const isRetryable =
        message.includes("timeout") ||
        message.includes("abort") ||
        message.includes("fetch") ||
        message.includes("ECONNREFUSED") ||
        message.includes("503");
      return {
        success: false,
        error: {
          code: "UNHANDLED_ERROR",
          message,
          retryable: isRetryable,
          suggestion: isRetryable
            ? "A transient error occurred. Try again or use direct sandbox tools."
            : "An unexpected error occurred. Check the error details and try a different approach.",
        },
      };
    }
  },
});
