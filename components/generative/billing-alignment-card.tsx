"use client";

/**
 * BillingAlignmentCard — generative UI card for billing-alignment workflow output.
 *
 * Shows Base44 vs NMI billing drift analysis:
 *   - Summary header with period + counts (checked, drifts, OK, errors)
 *   - Sortable/filterable per-customer table
 *   - Filter toggle: show only drifts
 *   - Bulk action: "Tag flagged for review"
 *
 * Mobile-first 375px. Uses framer-motion + Tailwind glass-card conventions.
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Users,
  ArrowUpDown,
  Filter,
  Tag,
  ChevronDown,
  ChevronRight,
  BarChart3,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────

export interface CustomerDriftRow {
  customerId: string;
  name: string;
  base44Status: string;
  nmiStatus: string;
  driftType: "DRIFT" | "OK" | "ERROR";
  nmiLastAmount?: number;
  lastChargeDate?: string;
  subscriptionId?: string;
}

export interface BillingAlignmentData {
  type?: string;
  summary: {
    periodLabel: string;
    customersChecked: number;
    driftsFound: number;
    okCount: number;
    errorCount?: number;
  };
  rows: CustomerDriftRow[];
  generatedAt?: string;
  source?: string;
}

export interface BillingAlignmentCardProps {
  data: BillingAlignmentData;
  className?: string;
  onTagForReview?: (customerIds: string[]) => void;
  onViewCustomer?: (customerId: string) => void;
}

// ── Status config ────────────────────────────────────────────────────────

const DRIFT_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; label: string }> = {
  DRIFT:  { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "DRIFT" },
  OK:     { icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "OK" },
  ERROR:  { icon: XCircle,       color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "ERROR" },
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
  });
}

// ── Component ────────────────────────────────────────────────────────────

export function BillingAlignmentCard({
  data,
  className,
  onTagForReview,
  onViewCustomer,
}: BillingAlignmentCardProps) {
  const [showOnlyDrifts, setShowOnlyDrifts] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isTagging, setIsTagging] = useState(false);

  const { summary, rows } = data;
  const errorCount = summary.errorCount ?? 0;
  const hasDrifts = summary.driftsFound > 0;

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!showOnlyDrifts) return rows;
    return rows.filter((r) => r.driftType === "DRIFT" || r.driftType === "ERROR");
  }, [rows, showOnlyDrifts]);

  const toggleRow = (customerId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  };

  const handleTagForReview = async () => {
    if (!onTagForReview || isTagging) return;
    setIsTagging(true);
    const ids = filteredRows
      .filter((r) => r.driftType === "DRIFT")
      .map((r) => r.customerId);
    try {
      await onTagForReview(ids);
    } finally {
      setIsTagging(false);
    }
  };

  const driftPct = summary.customersChecked > 0
    ? Math.round((summary.driftsFound / summary.customersChecked) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "relative overflow-hidden rounded-xl border backdrop-blur-xl",
        hasDrifts
          ? "border-amber-500/20 bg-amber-500/[0.03]"
          : "border-white/10 bg-white/5",
        "shadow-[0_4px_24px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      {/* Glass shimmer */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

      <div className="relative">
        {/* ── Summary Header ───────────────────────────────────────── */}
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2.5 mb-3">
            <div className={cn(
              "size-8 rounded-lg flex items-center justify-center shrink-0",
              hasDrifts ? "bg-amber-500/10" : "bg-emerald-500/10"
            )}>
              <BarChart3 className={cn("size-4", hasDrifts ? "text-amber-400" : "text-emerald-400")} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Billing Alignment
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {summary.periodLabel} lookback
                {data.source ? ` · ${data.source}` : ""}
              </p>
            </div>
            {hasDrifts && (
              <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {driftPct}% drift
              </span>
            )}
          </div>

          {/* Counts grid */}
          <div className="grid grid-cols-4 gap-2">
            <CountBadge
              icon={Users}
              label="Checked"
              value={summary.customersChecked}
              color="text-blue-400"
              bg="bg-blue-500/5 border-blue-500/20"
            />
            <CountBadge
              icon={AlertTriangle}
              label="Drifts"
              value={summary.driftsFound}
              color="text-amber-400"
              bg="bg-amber-500/5 border-amber-500/20"
              highlight={summary.driftsFound > 0}
            />
            <CountBadge
              icon={CheckCircle2}
              label="OK"
              value={summary.okCount}
              color="text-emerald-400"
              bg="bg-emerald-500/5 border-emerald-500/20"
            />
            <CountBadge
              icon={XCircle}
              label="Errors"
              value={errorCount}
              color="text-red-400"
              bg="bg-red-500/5 border-red-500/20"
              highlight={errorCount > 0}
            />
          </div>
        </div>

        {/* ── Table Header ──────────────────────────────────────────── */}
        <div className="px-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {filteredRows.length} customer{filteredRows.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={() => setShowOnlyDrifts(!showOnlyDrifts)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-all",
              showOnlyDrifts
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
            )}
          >
            <Filter className="size-3" />
            Only drifts
          </button>
        </div>

        {/* ── Column headers (desktop) ──────────────────────────────── */}
        <div className="hidden sm:grid grid-cols-[1fr_110px_110px_85px_40px] gap-2 px-4 py-1.5 text-[10px] font-medium text-white/30 uppercase tracking-wider border-y border-white/5">
          <span>Customer</span>
          <span>Base44</span>
          <span>NMI</span>
          <span>Drift</span>
          <span />
        </div>

        {/* ── Rows ──────────────────────────────────────────────────── */}
        <div className="max-h-[360px] overflow-y-auto">
          <AnimatePresence>
            {filteredRows.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                {showOnlyDrifts ? "No drifts found — all aligned!" : "No customers to display."}
              </div>
            ) : (
              filteredRows.map((row, idx) => {
                const driftCfg = DRIFT_CONFIG[row.driftType] ?? DRIFT_CONFIG.OK;
                const DriftIcon = driftCfg.icon;
                const isExpanded = expandedRows.has(row.customerId);

                return (
                  <motion.div
                    key={row.customerId}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.15 }}
                  >
                    <div
                      className={cn(
                        "border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors",
                        isExpanded && "bg-white/[0.02]"
                      )}
                    >
                      {/* Main row */}
                      <div
                        className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_110px_110px_85px_40px] gap-2 px-4 py-2.5 items-center cursor-pointer"
                        onClick={() => toggleRow(row.customerId)}
                      >
                        {/* Customer name (mobile stacks) */}
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-foreground truncate block">
                            {row.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground sm:hidden">
                            {row.base44Status} · {row.nmiStatus}
                          </span>
                        </div>

                        {/* Base44 status — hidden on mobile */}
                        <span className="hidden sm:block text-xs text-foreground/70 capitalize">
                          {row.base44Status}
                        </span>

                        {/* NMI status — hidden on mobile */}
                        <span className="hidden sm:flex items-center gap-1 text-xs text-foreground/70 capitalize">
                          {row.nmiStatus}
                          {row.nmiLastAmount !== undefined && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatCents(row.nmiLastAmount)}
                            </span>
                          )}
                        </span>

                        {/* Drift badge */}
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1 w-fit",
                            driftCfg.bg, driftCfg.color
                          )}
                        >
                          <DriftIcon className="size-2.5" />
                          {driftCfg.label}
                        </span>

                        {/* Expand chevron */}
                        <span className="text-white/20">
                          {isExpanded ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          )}
                        </span>
                      </div>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 pt-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                              <DetailItem label="Customer ID" value={row.customerId} />
                              <DetailItem label="Base44 Status" value={row.base44Status} />
                              <DetailItem label="NMI Status" value={row.nmiStatus} />
                              <DetailItem label="Last Charge" value={formatDate(row.lastChargeDate)} />
                              <DetailItem label="Amount" value={formatCents(row.nmiLastAmount)} />
                              <DetailItem label="Subscription" value={row.subscriptionId || "—"} />
                              <DetailItem label="Drift" value={row.driftType} />
                              <div className="flex items-end">
                                {onViewCustomer && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onViewCustomer(row.customerId);
                                    }}
                                    className="px-2 py-1 rounded-md text-[10px] font-medium border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                                  >
                                    View Customer
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* ── Bulk Action ───────────────────────────────────────────── */}
        {hasDrifts && onTagForReview && showOnlyDrifts && (
          <div className="px-4 py-3 border-t border-white/5">
            <button
              onClick={handleTagForReview}
              disabled={isTagging}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all w-full sm:w-auto justify-center",
                "border-amber-500/20 text-amber-400 hover:bg-amber-500/10",
                isTagging && "opacity-50 cursor-not-allowed"
              )}
            >
              <Tag className="size-3" />
              {isTagging ? "Tagging..." : "Tag flagged for review"}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function CountBadge({
  icon: Icon,
  label,
  value,
  color,
  bg,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
  bg: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border p-2 text-center", bg, highlight && "ring-1 ring-current/20")}>
      <Icon className={cn("size-3 mx-auto mb-0.5", color)} />
      <div className={cn("text-sm font-bold", color)}>{value}</div>
      <div className="text-[9px] text-white/30 uppercase">{label}</div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-white/30 block">{label}</span>
      <span className="text-foreground/70 font-mono">{value}</span>
    </div>
  );
}

export default BillingAlignmentCard;
