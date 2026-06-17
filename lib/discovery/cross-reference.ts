/**
 * lib/discovery/cross-reference.ts
 * Phase 38 Stream 1 — Cross-Reference Engine
 *
 * Connects Slack mentions to Base44 profiles via the 5-tier matcher,
 * builds composite CustomerDiscoveryContext by merging all data sources.
 *
 * This is where the "inception knowledge" begins — connecting
 * operational chatter (Slack) to ground truth (CRM + billing).
 */

import type {
  ScrapedSlackMessage,
  ExtractedCustomerMention,
  PulledCustomerData,
  CustomerDiscoveryContext,
  AlignmentFlag,
  CustomerMatch,
} from "./types";
import { batchMatchCustomers } from "./customer-matcher";
import type { CustomerProfileRecord } from "./customer-matcher";

// ── Build Customer Context from Pulled Data ──────────────────────

export function buildCustomerContext(
  customerId: string,
  profile: CustomerProfileRecord,
  pulled: PulledCustomerData,
  slackMentions: ScrapedSlackMessage[]
): CustomerDiscoveryContext {
  const latestMention =
    slackMentions.length > 0
      ? slackMentions.sort(
          (a, b) => parseFloat(b.ts) - parseFloat(a.ts)
        )[0]
      : null;

  const agentsWhoMentioned = [
    ...new Set(
      slackMentions
        .map((m) => m.userName || m.userId)
        .filter((n) => n && n !== 'unknown')
    ),
  ];

  const inferredAction = inferRequestedAction(slackMentions);

  const context: CustomerDiscoveryContext = {
    customerId,
    name: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
    phone: profile.phone || '',
    email: profile.email || '',

    base44: {
      profile: pulled.base44?.profile || null,
      enrollmentStatus: pulled.base44?.enrollmentStatus || 'unknown',
      billingStatus: pulled.base44?.billingStatus || 'unknown',
      paymentAmount: pulled.base44?.paymentAmount || 0,
      lastPayment: pulled.base44?.lastPayment || null,
      openTickets: pulled.base44?.openTickets || [],
      recentCalls: pulled.base44?.recentCalls || [],
    },

    nmi: {
      subscriptionId: pulled.nmi?.subscriptionId || null,
      subscriptionStatus: pulled.nmi?.subscriptionStatus || 'none',
      lastTransaction: pulled.nmi?.lastTransaction || null,
      nextChargeDate: pulled.nmi?.nextChargeDate || null,
      cofCompliant: pulled.nmi?.cofCompliant || false,
    },

    slack: {
      mentions: slackMentions,
      latestMention,
      agentsWhoMentioned,
      inferredActionRequested: inferredAction,
    },

    alignment: {
      base44_vs_nmi: 'unknown',
      slack_vs_base44: 'unknown',
      slack_vs_nmi: 'unknown',
      flags: [],
    },
  };

  return context;
}

// ── Infer Requested Action from Slack Messages ───────────────────

const ACTION_KEYWORDS: Array<{ action: string; keywords: RegExp[] }> = [
  {
    action: 'Update payment method',
    keywords: [
      /update\s*(payment|card)/i,
      /new\s*card/i,
      /change\s*(payment|card)/i,
    ],
  },
  {
    action: 'Cancel subscription',
    keywords: [
      /cancel/i,
      /stop\s*(payment|charging|subscription)/i,
    ],
  },
  {
    action: 'Request refund',
    keywords: [/refund/i, /money\s*back/i, /revers(e|al)/i],
  },
  {
    action: 'Follow up required',
    keywords: [
      /follow\s*up/i,
      /get\s*back\s*to/i,
      /I'?ll\s*(call|check|reach)/i,
      /let\s*me\s*(check|look|see)/i,
    ],
  },
  {
    action: 'Billing inquiry',
    keywords: [
      /billing\s*(question|issue|problem)/i,
      /charge\s*(wrong|incorrect|dispute)/i,
      /why\s*(was|am|did).*charge/i,
    ],
  },
  {
    action: 'Enrollment needed',
    keywords: [
      /enroll/i,
      /sign\s*up/i,
      /new\s*(customer|client)/i,
    ],
  },
];

