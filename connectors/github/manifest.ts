import { GithubIcon } from "lucide-react";
import { checkConnectorEnv } from "../../lib/connectors/registry";
import type { ConnectorManifest } from "../../lib/connectors/types";

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
      id: "listRepos",
      label: "List Repositories",
      description:
        "List ALL GitHub repositories with full pagination — returns every repo the authenticated user can access",
      icon: "FolderGit2",
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
  playbookPath: "connectors/github/playbook.mdx",
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
