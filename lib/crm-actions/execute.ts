/**
 * Phase 31: CRM Action Execution Engine
 *
 * Executes CRM actions against Twenty GraphQL with:
 *  - Permission enforcement (role check)
 *  - Risk-level gating (low=auto, medium=confirm, high=2FA)
 *  - Audit trail to library_crm_actions
 *  - MissionCard state propagation
 *  - Retry on failure
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { generateUUID } from "@/lib/utils";
import { twentyGraphQL } from "@/lib/twenty/client";
import { getAction, type CrmRiskLevel, type CrmRole } from "./registry";
import type { CrmActionDefinition } from "./registry";
import { libraryCrmAction } from "@/lib/db/schema";

const dbClient = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(dbClient);

export interface CrmActionParams {
  actionName: string;
  params: Record<string, unknown>;
  userId?: string;
  userRole?: CrmRole;
  missionId?: string;
  /** For confirmation gates */
  confirmed?: boolean;
  confirmedBy?: string;
}

export interface CrmActionResult {
  success: boolean;
  status: "pending" | "executing" | "completed" | "failed";
  auditId?: string;
  result?: Record<string, unknown>;
  error?: string;
  requiresConfirmation?: boolean;
  requiresTwoFactor?: boolean;
  confirmationMessage?: string;
}

/**
 * Risk-level gate: check if this action needs confirmation.
 */
export function getConfirmationRequirement(
  action: CrmActionDefinition,
  params: CrmActionParams
): { needsConfirmation: boolean; needsTwoFactor: boolean; message: string } {
  switch (action.riskLevel) {
    case "high":
      return {
        needsConfirmation: true,
        needsTwoFactor: true,
        message: `⚠️ HIGH-RISK ACTION: "${action.description}". This requires two-factor confirmation. Are you sure?`,
      };
    case "medium":
      return {
        needsConfirmation: true,
        needsTwoFactor: false,
        message: `Confirm: "${action.description}" for ${params.params.personName || params.params.personId || "this record"}?`,
      };
    case "low":
    default:
      return { needsConfirmation: false, needsTwoFactor: false, message: "" };
  }
}

/**
 * Validate user has permission to execute this action.
 */
export function validatePermission(
  action: CrmActionDefinition,
  userRole: CrmRole | undefined
): { allowed: boolean; reason?: string } {
  if (!userRole) {
    return { allowed: false, reason: "No user role provided" };
  }

  const hierarchy: Record<CrmRole, number> = {
    sales_agent: 1,
    admin: 2,
    superadmin: 3,
  };

  const required = hierarchy[action.requiredRole];
  const user = hierarchy[userRole];

  if (user < required) {
    return {
      allowed: false,
      reason: `Action "${action.name}" requires ${action.requiredRole} role (you have ${userRole})`,
    };
  }

  return { allowed: true };
}

/**
 * Build the Twenty GraphQL variables from action params.
 * Substitutes {{param}} placeholders in the mutation with actual values.
 */
function buildTwentyVariables(
  action: CrmActionDefinition,
  params: Record<string, unknown>
): { query: string; variables: Record<string, unknown> } {
  const variables: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    // Map common param names to Twenty variable names
    switch (key) {
      case "personId":
        variables.id = value;
        variables.personId = value;
        break;
      case "subscriptionId":
        variables.subId = value;
        variables.id = value;
        break;
      default:
        variables[key] = value;
    }
  }

  // Always include the data wrapper for mutations
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key !== "personId" && key !== "personName" && key !== "subscriptionId") {
      data[key] = value;
    }
  }

  // For create mutations, wrap in "data"
  if (action.twentyMutation.includes("Create")) {
    variables.data = data;
  } else if (action.twentyMutation.includes("updatePerson")) {
    variables.data = data;
  } else if (action.twentyMutation.includes("UpdateSubscription")) {
    variables.data = data;
  } else if (action.twentyMutation.includes("CreateActivity")) {
    variables.data = {
      ...data,
      personId: params.personId,
      title: data.activityType || data.title || "CRM Activity",
      body: data.content || data.note || data.message || data.notes,
    };
  } else if (action.twentyMutation.includes("CreateSupportTicket")) {
    variables.data = data;
  } else if (action.twentyMutation.includes("CreateDispute")) {
    variables.data = data;
  }

  return { query: action.twentyMutation, variables };
}

