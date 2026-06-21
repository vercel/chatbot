/**
 * Phase 25 Stream 2 / M-N4: get-customer-profile tool
 *
 * Returns rich CustomerProfileData with customerId at top level,
 * plus sub-objects for subscription, payments, calls, messages.
 * The CustomerProfileCard in message.tsx detects the customerId field
 * and renders the rich generative UI card.
 *
 * Also includes connectorType for backward compat with UniversalConnectorCard.
 */

import { tool } from "ai";
import { z } from "zod";

export const getCustomerProfile = tool({
  description:
    "Get a customer profile from Base44 with full details including " +
    "subscription, recent payments, calls, and messages. " +
    "Returns structured data for the CustomerProfileCard generative UI.",
  inputSchema: z.object({
    customerId: z.string().describe("Customer ID or email"),
  }),
  execute: async ({ customerId }) => {
    const bridgeUrl = process.env.VPS_BRIDGE_URL || "";
    try {
      const res = await fetch(`${bridgeUrl}/vpsAgentToolRouter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          internalToken: process.env.NEPTUNE_INTERNAL_TOKEN || "",
          tool: "cross_system_lookup",
          identifier: customerId,
          identifier_type: customerId.includes("@") ? "email" : "customer_id",
        }),
      });
      const json = await res.json().catch(() => ({}));
      const profile = json.result || json;

      // Extract customer identity fields
      const name = profile?.name || profile?.fullName || customerId;
      const email = profile?.email || "";
      const phone = profile?.phone || profile?.phoneNumber || "";
      const status = profile?.status || "active";

      // Build subscription info from profile
      const subscription = {
        planName: profile?.plan || profile?.subscriptionPlan || "Standard",
        amount: profile?.subscriptionAmount
          ? Math.round(parseFloat(String(profile.subscriptionAmount)) * 100)
          : undefined,
        nextChargeDate: profile?.nextChargeDate || profile?.nextBillingDate || undefined,
        status: profile?.subscriptionStatus || "active",
      };

      // Build payments from profile/related records
      const recentPayments = Array.isArray(profile?.recentPayments)
        ? profile.recentPayments.slice(0, 3).map((p: Record<string, unknown>) => ({
            id: p.id as string || "",
            amount: p.amount ? Math.round(parseFloat(String(p.amount)) * 100) : undefined,
            date: p.date as string || p.createdAt as string || "",
            status: (p.status as string) || "completed",
            method: (p.method as string) || (p.cardType as string) || "",
          }))
        : [];

      // Build calls from profile/related records
      const recentCalls = Array.isArray(profile?.recentCalls)
        ? profile.recentCalls.slice(0, 3).map((c: Record<string, unknown>) => ({
            id: c.id as string || "",
            date: c.date as string || c.createdAt as string || "",
            duration: c.duration ? Number(c.duration) : undefined,
            disposition: (c.disposition as string) || "completed",
            summary: (c.summary as string) || (c.transcript as string)?.slice(0, 80) || "",
          }))
        : [];

      // Build messages from Slack/SMS/email records
      const recentMessages = Array.isArray(profile?.recentMessages)
        ? profile.recentMessages.slice(0, 3).map((m: Record<string, unknown>) => ({
            id: m.id as string || m.ts as string || "",
            date: m.date as string || m.createdAt as string || "",
            channel: (m.channel as string) || (m.source as string) || "email",
            preview: (m.preview as string) || (m.text as string)?.slice(0, 100) || "",
          }))
        : [];

      return {
        // Top-level customerId for detection by CustomerProfileCard
        customerId: profile?.id || profile?.customerId || customerId,
        name,
        email,
        phone,
        photoUrl: profile?.photoUrl || profile?.avatarUrl || undefined,
        status,
        subscription,
        payments: {
          recentPayments,
          totalPaid: profile?.totalPaid
            ? Math.round(parseFloat(String(profile.totalPaid)) * 100)
            : undefined,
        },
        calls: {
          recentCalls,
          totalCalls: profile?.totalCalls ? Number(profile.totalCalls) : undefined,
        },
        messages: {
          recentMessages,
          totalMessages: profile?.totalMessages
            ? Number(profile.totalMessages)
            : undefined,
        },
        // Backward compat: preserve connectorType envelope for fallback
        connectorType: "base44",
        data: profile,
        rawProfile: profile,
      };
    } catch {
      return {
        customerId,
        name: customerId,
        email: "",
        phone: "",
        status: "error",
        subscription: { planName: "Unknown", status: "error" },
        payments: { recentPayments: [] },
        calls: { recentCalls: [] },
        messages: { recentMessages: [] },
        connectorType: "base44",
        data: {},
        rawProfile: {},
      };
    }
  },
});
