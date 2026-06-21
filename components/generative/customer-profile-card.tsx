"use client";

/**
 * CustomerProfileCard — generative UI card for customer-identity tool output.
 *
 * Shows rich customer 360 view:
 *   - Header: avatar/initials, name, email, phone, status badge
 *   - 4 sub-cards in 2x2 grid: Subscription, Payments, Calls, Messages
 *   - Action bar: Send billing link (DISPLAY ONLY), Open in Twenty, Create ticket
 *
 * Mobile-first 375px. Uses framer-motion + Tailwind glass-card conventions.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  CreditCard,
  Calendar,
  MessageSquare,
  PhoneCall,
  Receipt,
  ExternalLink,
  Ticket,
  Send,
  Building2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────

export interface SubscriptionInfo {
  planName?: string;
  amount?: number;           // cents
  nextChargeDate?: string;   // ISO
  status?: "active" | "paused" | "cancelled" | "past_due" | string;
}

export interface PaymentSummary {
  recentPayments?: Array<{
    id?: string;
    amount?: number;
    date?: string;
    status?: string;
    method?: string;
  }>;
  totalPaid?: number;
}

export interface CallSummary {
  recentCalls?: Array<{
    id?: string;
    date?: string;
    duration?: number;
    disposition?: string;
    summary?: string;
  }>;
  totalCalls?: number;
}

export interface MessageSummary {
  recentMessages?: Array<{
    id?: string;
    date?: string;
    channel?: string;
    preview?: string;
  }>;
  totalMessages?: number;
}

export interface CustomerProfileData {
  customerId?: string;
  name?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  status?: "active" | "inactive" | "lead" | "churned" | string;
  subscription?: SubscriptionInfo;
  payments?: PaymentSummary;
  calls?: CallSummary;
  messages?: MessageSummary;
  /** Raw profile data preserved for diagnostic access */
  rawProfile?: Record<string, unknown>;
  /** connector fields for backward compat */
  connectorType?: string;
  data?: Record<string, unknown>;
}

export interface CustomerProfileCardProps {
  data: CustomerProfileData;
  className?: string;
  /** DISPLAY ONLY — no actual send per user directive */
  onSendBillingLink?: () => void;
  onOpenInTwenty?: (customerId?: string) => void;
  onCreateTicket?: (customerId?: string) => void;
}

// ── Status config ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  inactive:  "bg-gray-500/10 text-gray-400 border-gray-500/20",
  lead:      "bg-blue-500/10 text-blue-400 border-blue-500/20",
  churned:   "bg-red-500/10 text-red-400 border-red-500/20",
  past_due:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  paused:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

// ── Helpers ──────────────────────────────────────────────────────────────

