/**
 * scrapeURL tool — Fetch and extract content from URLs using sandbox network access.
 * Pattern: One-shot ephemeral sandbox with network.
 */
import { tool } from "ai";
import { z } from "zod";
import { sandboxOrchestrator } from "../orchestrator";

export const scrapeURLTool = tool({
  description:
    "Fetch and extract content from a URL. Returns the page HTML/content.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to scrape"),
    selectors: z
      .array(z.string())
      .optional()
      .describe("CSS selectors to extract"),
    userId: z.string().describe("User ID for audit trail"),
  }),
  execute: async ({ url, selectors, userId }) => {
    const result = await sandboxOrchestrator.execute({
      tool: "scrapeURL",
      userId,
      payload: { url, selectors },
    });
    return result;
  },
});