export function inferRequestedAction(
  messages: ScrapedSlackMessage[]
): string {
  const actionScores: Record<string, number> = {};

  for (const msg of messages) {
    for (const { action, keywords } of ACTION_KEYWORDS) {
      for (const keyword of keywords) {
        if (keyword.test(msg.text)) {
          actionScores[action] = (actionScores[action] || 0) + 1;
        }
      }
    }
  }

  if (Object.keys(actionScores).length === 0) {
    return 'General inquiry / unspecified';
  }

  // Return highest-scoring action
  return Object.entries(actionScores).sort(
    (a, b) => b[1] - a[1]
  )[0][0];
}

// ── Cross-Reference: Match Slack Mentions → Base44 Profiles ──────

export interface CrossReferenceResult {
  matchedCustomers: Map<string, CustomerDiscoveryContext>;
  unmatchedMentions: ExtractedCustomerMention[];
  matchingStats: {
    totalMentions: number;
    matched: number;
    unmatched: number;
    byTier: Record<number, number>;
    averageConfidence: number;
  };
}

export function crossReference(
  allMentions: ExtractedCustomerMention[],
  profiles: CustomerProfileRecord[],
  pulledData: Map<string, PulledCustomerData>,
  slackMessages: ScrapedSlackMessage[]
): CrossReferenceResult {
  const matchedCustomers = new Map<string, CustomerDiscoveryContext>();
  const unmatchedMentions: ExtractedCustomerMention[] = [];
  const byTier: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalConfidence = 0;

  // Batch match mentions against profiles
  const matches = batchMatchCustomers(allMentions, profiles);

  for (const [base44Id, { match, mention }] of matches) {
    const profile = profiles.find((p) => p.id === base44Id);
    const pulled = pulledData.get(base44Id);

    if (!profile) {
      unmatchedMentions.push(mention);
      continue;
    }

    // Find all Slack messages mentioning this customer
    const customerMsgs = slackMessages.filter((msg) =>
      msg.extractedCustomers.some(
        (m) => m.type === mention.type && m.value === mention.value
      )
    );

    const context = buildCustomerContext(
      base44Id,
      profile,
      pulled || {
        customerId: base44Id,
        base44: null,
        nmi: null,
        comms: { recentCalls: [], recentEmails: [], recentSms: [], slackMentions: [] },
        tickets: { open: [], resolved: [], stale: [] },
        pulledAt: new Date().toISOString(),
      },
      customerMsgs
    );

    matchedCustomers.set(base44Id, context);
    byTier[match.matchTier] = (byTier[match.matchTier] || 0) + 1;
    totalConfidence += match.confidence;
  }

  // Find mentions that didn't match any profile
  for (const mention of allMentions) {
    const matched = [...matches.values()].some(
      (v) => v.mention.type === mention.type && v.mention.value === mention.value
    );
    if (!matched) {
      unmatchedMentions.push(mention);
    }
  }

  return {
    matchedCustomers,
    unmatchedMentions,
    matchingStats: {
      totalMentions: allMentions.length,
      matched: matchedCustomers.size,
      unmatched: unmatchedMentions.length,
      byTier,
      averageConfidence:
        matchedCustomers.size > 0
          ? totalConfidence / matchedCustomers.size
          : 0,
    },
  };
}

// ── Extract Profiles from Pulled Data ────────────────────────────

export function extractProfilesFromPulled(
  pulledData: Map<string, PulledCustomerData>
): CustomerProfileRecord[] {
  const profiles: CustomerProfileRecord[] = [];

  for (const [customerId, data] of pulledData) {
    const profile = data.base44?.profile;
    if (profile) {
      profiles.push({
        id: customerId,
        firstName: (profile as Record<string, unknown>).firstName as string,
        lastName: (profile as Record<string, unknown>).lastName as string,
        phone: (profile as Record<string, unknown>).phone as string,
        email: (profile as Record<string, unknown>).email as string,
      });
    }
  }

  return profiles;
}
