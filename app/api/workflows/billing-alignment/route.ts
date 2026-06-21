/**
 * POST /api/workflows/billing-alignment
 * Neptune Chat Connector Fortress — Phase 5
 *
 * Cross-references Slack billing requests against NMI subscription state
 * to detect misalignments. Runs server-side, returns alignment report.
 *
 * Input:  { lookbackDays?: number, channelId?: string }
 * Output: { report, categories, customers[], rawData }
 *
 * Categories:
 *   - critical_misalignment: Slack says X, NMI says Y (different states)
 *   - card_validation_failures: Card issues detected
 *   - payment_reschedules: Payment date changes requested
 *   - cancellations: Cancel requests detected
 */

import { NextRequest, NextResponse } from "next/server";
import { nameResolver } from "@/playbook-skills/connectors/name-resolver/client";
import type { NameResolverResult } from "@/playbook-skills/connectors/name-resolver/client";

// ── Types ────────────────────────────────────────────────────────────────

interface BillingAlignmentRequest {
  lookbackDays?: number;
  channelId?: string;
}

interface SlackMessage {
  ts: string;
  user?: string;
  text: string;
  thread_ts?: string;
}

interface CustomerExtraction {
  messageTs: string;
  customerName: string;
  intent: "unpause" | "plan_change" | "card_fail" | "reschedule" | "cancel" | "general_billing";
  detail: string;
}

interface NmiSubscriptionState {
  subscriptionId: string;
  status: string;
  nextChargeDate: string | null;
  amount: number | null;
  cardLast4: string | null;
}

interface AlignedCustomer {
  name: string;
  resolved: NameResolverResult | null;
  extractions: CustomerExtraction[];
  nmiState: NmiSubscriptionState | null;
  category: "critical_misalignment" | "card_validation_failures" | "payment_reschedules" | "cancellations" | "aligned" | "unresolved";
  misalignmentDetail: string | null;
}

interface AlignmentReport {
  generatedAt: string;
  lookbackDays: number;
  channelId: string;
  totalSlackMessages: number;
  totalExtractions: number;
  totalResolved: number;
  totalNmiQueried: number;
  categories: {
    critical_misalignment: number;
    card_validation_failures: number;
    payment_reschedules: number;
    cancellations: number;
    aligned: number;
    unresolved: number;
  };
  customers: AlignedCustomer[];
}

// ── Constants ────────────────────────────────────────────────────────────

const DEFAULT_LOOKBACK_DAYS = 7;
const DEFAULT_CHANNEL_ID = "C0AQDDC3HAB"; // #jarvis-admin

// ── Intent Detection Patterns ────────────────────────────────────────────

const INTENT_PATTERNS: Array<{ intent: CustomerExtraction["intent"]; patterns: RegExp[] }> = [
  {
    intent: "unpause",
    patterns: [
      /unpause/i, /resume.*(?:payment|billing|subscription)/i,
      /reinstate/i, /start.*(?:payment|billing|subscription)/i,
      /turn.*(?:back\s*)?on/i,
    ],
  },
  {
    intent: "plan_change",
    patterns: [
      /(?:change|switch|update|modify).*(?:plan|subscription|tier)/i,
      /downgrade/i, /upgrade/i, /different.*(?:plan|package)/i,
    ],
  },
  {
    intent: "card_fail",
    patterns: [
      /(?:card|payment).*(?:fail|declin|invalid|expir|not.*(?:work|go.*through))/i,
      /update.*(?:card|payment|billing)/i, /new.*card/i,
      /CVV/i, /CVC/i, /225/i,
    ],
  },
  {
    intent: "reschedule",
    patterns: [
      /(?:reschedule|move|change|push).*(?:payment|charge|date)/i,
      /(?:pay|charge).*(?:later|next.*(?:week|month)|tomorrow)/i,
      /extend.*(?:payment|due)/i,
    ],
  },
  {
    intent: "cancel",
    patterns: [
      /cancel/i, /stop.*(?:payment|subscription|service)/i,
      /(?:want|need|going).*out/i, /discontinue/i,
    ],
  },
];

// ── Customer Name Extraction ─────────────────────────────────────────────

/**
 * Extract customer names and billing intents from Slack message text.
 * Uses pattern matching + heuristics. For production, this could be
 * replaced with an LLM call for higher accuracy.
 */
