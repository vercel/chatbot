/**
 * Phase 31: CRM Action Registry
 *
 * 15 generative CRM actions with permissions, risk levels, and Twenty GraphQL mutations.
 * Each action defines: name, description, parameters (Zod), requiredRole, riskLevel,
 * twentyMutation, and missionCardConfig.
 *
 * Risk levels:
 *   LOW  — Auto-execute (addNote, tagPerson, createActivity)
 *   MED  — Confirmation modal (updatePersonField, sendSMS, sendPaymentLink)
 *   HIGH — Two-factor confirmation (cancelSubscription, createDispute)
 */

import { z } from "zod";

export type CrmRiskLevel = "low" | "medium" | "high";
export type CrmRole = "sales_agent" | "admin" | "superadmin";

export interface CrmActionDefinition {
  /** Unique action name */
  name: string;
  /** Human-readable description */
  description: string;
  /** Category for UI grouping */
  category: "person" | "billing" | "communication" | "ticket" | "dispute";
  /** Zod schema for parameters */
  paramsSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  /** Required role to execute */
  requiredRole: CrmRole;
  /** Risk level: low=auto, medium=confirm, high=2FA */
  riskLevel: CrmRiskLevel;
  /** Twenty GraphQL mutation template ({{param}} placeholders) */
  twentyMutation: string;
  /** Human description of mutation for audit trail */
  mutationDescription: string;
  /** Natural language trigger phrases */
  triggerPhrases: string[];
  /** Whether this mutation returns a result (for confirmation display) */
  hasResult: boolean;
}

// ── Parameter Schemas ─────────────────────────────────────────────────────

const PersonIdSchema = z.object({
  personId: z.string().describe("Twenty Person ID or Base44 CustomerProfile ID"),
  personName: z.string().optional().describe("Display name for audit trail"),
});

const AmountSchema = z.object({
  amount: z.number().positive().describe("Amount in USD"),
  currency: z.string().default("USD").describe("Currency code"),
});

// ── 15 Action Definitions ──────────────────────────────────────────────────

