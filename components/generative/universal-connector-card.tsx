"use client";

/**
 * Phase 24: Universal Connector Card
 *
 * Single React component for ALL connector card renderings.
 * Reads layout via getConnectorLayout / getCardTypeLayout.
 * Renders fields/badges per inline state.
 * Renders sections per expanded/canvas state.
 * framer-motion transitions between states.
 *
 * Mobile-first 375px.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getConnectorLayout,
  getCardTypeLayout,
} from "@/lib/connectors/layouts";
import type { CardState, ConnectorCardProps } from "@/lib/connectors/types";

const STATE_ORDER: CardState[] = ["inline", "expanded", "canvas"];

/** Format a field value for display */
function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    // Detect currency fields
    if (key === "amount") return `$${(value / 100).toFixed(2)}`;
    return String(value);
  }
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** Get badge variant from value */
function badgeVariant(
  key: string,
  value: unknown
): "success" | "danger" | "warning" | "info" | "default" {
  const s = String(value).toLowerCase();
  if (["completed", "success", "active", "valid", "approved"].includes(s))
    return "success";
  if (["failed", "error", "declined", "expired", "invalid"].includes(s))
    return "danger";
  if (["pending", "processing", "running"].includes(s)) return "warning";
  if (["cofindicator", "dpn", "cit", "mit"].includes(s)) return "info";
  return "default";
}

const BADGE_COLORS: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  danger: "bg-red-500/10 text-red-400 border-red-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  info: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  default: "bg-white/5 text-white/60 border-white/10",
};

export function UniversalConnectorCard({
  connector,
  type,
  data,
  state: initial = "inline",
  onStateChange,
  className,
}: ConnectorCardProps) {
  const [state, setState] = useState<CardState>(initial);
  const layout = getConnectorLayout(connector);
  const cardLayout = getCardTypeLayout(connector, type);

  const handleStateChange = useCallback(
    (next: CardState) => {
      setState(next);
      onStateChange?.(next);
    },
    [onStateChange]
  );

  const cycleState = useCallback(() => {
    const idx = STATE_ORDER.indexOf(state);
    const next = STATE_ORDER[(idx + 1) % STATE_ORDER.length];
    handleStateChange(next);
  }, [state, handleStateChange]);

  if (!layout) {
    return (
      <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-400">
        Unknown connector: <code>{connector}</code>
      </div>
    );
  }

  const {
    inline: { fields, badges },
  } = cardLayout;
  const accent = layout.accentColor || "#6b7280";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative overflow-hidden rounded-xl border backdrop-blur-xl",
        "border-white/10 bg-white/5",
        "shadow-[0_4px_24px_rgba(0,0,0,0.08)]",
        state === "expanded" && "shadow-[0_8px_40px_rgba(0,0,0,0.16)]",
        className
      )}
      style={{
        borderColor: `${accent}20`,
      }}
    >
      {/* Glass shimmer */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      <div className="relative">
        {/* ── INLINE STATE ────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {state === "inline" && (
            <motion.div
              key="inline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-3"
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className="size-8 rounded-lg flex items-center justify-center text-lg shrink-0"
                  style={{ backgroundColor: `${accent}15` }}
                >
                  {layout.icon}
                </div>

                {/* Fields */}
                <div className="flex-1 min-w-0 space-y-1">
                  {fields.slice(0, 3).map((field) => (
                    <div
                      key={field}
                      className="flex items-baseline gap-1.5"
                    >
                      <span className="text-[10px] text-white/30 uppercase shrink-0">
                        {field}
                      </span>
                      <span className="text-xs text-white/80 truncate">
                        {formatValue(field, data[field])}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Expand button */}
                <button
                  onClick={() => handleStateChange("expanded")}
                  className="p-1 rounded-md hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors shrink-0"
                  aria-label="Expand card"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              {/* Badges */}
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {badges.map((badge) => {
                    const val = data[badge];
                    if (val === undefined || val === null) return null;
                    return (
                      <span
                        key={badge}
                        className={cn(
                          "px-1.5 py-0.5 rounded-md text-[10px] font-medium border",
                          BADGE_COLORS[badgeVariant(badge, val)]
                        )}
                      >
                        {formatValue(badge, val)}
                      </span>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── EXPANDED STATE ──────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {state === "expanded" && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="px-3 pb-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{layout.icon}</span>
                  <span className="text-xs font-medium text-white/70">
                    {connector} · {type}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStateChange("canvas")}
                    className="p-1 rounded-md hover:bg-white/10 text-white/30 hover:text-white/70"
                    aria-label="Canvas view"
                  >
                    <Maximize2 className="size-3.5" />
                  </button>
                  <button
                    onClick={() => handleStateChange("inline")}
                    className="p-1 rounded-md hover:bg-white/10 text-white/30 hover:text-white/70"
                    aria-label="Collapse"
                  >
                    <Minimize2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Sections */}
              {cardLayout.expanded.sections.map((section) => (
                <div key={section} className="mt-2">
                  <h4 className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-1.5">
                    {section}
                  </h4>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-xs text-white/60">
                    {Object.entries(data)
                      .filter(([k]) =>
                        section === "details"
                          ? true
                          : k.toLowerCase().includes(section.toLowerCase())
                      )
                      .slice(0, 5)
                      .map(([key, val]) => (
                        <div
                          key={key}
                          className="flex justify-between py-0.5"
                        >
                          <span className="text-white/40">{key}</span>
                          <span className="text-white/70 font-mono text-[11px]">
                            {formatValue(key, val)}
                          </span>
                        </div>
                      ))}
                    {Object.entries(data).filter(([k]) =>
                      section === "details"
                        ? true
                        : k.toLowerCase().includes(section.toLowerCase())
                    ).length === 0 && (
                      <span className="text-white/20 italic">
                        No data available
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CANVAS STATE ────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {state === "canvas" && (
            <motion.div
              key="canvas"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="p-3"
            >
              {/* Canvas header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{layout.icon}</span>
                  <div>
                    <span className="text-sm font-semibold text-white/90 block">
                      {connector}
                    </span>
                    <span className="text-[10px] text-white/40">
                      {type} · Canvas View
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleStateChange("expanded")}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80"
                  aria-label="Close canvas"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Canvas sections */}
              <div className="space-y-3">
                {cardLayout.canvas.sections.map((section) => (
                  <div
                    key={section}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/5"
                  >
                    <h4 className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-2">
                      {section}
                    </h4>
                    <pre className="text-[11px] text-white/60 font-mono whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                      {JSON.stringify(
                        Object.fromEntries(
                          Object.entries(data).filter(([k]) =>
                            section === "lifecycle" || section === "fullRecord"
                              ? true
                              : k
                                  .toLowerCase()
                                  .includes(section.toLowerCase())
                          )
                        ),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                ))}
              </div>

              {/* Action bar */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                <button
                  onClick={cycleState}
                  className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:bg-white/10 transition-colors"
                >
                  Back to Inline
                </button>
                <button
                  onClick={() => {
                    // Copy data to clipboard
                    navigator.clipboard
                      .writeText(JSON.stringify(data, null, 2))
                      .catch(() => {});
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:bg-white/10 transition-colors"
                >
                  Copy JSON
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
