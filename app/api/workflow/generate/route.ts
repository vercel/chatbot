/**
 * Workflow Generation API — agent-driven workflow creation from natural language.
 *
 * POST { prompt: "every morning pull SMS from GHL last 24h post summary to Slack" }
 * → AI generates a structured workflow definition → returns nodes + edges
 *
 * Playbook auto-load: when connector tools are referenced in the generated workflow,
 * the PLAYBOOK.md sections for those connectors are injected into the AI prompt.
 */

import { getLanguageModel } from "@/lib/ai/providers";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { streamText } from "ai";
import {
  initConnectors,
} from "@/lib/connectors/init";
import {
  buildAllPlaybooksContext,
  resolveConnectorFromTool,
} from "@/lib/connectors/playbook-loader";
import { checkConnectorEnv } from "@/lib/connectors/registry";
import type { WorkflowNodeType } from "@/lib/workflow/types";
import { NODE_TYPE_META } from "@/lib/workflow/types";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

export const maxDuration = 60;

function generateNodeId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "node_";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export const POST = requireAllowlist(async (req: Request) => {
  // Validate internal token if configured (bypasses Vercel Deployment Protection)
  const expectedToken = process.env.NEPTUNE_INTERNAL_TOKEN;
  if (expectedToken) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token !== expectedToken) {
      // Fall through to public access if token not required
      // (token is only required when Vercel Deployment Protection is active)
      if (!token) {
        console.warn("[workflow/generate] No auth token provided, internal calls may fail behind Vercel DP");
      }
    }
  }

  const { prompt } = (await req.json().catch(() => ({}))) as {
    prompt?: string;
  };

  if (!prompt) {
    return Response.json(
      { error: "Missing required field: prompt" },
      { status: 400 }
    );
  }

  // Load playbook context for the AI
  let playbookContext = "";
  try {
    initConnectors();
    const { manifests } = await import("@/lib/connectors/init");
    const connectedIds = manifests
      .filter((m) => checkConnectorEnv(m.envKeys).ok)
      .map((m) => m.id);
    playbookContext = buildAllPlaybooksContext(connectedIds);
  } catch (_) {
    /* non-fatal */
  }

  const nodeTypeList = Object.entries(NODE_TYPE_META)
    .map(([type, meta]) => `- ${type} (${meta.label}): ${meta.description}`)
    .join("\n");

  const systemPrompt = `You are a workflow generation engine for the Neptune visual workflow builder. Given a natural language description, generate a structured workflow definition.

AVAILABLE NODE TYPES:
${nodeTypeList}

AVAILABLE CONNECTORS AND TOOLS:
- slack: listChannels, postMessage, pullMessages, reactionAdd, searchChannels
- ghl (GoHighLevel CRM): createContact, sendSms, sendEmail, queryConversations, getOpportunity
- github: searchCode, getFile, listPRs, createPR, spawnCodingAgent
- nmi (payments): getSubscription, getVault, queryTransactions, refundTransaction
- vercel: listDeploys, getDeployLog, listProjects, createProject, redeploy
- hyperswitch (payments): createPaymentLink, listPayments, refundPayment
- base44 (CRM/operations): createEntity, customer360, invokeFunction, queryEntity, reportingHub, updateEntity
- linear (issues): listIssues, createIssue, searchIssues, listProjects

${playbookContext ? `\nCONNECTOR PLAYBOOK CONTEXT:\n${playbookContext.slice(0, 5000)}` : ""}

OUTPUT FORMAT:
Return a JSON object with:
{
  "name": "short workflow name",
  "description": "one-line description",
  "category": "Operations|Finance|Communication|CRM|Engineering",
  "nodes": [
    {
      "id": "node_xxx",
      "type": "trigger|action|conditional|parallel|transform|ai|output",
      "position": { "x": 250, "y": 0 },
      "data": {
        "label": "Human-readable label",
        "nodeType": "trigger",
        "connectorId": "slack",   // for action nodes
        "toolName": "pullMessages", // for action nodes
        "triggerType": "cron",     // for trigger nodes
        "cronExpression": "0 8 * * *", // for cron triggers
        "prompt": "...",           // for ai nodes
        "modelId": "deepseek-v4-pro", // for ai nodes
        "condition": "...",        // for conditional nodes
        "outputType": "slack",     // for output nodes
        "outputConfig": {}         // for output nodes
      }
    }
  ],
  "edges": [
    {
      "id": "e-node1-node2",
      "source": "node_xxx",
      "target": "node_yyy",
      "data": { "animated": true }
    }
  ]
}

RULES:
1. Every workflow MUST start with a trigger node and end with an output node
2. Nodes should be positioned with increasing y (0, 120, 240, 360, etc.) at x=250
3. Each node should have a unique, descriptive label
4. Use the correct connectorId + toolName for action nodes
5. parallel nodes should have 2+ child nodes at different x positions
6. conditional nodes should have TWO output edges (true/false branches)
7. For cron triggers, use standard 5-field cron expressions
8. Keep descriptions under 100 characters
9. Generate 3-7 nodes for simple workflows, 5-12 for complex ones

RESPOND WITH ONLY THE JSON OBJECT, NO MARKDOWN FORMATTING.`;

  try {
    const model = getLanguageModel(DEFAULT_CHAT_MODEL);
    const result = streamText({
      model,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Create a workflow for: ${prompt}`,
        },
      ],
      temperature: 0.3,
      maxOutputTokens: 4096,
    });

    let fullText = "";
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }

    // Extract JSON from response
    const jsonMatch =
      fullText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      fullText.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || fullText) : fullText;

    try {
      const workflow = JSON.parse(jsonStr.trim());

      // Validate and fix node IDs
      if (Array.isArray(workflow.nodes)) {
        for (const node of workflow.nodes) {
          if (!node.id || node.id === "node_xxx") {
            node.id = generateNodeId();
          }
          // Ensure position is valid
          if (!node.position || !node.position.x) {
            node.position = { x: 250, y: 0 };
          }
        }
      }

      // Wire up edges if missing
      if (Array.isArray(workflow.nodes) && (!workflow.edges || workflow.edges.length === 0)) {
        workflow.edges = [];
        const sortedNodes = [...workflow.nodes].sort(
          (a, b) => (a.position?.y || 0) - (b.position?.y || 0)
        );
        for (let i = 0; i < sortedNodes.length - 1; i++) {
          if (sortedNodes[i].type !== "conditional") {
            workflow.edges.push({
              id: `e-${sortedNodes[i].id}-${sortedNodes[i + 1].id}`,
              source: sortedNodes[i].id,
              target: sortedNodes[i + 1].id,
              data: { animated: true },
            });
          }
        }
      }

      // Ensure edges have the right structure
      if (Array.isArray(workflow.edges)) {
        workflow.edges = workflow.edges.map((e: Record<string, unknown>) => ({
          ...e,
          id: e.id || `e-${e.source}-${e.target}`,
          data: { animated: true, ...(e.data as Record<string, unknown> || {}) },
        }));
      }

      return Response.json({
        workflow: {
          id: `wf_gen_${Date.now()}`,
          name: workflow.name || "Generated Workflow",
          description: workflow.description || prompt.slice(0, 100),
          category: workflow.category || "Operations",
          nodes: workflow.nodes || [],
          edges: workflow.edges || [],
          source: "agent",
          agentPrompt: prompt,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (parseErr) {
      return Response.json(
        {
          error: "Failed to parse AI-generated workflow",
          rawOutput: fullText.slice(0, 500),
          details: parseErr instanceof Error ? parseErr.message : "JSON parse error",
        },
        { status: 422 }
      );
    }
  } catch (err) {
    return Response.json(
      {
        error: "Workflow generation failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});
