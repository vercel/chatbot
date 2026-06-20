/**
 * /api/workflows/data-audit — Data integrity audit workflow (Phase 6, migrated to WorkflowAgent)
 *
 * WorkflowAgent with 2 sub-agent tools:
 * - completenessCheck: checks for missing fields, nulls, format issues
 * - anomalyDetect: finds statistical outliers and impossible combinations
 *
 * POST { prompt: "Audit customer records for duplicates" }
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
        send({ type: "meta", workflow: "data-audit", fanout: 2, timestamp: Date.now() });
        send({ type: "status", status: "auditing", timestamp: Date.now() });

        const agent = new WorkflowAgent({
          model,
          instructions: `You are a Data Quality Lead orchestrating a data audit. Your job is to produce a consolidated audit report.

Use the completenessCheck tool to audit data completeness (missing fields, nulls, format issues, orphaned references).
Use the anomalyDetect tool to detect anomalies (outliers, impossible combinations, duplicates, pattern breaks).

After both tools return, merge the findings into one prioritized action plan grouped as CRITICAL/HIGH/MEDIUM/LOW.
For each finding state the evidence, impact, and remediation.

Audit scope: ${prompt}`,
          tools: {
            completenessCheck: {
              description:
                "Audit data completeness. Check for: missing required fields, null values where data is expected, inconsistent formats (dates, phones, emails), truncated values, and orphaned references. Produce severity-ranked findings with record counts and examples.",
              inputSchema: z.object({
                scope: z
                  .string()
                  .describe("What to audit for completeness"),
              }),
            },
            anomalyDetect: {
              description:
                "Detect data anomalies. Check for: statistical outliers, unusual value distributions, impossible combinations (e.g., negative amounts, future dates for past events), duplicate records, and pattern breaks. Flag anomalies with confidence levels and investigation priority.",
              inputSchema: z.object({
                scope: z
                  .string()
                  .describe("What to audit for anomalies"),
              }),
            },
          },
          onToolExecutionStart: ({ toolCall }) => {
            send({
              type: "agent-start",
              toolName: toolCall.toolName,
              agentIndex: toolCall.toolName === "completenessCheck" ? 0 : 1,
              timestamp: Date.now(),
            });
          },
          onToolExecutionEnd: ({ toolCall, success, output }) => {
            send({
              type: "agent-done",
              toolName: toolCall.toolName,
              agentIndex: toolCall.toolName === "completenessCheck" ? 0 : 1,
              length: success ? JSON.stringify(output).length : 0,
              timestamp: Date.now(),
            });
          },
        });

        const messages: ModelMessage[] = [
          {
            role: "user",
            content: `Run a data audit for: ${prompt}\n\nFirst call completenessCheck with this scope. Then call anomalyDetect with this scope. After both return, produce a consolidated audit report with findings grouped by severity.`,
          },
        ] as ModelMessage[];

        const result = await agent.stream({ messages });
        const output =
          result.steps.map((s) => s.text).filter(Boolean).join("\n") ||
          "No audit results produced.";

        send({ type: "status", status: "consolidating", timestamp: Date.now() });
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
