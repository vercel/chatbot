"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ModelTooltip, type ModelDetail } from "./model-tooltip";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function getGrade(score?: number): { label: string; bg: string; text: string } {
  if (!score) return { label: "?", bg: "bg-muted", text: "text-muted-foreground" };
  if (score >= 90) return { label: "S", bg: "bg-amber-500/10", text: "text-amber-500" };
  if (score >= 80) return { label: "A", bg: "bg-emerald-500/10", text: "text-emerald-500" };
  if (score >= 70) return { label: "B", bg: "bg-blue-500/10", text: "text-blue-500" };
  if (score >= 60) return { label: "C", bg: "bg-slate-500/10", text: "text-slate-500" };
  return { label: "D", bg: "bg-red-500/10", text: "text-red-500" };
}

function formatPrice(price: number): string {
  if (price === 0) return "Free";
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(2)}`;
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ModelCardProps {
  model: ModelDetail;
  isSelected?: boolean;
  onSelect?: (identifier: string) => void;
  showTooltip?: boolean;
}

export function ModelCard({
  model,
  isSelected = false,
  onSelect,
  showTooltip = true,
}: ModelCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);
  const grade = getGrade(model.codingScore ?? undefined);

  return (
    <div className="relative">
      <motion.button
        ref={cardRef}
        onClick={() => onSelect?.(model.identifier)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "relative w-full text-left",
          "p-3.5 rounded-2xl",
          "bg-card/70 backdrop-blur-xl",
          "border transition-all duration-300",
          isSelected
            ? "border-primary/40 shadow-[0_0_0_1px_rgba(var(--primary),0.15)] bg-primary/5"
            : isHovered
              ? "border-border/60 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.08)] bg-card/85"
              : "border-border/20 shadow-sm",
        )}
      >
        {/* Provider Logo + Grade Badge */}
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex-shrink-0">
              <img
                src={`https://models.dev/logos/${model.provider}.svg`}
                alt={model.provider}
                className="size-6 rounded-full ring-1 ring-border/20 dark:invert"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              {model.status === "beta" && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-400 ring-2 ring-card" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold truncate leading-tight">
                {model.displayName}
              </div>
              <div className="text-[10px] text-muted-foreground/50 truncate leading-tight">
                {model.provider}
              </div>
            </div>
          </div>

          {/* Grade Badge */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            className={cn(
              "flex-shrink-0 size-6 rounded-lg flex items-center justify-center",
              "text-[10px] font-bold",
              grade.bg,
              grade.text,
            )}
          >
            {grade.label}
          </motion.div>
        </div>

        {/* Capability Icons */}
        <div className="flex items-center gap-1 mb-2.5">
          {model.capabilities.includes("reasoning") && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/5 text-violet-500 border border-violet-500/10">
              🧠
            </span>
          )}
          {model.capabilities.includes("vision") && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-cyan-500/5 text-cyan-500 border border-cyan-500/10">
              👁
            </span>
          )}
          {model.capabilities.includes("tools") && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/5 text-emerald-500 border border-emerald-500/10">
              🔧
            </span>
          )}
          {model.capabilities.includes("streaming") && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/5 text-amber-500 border border-amber-500/10">
              🌊
            </span>
          )}
          {model.capabilities.includes("json_output") && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/5 text-rose-500 border border-rose-500/10">
              📋
            </span>
          )}
        </div>

        {/* Price + Context */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
            <span className="font-mono tabular-nums">
              {formatPrice(model.inputPricePerMillion)}/1M in
            </span>
            <span className="text-border/40">·</span>
            <span className="font-mono tabular-nums">
              {formatTokens(model.contextWindowTokens)}
            </span>
          </div>
          {/* Selection indicator */}
          <motion.div
            animate={{
              scale: isSelected ? 1 : 0,
              opacity: isSelected ? 1 : 0,
            }}
            className={cn(
              "size-4 rounded-full bg-primary flex items-center justify-center",
            )}
          >
            <svg
              className="size-2.5 text-primary-foreground"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M3 8l3.5 3.5L13 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        </div>
      </motion.button>

      {/* Tooltip on hover */}
      <AnimatePresence>
        {isHovered && showTooltip && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 pointer-events-none">
            <ModelTooltip model={model} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
