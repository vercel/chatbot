"use client";

import { motion } from "framer-motion";
import {
  Brain,
  Code2,
  Eye,
  Zap,
  DollarSign,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ModelDetail {
  identifier: string;
  displayName: string;
  provider: string;
  family?: string | null;
  version?: string;
  contextWindowTokens: number;
  maxOutputTokens: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPrice?: number | null;
  capabilities: string[];
  modalities: string[];
  reasoningScore?: number;
  codingScore?: number;
  visionScore?: number;
  speedScore?: number;
  costScore?: number;
  benchmarkScores?: Record<string, number> | null;
  bestFor?: string[];
  notGoodFor?: string[];
  status?: string;
  sourceUrl?: string | null;
  usage?: {
    totalCalls?: number;
    avgLatencyMs?: number;
    totalCostUsd?: number;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatPrice(price: number): string {
  if (price === 0) return "Free";
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(2)}`;
}

function getGrade(score?: number): { label: string; color: string } {
  if (!score) return { label: "?", color: "text-muted-foreground" };
  if (score >= 90) return { label: "S", color: "text-amber-400" };
  if (score >= 80) return { label: "A", color: "text-emerald-400" };
  if (score >= 70) return { label: "B", color: "text-blue-400" };
  if (score >= 60) return { label: "C", color: "text-slate-400" };
  return { label: "D", color: "text-red-400" };
}

// ── Score Bar ──────────────────────────────────────────────────────────────

function ScoreBar({
  icon: Icon,
  label,
  score,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  score?: number;
}) {
  const grade = getGrade(score);
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <Icon className="size-3 text-muted-foreground/60" />
      <span className="text-muted-foreground w-16">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-muted/60 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score ?? 0}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="h-full rounded-full bg-primary/60"
        />
      </div>
      <span className={cn("w-5 text-right font-mono tabular-nums", grade.color)}>
        {score ?? "?"}
      </span>
      <span className={cn("w-3 text-center font-bold", grade.color)}>
        {grade.label}
      </span>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface ModelTooltipProps {
  model: ModelDetail;
  className?: string;
}

export function ModelTooltip({ model, className }: ModelTooltipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "w-[320px] p-4 rounded-2xl",
        "bg-card/95 backdrop-blur-2xl",
        "border border-border/30",
        "shadow-[0_16px_48px_-12px_rgba(0,0,0,0.15)]",
        "overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <img
          src={`https://models.dev/logos/${model.provider}.svg`}
          alt={model.provider}
          className="size-6 rounded-full ring-1 ring-border/20 dark:invert"
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{model.displayName}</div>
          <div className="text-[11px] text-muted-foreground/60 truncate">
            {model.provider}
            {model.family && ` · ${model.family}`}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/20 -mx-4 mb-3" />

      {/* Scores */}
      <div className="space-y-1.5 mb-3">
        <ScoreBar icon={Brain} label="Reasoning" score={model.reasoningScore ?? undefined} />
        <ScoreBar icon={Code2} label="Coding" score={model.codingScore ?? undefined} />
        <ScoreBar icon={Eye} label="Vision" score={model.visionScore ?? undefined} />
        <ScoreBar icon={Zap} label="Speed" score={model.speedScore ?? undefined} />
        <ScoreBar icon={DollarSign} label="Cost" score={model.costScore ?? undefined} />
      </div>

      {/* Specs */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-2 rounded-lg bg-muted/30">
          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
            Context
          </div>
          <div className="text-xs font-mono tabular-nums mt-0.5">
            {formatTokens(model.contextWindowTokens)}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-muted/30">
          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
            Max Output
          </div>
          <div className="text-xs font-mono tabular-nums mt-0.5">
            {formatTokens(model.maxOutputTokens)}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-muted/30">
          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
            Input / 1M
          </div>
          <div className="text-xs font-mono tabular-nums mt-0.5">
            {formatPrice(model.inputPricePerMillion)}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-muted/30">
          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
            Output / 1M
          </div>
          <div className="text-xs font-mono tabular-nums mt-0.5">
            {formatPrice(model.outputPricePerMillion)}
          </div>
        </div>
      </div>

      {/* Capabilities */}
      {model.capabilities.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mb-2">
          {model.capabilities.map((cap) => (
            <span
              key={cap}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-primary/5 text-primary/70 border border-primary/10"
            >
              {cap}
            </span>
          ))}
        </div>
      )}

      {/* Best For / Not Good For */}
      {model.bestFor && model.bestFor.length > 0 && (
        <div className="mb-1.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 mb-1">
            <ThumbsUp className="size-3" />
            Best for
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {model.bestFor.slice(0, 4).map((item) => (
              <span
                key={item}
                className="px-1.5 py-0.5 rounded-md text-[10px] bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {model.notGoodFor && model.notGoodFor.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 mb-1">
            <ThumbsDown className="size-3" />
            Not great for
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {model.notGoodFor.slice(0, 3).map((item) => (
              <span
                key={item}
                className="px-1.5 py-0.5 rounded-md text-[10px] bg-red-500/5 text-red-600 dark:text-red-400 border border-red-500/10"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Benchmark Scores */}
      {model.benchmarkScores && Object.keys(model.benchmarkScores).length > 0 && (
        <>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 mb-1">
            <BookOpen className="size-3" />
            Benchmarks
          </div>
          <div className="grid grid-cols-3 gap-1 mb-2">
            {Object.entries(model.benchmarkScores).slice(0, 6).map(([key, val]) => (
              <div key={key} className="p-1.5 rounded-md bg-muted/20 text-center">
                <div className="text-[9px] text-muted-foreground/50 uppercase truncate">
                  {key}
                </div>
                <div className="text-[11px] font-mono font-medium tabular-nums">
                  {val}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Usage Stats + Source */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
        {model.usage && model.usage.totalCalls ? (
          <span>
            {model.usage.totalCalls} calls · {model.usage.avgLatencyMs ?? 0}ms avg
          </span>
        ) : (
          <span>No recent usage</span>
        )}
        {model.sourceUrl && (
          <a
            href={model.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 hover:text-foreground/60 transition-colors"
          >
            Docs <ExternalLink className="size-2.5" />
          </a>
        )}
      </div>
    </motion.div>
  );
}