function formatCents(amount?: number): string {
  if (amount === undefined || amount === null) return "—";
  return `$${(amount / 100).toFixed(2)}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(secs?: number): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Component ────────────────────────────────────────────────────────────

export function CustomerProfileCard({
  data,
  className,
  onSendBillingLink,
  onOpenInTwenty,
  onCreateTicket,
}: CustomerProfileCardProps) {
  const statusColor = STATUS_COLORS[data.status ?? ""] ?? STATUS_COLORS.inactive;
  const initials = getInitials(data.name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "relative overflow-hidden rounded-xl border backdrop-blur-xl",
        "border-white/10 bg-white/5",
        "shadow-[0_4px_24px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      {/* Glass shimmer */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

      <div className="relative">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="p-4 pb-3">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            {data.photoUrl ? (
              <img
                src={data.photoUrl}
                alt={data.name || "Customer"}
                className="size-12 rounded-xl object-cover ring-1 ring-white/10 shrink-0"
              />
            ) : (
              <div className="size-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 flex items-center justify-center shrink-0 ring-1 ring-white/10">
                <span className="text-sm font-bold text-cyan-400">{initials}</span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {data.name || "Unknown Customer"}
                </h3>
                {data.status && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px] font-medium border capitalize shrink-0",
                    statusColor
                  )}>
                    {data.status}
                  </span>
                )}
              </div>

              <div className="space-y-0.5">
                {data.email && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Mail className="size-3 shrink-0" />
                    <span className="truncate">{data.email}</span>
                  </div>
                )}
                {data.phone && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Phone className="size-3 shrink-0" />
                    <span>{data.phone}</span>
                  </div>
                )}
                {data.customerId && (
                  <div className="flex items-center gap-1 text-[10px] text-white/20">
                    <User className="size-3 shrink-0" />
                    <span className="font-mono">{data.customerId}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Sub-cards Grid ────────────────────────────────────────── */}
        <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Subscription sub-card */}
          <SubCard
            icon={CreditCard}
            title="Subscription"
            accent="border-l-cyan-500/30"
          >
            <div className="space-y-1">
              {data.subscription?.planName && (
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Plan</span>
                  <span className="text-foreground/80 font-medium">
                    {data.subscription.planName}
                  </span>
                </div>
              )}
              {data.subscription?.amount !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Amount</span>
                  <span className="text-foreground/80 font-mono">
                    {formatCents(data.subscription.amount)}
                  </span>
                </div>
              )}
              {data.subscription?.nextChargeDate && (
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Next Charge</span>
                  <span className="text-foreground/80">
                    {formatDate(data.subscription.nextChargeDate)}
                  </span>
                </div>
              )}
              {data.subscription?.status && (
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Status</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium border capitalize",
                    STATUS_COLORS[data.subscription.status] ?? "bg-white/5 text-white/60 border-white/10"
                  )}>
                    {data.subscription.status}
                  </span>
                </div>
              )}
              {!data.subscription?.planName && !data.subscription?.amount && (
                <span className="text-[10px] text-white/20 italic">No subscription data</span>
              )}
            </div>
          </SubCard>

          {/* Recent Payments sub-card */}
          <SubCard
            icon={Receipt}
            title="Recent Payments"
            accent="border-l-emerald-500/30"
          >
            {data.payments?.recentPayments && data.payments.recentPayments.length > 0 ? (
              <div className="space-y-1.5">
                {data.payments.recentPayments.slice(0, 3).map((p, i) => (
                  <div key={p.id || i} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-foreground/70 font-mono text-[10px]">
                        {formatCents(p.amount)}
                      </span>
                      <span className="text-[10px] text-white/30">{formatDate(p.date)}</span>
                    </div>
                    <span className={cn(
                      "text-[10px] px-1 py-0.5 rounded capitalize",
                      p.status === "success" || p.status === "completed"
                        ? "text-emerald-400 bg-emerald-500/10"
                        : p.status === "failed" || p.status === "declined"
                        ? "text-red-400 bg-red-500/10"
                        : "text-amber-400 bg-amber-500/10"
                    )}>
                      {p.status || p.method || "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-white/20 italic">No recent payments</span>
            )}
          </SubCard>

          {/* Recent Calls sub-card */}
          <SubCard
            icon={PhoneCall}
            title="Recent Calls"
            accent="border-l-blue-500/30"
          >
            {data.calls?.recentCalls && data.calls.recentCalls.length > 0 ? (
              <div className="space-y-1.5">
                {data.calls.recentCalls.slice(0, 3).map((c, i) => (
                  <div key={c.id || i} className="flex justify-between items-center text-xs">
                    <div className="min-w-0">
                      <span className="text-[10px] text-white/30">{formatDate(c.date)}</span>
                      <span className="text-foreground/70 ml-1 text-[10px]">
                        {formatDuration(c.duration)}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/40 capitalize truncate ml-1">
                      {c.disposition || "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-white/20 italic">No recent calls</span>
            )}
          </SubCard>

          {/* Recent Messages sub-card */}
          <SubCard
            icon={MessageSquare}
            title="Recent Messages"
            accent="border-l-purple-500/30"
          >
            {data.messages?.recentMessages && data.messages.recentMessages.length > 0 ? (
              <div className="space-y-1.5">
                {data.messages.recentMessages.slice(0, 3).map((m, i) => (
                  <div key={m.id || i} className="text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-white/20">{formatDate(m.date)}</span>
                      <span className="text-[10px] px-1 py-0.5 rounded bg-white/5 text-white/40 capitalize">
                        {m.channel || "—"}
                      </span>
                    </div>
                    {m.preview && (
                      <p className="text-[10px] text-foreground/60 truncate mt-0.5">
                        {m.preview}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-white/20 italic">No recent messages</span>
            )}
          </SubCard>
        </div>

        {/* ── Action Bar ────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-white/5 flex flex-wrap gap-2">
          {/* Send billing link — DISPLAY ONLY */}
          <button
            onClick={onSendBillingLink}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              "border-white/10 text-white/30 cursor-not-allowed opacity-60",
              "hover:bg-white/[0.02]"
            )}
            title="Send billing link — display only, not yet wired"
            aria-label="Send billing link (display only)"
          >
            <Send className="size-3" />
            Send billing link
          </button>

          {/* Open in Twenty */}
          <button
            onClick={() => onOpenInTwenty?.(data.customerId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                       border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10"
          >
            <Building2 className="size-3" />
            Open in Twenty
          </button>

          {/* Create ticket */}
          <button
            onClick={() => onCreateTicket?.(data.customerId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                       border-purple-500/20 text-purple-400 hover:bg-purple-500/10"
          >
            <Ticket className="size-3" />
            Create ticket
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Sub-component ────────────────────────────────────────────────────────

function SubCard({
  icon: Icon,
  title,
  accent,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-lg border-l-2 bg-white/[0.02] border border-white/5 p-2.5",
      accent
    )}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="size-3 text-white/40" />
        <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

export default CustomerProfileCard;
