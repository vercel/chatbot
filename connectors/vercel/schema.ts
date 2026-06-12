/**
 * Vercel Connector — Zod schemas for all tool inputs and outputs.
 */

import { z } from "zod";

export const listDeploysSchema = {
  input: z.object({
    projectId: z.string().describe("Vercel project ID (prj_xxx)"),
    state: z
      .enum(["BUILDING", "ERROR", "INITIALIZING", "QUEUED", "READY", "CANCELED"])
      .optional(),
    target: z.enum(["production", "preview"]).optional(),
    branch: z.string().optional(),
    limit: z.number().default(5),
  }),
  output: z.object({
    deployments: z.array(
      z.object({
        uid: z.string(),
        name: z.string(),
        url: z.string(),
        state: z.string(),
        target: z.string(),
        source: z.string().optional(),
        createdAt: z.number().optional(),
        inspectorUrl: z.string().optional(),
        errorCode: z.string().optional(),
        errorMessage: z.string().optional(),
      })
    ),
    count: z.number(),
    pagination: z.record(z.unknown()).optional(),
  }),
};

export const getDeployLogSchema = {
  input: z.object({
    deploymentId: z.string().describe("Vercel deployment ID (dpl_xxx)"),
    limit: z.number().default(50),
    direction: z.enum(["forward", "backward"]).default("forward"),
  }),
  output: z.object({
    deploymentId: z.string(),
    totalEvents: z.number(),
    logLines: z.array(
      z.object({
        type: z.string(),
        created: z.number(),
        text: z.string(),
        serial: z.string().optional(),
      })
    ),
    errors: z.array(z.string()),
    hasErrors: z.boolean(),
  }),
};

export const listProjectsSchema = {
  input: z.object({
    teamId: z.string().optional(),
    limit: z.number().default(20),
  }),
  output: z.object({
    projects: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        link: z.string().optional(),
        framework: z.string().optional(),
        latestDeployments: z.array(z.record(z.unknown())).optional(),
        targets: z.record(z.unknown()).optional(),
        updatedAt: z.number().optional(),
      })
    ),
    count: z.number(),
  }),
};

export const createProjectSchema = {
  input: z.object({
    name: z.string().describe("Project name (slug)"),
    framework: z
      .enum(["nextjs", "vite", "gatsby", "remix", "astro", "nuxt", "sveltekit", "other"])
      .default("nextjs"),
    gitRepoOwner: z.string().optional(),
    gitRepoName: z.string().optional(),
    gitRepoType: z.enum(["github", "gitlab", "bitbucket"]).default("github"),
    rootDirectory: z.string().optional(),
    buildCommand: z.string().optional(),
    installCommand: z.string().optional(),
    outputDirectory: z.string().optional(),
    environmentVariables: z
      .array(
        z.object({
          key: z.string(),
          value: z.string(),
          target: z.array(z.enum(["production", "preview", "development"])).default([
            "production",
            "preview",
            "development",
          ]),
          type: z.enum(["plain", "encrypted"]).default("encrypted"),
        })
      )
      .optional(),
    teamId: z.string().optional(),
  }),
  output: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    link: z.string().optional(),
    framework: z.string().optional(),
    gitRepository: z.record(z.unknown()).nullable().optional(),
    message: z.string().optional(),
  }),
};

export const redeploySchema = {
  input: z.object({
    projectId: z.string().describe("Vercel project ID"),
    target: z.enum(["production", "preview"]).default("production"),
    gitBranch: z.string().optional(),
    gitSha: z.string().optional(),
    teamId: z.string().optional(),
  }),
  output: z.object({
    deploymentId: z.string().optional(),
    url: z.string().optional(),
    state: z.string().optional(),
    target: z.string().optional(),
    inspectorUrl: z.string().optional(),
    message: z.string().optional(),
  }),
};

export type ListDeploysInput = z.infer<typeof listDeploysSchema.input>;
export type GetDeployLogInput = z.infer<typeof getDeployLogSchema.input>;
export type ListProjectsInput = z.infer<typeof listProjectsSchema.input>;
export type CreateProjectInput = z.infer<typeof createProjectSchema.input>;
export type RedeployInput = z.infer<typeof redeploySchema.input>;

export const vercelSchemas = {
  listDeploys: listDeploysSchema,
  getDeployLog: getDeployLogSchema,
  listProjects: listProjectsSchema,
  createProject: createProjectSchema,
  redeploy: redeploySchema,
} as const;
