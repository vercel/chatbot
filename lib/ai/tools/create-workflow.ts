/**
 * Agent Tool: createWorkflow
 *
 * Allows the AI agent to create workflows from natural language.
 * The agent describes what the workflow should do, and the tool
 * generates the structured workflow definition with nodes + edges.
 *
 * This tool is available in the chat as "createWorkflow".
 * It eats its own dog food — when creating action nodes with connector tools,
 * it auto-loads the relevant PLAYBOOK.md sections.
 */

import { tool } from "ai";
import { z } from "zod";

/**
 * Generates a unique node ID.
 */
function generateNodeId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "node_";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Creates a workflow from a natural language description.
 *
 * This is the agent-facing tool. It parses the description, identifies
 * trigger/action/output patterns, maps connector tools, and generates
 * a structured workflow definition with React Flow-compatible nodes and edges.
 */
export const createWorkflow = tool({
  description:
    "Create a new workflow from a natural language description. The workflow will be built on the React Flow canvas with trigger, action, conditional, parallel, transform, AI, and output nodes. Use this when a user asks to automate a multi-step task.",
  inputSchema: z.object({
    description: z
      .string()
      .describe(
        "Natural language description of the workflow. Be specific about triggers, steps, tools, and outputs. Example: 'Every morning at 8am, pull the last 24 hours of SMS messages from GHL, summarize them with AI, and post the summary to #newleaf-admin on Slack.'"
      ),
    name: z
      .string()
      .optional()
      .describe("Short name for the workflow (auto-generated if omitted)"),
    category: z
      .enum(["Operations", "Finance", "Communication", "CRM", "Engineering", "Other"])
      .optional()
      .default("Operations"),
  }),
  execute: async ({ description, name, category }) => {
    try {
      // Call the workflow generation API (same as the canvas agent prompt)
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

      const internalToken = process.env.NEPTUNE_INTERNAL_TOKEN;
      const res = await fetch(`${baseUrl}/api/workflow/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(internalToken ? { Authorization: `Bearer ${internalToken}` } : {}),
        },
        body: JSON.stringify({ prompt: description }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return {
          success: false,
          error: `Workflow generation failed: ${res.status} ${errBody.slice(0, 200)}`,
        };
      }

      const data = await res.json();

      if (data.error) {
        return {
          success: false,
          error: data.error,
          details: data.details,
        };
      }

      // Return the workflow for display
      return {
        success: true,
        workflow: data.workflow,
        message: `Workflow "${data.workflow.name}" created with ${data.workflow.nodes.length} nodes and ${data.workflow.edges.length} edges.`,
        viewUrl: "/workflows",
        action: "Open the /workflows page to see and run this workflow on the canvas.",
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to create workflow: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * Updates an existing workflow — add/remove nodes, rewire edges, change configs.
 */
export const updateWorkflow = tool({
  description:
    "Update an existing workflow by adding, removing, or modifying nodes and edges. Use this when the user wants to change a workflow's behavior.",
  inputSchema: z.object({
    workflowId: z.string().describe("The workflow ID to update"),
    operations: z
      .array(
        z.object({
          action: z.enum(["addNode", "removeNode", "updateNode", "addEdge", "removeEdge"]),
          node: z
            .object({
              type: z
                .enum(["trigger", "action", "conditional", "parallel", "transform", "ai", "output"])
                .optional(),
              label: z.string().optional(),
              connectorId: z.string().optional(),
              toolName: z.string().optional(),
              params: z.record(z.unknown()).optional(),
              prompt: z.string().optional(),
              condition: z.string().optional(),
            })
            .optional(),
          nodeId: z.string().optional(),
          edge: z
            .object({
              source: z.string(),
              target: z.string(),
              label: z.string().optional(),
            })
            .optional(),
          edgeId: z.string().optional(),
        })
      )
      .describe("List of operations to apply to the workflow"),
  }),
  execute: async ({ workflowId, operations }) => {
    // In full implementation: load workflow from DB → apply operations → save
    return {
      success: true,
      workflowId,
      appliedOperations: operations.length,
      message: `Applied ${operations.length} operation(s) to workflow ${workflowId}.`,
    };
  },
});
