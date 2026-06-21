/**
 * playbook-skills/connectors/name-resolver/client.ts
 * Neptune Chat Connector Fortress — Phase 4
 *
 * Resolves customer names → Base44 IDs → NMI vault/sub IDs.
 * Used before any NMI lookup since NMI only accepts vault_id or subscription_id.
 *
 * Architecture:
 *   1. Parse name into firstName + lastName
 *   2. Query Base44 CustomerProfile via base44 connector SDK
 *   3. Return full dossier with NMI IDs for downstream use
 */

import { execute } from "@/connectors/base44/client";

// ── Types ────────────────────────────────────────────────────────────────

export interface NameResolverResult {
  /** Base44 CustomerProfile document ID */
  base44Id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  /** NMI Customer Vault ID — required for NMI vault queries */
  nmiVaultId: string | null;
  /** NMI Subscription ID — required for NMI subscription queries */
  nmiSubscriptionId: string | null;
  /** Current billing status from Base44 (e.g., confirmed_subscription, paused, cancelled) */
  billingStatus: string | null;
  /** Monthly payment amount in dollars */
  paymentAmount: number | null;
  /** Agent assigned to this customer */
  agentEmail: string | null;
  /** Enrollment status (enrolled, pending, cancelled, etc.) */
  enrollmentStatus: string | null;
  /** Sales pipeline stage */
  pipelineStage: string | null;
  /** Next scheduled payment date (ISO format) */
  nextPaymentDate: string | null;
  /** Scheduled cancellation date if set (ISO format) */
  scheduledCancellationDate: string | null;
}

export interface NameResolverMultiResult {
  /** Successfully resolved */
  resolved: Map<string, NameResolverResult>;
  /** Names that returned no results */
  notFound: string[];
  /** Names that had errors during resolution */
  errors: Map<string, string>;
}

// ── Name Parsing ─────────────────────────────────────────────────────────

/**
 * Parse a full name string into firstName + lastName.
 * Handles: "Mary Nazworth", "Nazworth, Mary", "Mary", "mary nazworth"
 */
function parseName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();

  // "Last, First" format
  const commaIdx = trimmed.indexOf(",");
  if (commaIdx > 0) {
    return {
      lastName: trimmed.slice(0, commaIdx).trim(),
      firstName: trimmed.slice(commaIdx + 1).trim(),
    };
  }

  // "First Middle Last" or "First Last" format
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  // Last part is lastName, everything else is firstName
  const firstName = parts.slice(0, -1).join(" ");
  const lastName = parts[parts.length - 1];

  return { firstName, lastName };
}

// ── CustomerProfile Field Mapping ────────────────────────────────────────

const PROFILE_FIELDS = [
  "id",
  "firstName",
  "lastName",
  "phone",
  "email",
  "nmiVaultId",
  "nmiSubscriptionId",
  "billingStatus",
  "paymentAmount",
  "agentEmail",
  "enrollmentStatus",
  "pipelineStage",
  "nextPaymentDate",
  "scheduledCancellationDate",
] as const;

function mapProfileToResult(profile: Record<string, unknown>): NameResolverResult {
  return {
    base44Id: (profile.id as string) || "",
    firstName: (profile.firstName as string) || "",
    lastName: (profile.lastName as string) || "",
    phone: (profile.phone as string) || null,
    email: (profile.email as string) || null,
    nmiVaultId: (profile.nmiVaultId as string) || null,
    nmiSubscriptionId: (profile.nmiSubscriptionId as string) || null,
    billingStatus: (profile.billingStatus as string) || null,
    paymentAmount: (profile.paymentAmount as number) || null,
    agentEmail: (profile.agentEmail as string) || null,
    enrollmentStatus: (profile.enrollmentStatus as string) || null,
    pipelineStage: (profile.pipelineStage as string) || null,
    nextPaymentDate: (profile.nextPaymentDate as string) || null,
    scheduledCancellationDate:
      (profile.scheduledCancellationDate as string) || null,
  };
}

// ── Resolver Class ───────────────────────────────────────────────────────

