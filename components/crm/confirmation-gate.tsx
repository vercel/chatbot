"use client";

/**
 * Phase 31: CRM Confirmation Gate
 *
 * Displays based on action risk level:
 *  LOW    — No gate (auto-execute)
 *  MEDIUM — Confirmation modal with action details
 *  HIGH   — Two-factor confirmation with warning
 *
 * Mobile-first 375px, follows Phase 22 glass primitives.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Shield,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRING_GENTLE, FADE_UP } from "@/lib/motion/springs";
import type { CrmRiskLevel } from "@/lib/crm-actions/registry";

export interface ConfirmationGateProps {
  /** Action name for display */
  actionName: string;
  /** Human-readable description */
  description: string;
  /** Risk level determining gate behavior */
  riskLevel: CrmRiskLevel;
  /** Target entity name (person, subscription, etc.) */
  targetName?: string;
  /** Additional details to display */
  details?: Record<string, string | number>;
  /** Called when user confirms */
  onConfirm: () => void | Promise<void>;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether action is currently executing */
  executing?: boolean;
  className?: string;
}

const riskStyles: Record<CrmRiskLevel, { border: string; bg: string; icon: string; label: string }> = {
  low: {
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/[0.04]",
    icon: "text-emerald-400",
    label: "AUTO-EXECUTE",
  },
  medium: {
    border: "border-amber-500/20",
    bg: "bg-amber-500/[0.04]",
    icon: "text-amber-400",
    label: "CONFIRMATION REQUIRED",
  },
  high: {
    border: "border-red-500/20",
    bg: "bg-red-500/[0.04]",
    icon: "text-red-400",
    label: "⚠️ HIGH-RISK — REQUIRES CONFIRMATION",
  },
};

export function ConfirmationGate({
  actionName,
  description,
  riskLevel,
  targetName,
  details,
  onConfirm,
  onCancel,
  executing = false,
  className,
}: ConfirmationGateProps) {
  const style = riskStyles[riskLevel];

  // LOW risk: auto-execute, no gate needed (handled by parent)
  if (riskLevel === "low") {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={FADE_UP.initial}
        animate={FADE_UP.animate}
        exit={{ opacity: 0, y: 8 }}
        transition={SPRING_GENTLE}
        className={cn(
          "relative overflow-hidden rounded-xl border backdrop-blur-xl",
          "max-w-[375px] sm:max-w-[420px]",
          style.border,
          style.bg,
          "shadow-[0_4px_24px_rgba(0,0,0,0.12)]",
          className
        )}
        role="dialog"
        aria-label={`Confirm ${actionName}`}
      >
        {/* Glass shimmer */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

        <div className="relative p-4">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", style.bg, "border", style.border)}>
              {riskLevel === "high" ? (
                <AlertTriangle className="size-4 text-red-400" />
              ) : (
                <Shield className="size-4 text-amber-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] font-semibold text-white/90">
                {actionName}
              </h3>
              <p className="text-[11px] text-white/50 mt-0.5">
                {description}
              </p>
              {targetName && (
                <p className="text-[11px] text-cyan-400/80 mt-0.5 font-medium">
                  Target: {targetName}
                </p>
              )}
            </div>
          </div>

          {/* Risk badge */}
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium mb-3",
              style.border,
              "border",
              riskLevel === "high"
                ? "text-red-400 bg-red-500/5"
                : "text-amber-400 bg-amber-500/5"
            )}
          >
            <div className={cn("size-1.5 rounded-full", riskLevel === "high" ? "bg-red-400" : "bg-amber-400")} />
            {style.label}
          </div>

          {/* Details */}
          {details && Object.keys(details).length > 0 && (
            <div className="mb-3 space-y-1">
              {Object.entries(details).map(([key, value]) => (
                <div key={key} className="flex justify-between text-[11px]">
                  <span className="text-white/40">{key}</span>
                  <span className="text-white/70 font-mono text-[10px]">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Two-factor warning */}
          {riskLevel === "high" && (
            <div className="mb-3 p-2.5 rounded-lg bg-red-500/[0.06] border border-red-500/10">
              <p className="text-[11px] text-red-400/90 leading-relaxed">
                This is a <strong>high-risk</strong> action that will permanently modify billing or dispute data.
                Please verify all details before confirming. This action will be recorded in the audit trail.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={executing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/60 hover:bg-white/[0.08] transition-colors disabled:opacity-40"
            >
              <X className="size-3.5" />
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={executing}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40 ml-auto",
                riskLevel === "high"
                  ? "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                  : "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20"
              )}
            >
              {executing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  {riskLevel === "high" ? "I Understand — Execute" : "Confirm"}
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ConfirmationGate;