function extractCustomers(messages: SlackMessage[]): CustomerExtraction[] {
  const extractions: CustomerExtraction[] = [];
  const namePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/g;

  for (const msg of messages) {
    const text = msg.text || "";

    // Detect intent
    let bestIntent: CustomerExtraction["intent"] = "general_billing";
    let bestScore = 0;
    for (const { intent, patterns } of INTENT_PATTERNS) {
      const score = patterns.filter((p) => p.test(text)).length;
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }

    // Skip messages with no discernible billing intent
    if (bestIntent === "general_billing") {
      // Only include if it mentions billing/payment/card
      if (!/billing|payment|charge|card|subscription|invoice/i.test(text)) {
        continue;
      }
    }

    // Extract customer names
    const names = text.match(namePattern) || [];
    // Filter out common non-name matches
    const filteredNames = names.filter(
      (n) =>
        !/^(?:Hello|Thanks|Please|Could|Would|Can|Will|Just|Need|Want|This|That|What|When|Where|How|The|And|For|You|Your|Our|All|New|Good|Great|Okay|Sure|Yes|Help|Issue|Error|Problem|Slack|Admin|Team|Message|Channel|Thread|Billing|Payment)$/i.test(
          n
        )
    );

    for (const name of [...new Set(filteredNames)]) {
      extractions.push({
        messageTs: msg.ts,
        customerName: name,
        intent: bestIntent,
        detail: text.slice(0, 200),
      });
    }
  }

  return extractions;
}

// ── Slack Channel History ────────────────────────────────────────────────