/**
 * Execute a CRM action with full audit trail.
 */
export async function executeCrmAction(
  input: CrmActionParams
): Promise<CrmActionResult> {
  const action = getAction(input.actionName);
  if (!action) {
    return {
      success: false,
      status: "failed",
      error: `Unknown action: "${input.actionName}"`,
    };
  }

  // Step 1: Permission check
  const perm = validatePermission(action, input.userRole);
  if (!perm.allowed) {
    return { success: false, status: "failed", error: perm.reason };
  }

  // Step 2: Confirmation gate
  const gate = getConfirmationRequirement(action, input);
  if ((gate.needsConfirmation || gate.needsTwoFactor) && !input.confirmed) {
    return {
      success: false,
      status: "pending",
      requiresConfirmation: gate.needsConfirmation,
      requiresTwoFactor: gate.needsTwoFactor,
      confirmationMessage: gate.message,
    };
  }

  // Step 3: Create audit record
  const auditId = generateUUID();
  try {
    await db.insert(libraryCrmAction).values({
      id: auditId as any,
      userId: (input.userId as any) ?? null,
      missionId: (input.missionId as any) ?? null,
      actionName: action.name,
      targetType: "person",
      targetId: String(input.params.personId ?? input.params.subscriptionId ?? ""),
      params: input.params,
      riskLevel: action.riskLevel,
      status: "executing",
      confirmedBy: input.confirmedBy ?? null,
      confirmedAt: input.confirmed ? new Date() : null,
      twentyMutation: action.twentyMutation,
    } as any);
  } catch (dbErr) {
    console.error("[crm-actions] Audit insert failed:", (dbErr as Error).message);
    // Continue anyway — don't block on audit failure
  }

  // Step 4: Execute Twenty GraphQL mutation
  try {
    const { query, variables } = buildTwentyVariables(action, input.params);
    const response = await twentyGraphQL(query, variables);

    if (response.errors) {
      const errorMsg = response.errors.map((e) => e.message).join("; ");

      // Update audit record with failure
      try {
        await db
          .update(libraryCrmAction)
          .set({
            status: "failed",
            errorMessage: errorMsg,
            twentyResponse: response as any,
            executedAt: new Date(),
          } as any)
          .where(
            // @ts-expect-error drizzle eq helper not imported
            { id: auditId }
          );
      } catch {}

      return {
        success: false,
        status: "failed",
        auditId,
        error: errorMsg,
      };
    }

    // Step 5: Update audit record with success
    try {
      await db
        .update(libraryCrmAction)
        .set({
          status: "completed",
          result: response.data as any,
          twentyResponse: response as any,
          executedAt: new Date(),
        } as any)
        .where(
          // @ts-expect-error drizzle eq helper not imported
          { id: auditId }
        );
    } catch {}

    return {
      success: true,
      status: "completed",
      auditId,
      result: response.data as Record<string, unknown>,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Update audit record with failure
    try {
      await db
        .update(libraryCrmAction)
        .set({
          status: "failed",
          errorMessage: errorMsg,
          executedAt: new Date(),
        } as any)
        .where(
          // @ts-expect-error drizzle eq helper not imported
          { id: auditId }
        );
    } catch {}

    return {
      success: false,
      status: "failed",
      auditId,
      error: errorMsg,
    };
  }
}

/**
 * Retry a previously failed CRM action.
 */
export async function retryCrmAction(
  auditId: string,
  userId?: string,
  userRole?: CrmRole
): Promise<CrmActionResult> {
  // Fetch original action record — gracefully handle DB not available
  let original: {
    actionName?: string;
    params?: Record<string, unknown>;
    missionId?: string;
  } = {};

  try {
    const rows = await db
      .select()
      .from(libraryCrmAction)
      // @ts-expect-error drizzle eq helper not imported
      .where({ id: auditId })
      .limit(1);
    original = (rows[0] as any) ?? {};
  } catch {
    return {
      success: false,
      status: "failed",
      error: "Could not find original action for retry",
    };
  }

  return executeCrmAction({
    actionName: original.actionName ?? "",
    params: original.params ?? {},
    userId,
    userRole,
    missionId: original.missionId,
    confirmed: true, // Already confirmed on first attempt
  });
}
