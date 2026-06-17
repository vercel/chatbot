/**
 * Phase 25 Stream 2: get-vercel-deploy tool
 * Returns Vercel deployment data in UniversalConnectorCard envelope format.
 */
import { tool } from "ai";
import { z } from "zod";

export const getVercelDeploy = tool({
  description: "Get Vercel deployment status. Returns project, deployment URL, build duration, and status.",
  inputSchema: z.object({
    project: z.string().describe("Vercel project name or deployment URL"),
    deploymentId: z.string().optional().describe("Specific deployment ID"),
  }),
  execute: async ({ project, deploymentId }) => {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN || "";
    try {
      // List deployments for the project
      const url = deploymentId
        ? `https://api.vercel.com/v13/deployments/${deploymentId}`
        : `https://api.vercel.com/v13/deployments?projectId=${project}&limit=1`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      });
      const json = await res.json();
      const deploy = deploymentId ? json : json.deployments?.[0] || {};

      return {
        connectorType: "vercel",
        data: {
          project,
          deploymentUrl: deploy.url ? `https://${deploy.url}` : "N/A",
          buildDuration: deploy.buildingAt && deploy.ready
            ? `${Math.round((new Date(deploy.ready).getTime() - new Date(deploy.buildingAt).getTime()) / 1000)}s`
            : "N/A",
          status: deploy.state || deploy.readyState || "unknown",
          buildLog: deploy.inspectorUrl || null,
        },
        schemaVersion: 1,
      };
    } catch {
      return {
        connectorType: "vercel",
        data: {
          project,
          deploymentUrl: "N/A",
          buildDuration: "N/A",
          status: "error",
          buildLog: null,
        },
        schemaVersion: 1,
      };
    }
  },
});
