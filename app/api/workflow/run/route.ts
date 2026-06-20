/**
 * Workflow SDK route — Durable workflow execution with WorkflowAgent.
 *
 * Uses @ai-sdk/workflow v1 (WorkflowAgent) for durable agent execution.
 * Tools wired: all inline tools + sandbox tools + MCP tools.
 * Streaming: SSE (Server-Sent Events) for real-time progress.
 */
import { WorkflowAgent } from "@ai-sdk/workflow";
import { getAvailableTools } from "@/lib/agent/inline-tools";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import { initConnectors } from "@/lib/connectors/init";
import {
  buildAllPlaybooksContext,
} from "@/lib/connectors/playbook-loader";
import { checkConnectorEnv } from "@/lib/connectors/registry";
import { sandboxTools } from "@/lib/sandbox/tools";
import { requireAllowlist } from "@/lib/auth/require-allowlist";
import type { ModelMessage } from "ai";

export const maxDuration = 300; // 5 min max for workflow

export const POST = requireAllowlist(async (req: Request) => {
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

  // ── Playbook Auto-Load ──────────────────────────────────────────────
  let playbookPrompt = "";
  try {
    initConnectors();
    const { manifests } = await import("@/lib/connectors/init");
    const connectedIds = manifests
      .filter((m) => checkConnectorEnv(m.envKeys).ok)
      .map((m) => m.id);
    const ctx = buildAllPlaybooksContext(connectedIds);
    if (ctx) {
      playbookPrompt = `\n\n## Connector Playbooks (Operational Context)\n\n${ctx}\n\n---\n*When using connector tools, follow the anti-patterns and safeguards from the playbooks above.*`;
    }
  } catch {
    /* non-fatal */
  }

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

        const systemPrompt = `You are Neptune Workflow, a durable AI agent designed for long-running tasks.
Your task: ${task}
${context ? `\nAdditional context: ${JSON.stringify(context)}` : ""}

You have access to all neptune tools including sandbox execution, V2 coding agent handoff,
Slack integration, database queries, knowledge search, and file system operations.

Complete the task thoroughly. If you encounter an error, try an alternative approach.
Report your final result at the end.${playbookPrompt}`;

        const agent = new WorkflowAgent({
          model,
          instructions: systemPrompt,
          tools: allTools,
          onStepEnd: ({ stepNumber, steps }) => {
            const lastStep = steps[steps.length - 1];
            if (lastStep?.text) {
              send({
                type: "step-end",
                stepNumber,
                textPreview: lastStep.text.slice(0, 500),
                timestamp: Date.now(),
              });
            }
          },
          onToolExecutionStart: ({ toolCall }) => {
            send({
              type: "tool-start",
              toolName: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              timestamp: Date.now(),
            });
          },
          onToolExecutionEnd: ({ toolCall, success, output, error }) => {
            send({
              type: "tool-end",
              toolName: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              success,
              outputPreview: success ? JSON.stringify(output).slice(0, 200) : undefined,
              error: !success ? String(error).slice(0, 200) : undefined,
              timestamp: Date.now(),
            });
          },
        });

        const messages: ModelMessage[] = [
          { role: "user", content: task },
        ] as ModelMessage[];

        const result = await agent.stream({
          messages,
          tools: allTools,
        });

        const fullText = result.steps
          .map((s) => s.text)
          .filter(Boolean)
          .join("\n");

        send({
          type: "done",
          fullText: fullText.slice(0, 5000),
          stepCount: result.steps.length,
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
});
