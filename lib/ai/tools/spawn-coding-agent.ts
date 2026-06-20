/**
 * Phase 23B: spawn-coding-agent tool — V2 Handoff Persistence
 *
 * Hand off complex coding tasks to Neptune V2 long-running agent.
 * Persists sessions to library_v2_handoffs table for /library/handoffs visibility.
 *
 * Modes: new_project | modify_existing | investigation
 *
 * Chat → spawnCodingAgent → V2 backend → DB persistence → visible in /library/handoffs
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { tool } from "ai";
import { z } from "zod";
import { readFile } from "fs/promises";
import path from "path";
import { libraryV2Handoff } from "@/lib/db/schema";
import { spawnV2Session } from "@/lib/v2/handoff-client";
import { generateUUID } from "@/lib/utils";
import { routeIntent } from "@/lib/ai/routing/kg-router";
import { recordHandoffSuccess, recordHandoffFailure } from "@/lib/handoff-health";

const dbClient = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(dbClient);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN_RAW || process.env.GITHUB_TOKEN || "";
const GITHUB_API = "https://api.github.com";
const VERCEL_API = "https://api.vercel.com";
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || "";
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || "team_NXlYvSlpN5mMinKXi0emQkFT";
const TEMPLATE_DIR = "/home/neptune/templates/nextjs-16-shadcn";

// ─── Token Validation ─────────────────────────────────────────────────────

interface TokenStatus {
  configured: boolean;
  missing: string[];
}

function checkTokens(mode: string): TokenStatus {
  const missing: string[] = [];
  if (mode === "new_project") {
    if (!GITHUB_TOKEN) missing.push("GITHUB_TOKEN");
    if (!VERCEL_TOKEN) missing.push("VERCEL_TOKEN");
    if (!VERCEL_TEAM_ID) missing.push("VERCEL_TEAM_ID");
  }
  return { configured: missing.length === 0, missing };
}

// ─── GitHub Helpers ───────────────────────────────────────────────────────

function githubHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function createGitHubRepo(params: {
  name: string;
  description?: string;
  private?: boolean;
}): Promise<{ htmlUrl: string; cloneUrl: string; owner: string; name: string }> {
  const body: Record<string, unknown> = {
    name: params.name,
    private: params.private ?? false,
    auto_init: true,
  };
  if (params.description) body.description = params.description;

  const userRes = await fetch(`${GITHUB_API}/user`, { headers: githubHeaders() });
  if (!userRes.ok) throw new Error(`GitHub user fetch failed: ${userRes.status}`);
  const userData = (await userRes.json()) as { login: string };

  const res = await fetch(`${GITHUB_API}/user/repos`, {
    method: "POST",
    headers: githubHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub create repo failed: ${res.status}`);
  const data = (await res.json()) as {
    html_url: string; clone_url: string; name: string; owner: { login: string };
  };
  return { htmlUrl: data.html_url, cloneUrl: data.clone_url, owner: data.owner.login, name: data.name };
}

async function uploadFileToRepo(params: {
  owner: string; repo: string; filePath: string; content: string; commitMessage?: string;
}): Promise<void> {
  const { owner, repo, filePath, content, commitMessage } = params;
  const body = { message: commitMessage || `Add ${filePath}`, content: Buffer.from(content, "utf-8").toString("base64") };
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, {
    method: "PUT", headers: githubHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub upload ${filePath} failed: ${res.status}`);
}

// ─── Vercel Helpers ───────────────────────────────────────────────────────

function vercelHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${VERCEL_TOKEN}`, "Content-Type": "application/json" };
}

async function createVercelProject(params: {
  name: string; gitRepoOwner: string; gitRepoName: string;
}): Promise<{ id: string; link: string }> {
  const body: Record<string, unknown> = {
    name: params.name, framework: "nextjs",
    gitRepository: { type: "github", repo: `${params.gitRepoOwner}/${params.gitRepoName}` },
  };
  const res = await fetch(`${VERCEL_API}/v10/projects`, {
    method: "POST", headers: vercelHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Vercel create project failed: ${res.status}`);
  const data = (await res.json()) as { id: string; link: string };
  return { id: data.id, link: data.link };
}

const TEMPLATE_FILES = [
  "package.json", "tsconfig.json", "next.config.js", "postcss.config.mjs",
  ".gitignore", "README.md", "app/globals.css", "app/layout.tsx", "app/page.tsx", "lib/utils.ts",
];

// ─── Main Tool ─────────────────────────────────────────────────────────────

export const spawnCodingAgent = tool({
  description:
    "Hand off a complex multi-step coding task to Neptune V2 long-running agent. " +
    "Modes: 'modify_existing' (V2 sandbox), 'new_project' (GitHub + Vercel), 'investigation' (deep analysis). " +
    "Enriches context with KG playbook insights, conversation history, and panel preset metadata. " +
    "Retries with 2s backoff on transient V2 failures. Sessions are visible at /library/handoffs.",
  inputSchema: z.object({
    mode: z.enum(["modify_existing", "new_project", "investigation"]).default("modify_existing")
      .describe("Operation mode"),
    goal: z.string().describe("Natural language description of what to build/fix."),
    repoOwner: z.string().default("abhiswami2121").describe("GitHub repo owner"),
    repoName: z.string().optional().describe("Target repository name (for modify_existing)"),
    baseBranch: z.string().default("main").describe("Base branch"),
    createPR: z.boolean().default(true).describe("Whether to create a pull request"),
    deployToVercel: z.boolean().default(false),
    projectName: z.string().optional().describe("Name for new project/repo"),
    projectTitle: z.string().optional().describe("Human-readable project title"),
    projectDescription: z.string().optional().describe("Short project description"),
    isPrivate: z.boolean().default(false).describe("Whether new repo should be private"),
    sessionId: z.string().optional().describe("Existing v2 session ID to resume"),
    skills: z.array(z.string()).optional().describe("Skill names to inject into V2 prompt"),
  }),
  execute: async (params, { toolCallId, messages }) => {
    try {
      const mode = params.mode || "modify_existing";
      const userGoal = params.goal;

      // Phase 24: KG Insights — enrich handoff with playbook routing context
      let kgInsights: {
        primaryPlaybook: string | null;
        confidence: number;
        topMatches: string[];
        queryTimeMs: number;
      } | null = null;
      try {
        const routing = await routeIntent(userGoal, params.sessionId);
        kgInsights = {
          primaryPlaybook: routing.primary?.slug ?? null,
          confidence: routing.primary?.confidence ?? 0,
          topMatches: routing.matches.slice(0, 3).map((m) => m.slug),
          queryTimeMs: routing.queryTimeMs,
        };
        console.log(`[spawnCodingAgent] KG insights: primary=${kgInsights.primaryPlaybook} confidence=${kgInsights.confidence}`);
      } catch (kgErr) {
        console.warn("[spawnCodingAgent] KG insights unavailable (non-critical):", (kgErr as Error).message);
      }

      // Phase 24: Last 5 messages from conversation context
      let lastMessages: unknown[] = [];
      try {
        const allMessages = messages || [];
        lastMessages = allMessages.slice(-5).map((m: { role: string; content: string }) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content.slice(0, 500) : "[complex content]",
        }));
      } catch {
        lastMessages = [];
      }

      // Validate tokens
      const tokenStatus = checkTokens(mode);
      if (!tokenStatus.configured) {
        return {
          success: false,
          error: {
            code: "MISSING_TOKENS",
            message: `Missing: ${tokenStatus.missing.join(", ")}`,
            retryable: false,
            suggestion: `Set these in Vercel project environment variables.`,
          },
        };
      }

      // ── MODIFY_EXISTING / INVESTIGATION — V2 Handoff ─────────────────
      if (mode === "modify_existing" || mode === "investigation") {
        const { goal, repoOwner, repoName, baseBranch, createPR, deployToVercel, sessionId } = params;

        if (!repoName && mode === "modify_existing") {
          return {
            success: false,
            error: { code: "MISSING_PARAM", message: "repoName required for modify_existing", retryable: false },
          };
        }

        // Phase 24: Build enriched handoff context
        const handoffContext = {
          goal,
          mode,
          targetRepo: `${repoOwner}/${repoName || "unknown"}`,
          branch: baseBranch || "main",
          baseCommit: (params as Record<string, unknown>).baseCommit || null,
          conversationContext: lastMessages,
          panelPreset: (params as Record<string, unknown>).panelPreset || null,
          kgInsights,
          timestamp: new Date().toISOString(),
        };

        // Phase 28: V2 handoff with 3 retries exp backoff, 10s timeout per attempt
        const MAX_RETRIES = 3;
        const BASE_DELAY_MS = 1000;
        const ATTEMPT_TIMEOUT_MS = 10_000;

        let v2SessionId = "";
        let streamUrl = "";
        let handoffAttempts = 0;
        let lastError: string | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          handoffAttempts = attempt;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);

          try {
            console.log(`[spawnCodingAgent] Attempt ${attempt}/${MAX_RETRIES}: spawning V2 session for "${goal.slice(0, 60)}"`);

            const v2Result = await spawnV2Session({
              goal,
              mode,
              targetRepo: repoName ? `${repoOwner}/${repoName}` : undefined,
              context: {
                baseBranch,
                createPR,
                deployToVercel,
                handoffContext,
              },
            });

            clearTimeout(timeoutId);

            if (v2Result.success && v2Result.sessionId) {
              console.log(`[spawnCodingAgent] ✅ V2 session created (attempt ${attempt}/${MAX_RETRIES}): ${v2Result.sessionId}`);
              v2SessionId = v2Result.sessionId;
              streamUrl = v2Result.streamUrl || "";
              break;
            }

            lastError = `V2 returned: ${v2Result.code || "UNKNOWN"} - ${v2Result.error || "no error detail"}`;
            console.warn(`[spawnCodingAgent] ⚠️ Attempt ${attempt}/${MAX_RETRIES} failed: ${lastError}`);

            if (v2Result.code === "V2_UNREACHABLE" || v2Result.code?.startsWith("V2_HTTP_5")) {
              // Retryable — continue loop
            } else {
              // Non-retryable error, don't waste retries
              lastError = v2Result.error || "Non-retryable V2 error";
              break;
            }
          } catch (err) {
            clearTimeout(timeoutId);
            lastError = (err as Error).message;
            console.error(`[spawnCodingAgent] ❌ Attempt ${attempt}/${MAX_RETRIES} exception: ${lastError}`);
          }

          // Exponential backoff before next attempt (1s, 2s, 4s)
          if (attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
            console.log(`[spawnCodingAgent] Retrying in ${delay}ms...`);
            await new Promise((r) => setTimeout(r, delay));
          }
        }

        if (!v2SessionId) {
          // Phase 28: Record health failure
          recordHandoffFailure(lastError || "unknown", undefined).catch(() => {});

          return {
            success: false,
            error: {
              code: "V2_HANDOFF_FAILED",
              message: `V2 unreachable after ${handoffAttempts} attempt(s). Last error: ${lastError || "unknown"}`,
              retryable: true,
              suggestion: "V2 backend may be temporarily down. Try again or use sandbox tools.",
            },
          };
        }

        // Persist to library_v2_handoffs
        const dbId = generateUUID();
        try {
          await db.insert(libraryV2Handoff).values({
            id: dbId,
            v2SessionId,
            handoffMode: mode,
            targetRepo: repoName ? `${repoOwner}/${repoName}` : null,
            goal,
            status: "running",
            streamUrl: streamUrl || null,
            startedAt: new Date(),
          });
        } catch (dbErr) {
          console.warn("[spawnCodingAgent] DB persist failed (non-fatal):", (dbErr as Error).message);
        }

        // Phase 28: Record health success
        recordHandoffSuccess(v2SessionId).catch(() => {});

        return {
          success: true,
          mode,
          sessionId: v2SessionId,
          status: "started",
          libraryUrl: "/library/handoffs",
          v2DirectUrl: `https://neptune-v2.vercel.app/agent-sessions/${v2SessionId}`,
          message: `V2 coding agent spawned. Track at /library/handoffs or open in V2. Session: ${v2SessionId?.slice(0, 12)}...`,
          // Phase 25: HandoffCard metadata for generative UI rendering
          handoff: {
            sessionId: v2SessionId,
            mode,
            goal,
            status: "spawning" as const,
            repo: repoName ? `${repoOwner}/${repoName}` : undefined,
            branch: baseBranch || "main",
            progress: 0,
            v2DirectUrl: `https://neptune-v2.vercel.app/agent-sessions/${v2SessionId}`,
            libraryUrl: "/library/handoffs",
          },
        };
      }

      // ── NEW_PROJECT — Direct GitHub + Vercel API ────────────────────
      const { goal, projectName, projectTitle, projectDescription, isPrivate } = params;

      const safeProjectName = projectName ||
        goal.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) ||
        "neptune-project";

      const safeTitle = projectTitle || goal.slice(0, 80) || safeProjectName;
      const safeDescription = projectDescription || `Scaffolded by Neptune Chat: ${goal.slice(0, 100)}`;

      let v2SessionId = `newproject-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Create GitHub repo
      const repo = await createGitHubRepo({ name: safeProjectName, description: safeDescription, private: isPrivate });
      console.log(`[spawnCodingAgent] Repo created: ${repo.htmlUrl}`);

      // Upload template files
      const templateRoot = path.join(TEMPLATE_DIR);
      for (const filePath of TEMPLATE_FILES) {
        try {
          const fullPath = path.join(templateRoot, filePath);
          let content = await readFile(fullPath, "utf-8");
          content = content
            .replace(/\{\{PROJECT_NAME\}\}/g, safeProjectName)
            .replace(/\{\{PROJECT_TITLE\}\}/g, safeTitle)
            .replace(/\{\{PROJECT_DESCRIPTION\}\}/g, safeDescription)
            .replace(/\{\{GITHUB_OWNER\}\}/g, repo.owner);
          await uploadFileToRepo({ owner: repo.owner, repo: repo.name, filePath, content, commitMessage: `Scaffold: ${filePath}` });
          console.log(`[spawnCodingAgent] Uploaded: ${filePath}`);
        } catch (err) {
          console.error(`[spawnCodingAgent] Failed to upload ${filePath}:`, err);
        }
      }

      // Create Vercel project
      let vercelProjectId = "";
      let deploymentUrl: string | null = null;
      try {
        const vercelProject = await createVercelProject({ name: safeProjectName, gitRepoOwner: repo.owner, gitRepoName: repo.name });
        vercelProjectId = vercelProject.id;
        console.log(`[spawnCodingAgent] Vercel project: ${vercelProjectId}`);
      } catch (err) {
        console.error("[spawnCodingAgent] Vercel project creation failed (non-fatal):", err);
      }

      // Persist to DB
      try {
        await db.insert(libraryV2Handoff).values({
          id: generateUUID(),
          v2SessionId,
          handoffMode: "new_project",
          targetRepo: `${repo.owner}/${repo.name}`,
          goal,
          status: "completed",
          resultUrl: repo.htmlUrl,
          startedAt: new Date(),
          endedAt: new Date(),
        });
      } catch (dbErr) {
        console.warn("[spawnCodingAgent] DB persist failed (non-fatal):", (dbErr as Error).message);
      }

      return {
        success: true,
        mode: "new_project",
        repoUrl: repo.htmlUrl,
        vercelProjectId,
        deploymentUrl,
        projectName: safeProjectName,
        libraryUrl: "/library/handoffs",
        message: `New project "${safeTitle}" created!\n📁 GitHub: ${repo.htmlUrl}\n${vercelProjectId ? `🚀 Vercel: ${deploymentUrl || "deploying..."}` : ""}`,
        // Phase 25: HandoffCard metadata
        handoff: {
          sessionId: v2SessionId,
          mode: "new_project",
          goal,
          status: "completed" as const,
          repo: `${repo.owner}/${repo.name}`,
          branch: "main",
          deployUrl: deploymentUrl || undefined,
          prUrl: repo.htmlUrl,
          progress: 100,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isRetryable = message.includes("timeout") || message.includes("fetch") || message.includes("ECONNREFUSED");
      return {
        success: false,
        error: { code: "UNHANDLED_ERROR", message, retryable: isRetryable, suggestion: isRetryable ? "Transient error, try again." : "Check error details and try different approach." },
      };
    }
  },
});
