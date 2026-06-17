/**
 * Phase 25 Stream 2: get-github-pr tool
 * Returns GitHub PR data in UniversalConnectorCard envelope format.
 */
import { tool } from "ai";
import { z } from "zod";

export const getGithubPr = tool({
  description: "Get GitHub pull request status. Returns repo, branch, PR status, and checks.",
  inputSchema: z.object({
    repo: z.string().describe("GitHub repo, e.g. 'abhiswami2121/neptune-chat'"),
    prNumber: z.number().describe("PR number"),
  }),
  execute: async ({ repo, prNumber }) => {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN_RAW || process.env.GITHUB_TOKEN || "";
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/pulls/${prNumber}`,
        {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
          },
        }
      );
      const pr = await res.json();

      // Get checks
      let checksStatus = "unknown";
      try {
        const checksRes = await fetch(
          `https://api.github.com/repos/${repo}/commits/${pr.head?.sha}/check-runs`,
          {
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              Accept: "application/vnd.github+json",
            },
          }
        );
        const checks = await checksRes.json();
        if (checks.check_runs?.length) {
          const failed = checks.check_runs.filter(
            (c: { conclusion: string }) => c.conclusion === "failure"
          ).length;
          checksStatus = failed > 0 ? `${failed} failing` : "all passing";
        }
      } catch { /* checks unavailable */ }

      return {
        connectorType: "github",
        data: {
          repo,
          branch: pr.head?.ref || "unknown",
          prStatus: pr.state || "unknown",
          prNumber: prNumber.toString(),
          checks: checksStatus,
          title: pr.title || "",
          url: pr.html_url || "",
        },
        schemaVersion: 1,
      };
    } catch {
      return {
        connectorType: "github",
        data: {
          repo,
          branch: "unknown",
          prStatus: "error",
          prNumber: prNumber.toString(),
          checks: "unknown",
          title: "Error fetching PR",
          url: "",
        },
        schemaVersion: 1,
      };
    }
  },
});
