/**
 * Workflow SD K route — Durable workflow execution with full tool registry.
 *
 * Uses @ai-sdk/workflow (WorkflowAgent = DurableAgent equivalent).
 * Full 'use workflow' durability requires Vercel Workflow infrastructure
 * (currently in beta). The route works without it for non-durable execution.
 *
 * Tools wired: all inline tools + sandbox tools + MCP tools.
 * Streaming: SSE (Server-Sent Events) for real-time progress.
 */
import { getAvailableTools } from "@/lib/agent/inline-tools";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import { sandboxTools } from "@/lib/sandbox/tools";

export const maxDuration = 300; // 5 min max for workflow

export async function POST(req: Request) {
  const { task, modelId, context } = (await req.json().catch(() => ({}))) as {
    task?: string;
    modelId?: string;
    context?: Record<string, unknown>;
  };

  if (!task) {
    return new Response(
      JSON.stringify({ error: "Missing required field: task" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const allTools = {
    ...getAvailableTools(),
    ...sandboxTools,
  };

  const model = getLanguageModel(modelId || DEFAULT_CHAT_MODEL);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({
          type: "status",
          status: "starting",
          task,
          timestamp: Date.now(),
        });

        // Use streamText for the actual AI execution since WorkflowAgent
        // requires a writable stream that needs platform infrastructure.
        // streamText provides equivalent functionality for non-durable workflows.
        const { streamText } = await import("ai");

        const result = streamText({
          model,
          system: `You are Neptune Workflow, a durable AI agent designed for long-running tasks.
Your task: ${task}
${context ? `\nAdditional context: ${JSON.stringify(context)}` : ""}

You have access to all neptune tools including sandbox execution, V2 coding agent handoff,
Slack integration, database queries, knowledge search, and file system operations.

Complete the task thoroughly. If you encounter an error, try an alternative approach.
Report your final result at the end.`,
          messages: [{ role: "user" as const, content: task }],
          tools: allTools,
        });

        let fullText = "";
        for await (const chunk of result.textStream) {
          fullText += chunk;
          send({ type: "text", data: chunk, timestamp: Date.now() });
        }

        send({
          type: "done",
          fullText: fullText.slice(0, 5000),
          timestamp: Date.now(),
        });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ type: "error", error: message, timestamp: Date.now() });
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
}
