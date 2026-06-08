/**
 * runWorkflow tool — Execute multi-step workflows with optional fan-out.
 * Pattern: V2 handoff for complex multi-step work.
 */
import { tool } from "ai";
import { z } from "zod";
import { sandboxOrchestrator } from "../orchestrator";

export const runWorkflowTool = tool({
  description:
    "Execute a multi-step workflow. Each step runs in its own sandbox. Supports parallel fan-out.",
  inputSchema: z.object({
    steps: z
      .array(
        z.object({
          name: z.string().describe("Step name"),
          code: z.string().describe("Code to execute in this step"),
          runtime: z.enum(["node", "python"]).default("node"),
          dependsOn: z
            .array(z.string())
            .optional()
            .describe("Steps that must complete before this one"),
        })
      )
      .describe("Ordered list of workflow steps"),
    parallel: z
      .boolean()
      .default(false)
      .describe("Enable parallel fan-out for independent steps"),
    userId: z.string().describe("User ID for audit trail"),
  }),
  execute: async ({ steps, parallel, userId }) => {
    const result = await sandboxOrchestrator.execute({
      tool: "runWorkflow",
      userId,
      payload: { steps, parallel },
    });
    return result;
  },
});
