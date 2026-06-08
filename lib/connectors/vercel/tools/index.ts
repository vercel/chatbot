/**
 * Vercel Connector Tools — 5+ tools for managing Vercel deployments.
 *
 * Tools: listDeploys, getDeployLog, listProjects, createProject, redeploy
 */
import { tool } from "ai";
import { z } from "zod";

const VERCEL_API = "https://api.vercel.com";
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || "";

function vercelHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    "Content-Type": "application/json",
  };
}

// ─── listDeploys ───────────────────────────────────────────────────────────

export const listDeploys = tool({
  description:
    "List Vercel deployments for a project. Filter by state, target, branch, or limit.",
  inputSchema: z.object({
    projectId: z.string().describe("Vercel project ID (e.g., prj_xxx)"),
    state: z
      .enum([
        "BUILDING",
        "ERROR",
        "INITIALIZING",
        "QUEUED",
        "READY",
        "CANCELED",
      ])
      .optional()
      .describe("Filter by deployment state"),
    target: z
      .enum(["production", "preview"])
      .optional()
      .describe("Filter by deployment target"),
    branch: z.string().optional().describe("Filter by Git branch name"),
    limit: z.number().default(5).describe("Max deployments to return"),
  }),
  execute: async ({ projectId, state, target, branch, limit }) => {
    const params = new URLSearchParams();
    params.set("projectId", projectId);
    params.set("limit", String(limit));
    if (state) params.set("state", state);
    if (target) params.set("target", target);
    if (branch) params.set("branch", branch);

    const res = await fetch(
      `${VERCEL_API}/v7/deployments?${params.toString()}`,
      { headers: vercelHeaders() }
    );

    if (!res.ok) {
      throw new Error(
        `Vercel listDeploys failed: ${res.status} ${await res.text()}`
      );
    }

    const data = await res.json();
    const deployments = (data.deployments || []).map((d: Record<string, unknown>) => ({
      uid: d.uid,
      name: d.name,
      url: d.url,
      state: d.state,
      target: d.target,
      source: d.source,
      createdAt: d.createdAt,
      inspectorUrl: d.inspectorUrl,
      errorCode: d.errorCode,
      errorMessage: d.errorMessage,
      meta: d.meta,
    }));

    return {
      deployments,
      count: deployments.length,
      pagination: data.pagination,
    };
  },
});

// ─── getDeployLog ──────────────────────────────────────────────────────────

export const getDeployLog = tool({
  description:
    "Fetch the build log/events for a specific Vercel deployment. Returns stdout/stderr events from the build process.",
  inputSchema: z.object({
    deploymentId: z.string().describe("Vercel deployment ID (dpl_xxx)"),
    limit: z.number().default(50).describe("Max events to return"),
    direction: z
      .enum(["forward", "backward"])
      .default("forward")
      .describe("Event direction"),
  }),
  execute: async ({ deploymentId, limit, direction }) => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("direction", direction);

    const res = await fetch(
      `${VERCEL_API}/v2/deployments/${deploymentId}/events?${params.toString()}`,
      { headers: vercelHeaders() }
    );

    if (!res.ok) {
      throw new Error(
        `Vercel getDeployLog failed: ${res.status} ${await res.text()}`
      );
    }

    const events = await res.json();
    const logLines = (Array.isArray(events) ? events : []).map(
      (e) => ({
        type: e.type as string,
        created: e.created as number,
        text: ((e.payload as Record<string, unknown>)?.text as string) || "",
        serial: (e.payload as Record<string, unknown>)?.serial as string | undefined,
      })
    );

    // Parse errors from log lines
    const errors = logLines.filter(
      (l) =>
        l.text.includes("Error") ||
        l.text.includes("ERR_") ||
        l.text.includes("failed") ||
        l.text.includes("✗")
    );

    return {
      deploymentId,
      totalEvents: logLines.length,
      logLines,
      errors: errors.map((e) => e.text),
      hasErrors: errors.length > 0,
    };
  },
});

// ─── listProjects ──────────────────────────────────────────────────────────

export const listProjects = tool({
  description:
    "List all Vercel projects accessible to the authenticated user or team.",
  inputSchema: z.object({
    teamId: z.string().optional().describe("Vercel team ID"),
    limit: z.number().default(20).describe("Max projects to return"),
  }),
  execute: async ({ teamId, limit }) => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (teamId) params.set("teamId", teamId);

    const res = await fetch(
      `${VERCEL_API}/v9/projects?${params.toString()}`,
      { headers: vercelHeaders() }
    );

    if (!res.ok) {
      throw new Error(
        `Vercel listProjects failed: ${res.status} ${await res.text()}`
      );
    }

    const data = await res.json();
    const projects = (data.projects || data || []).map(
      (p: Record<string, unknown>) => ({
        id: p.id,
        name: p.name,
        link: p.link,
        framework: p.framework,
        latestDeployments: p.latestDeployments,
        targets: p.targets,
        updatedAt: p.updatedAt,
      })
    );

    return {
      projects,
      count: projects.length,
    };
  },
});

