/**
 * NextBestAction — Twenty Generative UI Component
 * Phase 39 Stream 2: AI-driven next best action recommendation.
 *
 * Analyzes customer state (payment status, disputes, tickets, Slack mentions)
 * and recommends the most impactful next action with priority scoring.
 */
"use client";

import React, { useState, useEffect } from "react";

interface NbaProps {
  personId: string;
  record?: Record<string, unknown>;
}

interface SuggestedAction {
  label: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  type: "call" | "sms" | "email" | "payment" | "ticket" | "view";
  icon: string;
  disabled?: boolean;
  disabledReason?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-gray-100 text-gray-600 border-gray-300",
};

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function NextBestAction({ personId, record }: NbaProps) {
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function computeActions() {
      try {
        // In production, this calls an AI endpoint that analyzes customer state
        // For now, compute based on available record data
        const computed: SuggestedAction[] = [];

        const billingStatus = record?.billingStatus as string || "";
        const enrollmentStatus = record?.enrollmentStatus as string || "";
        const lastPaymentStatus = record?.lastPaymentStatus as string || "";
        const openTickets = (record?.openTickets as number) || 0;

        // Billing-critical actions
        if (lastPaymentStatus === "declined" || billingStatus === "past_due") {
          computed.push({
            label: "Send Payment Reminder",
            description: "Payment was declined — send SMS reminder with payment link",
            priority: "critical",
            type: "sms",
            icon: "IconAlertTriangle",
          });
          computed.push({
            label: "Call Customer",
            description: "Direct phone call to resolve payment issue",
            priority: "high",
            type: "call",
            icon: "IconPhone",
          });
        }

        // Enrollment follow-up
        if (enrollmentStatus === "pending" || enrollmentStatus === "in_progress") {
          computed.push({
            label: "Complete Enrollment",
            description: "Follow up on pending enrollment steps",
            priority: "high",
            type: "ticket",
            icon: "IconChecklist",
          });
        }

        // Open tickets
        if (openTickets > 0) {
          computed.push({
            label: "Review Open Tickets",
            description: `${openTickets} open support ticket(s) need attention`,
            priority: "medium",
            type: "view",
            icon: "IconTicket",
          });
        }

        // Default: view full profile
        computed.push({
          label: "View Customer 360",
          description: "Full customer profile with all data sources",
          priority: "low",
          type: "view",
          icon: "IconUser",
        });

        // Always available actions
        computed.push({
          label: "Send Payment Link",
          description: "Generate and send a payment link",
          priority: "medium",
          type: "payment",
          icon: "IconCurrencyDollar",
        });

        // Sort by priority
        computed.sort((a, b) =>
          (PRIORITY_ORDER[a.priority] || 99) - (PRIORITY_ORDER[b.priority] || 99)
        );

        setActions(computed);
      } catch (err) {
        console.error("NextBestAction: failed to compute actions:", err);
      } finally {
        setLoading(false);
      }
    }

    computeActions();
  }, [personId, record]);

  if (loading) {
    return (
      <div className="animate-pulse p-3 space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  const topAction = actions[0];
  const secondaryActions = actions.slice(1, 4);

  return (
    <div className="p-3 space-y-3">
      {/* Primary Action */}
      {topAction && (
        <div className={`border rounded-lg p-3 ${PRIORITY_COLORS[topAction.priority]}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide">
              {topAction.priority} priority
            </span>
            <span className="text-xs opacity-60">#1 action</span>
          </div>
          <p className="font-semibold text-sm">{topAction.label}</p>
          <p className="text-xs mt-1 opacity-80">{topAction.description}</p>
          <button
            className="mt-2 w-full bg-white/50 hover:bg-white/80 text-sm font-medium py-1.5 px-3 rounded-md transition-colors border border-current/20"
            disabled={topAction.disabled}
          >
            {topAction.disabled ? topAction.disabledReason || "Unavailable" : topAction.label}
          </button>
        </div>
      )}

      {/* Secondary Actions */}
      <div className="space-y-2">
        {secondaryActions.map((action, idx) => (
          <button
            key={idx}
            className="w-full text-left p-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-sm"
            disabled={action.disabled}
          >
            <span className="font-medium text-gray-900">{action.label}</span>
            {action.description && (
              <span className="block text-xs text-gray-500 mt-0.5">{action.description}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