export const CRM_ACTIONS: CrmActionDefinition[] = [
  // ── Person Actions ─────────────────────────────────────────────────────
  {
    name: "updatePersonStatus",
    description: "Update a person's status in Twenty CRM",
    category: "person",
    paramsSchema: PersonIdSchema.extend({
      status: z.enum(["active", "paused", "churned", "lead", "customer"]),
    }),
    requiredRole: "admin",
    riskLevel: "medium",
    twentyMutation: `
      mutation UpdatePerson($id: ID!, $data: PersonUpdateInput!) {
        updatePerson(id: $id, data: $data) { id status }
      }`,
    mutationDescription: "Updates person status",
    triggerPhrases: ["update status", "change status to", "set status"],
    hasResult: true,
  },
  {
    name: "updatePersonField",
    description: "Update any non-NMI field on a person record",
    category: "person",
    paramsSchema: PersonIdSchema.extend({
      field: z.string().describe("Field name to update (e.g., notes, phone, city)"),
      value: z.string().describe("New value for the field"),
    }),
    requiredRole: "sales_agent",
    riskLevel: "medium",
    twentyMutation: `
      mutation UpdatePerson($id: ID!, $data: PersonUpdateInput!) {
        updatePerson(id: $id, data: $data) { id }
      }`,
    mutationDescription: "Updates person field",
    triggerPhrases: ["update", "change", "set", "edit field"],
    hasResult: true,
  },
  {
    name: "addNote",
    description: "Add an internal note to a person's CRM record",
    category: "person",
    paramsSchema: PersonIdSchema.extend({
      note: z.string().min(1).max(2000).describe("Note content"),
    }),
    requiredRole: "sales_agent",
    riskLevel: "low",
    twentyMutation: `
      mutation UpdatePerson($id: ID!, $data: PersonUpdateInput!) {
        updatePerson(id: $id, data: $data) { id notes }
      }`,
    mutationDescription: "Adds note to person",
    triggerPhrases: ["add note", "add a note", "note that", "noted", "write note"],
    hasResult: true,
  },
  {
    name: "assignToAgent",
    description: "Assign a person to a different sales agent",
    category: "person",
    paramsSchema: PersonIdSchema.extend({
      agentEmail: z.string().email().describe("Agent's email address"),
    }),
    requiredRole: "admin",
    riskLevel: "medium",
    twentyMutation: `
      mutation UpdatePerson($id: ID!, $data: PersonUpdateInput!) {
        updatePerson(id: $id, data: $data) { id agentEmail }
      }`,
    mutationDescription: "Assigns person to agent",
    triggerPhrases: ["assign to", "reassign", "transfer to"],
    hasResult: true,
  },
  {
    name: "tagPerson",
    description: "Add a tag/label to a person",
    category: "person",
    paramsSchema: PersonIdSchema.extend({
      tag: z.string().min(1).max(64).describe("Tag to add"),
    }),
    requiredRole: "sales_agent",
    riskLevel: "low",
    twentyMutation: `
      mutation UpdatePerson($id: ID!, $data: PersonUpdateInput!) {
        updatePerson(id: $id, data: $data) { id }
      }`,
    mutationDescription: "Tags person",
    triggerPhrases: ["tag", "label", "mark as"],
    hasResult: true,
  },

  // ── Billing/Subscription Actions ─────────────────────────────────────────
  {
    name: "createSubscription",
    description: "Create a new subscription for a person",
    category: "billing",
    paramsSchema: PersonIdSchema.merge(AmountSchema).extend({
      frequency: z.enum(["weekly", "biweekly", "monthly", "quarterly", "annually"]),
    }),
    requiredRole: "admin",
    riskLevel: "high",
    twentyMutation: `
      mutation CreateSubscription($data: SubscriptionCreateInput!) {
        createSubscription(data: $data) { id amount frequency }
      }`,
    mutationDescription: "Creates new subscription",
    triggerPhrases: ["create subscription", "new subscription", "start subscription"],
    hasResult: true,
  },
  {
    name: "updateSubscriptionAmount",
    description: "Update a subscription's billing amount",
    category: "billing",
    paramsSchema: z.object({
      subscriptionId: z.string().describe("Subscription ID"),
      newAmount: z.number().positive().describe("New amount in USD"),
    }),
    requiredRole: "admin",
    riskLevel: "high",
    twentyMutation: `
      mutation UpdateSubscription($id: ID!, $data: SubscriptionUpdateInput!) {
        updateSubscription(id: $id, data: $data) { id amount }
      }`,
    mutationDescription: "Updates subscription amount",
    triggerPhrases: ["change amount", "update amount to", "adjust billing"],
    hasResult: true,
  },
  {
    name: "pauseSubscription",
    description: "Pause a subscription until a given date",
    category: "billing",
    paramsSchema: z.object({
      subscriptionId: z.string().describe("Subscription ID"),
      until: z.string().describe("ISO date until which subscription is paused"),
      reason: z.string().optional().describe("Reason for pause"),
    }),
    requiredRole: "admin",
    riskLevel: "high",
    twentyMutation: `
      mutation UpdateSubscription($id: ID!, $data: SubscriptionUpdateInput!) {
        updateSubscription(id: $id, data: $data) { id status }
      }`,
    mutationDescription: "Pauses subscription",
    triggerPhrases: ["pause subscription", "put on hold", "suspend billing"],
    hasResult: true,
  },
  {
    name: "cancelSubscription",
    description: "Cancel a subscription permanently",
    category: "billing",
    paramsSchema: z.object({
      subscriptionId: z.string().describe("Subscription ID"),
      reason: z.string().min(1).max(500).describe("Cancellation reason"),
    }),
    requiredRole: "admin",
    riskLevel: "high",
    twentyMutation: `
      mutation CancelSubscription($id: ID!, $data: SubscriptionUpdateInput!) {
        updateSubscription(id: $id, data: $data) { id status cancellationReason }
      }`,
    mutationDescription: "Cancels subscription permanently",
    triggerPhrases: ["cancel subscription", "cancel billing", "stop subscription", "terminate"],
    hasResult: true,
  },

  // ── Communication Actions ────────────────────────────────────────────────
  {
    name: "sendPaymentLink",
    description: "Send a payment link to a person via SMS/email",
    category: "communication",
    paramsSchema: PersonIdSchema.merge(AmountSchema).extend({
      method: z.enum(["sms", "email"]).default("sms"),
      description: z.string().optional().describe("Payment description"),
    }),
    requiredRole: "sales_agent",
    riskLevel: "medium",
    twentyMutation: `
      mutation CreateActivity($data: ActivityCreateInput!) {
        createActivity(data: $data) { id }
      }`,
    mutationDescription: "Sends payment link and logs activity",
    triggerPhrases: ["send payment link", "send invoice", "collect payment", "request payment"],
    hasResult: true,
  },
  {
    name: "sendSMS",
    description: "Send an SMS message to a person",
    category: "communication",
    paramsSchema: PersonIdSchema.extend({
      message: z.string().min(1).max(1600).describe("SMS message content"),
      phoneOverride: z.string().optional().describe("Override phone number"),
    }),
    requiredRole: "sales_agent",
    riskLevel: "medium",
    twentyMutation: `
      mutation CreateActivity($data: ActivityCreateInput!) {
        createActivity(data: $data) { id }
      }`,
    mutationDescription: "Sends SMS and logs activity",
    triggerPhrases: ["send sms", "text them", "send text", "message them"],
    hasResult: true,
  },

  // ── Ticket Actions ───────────────────────────────────────────────────────
  {
    name: "createSupportTicket",
    description: "Create a support ticket linked to a person",
    category: "ticket",
    paramsSchema: PersonIdSchema.extend({
      title: z.string().min(1).max(200).describe("Ticket title"),
      description: z.string().min(1).max(5000).describe("Ticket description"),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    }),
    requiredRole: "sales_agent",
    riskLevel: "low",
    twentyMutation: `
      mutation CreateSupportTicket($data: CreateSupportTicketInput!) {
        createSupportTicket(data: $data) { id title status }
      }`,
    mutationDescription: "Creates support ticket",
    triggerPhrases: ["create ticket", "open ticket", "file ticket", "support ticket"],
    hasResult: true,
  },
  {
    name: "createActivity",
    description: "Log a CRM activity for a person",
    category: "person",
    paramsSchema: PersonIdSchema.extend({
      activityType: z.enum(["call", "email", "meeting", "note", "task"]),
      content: z.string().min(1).max(5000).describe("Activity content"),
    }),
    requiredRole: "sales_agent",
    riskLevel: "low",
    twentyMutation: `
      mutation CreateActivity($data: ActivityCreateInput!) {
        createActivity(data: $data) { id }
      }`,
    mutationDescription: "Logs CRM activity",
    triggerPhrases: ["log call", "log meeting", "record activity", "create activity"],
    hasResult: true,
  },

  // ── Dispute Actions ──────────────────────────────────────────────────────
  {
    name: "createDispute",
    description: "Create a credit dispute for a person",
    category: "dispute",
    paramsSchema: PersonIdSchema.extend({
      bureau: z.enum(["experian", "equifax", "transunion"]),
      accountInfo: z.string().min(1).max(1000).describe("Account details for dispute"),
      reason: z.string().optional().describe("Dispute reason"),
    }),
    requiredRole: "admin",
    riskLevel: "high",
    twentyMutation: `
      mutation CreateDispute($data: DisputeCreateInput!) {
        createDispute(data: $data) { id status bureau }
      }`,
    mutationDescription: "Creates credit dispute",
    triggerPhrases: ["create dispute", "file dispute", "dispute item", "start dispute"],
    hasResult: true,
  },
  {
    name: "scheduleFollowUp",
    description: "Schedule a follow-up task/reminder for a person",
    category: "person",
    paramsSchema: PersonIdSchema.extend({
      followUpType: z.enum(["call", "email", "sms", "meeting"]),
      scheduledDate: z.string().describe("ISO date for follow-up"),
      notes: z.string().optional().describe("Follow-up notes"),
    }),
    requiredRole: "sales_agent",
    riskLevel: "low",
    twentyMutation: `
      mutation CreateActivity($data: ActivityCreateInput!) {
        createActivity(data: $data) { id }
      }`,
    mutationDescription: "Schedules follow-up activity",
    triggerPhrases: ["schedule", "follow up", "remind me to", "set reminder"],
    hasResult: true,
  },
];