async function getSlackHistory(
  channelId: string,
  lookbackDays: number
): Promise<SlackMessage[]> {
  try {
    const oldest = String(
      Math.floor(Date.now() / 1000) - lookbackDays * 24 * 60 * 60
    );

    const slackToken = process.env.SLACK_BOT_TOKEN;
    if (!slackToken) {
      console.warn("[billing-alignment] No SLACK_BOT_TOKEN — skipping Slack pull");
      return [];
    }

    const url = new URL("https://slack.com/api/conversations.history");
    url.searchParams.set("channel", channelId);
    url.searchParams.set("oldest", oldest);
    url.searchParams.set("limit", "200");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${slackToken}` },
    });

    const data = await res.json();

    if (!data.ok) {
      console.error(`[billing-alignment] Slack error: ${data.error}`);
      return [];
    }

    return (data.messages || []) as SlackMessage[];
  } catch (err) {
    console.error(
      "[billing-alignment] Slack pull failed:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

// ── NMI Subscription Query ───────────────────────────────────────────────

async function queryNmiSubscription(
  subscriptionId: string
): Promise<NmiSubscriptionState | null> {
  try {
    const bridgeUrl =
      process.env.VPS_BRIDGE_URL || "http://localhost:8400";
    const internalToken = process.env.NEPTUNE_INTERNAL_TOKEN || "";

    const res = await fetch(`${bridgeUrl}/vpsAgentToolRouter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        internalToken,
        tool: "nmi_mcp_bridge",
        action: "query_subscription",
        payload: { subscription_id: subscriptionId },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const sub = data?.subscription || data?.result || data;

    return {
      subscriptionId,
      status: sub?.status || sub?.subscription_status || "unknown",
      nextChargeDate: sub?.next_charge_date || null,
      amount: sub?.amount || sub?.recurring_amount || null,
      cardLast4: sub?.card_last4 || sub?.cc_last4 || null,
    };
  } catch (err) {
    console.error(
      `[billing-alignment] NMI query failed for sub ${subscriptionId}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ── Alignment Categorization ─────────────────────────────────────────────

function categorizeAlignment(
  extractions: CustomerExtraction[],
  nmiState: NmiSubscriptionState | null
): {
  category: AlignedCustomer["category"];
  detail: string | null;
} {
  if (!nmiState) {
    return { category: "unresolved", detail: "No NMI subscription state available" };
  }

  const intents = extractions.map((e) => e.intent);
  const nmiStatus = (nmiState.status || "").toLowerCase();

  // Check for critical misalignment: Slack says one thing, NMI says another
  if (intents.includes("unpause") && ["active", "confirmed_subscription"].includes(nmiStatus)) {
    return {
      category: "critical_misalignment",
      detail: `Slack requests unpause but NMI shows status="${nmiStatus}" — already active`,
    };
  }

  if (intents.includes("cancel") && ["cancelled", "canceled"].includes(nmiStatus)) {
    return {
      category: "aligned",
      detail: "Cancellation confirmed in NMI",
    };
  }

  if (intents.includes("cancel") && !["cancelled", "canceled"].includes(nmiStatus)) {
    return {
      category: "cancellations",
      detail: `Cancel requested in Slack but NMI status="${nmiStatus}" — cancellation may not be processed`,
    };
  }

  // Card validation failures
  if (intents.includes("card_fail")) {
    if (["declining", "declined", "payment_declined_hard", "payment_declined_soft"].includes(nmiStatus)) {
      return {
        category: "card_validation_failures",
        detail: `Card failure confirmed in NMI (status="${nmiStatus}")`,
      };
    }
    return {
      category: "card_validation_failures",
      detail: `Card issue reported in Slack but NMI status="${nmiStatus}"`,
    };
  }

  // Payment reschedules
  if (intents.includes("reschedule")) {
    return {
      category: "payment_reschedules",
      detail: `Reschedule requested. NMI next charge: ${nmiState.nextChargeDate || "unknown"}`,
    };
  }

  // Default: aligned if NMI has a normal status
  if (["active", "confirmed_subscription", "pending"].includes(nmiStatus)) {
    return { category: "aligned", detail: null };
  }

  if (["declining", "declined", "payment_declined_hard", "payment_declined_soft"].includes(nmiStatus)) {
    return {
      category: "card_validation_failures",
      detail: `NMI shows decline state="${nmiStatus}" but no explicit card-fail Slack request`,
    };
  }

  return { category: "aligned", detail: null };
}

// ── Main POST Handler ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: BillingAlignmentRequest = await request.json().catch(() => ({}));
    const lookbackDays = body.lookbackDays || DEFAULT_LOOKBACK_DAYS;
    const channelId = body.channelId || DEFAULT_CHANNEL_ID;

    // Step 1: Pull Slack channel history
    const slackMessages = await getSlackHistory(channelId, lookbackDays);

    // Step 2: Extract customer names + intents
    const extractions = extractCustomers(slackMessages);

    // Deduplicate customer names
    const uniqueNames = [...new Set(extractions.map((e) => e.customerName))];

    // Step 3: Resolve names via NameResolver (bulk)
    const { resolved, notFound } = await nameResolver.resolveMany(uniqueNames);

    // Step 4: Query NMI for each resolved customer
    const nmiStates = new Map<string, NmiSubscriptionState | null>();
    for (const [name, profile] of resolved) {
      if (profile.nmiSubscriptionId) {
        const state = await queryNmiSubscription(profile.nmiSubscriptionId);
        nmiStates.set(name, state);
      } else {
        nmiStates.set(name, null);
      }
    }

    // Step 5: Build alignment report
    const customers: AlignedCustomer[] = [];

    for (const name of uniqueNames) {
      const customerExtractions = extractions.filter((e) => e.customerName === name);
      const profile = resolved.get(name) || null;
      const nmiState = nmiStates.get(name) || null;

      const { category, detail } = categorizeAlignment(customerExtractions, nmiState);

      customers.push({
        name,
        resolved: profile,
        extractions: customerExtractions,
        nmiState,
        category,
        misalignmentDetail: detail,
      });
    }

    // Count categories
    const categoryCounts = {
      critical_misalignment: 0,
      card_validation_failures: 0,
      payment_reschedules: 0,
      cancellations: 0,
      aligned: 0,
      unresolved: 0,
    };
    for (const c of customers) {
      categoryCounts[c.category]++;
    }

    const report: AlignmentReport = {
      generatedAt: new Date().toISOString(),
      lookbackDays,
      channelId,
      totalSlackMessages: slackMessages.length,
      totalExtractions: extractions.length,
      totalResolved: resolved.size,
      totalNmiQueried: [...nmiStates.values()].filter(Boolean).length,
      categories: categoryCounts,
      customers,
    };

    return NextResponse.json({ report });
  } catch (err) {
    console.error(
      "[POST /api/workflows/billing-alignment]",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      {
        error: "Billing alignment workflow failed",
        detail: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
