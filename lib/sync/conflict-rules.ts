/**
 * lib/sync/conflict-rules.ts — Bidirectional Sync Conflict Resolution
 * Phase 30: Enforces NMI sacred fields + LWW + field ownership
 */

export type SyncDirection = "b2t" | "t2b";

export interface SyncField {
  field: string;
  /** Which system owns this field */
  owner: "base44" | "twenty" | "lww";
  /** Is this field write-protected from the non-owner? */
  sacred?: boolean;
}

/**
 * SACRED NMI FIELDS — Base44 ALWAYS wins.
 * These fields must NEVER be overwritten by Twenty updates.
 * NMI is the billing source of truth.
 */
export const NMI_SACRED_FIELDS: readonly string[] = [
  "nmiSubscriptionId",
  "nmiVaultId",
  "nmiBillingId",
  "nmiBillingIds",
  "nmiDayZeroTransactionId",
  "nmiDayZeroDate",
  "nmiDayZeroIpAddress",
  "nmiLastVerifiedAt",
  "nmiLastVerifiedBillingId",
  "nmiCardVerified",
  "nmiCardSavedWithoutVerification",
  "networkTokenStatus",
  "networkTokenProvisionedAt",
  "cardNumber",
  "cardExpiry",
  "cardCvv",
  "cardholderName",
  "cardholderFirstName",
  "billingAddressLine1",
  "billingCity",
  "billingState",
  "billingZipCode",
  "billingActionToken",
  "billingActionTokenExpiresAt",
  "subscriptionRetryCount",
  "consecutiveDeclineCount",
  "lastDeclineCode",
  "lastDeclineReason",
  "lastRetryDate",
  "nextRetryDate",
  "pendingSubCancellation",
] as const;

/**
 * BILLING STATUS FIELDS — Base44 wins.
 * These reflect live billing engine state.
 */
export const BILLING_FIELDS: readonly string[] = [
  "billingStatus",
  "paymentAmount",
  "paymentFrequency",
  "nextPaymentDate",
  "paymentMethod",
  "paymentSourceType",
  "paymentAuthStatus",
  "subscriptionHealth",
  "subscriptionEmailSent",
  "subscriptionEmailSentAt",
  "cancellationReason",
  "cancellationDate",
  "scheduledCancellationDate",
  "retentionAttempted",
  "retentionOffer",
  "retentionOutcome",
  "recoveryStatus",
  "recoveryDate",
  "recoveryAgent",
  "recoveryNotes",
] as const;

/**
 * SALES/CRM FIELDS — Twenty wins.
 * Twenty is the CRM of record for sales activity.
 */
export const SALES_FIELDS: readonly string[] = [
  "notes",
  "lastNote",
  "agentEmail",
  "processingAgentEmail",
  "conversationSummary",
  "conversationSentiment",
  "aiMemory",
  "aiMemoryUpdatedAt",
  "aiReplyCount",
  "lastAiReplyAt",
  "engagementTier",
  "emailEngagementScore",
  "pipelineStage",
  "campaignTags",
  "processingPriority",
] as const;

/**
 * CORE IDENTITY FIELDS — LWW (last-write-wins) by timestamp.
 */
export const IDENTITY_FIELDS: readonly string[] = [
  "email",
  "firstName",
  "lastName",
  "phone",
  "canonicalPhone",
  "addressLine1",
  "city",
  "state",
  "zipCode",
  "dob",
  "company",
  "employerName",
  "jobTitle",
] as const;

/**
 * Check if a field is a sacred NMI field (must never be overwritten from Twenty).
 */
export function isSacredField(fieldName: string): boolean {
  return (NMI_SACRED_FIELDS as readonly string[]).includes(fieldName);
}

/**
 * Check if a field is owned by Base44 (billing + NMI).
 */
export function isBase44Owned(fieldName: string): boolean {
  return isSacredField(fieldName) ||
    (BILLING_FIELDS as readonly string[]).includes(fieldName);
}

/**
 * Check if a field is owned by Twenty (CRM/sales).
 */
export function isTwentyOwned(fieldName: string): boolean {
  return (SALES_FIELDS as readonly string[]).includes(fieldName);
}

/**
 * Get the owner of a field for conflict resolution.
 */
export function getFieldOwner(fieldName: string): "base44" | "twenty" | "lww" {
  if (isBase44Owned(fieldName)) return "base44";
  if (isTwentyOwned(fieldName)) return "twenty";
  return "lww";
}

/**
 * Determine if a field update should be applied.
 *
 * Rules (in priority order):
 * 1. SACRED NMI fields → NEVER apply from Twenty direction
 * 2. Base44 billing fields → NEVER apply from Twenty direction
 * 3. Twenty CRM fields → ALWAYS apply from Twenty direction
 * 4. Shared identity fields → LWW by _sync_updated_at timestamp
 */
export function shouldApplyFieldUpdate(
  fieldName: string,
  direction: SyncDirection,
  incomingTimestamp: string,
  existingTimestamp?: string
): { apply: boolean; reason: string } {
  // Rule 1: Sacred NMI fields
  if (isSacredField(fieldName)) {
    if (direction === "t2b") {
      return { apply: false, reason: `Sacred NMI field '${fieldName}' — Base44 wins` };
    }
    return { apply: true, reason: "Base44→Twenty sacred field sync" };
  }

  // Rule 2: Base44 billing fields
  if ((BILLING_FIELDS as readonly string[]).includes(fieldName)) {
    if (direction === "t2b") {
      return { apply: false, reason: `Billing field '${fieldName}' — Base44 wins` };
    }
    return { apply: true, reason: "Base44→Twenty billing sync" };
  }

  // Rule 3: Twenty CRM fields
  if ((SALES_FIELDS as readonly string[]).includes(fieldName)) {
    if (direction === "t2b") {
      return { apply: true, reason: "Twenty→Base44 CRM field sync" };
    }
    return { apply: false, reason: `CRM field '${fieldName}' — Twenty wins, skip B→T` };
  }

  // Rule 4: LWW by timestamp
  if (!existingTimestamp) {
    return { apply: true, reason: "No existing timestamp — apply incoming" };
  }

  const incoming = new Date(incomingTimestamp).getTime();
  const existing = new Date(existingTimestamp).getTime();

  if (incoming > existing) {
    return { apply: true, reason: `LWW: incoming (${incomingTimestamp}) > existing (${existingTimestamp})` };
  }

  if (Math.abs(incoming - existing) < 1000) {
    // Within 1 second — tiebreaker
    if (direction === "b2t") {
      return { apply: true, reason: "LWW tie: Base44→Twenty bias" };
    }
    return { apply: false, reason: "LWW tie: Twenty→Base44 suppressed (too close)" };
  }

  return { apply: false, reason: `LWW: incoming older than existing` };
}

/**
 * Filter a Twenty webhook payload's data fields,
 * removing any fields that should NOT propagate to Base44.
 */
export function filterSacredFieldsFromTwentyPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!shouldApplyFieldUpdate(key, "t2b", new Date().toISOString()).apply) {
      continue;
    }
    filtered[key] = value;
  }
  return filtered;
}
