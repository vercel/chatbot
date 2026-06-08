/**
 * Vercel Connector — manage Vercel projects, deployments, and webhooks.
 *
 * Connector tools: listDeploys, getDeployLog, listProjects, createProject, redeploy
 * Webhook handler: /api/vercel/webhook (HMAC-SHA1 verified)
 * Events endpoint: /api/vercel/events (pollable by active sessions)
 */
import { CloudIcon } from "lucide-react";
import { checkConnectorEnv } from "../registry";
import type { ConnectorManifest } from "../types";

const vercelManifest: ConnectorManifest = {
  id: "vercel",
  name: "Vercel",
  description:
    "Manage Vercel projects, deployments, build logs, and webhook events",
  icon: CloudIcon,
  brandColor: "#000000",
  envKeys: ["VERCEL_TOKEN"],
  capabilities: [
    {
      id: "listDeploys",
      label: "List Deployments",
      description:
        "List recent deployments for a project — filter by state, branch, target",
      icon: "List",
    },
    {
      id: "getDeployLog",
      label: "Get Build Log",
      description: "Fetch the build events/log for a specific deployment",
      icon: "ScrollText",
    },
    {
      id: "listProjects",
      label: "List Projects",
      description: "List all Vercel projects in the team",
      icon: "FolderKanban",
    },
    {
      id: "createProject",
      label: "Create Project",
      description:
        "Create a new Vercel project, optionally linking a GitHub repo for auto-deploy",
      icon: "PlusCircle",
    },
    {
      id: "redeploy",
      label: "Redeploy",
      description: "Trigger a new deployment for a project (redeploy)",
      icon: "RefreshCw",
    },
  ],
  toolModule: () => import("./tools"),
  resultRenderers: {},
  playbookPath: "lib/connectors/vercel/playbook.mdx",
  getStatus: () => {
    const { ok, missing } = checkConnectorEnv(["VERCEL_TOKEN"]);
    return {
      connected: ok,
      message: ok
        ? "Connected (API Token)"
        : `Not Configured — missing: ${missing.join(", ")}`,
    };
  },
  docs: {
    official: "https://vercel.com/docs/rest-api",
    ourGuide: "/wiki/vercel-deploy-event-loop",
  },
};

export default vercelManifest;
