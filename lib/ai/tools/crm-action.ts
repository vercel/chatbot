/**
 * Phase 31: CRM Action AI Tool
 *
 * Exposed to the LLM as a callable tool for executing CRM actions.
 * The LLM calls this with an action name + parameters, and it returns
 * either a MissionCard-compatible result or a confirmation request.
 *
 * Tool name: executeCrmAction
 * Role: routes user CRM requests through the Twenty GraphQL API
 */

import { tool } from "ai";
import { z } from "zod";
import { CRM_ACTIONS, getAction } from "@/lib/crm-actions/registry";
import {
  executeCrmAction,
  getConfirmationRequirement,
  validatePermission,
} from "@/lib/crm-actions/execute";
import type { CrmRole } from "@/lib/crm-actions/registry";

export const executeCrmActionTool = tool({
  description: `Execute a CRM action against Twenty CRM. Use this when the user wants to:
- Update a person's status, field, notes, or tags
- Create support tickets, activities, or disputes
- Manage subscriptions (create, update, pause, cancel)
- Send communications (SMS, payment links)
- Schedule follow-ups or assign agents

Available actions: ${CRM_ACTIONS.map((a) => a.name).join(", ")}

Risk levels:
- LOW (auto-execute): addNote, tagPerson, createActivity, createSupportTicket, scheduleFollowUp
- MEDIUM (needs confirmation): updatePersonStatus, updatePersonField, assignToAgent, sendPaymentLink, sendSMS
- HIGH (needs two-factor): createSubscription, updateSubscriptionAmount, pauseSubscription, cancelSubscription, createDispute

When you call this tool, it returns either:
- A completed result with audit ID
- A confirmation request that needs user approval before execution`,

  inputSchema: z.object({
    actionName: z
      .string()
      .describe(
        `The CRM action to execute. One of: ${CRM_ACTIONS.map((a) => a.name).join(", ")}`
      ),
    personId: z
      .string()
      .optional()
      .describe("Twenty Person ID or Base44 CustomerProfile ID"),
    personName: z.string().optional().describe("Person's display name"),
    params: z
      .record(z.any())
      .optional()
      .describe("Additional parameters specific to the action"),
    confirmed: z
      .boolean()
      .optional()
      .default(false)
      .describe("Set to true if user has confirmed the action"),
  }),

  execute: async (input) => {
    const action = getAction(input.actionName);
    if (!action) {
      return {
        success: false,
        error: `Unknown action: "${input.actionName}". Available: ${CRM_ACTIONS.map((a) => a.name).join(", ")}`,
        hint: "Ask the user to clarify which CRM action they want",
      };
    }

    // Merge params
    const mergedParams: Record<string, unknown> = {
      personId: input.personId,
      personName: input.personName,
      ...(input.params ?? {}),
    };

    const result = await executeCrmAction({
      actionName: input.actionName,
      params: mergedParams,
      userRole: "admin", // Default role from session — override in production with actual session
      confirmed: input.confirmed ?? false,
    });

    // Format for MissionCard compatibility
    return {
      ...result,
      actionName: input.actionName,
      actionDescription: action.description,
      riskLevel: action.riskLevel,
      missionCardTitle: `${action.description}${input.personName ? ` for ${input.personName}` : ""}`,
      nextStep: result.requiresConfirmation
        ? "User confirmation required — ask the user to confirm before proceeding"
        : result.success
          ? "Action completed successfully — MissionCard will update"
          : `Action failed: ${result.error}`,
    };
  },
});

/**
 * Register this tool in the AI tool registry.
 * Called from app initialization.
 */
export function registerCrmActionTool() {
  return {
    name: "executeCrmAction",
    tool: executeCrmActionTool,
  };
}
