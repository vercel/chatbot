/**
 * runScript tool — Execute arbitrary code in ephemeral sandbox.
 * Pattern: One-shot ephemeral sandbox.
 */
import { tool } from "ai";
import { z } from "zod";
import { sandboxOrchestrator } from "../orchestrator";

export const runScriptTool = tool({
  description:
    "Execute JavaScript/TypeScript or Python code in a secure sandbox. Returns stdout, stderr, and exit code.",
  inputSchema: z.object({
    code: z.string().describe("The source code to execute"),
    runtime: z
      .enum(["node", "python"])
      .default("node")
      .describe("Runtime to use"),
    userId: z.string().describe("User ID for audit trail"),
  }),
  execute: async ({ code, runtime, userId }) => {
    const result = await sandboxOrchestrator.execute({
      tool: "runScript",
      userId,
      payload: { code, runtime },
    });
    return result;
  },
});
