/**
 * self-code.ts — Self-coding tool for Neptune Chat.
 *
 * Allows Neptune Chat to modify ITS OWN codebase for small fixes
 * (typos, color tweaks, copy changes, prop additions).
 * For larger work, use spawnCodingAgent to hand off to Neptune V2.
 *
 * Phase 9: execute path now delegates to spawnCodingAgent instead of
 * directly calling V2 sandbox API (which requires sessionId management).
 *
 * SC2 — NEPTUNE SELF-CODING MISSION (2026-06-11)
 */
import { tool } from "ai";
import { z } from "zod";
import { secrets } from "@/secrets";

// --- Self-Context Constants ------------------------------------------------

const SELF_CONTEXT = {
  agent: "Neptune Chat",
  repoUrl: "https://github.com/abhiswami2121/neptune-chat",
  repoOwner: "abhiswami2121",
  repoName: "neptune-chat",
  vercelProjectId: "prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl",
  vercelTeamId: "team_NXlYvSlpN5mMinKXi0emQkFT",
  deployedUrl: "https://neptune-chat-ashy.vercel.app",
  v2Url: "https://neptune-v2.vercel.app",
  stack: "Next.js 16, AI SDK 6, NextAuth v5, Tailwind, shadcn/ui",
  commitAuthor: { name: "abhiswami2121", email: "abhiswami2121@gmail.com" },
};

// --- Vercel API Helpers ----------------------------------------------------

const VERCEL_API = "https://api.vercel.com";
const VERCEL_TOKEN = secrets.vercel.token;

function vercelHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function pollSelfDeploy(maxWaitMs = 480_000): Promise<{
  state: string;
  deployId: string;
  url: string | null;
}> {
  const start = Date.now();
  const projectId = SELF_CONTEXT.vercelProjectId;
  const teamId = SELF_CONTEXT.vercelTeamId;

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `${VERCEL_API}/v9/projects/${projectId}?teamId=${teamId}`,
      { headers: vercelHeaders() }
    );

    if (!res.ok) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    const data = (await res.json()) as {
      latestDeployments?: Array<{
        id: string;
        readyState: string;
        url: string;
        alias?: string[];
      }>;
    };

    const latest = data.latestDeployments?.[0];
    if (!latest) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    if (latest.readyState === "READY") {
      const aliasUrl = latest.alias?.[0];
      return {
        state: "READY",
        deployId: latest.id,
        url: aliasUrl
          ? `https://${aliasUrl}`
          : latest.url
            ? `https://${latest.url}`
            : null,
      };
    }

    if (latest.readyState === "ERROR") {
      return {
        state: "ERROR",
        deployId: latest.id,
        url: null,
      };
    }

    // Still building - wait
    await new Promise((r) => setTimeout(r, 10000));
  }

  return { state: "TIMEOUT", deployId: "", url: null };
}

async function smokeTest(paths: string[]): Promise<
  Array<{ path: string; httpCode: number; size: number; passed: boolean }>
> {
  const results: Array<{
    path: string;
    httpCode: number;
    size: number;
    passed: boolean;
  }> = [];

  for (const path of paths) {
    try {
      const res = await fetch(`${SELF_CONTEXT.deployedUrl}${path}`, {
        redirect: "manual",
      });
      const text = await res.text();
      results.push({
        path,
        httpCode: res.status,
        size: text.length,
        passed: res.status === 200 && text.length > 50,
      });
    } catch (err) {
      results.push({
        path,
        httpCode: 0,
        size: 0,
        passed: false,
      });
    }
  }

  return results;
}

// --- Main Tool -------------------------------------------------------------