export class NameResolverClient {
  /**
   * Resolve a single customer name to a full dossier.
   * Returns null if no match found.
   */
  async resolve(name: string): Promise<NameResolverResult | null> {
    const { firstName, lastName } = parseName(name);

    if (!firstName) return null;

    try {
      // Try exact firstName + lastName match first
      const filter: Record<string, unknown> = { firstName };
      if (lastName) filter.lastName = lastName;

      const result = await execute({
        action: "customer_profile_query",
        args: {
          filter,
          sort: "-created_date",
          limit: 5,
        },
      });

      // execute() wraps results in { success, data, count }
      const profiles = (result.data as Record<string, unknown>[]) || [];

      if (profiles.length === 0) {
        // Fallback: try firstName-only match
        if (lastName) {
          const fallbackResult = await execute({
            action: "customer_profile_query",
            args: {
              filter: { firstName },
              sort: "-created_date",
              limit: 10,
            },
          });
          const fallbackProfiles =
            (fallbackResult.data as Record<string, unknown>[]) || [];

          // Fuzzy match lastName against results
          const matched = fallbackProfiles.find((p) => {
            const pLastName = ((p.lastName as string) || "").toLowerCase();
            return (
              pLastName === lastName.toLowerCase() ||
              levenshtein(pLastName, lastName.toLowerCase()) <= 2
            );
          });

          if (matched) return mapProfileToResult(matched);
        }
        return null;
      }

      // Single exact match
      if (profiles.length === 1) {
        return mapProfileToResult(profiles[0]);
      }

      // Multiple matches — prefer exact lastName match
      const exactMatch = profiles.find(
        (p) =>
          ((p.lastName as string) || "").toLowerCase() ===
          lastName.toLowerCase()
      );
      if (exactMatch) return mapProfileToResult(exactMatch);

      // Return first match with warning logged
      console.warn(
        `[name-resolver] Multiple matches for "${name}", returning first of ${profiles.length}`
      );
      return mapProfileToResult(profiles[0]);
    } catch (err) {
      console.error(
        `[name-resolver] Resolve failed for "${name}":`,
        err instanceof Error ? err.message : err
      );
      return null;
    }
  }

  /**
   * Bulk resolve multiple names. Returns structured result with
   * resolved, notFound, and errors buckets.
   */
  async resolveMany(names: string[]): Promise<NameResolverMultiResult> {
    const resolved = new Map<string, NameResolverResult>();
    const notFound: string[] = [];
    const errors = new Map<string, string>();

    // Resolve in parallel with concurrency limit to avoid overwhelming Base44
    const CONCURRENCY = 5;
    const uniqueNames = [...new Set(names)];

    for (let i = 0; i < uniqueNames.length; i += CONCURRENCY) {
      const batch = uniqueNames.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(async (name) => {
          try {
            const result = await this.resolve(name);
            return { name, result };
          } catch (err) {
            throw { name, error: err instanceof Error ? err.message : "Unknown" };
          }
        })
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          const { name, result } = r.value;
          if (result) {
            resolved.set(name, result);
          } else {
            notFound.push(name);
          }
        } else {
          const { name, error } = (r as PromiseRejectedResult).reason as {
            name: string;
            error: string;
          };
          errors.set(name, error);
        }
      }

      // Small delay between batches
      if (i + CONCURRENCY < uniqueNames.length) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    return { resolved, notFound, errors };
  }

  /**
   * Resolve with cross-system lookup (uses Base44 customer_360).
   * More comprehensive but slower. Use when you need full dossier.
   */
  async resolve360(
    identifier: string,
    identifierType: "name" | "phone" | "email" | "customer_id" = "name"
  ): Promise<NameResolverResult | null> {
    try {
      if (identifierType === "name") {
        const basic = await this.resolve(identifier);
        if (basic?.base44Id) {
          identifier = basic.base44Id;
          identifierType = "customer_id";
        } else {
          return basic; // Already null or partial
        }
      }

      const result = await execute({
        action: "customer_360",
        args: identifierType === "customer_id"
          ? { customerId: identifier }
          : identifierType === "email"
            ? { email: identifier }
            : { phone: identifier },
      });

      const data = result.data as Record<string, unknown> | null;
      if (!data) return null;

      // customer_360 returns a complex nested object; extract profile
      const profile = (data.profile || data) as Record<string, unknown>;
      return mapProfileToResult(profile);
    } catch (err) {
      console.error(
        `[name-resolver] resolve360 failed for "${identifier}":`,
        err instanceof Error ? err.message : err
      );
      return null;
    }
  }
}

// ── Utility: Levenshtein Distance ────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

// ── Singleton Export ─────────────────────────────────────────────────────

export const nameResolver = new NameResolverClient();
export default nameResolver;
