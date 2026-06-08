import { GithubIcon } from "lucide-react";
import { checkConnectorEnv } from "../registry";
import type { ConnectorManifest } from "../types";

const githubManifest: ConnectorManifest = {
  id: "github",
  name: "GitHub",
  description: "Repo access, code search, PR management, and V2 coding handoff",
  icon: GithubIcon,
  brandColor: "#6E40C9",
  envKeys: ["GITHUB_TOKEN"],
  capabilities: [
    {
      id: "searchCode",
      label: "Search Code",
      description: "Search across NewLeaf repositories",
      icon: "Search",
    },
    {
      id: "getFile",
      label: "Get File",
      description: "Read a file from any abhiswami2121 repo",
      icon: "File",
    },
    {
      id: "listPRs",
      label: "List PRs",
      description: "List open pull requests across repos",
      icon: "GitPullRequest",
    },
    {
      id: "createPR",
      label: "Create PR",
      description: "Open a new pull request",
      icon: "GitPullRequestArrow",
    },
    {
      id: "spawnCodingAgent",
      label: "V2 Coding Agent",
      description:
        "Hand off coding tasks to V2 sandbox — V2 clones repo, fixes, commits, opens PR, deploys",
      icon: "Bot",
    },
  ],
  toolModule: () => import("./tools"),
  resultRenderers: {},
  playbookPath: "lib/connectors/github/playbook.mdx",
  getStatus: () => {
    const { ok, missing } = checkConnectorEnv(["GITHUB_TOKEN"]);
    return {
      connected: ok,
      message: ok
        ? "Connected (PAT)"
        : `Not Configured — missing: ${missing.join(", ")}`,
    };
  },
  docs: { official: "https://docs.github.com/en/rest" },
};
export default githubManifest;