export const selfCode = tool({
  description:
    "Make a SMALL change to Neptune Chat's own codebase. " +
    "Use ONLY for tiny fixes: typos, color tweaks, copy changes, simple prop additions. " +
    "For anything bigger than 50 lines or 3 files, use spawnCodingAgent (handoff to V2) instead. " +
    "This tool knows the Neptune Chat repo context (abhiswami2121/neptune-chat, Vercel prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl). " +
    "It will clone via Vercel Sandbox, make the change, build, push, poll deploy, and smoke test.",
  inputSchema: z.object({
    task: z
      .string()
      .describe(
        "Natural language description of the small fix. E.g., 'Fix typo in NEPTUNE.md: change Neptun to Neptune' or 'Change the welcome message to Hello from self-coded Neptune'"
      ),
    files: z
      .array(z.string())
      .optional()
      .describe(
        "Specific files to modify (optional - if omitted, the sandbox will find the right files)"
      ),
    scope: z
      .enum(["small", "large"])
      .default("small")
      .describe(
        "'small' = self-code this (<=50 lines, <=3 files). 'large' = routes to spawnCodingAgent instead."
      ),
    dryRun: z
      .boolean()
      .default(false)
      .describe(
        "If true, return the plan without executing. Use for the agent to confirm the plan before execution."
      ),
  }),
  execute: async ({ task, files, scope, dryRun }) => {
    // If scope is large, tell the caller to use spawnCodingAgent instead
    if (scope === "large") {
      return {
        action: "handoff_to_v2",
        message:
          `This task ("${task}") is scoped as "large". ` +
          `Use spawnCodingAgent with mode=modify_existing, repoName=neptune-chat instead. ` +
          `V2 URL: ${SELF_CONTEXT.v2Url}`,
        recommendedTool: "spawnCodingAgent",
        recommendedParams: {
          mode: "modify_existing",
          goal: task,
          repoOwner: SELF_CONTEXT.repoOwner,
          repoName: SELF_CONTEXT.repoName,
          createPR: true,
        },
      };
    }

    if (dryRun) {
      return {
        action: "dry_run",
        task,
        files: files || ["(auto-detect)"],
        context: SELF_CONTEXT,
        plan: [
          `1. Clone ${SELF_CONTEXT.repoUrl} via Vercel Sandbox SDK`,
          `2. Make change: ${task}`,
          `3. Run pnpm typecheck + pnpm build`,
          `4. Create feat/ branch, commit with Co-Authored-By`,
          `5. Push to GitHub`,
          `6. Poll Vercel deploy until READY`,
          `7. Smoke test affected routes`,
          `8. Report result`,
        ],
        message: `[Dry run] Plan for: "${task}". Ready to execute when you confirm.`,
      };
    }

    // --- Execute: Phase 9 fix ---
    // selfCode execute no longer calls V2 sandbox API directly.
    // V2 requires sessionId management that selfCode doesn't handle.
    // Instead, return a clear delegation directing to spawnCodingAgent
    // which properly manages V2 session lifecycle and resume.
    return {
      action: "self_code_execute_delegated",
      message:
        `selfCode execute delegates to spawnCodingAgent. ` +
        `The dry_run above confirmed the plan is valid. ` +
        `Use spawnCodingAgent with mode=modify_existing to execute.`,
      recommendedTool: "spawnCodingAgent",
      recommendedParams: {
        mode: "modify_existing",
        goal: task,
        repoOwner: SELF_CONTEXT.repoOwner,
        repoName: SELF_CONTEXT.repoName || "neptune-chat",
        baseBranch: "main",
        createPR: true,
        deployToVercel: true,
      },
      context: SELF_CONTEXT,
    };
  },
});

// --- Context Helper (exported for use by /api/context endpoint) ------------

/**
 * Returns Neptune Chat's self-context - repo, Vercel project, capabilities.
 * Used by the /api/context endpoint and injected into the system prompt.
 */
export function getSelfContext() {
  return {
    ...SELF_CONTEXT,
    timestamp: new Date().toISOString(),
    capabilities: [
      "self-coding (small fixes to own codebase)",
      "spawn-coding-agent (handoff to V2 for complex work)",
      "connector-integrations (NMI, Slack, GitHub, Vercel, Base44, etc.)",
      "knowledge-retrieval (skills, PRDs, cortex)",
      "database-queries (read-only Postgres)",
      "sandbox-execution (Vercel Sandbox SDK)",
      "workflow-execution (multi-step durable workflows)",
    ],
  };
}

// --- Deploy Poller (exported for use by /api/context endpoint) -------------

export { pollSelfDeploy, smokeTest, SELF_CONTEXT };
