/**
 * Base44 invokeFunction — call any registered backend function
 */
import { tool } from "ai";
import { z } from "zod";
import { base44Service } from "../client";

export const invokeFunction = tool({
  description:
    "Invoke any Base44 backend function by name. For: reportingHub, nmiMcpBridge, slackMcpBridge, jarvisTaskManager, etc.",
  inputSchema: z.object({
    functionName: z
      .string()
      .describe(
        "Function name to invoke (e.g. 'reportingHubQuery', 'nmiMcpBridge')"
      ),
    payload: z
      .record(z.unknown())
      .optional()
      .describe("Payload to pass to the function"),
  }),
  execute: async ({ functionName, payload }) => {
    try {
      const result = await base44Service.functions.invoke(
        functionName,
        (payload as Record<string, unknown>) || {}
      );
      return { function: functionName, result };
    } catch (err) {
      return {
        error: `Function invoke failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});