// ── Helper Functions ───────────────────────────────────────────────────────

export function getAction(name: string): CrmActionDefinition | undefined {
  return CRM_ACTIONS.find((a) => a.name === name);
}

export function getActionsByRiskLevel(risk: CrmRiskLevel): CrmActionDefinition[] {
  return CRM_ACTIONS.filter((a) => a.riskLevel === risk);
}

export function getActionsByCategory(category: CrmActionDefinition["category"]): CrmActionDefinition[] {
  return CRM_ACTIONS.filter((a) => a.category === category);
}

export function getActionsByRole(role: CrmRole): CrmActionDefinition[] {
  // "sales_agent" can do sales_agent actions only
  // "admin" can do sales_agent + admin actions
  // "superadmin" can do everything
  const hierarchy: Record<CrmRole, number> = {
    sales_agent: 1,
    admin: 2,
    superadmin: 3,
  };
  const userLevel = hierarchy[role];
  return CRM_ACTIONS.filter((a) => hierarchy[a.requiredRole] <= userLevel);
}

/**
 * Score an action's match confidence against a natural language phrase.
 * Returns 0-1 where 1 = perfect match.
 */
export function scoreActionMatch(action: CrmActionDefinition, phrase: string): number {
  const lower = phrase.toLowerCase();
  let bestScore = 0;

  for (const trigger of action.triggerPhrases) {
    const triggerLower = trigger.toLowerCase();
    if (lower.includes(triggerLower)) {
      // Longer trigger match = higher score
      const score = triggerLower.length / lower.length;
      if (score > bestScore) bestScore = score;
    }
    // Exact match gets bonus
    if (lower === triggerLower) {
      return 1.0;
    }
  }

  return bestScore;
}

/**
 * Find the best matching action for a natural language phrase.
 * Returns null if no action scores above threshold.
 */
export function detectAction(phrase: string, minScore = 0.1): CrmActionDefinition | null {
  let bestAction: CrmActionDefinition | null = null;
  let bestScore = 0;

  for (const action of CRM_ACTIONS) {
    const score = scoreActionMatch(action, phrase);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }

  return bestScore >= minScore ? bestAction : null;
}
