import { ListTodoIcon } from "lucide-react";
import { checkConnectorEnv } from "../registry";
import type { ConnectorManifest } from "../types";

const linearManifest: ConnectorManifest = {
  id: "linear",
  name: "Linear",
  description: "Issue tracking and project management — Not Configured",
  icon: ListTodoIcon,
  brandColor: "#5E6AD2",
  envKeys: ["LINEAR_API_KEY"],
  capabilities: [
    {
      id: "listIssues",
      label: "List Issues",
      description: "List Linear issues by team, status, or assignee",
      icon: "List",
    },
    {
      id: "createIssue",
      label: "Create Issue",
      description: "Create a new Linear issue",
      icon: "Plus",
    },
    {
      id: "searchIssues",
      label: "Search Issues",
      description: "Full-text search across Linear issues",
      icon: "Search",
    },
    {
      id: "listProjects",
      label: "List Projects",
      description: "List Linear projects with status",
      icon: "Folder",
    },
  ],
  toolModule: () => import("./tools"),
  resultRenderers: {},
  playbookPath: "lib/connectors/linear/playbook.mdx",
  getStatus: () => {
    const { ok, missing } = checkConnectorEnv(["LINEAR_API_KEY"]);
    return { connected: ok, message: ok ? "Connected" : "Not Configured" };
  },
};
export default linearManifest;
