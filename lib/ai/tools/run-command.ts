import { tool } from "ai";
import { z } from "zod";

export const runCommand = tool({
  description:
    "Execute a shell command via the Blackbox Cloud API. Use this when the user asks to run a terminal command such as ls, npm, python, pip, bash, or any other shell command.",
  inputSchema: z.object({
    command: z
      .string()
      .describe(
        "The shell command to execute (e.g., 'ls -a', 'npm install', 'python --version')"
      ),
  }),
  needsApproval: true,
  execute: async ({ command }) => {
    const apiKey = process.env.BLACKBOX_API_KEY;

    if (!apiKey) {
      return {
        error:
          "BLACKBOX_API_KEY environment variable is not set. Cannot execute command.",
      };
    }

    let response: Response;

    try {
      response = await fetch("https://cloud.blackbox.ai/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: command,
          selectedAgents: [
            { agent: "blackbox", model: "blackboxai/blackbox-pro" },
          ],
          multiLaunch: false,
        }),
      });
    } catch (err) {
      return {
        error: `Network error while contacting Blackbox Cloud API: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (!response.ok) {
      return {
        error: `Blackbox Cloud API returned status ${response.status}: ${response.statusText}`,
      };
    }

    let data: unknown;

    try {
      data = await response.json();
    } catch {
      return {
        error: "Failed to parse response from Blackbox Cloud API.",
      };
    }

    return { result: data };
  },
});