// ─── createProject ─────────────────────────────────────────────────────────

export const createProject = tool({
  description:
    "Create a new Vercel project, optionally linking a GitHub repository for automatic deployments.",
  inputSchema: z.object({
    name: z.string().describe("Project name (slug)"),
    framework: z
      .enum([
        "nextjs",
        "vite",
        "gatsby",
        "remix",
        "astro",
        "nuxt",
        "sveltekit",
        "other",
      ])
      .default("nextjs")
      .describe("Framework preset"),
    gitRepoOwner: z
      .string()
      .optional()
      .describe("GitHub repo owner (for linking)"),
    gitRepoName: z
      .string()
      .optional()
      .describe("GitHub repo name (for linking)"),
    gitRepoType: z
      .enum(["github", "gitlab", "bitbucket"])
      .default("github")
      .describe("Git provider type"),
    rootDirectory: z
      .string()
      .optional()
      .describe("Root directory for the project (monorepo)"),
    buildCommand: z
      .string()
      .optional()
      .describe("Override build command"),
    installCommand: z
      .string()
      .optional()
      .describe("Override install command"),
    outputDirectory: z
      .string()
      .optional()
      .describe("Output directory"),
    environmentVariables: z
      .array(
        z.object({
          key: z.string(),
          value: z.string(),
          target: z
            .array(z.enum(["production", "preview", "development"]))
            .default(["production", "preview", "development"]),
          type: z.enum(["plain", "encrypted"]).default("encrypted"),
        })
      )
      .optional()
      .describe("Environment variables to set on the project"),
    teamId: z.string().optional().describe("Vercel team ID"),
  }),
  execute: async ({
    name,
    framework,
    gitRepoOwner,
    gitRepoName,
    gitRepoType,
    rootDirectory,
    buildCommand,
    installCommand,
    outputDirectory,
    environmentVariables,
    teamId,
  }) => {
    const body: Record<string, unknown> = {
      name,
      framework,
    };

    // Link GitHub repo if provided
    if (gitRepoOwner && gitRepoName) {
      body.gitRepository = {
        type: gitRepoType,
        repo: `${gitRepoOwner}/${gitRepoName}`,
      };
    }

    if (rootDirectory) body.rootDirectory = rootDirectory;
    if (buildCommand) body.buildCommand = buildCommand;
    if (installCommand) body.installCommand = installCommand;
    if (outputDirectory) body.outputDirectory = outputDirectory;
    if (environmentVariables) body.environmentVariables = environmentVariables;

    const params = new URLSearchParams();
    if (teamId) params.set("teamId", teamId);

    const res = await fetch(
      `${VERCEL_API}/v10/projects?${params.toString()}`,
      {
        method: "POST",
        headers: vercelHeaders(),
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Vercel createProject failed: ${res.status} ${errText}`);
    }

    const data = await res.json();

    return {
      id: data.id,
      name: data.name,
      link: data.link,
      framework: data.framework,
      gitRepository: data.gitRepository || null,
      latestDeployments: data.latestDeployments || [],
      message: gitRepoOwner
        ? `Project created with GitHub link: ${gitRepoOwner}/${gitRepoName} → ${data.link}`
        : `Project created: ${data.link}`,
    };
  },
});

// ─── redeploy ──────────────────────────────────────────────────────────────

export const redeploy = tool({
  description:
    "Trigger a new deployment for a Vercel project. Optionally from a specific Git branch or SHA.",
  inputSchema: z.object({
    projectId: z.string().describe("Vercel project ID"),
    target: z
      .enum(["production", "preview"])
      .default("production")
      .describe("Deployment target"),
    gitBranch: z.string().optional().describe("Git branch to deploy from"),
    gitSha: z.string().optional().describe("Git commit SHA to deploy"),
    teamId: z.string().optional().describe("Vercel team ID"),
  }),
  execute: async ({ projectId, target, gitBranch, gitSha, teamId }) => {
    const body: Record<string, unknown> = {
      name: projectId,
      target,
    };

    if (gitBranch || gitSha) {
      body.gitSource = {
        type: "github",
        ...(gitBranch ? { ref: gitBranch } : {}),
        ...(gitSha ? { sha: gitSha } : {}),
        repoId: projectId,
      };
    }

    const params = new URLSearchParams();
    if (teamId) params.set("teamId", teamId);
    params.set("forceNew", "1");

    const res = await fetch(
      `${VERCEL_API}/v13/deployments?${params.toString()}`,
      {
        method: "POST",
        headers: vercelHeaders(),
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Vercel redeploy failed: ${res.status} ${errText}`);
    }

    const data = await res.json();

    return {
      deploymentId: data.id || data.uid,
      url: data.url,
      state: data.state,
      target: data.target,
      inspectorUrl: data.inspectorUrl,
      message: `Redeploy triggered: ${data.url || "pending"}`,
    };
  },
});

