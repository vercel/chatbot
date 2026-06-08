/**
 * ToolLoopAgent — Primary agent for neptune-chat.
 *
 * Aggregates ALL tools: knowledge, data, workflow, sandbox, v2-bridge, canvas, VPS bridge.
 * Uses DeepSeek V4 Pro as default model via AI Gateway.
 */
import { stepCountIs, ToolLoopAgent } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { sandboxTools } from "@/lib/sandbox/tools";
import { getAvailableTools } from "./inline-tools";

export function createToolLoopAgent(modelId?: string) {
  const allTools = {
    ...getAvailableTools(),
    ...sandboxTools,
  };

  return new ToolLoopAgent({
    model: getLanguageModel(modelId || "deepseek/deepseek-v4-pro"),
    tools: allTools,
    stopWhen: stepCountIs(20),
    instructions: `
You are Neptune, a production-grade AI assistant running on the Vercel AI stack.
You have access to knowledge tools (skills, PRDs, search), data tools (database queries, Slack, URL fetch),
workflow tools, sandbox execution tools, V2 coding agent bridge, and canvas rendering tools.

Always choose the most appropriate tool for the user's request:
- For knowledge questions: use readSkill, readPRD, searchKnowledge
- For data queries: use queryDatabase, pullSlackMessages, fetchURL
- For code execution: use runScript (sandbox)
- For complex coding: use spawnCodingAgent (hands off to V2)
- For Slack operations: use pullSlackMessages
- For workflows: use runWorkflow

Always report results clearly and concisely. If a tool fails, explain why and suggest alternatives.
`,
  });
}

export { sandboxTools } from "@/lib/sandbox/tools";
export { getAvailableToolNames, getAvailableTools } from "./inline-tools";
