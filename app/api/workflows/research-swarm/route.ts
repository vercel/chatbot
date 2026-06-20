/**
 * /api/workflows/research-swarm — Research swarm workflow (Phase 6, migrated to WorkflowAgent)
 *
 * WorkflowAgent with 3 sub-agent tools:
 * - researchAnalyze: systematic evidence-based exploration
 * - researchSkeptic: challenge every claim, find gaps
 * - researchSynthesize: combine perspectives into coherent narrative
 *
 * POST { prompt: "Research topic X" }
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
        send({ type: "meta", workflow: "research-swarm", fanout: 3, timestamp: Date.now() });
        send({ type: "status", status: "researching", timestamp: Date.now() });

        const agent = new WorkflowAgent({
          model,
          instructions: `You are a Consensus Synthesizer orchestrating a research swarm. Your job is to combine multiple research perspectives into one coherent report.

Use these tools to gather research:
- researchAnalyze: Systematic exploration — gather facts, cite sources, organize by theme. Be exhaustive and evidence-based.
- researchSkeptic: Challenge every claim — what evidence is missing? What are counterarguments, risks, or failure modes? Identify gaps.
- researchSynthesize: Combine insights — find connections, reconcile differences, produce a narrative a non-expert can understand.

After all tools return, produce a unified research synthesis. Highlight agreements, note disagreements, and give a unified conclusion.

Research topic: ${prompt}`,
          tools: {
            researchAnalyze: {
              description:
                "Systematically explore the topic: gather facts, cite sources, organize findings by theme. Be exhaustive and evidence-based. Structure with clear sections.",
              inputSchema: z.object({
                topic: z.string().describe("The research topic to explore"),
              }),
            },
            researchSkeptic: {
              description:
                "Challenge every claim. What evidence is missing? What are the counterarguments? What are the failure modes or risks? Identify gaps in the prevailing narrative.",
              inputSchema: z.object({
                topic: z
                  .string()
                  .describe("The research topic to challenge"),
              }),
            },
            researchSynthesize: {
              description:
                "Combine and reconcile diverse insights. Find connections between disparate findings. Produce a clear, narrative-driven synthesis that a non-expert can understand.",
              inputSchema: z.object({
                findings: z
                  .string()
                  .describe("The findings from the other research tools to synthesize"),
              }),
            },
          },
          onToolExecutionStart: ({ toolCall }) => {
            const idxMap: Record<string, number> = {
              researchAnalyze: 0,
              researchSkeptic: 1,
              researchSynthesize: 2,
            };
            send({
              type: "agent-start",
              toolName: toolCall.toolName,
              agentIndex: idxMap[toolCall.toolName] ?? 0,
              timestamp: Date.now(),
            });
          },
          onToolExecutionEnd: ({ toolCall, success, output }) => {
            const idxMap: Record<string, number> = {
              researchAnalyze: 0,
              researchSkeptic: 1,
              researchSynthesize: 2,
            };
            send({
              type: "agent-done",
              toolName: toolCall.toolName,
              agentIndex: idxMap[toolCall.toolName] ?? 0,
              length: success ? JSON.stringify(output).length : 0,
              timestamp: Date.now(),
            });
          },
        });

        const messages: ModelMessage[] = [
          {
            role: "user",
            content: `Research this topic: ${prompt}\n\nFirst call researchAnalyze to explore the topic systematically. Then call researchSkeptic to challenge the findings. Finally call researchSynthesize with the combined findings to produce a unified synthesis.`,
          },
        ] as ModelMessage[];

        const result = await agent.stream({ messages });
        const output =
          result.steps.map((s) => s.text).filter(Boolean).join("\n") ||
          "No research results produced.";

        send({ type: "status", status: "synthesizing", timestamp: Date.now() });
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
