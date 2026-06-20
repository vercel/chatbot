/**
 * /api/workflows/code-refactor — Code refactoring workflow (Phase 6, migrated to WorkflowAgent)
 *
 * WorkflowAgent with 2 sub-agent tools:
 * - PatternMatcher: identifies code patterns and suggests improvements
 * - RiskAuditor: identifies breaking changes and risks
 *
 * POST { prompt: "Refactor the auth module to..." }
 * → SSE stream
 */

import { WorkflowAgent } from "@ai-sdk/workflow";
import { getLanguageModel } from "@/lib/ai/providers";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { requireAllowlist } from "@/lib/auth/require-allowlist";
import { z } from "zod";
import type { ModelMessage } from "ai";

export const maxDuration = 300;

export const POST = requireAllowlist(async (req: Request) => {
  const { prompt } = (await req.json().catch(() => ({}))) as { prompt?: string };
  if (!prompt) {
    return new Response(JSON.stringify({ error: "Missing prompt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const model = getLanguageModel(DEFAULT_CHAT_MODEL);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (d: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`));
      try {
        send({ type: "meta", workflow: "code-refactor", fanout: 2, timestamp: Date.now() });
        send({ type: "status", status: "analyzing", timestamp: Date.now() });

        const agent = new WorkflowAgent({
          model,
          instructions: `You are a Code Refactoring Orchestrator. Your job is to produce a comprehensive refactoring analysis.

Use the patternMatch tool to analyze code patterns and consistency.
Use the riskAudit tool to identify what could break.

Combine both analyses into a structured report with sections:
1. Pattern & Consistency Analysis
2. Risk & Safety Audit
3. Recommended Approach

The user wants to: ${prompt}`,
          tools: {
            patternMatch: {
              description:
                "Analyze code patterns, identify consistency issues, and suggest improvements aligned with project conventions. Provide concrete before/after code examples.",
              inputSchema: z.object({
                codeOrPrompt: z
                  .string()
                  .describe("The code or prompt to analyze for patterns"),
              }),
            },
            riskAudit: {
              description:
                "Identify what could break: API contracts, type changes, side effects, performance regressions, and test coverage gaps. Flag every risk with severity (P0/P1/P2).",
              inputSchema: z.object({
                codeOrPrompt: z
                  .string()
                  .describe("The code or prompt to audit for risks"),
              }),
            },
          },
          onToolExecutionStart: ({ toolCall }) => {
            send({
              type: "agent-start",
              toolName: toolCall.toolName,
              agentIndex: toolCall.toolName === "patternMatch" ? 0 : 1,
              timestamp: Date.now(),
            });
          },
          onToolExecutionEnd: ({ toolCall, success, output }) => {
            send({
              type: "agent-done",
              toolName: toolCall.toolName,
              agentIndex: toolCall.toolName === "patternMatch" ? 0 : 1,
              length: success ? JSON.stringify(output).length : 0,
              timestamp: Date.now(),
            });
          },
        });

        const messages: ModelMessage[] = [
          {
            role: "user",
            content: `Produce a code refactoring analysis for: ${prompt}\n\nFirst call patternMatch with the prompt. Then call riskAudit with the prompt. Then combine both into one structured report.`,
          },
        ] as ModelMessage[];

        const result = await agent.stream({ messages });
        const output =
          result.steps.map((s) => s.text).filter(Boolean).join("\n") ||
          "No analysis produced.";

        send({ type: "status", status: "combining", timestamp: Date.now() });
        send({ type: "result", output, timestamp: Date.now() });
        send({ type: "done", timestamp: Date.now() });
        controller.close();
      } catch (e) {
        send({ type: "error", error: String(e) });
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
