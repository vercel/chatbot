"use client";

/**
 * Phase 23A: Agent Avatar Stack — mini overlapping provider logos
 *
 * Shows a compact row of overlapping colored dots/initials for each agent.
 * Reused in panel preset cards and deliberation view.
 */

import type { AgentModel, JudgeModel } from "@/lib/ai/fusion/types";
import { cn } from "@/lib/utils";

interface AgentAvatarStackProps {
  agents: AgentModel[];
  judge: JudgeModel;
  size?: "sm" | "md";
  showJudge?: boolean;
  className?: string;
}

const PROVIDER_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  deepseek: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  moonshotai: {
    bg: "bg-violet-100 dark:bg-violet-900/40",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-800",
  },
  zai: {
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  alibaba: {
    bg: "bg-orange-100 dark:bg-orange-900/40",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
  },
  anthropic: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  google: {
    bg: "bg-red-100 dark:bg-red-900/40",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
  },
};

const FALLBACK_COLOR = {
  bg: "bg-gray-100 dark:bg-gray-800",
  text: "text-gray-600 dark:text-gray-400",
  border: "border-gray-200 dark:border-gray-700",
};

function getProviderInitials(provider: string): string {
  const MAP: Record<string, string> = {
    deepseek: "DS",
    moonshotai: "KI",
    zai: "GL",
    alibaba: "QW",
    anthropic: "CL",
    google: "GM",
    xai: "GR",
    openai: "OA",
  };
  return MAP[provider] ?? provider.slice(0, 2).toUpperCase();
}

function AgentDot({
  modelId,
  provider,
  name,
  role,
  size,
  index,
}: AgentModel & { role: string; size: "sm" | "md"; index: number }) {
  const colors = PROVIDER_COLORS[provider] ?? FALLBACK_COLOR;
  const dim = size === "sm" ? "size-6 text-[9px]" : "size-7 text-[10px]";
  const overlap = size === "sm" ? "-ml-1.5" : "-ml-2";

  return (
    <div
      aria-label={name}
      className={cn(
        "relative flex items-center justify-center rounded-full border-2 border-background font-semibold",
        colors.bg,
        colors.text,
        dim,
        index > 0 && overlap
      )}
      style={{ zIndex: 10 - index }}
      title={`${name} (${role === "judge" ? "Judge" : "Agent"})`}
    >
      {getProviderInitials(provider)}
      {role === "judge" && (
        <span className="absolute -top-0.5 -right-0.5 flex size-2.5 items-center justify-center rounded-full bg-amber-400 text-[6px] font-bold text-amber-900 ring-1 ring-background">
          ★
        </span>
      )}
    </div>
  );
}

export function AgentAvatarStack({
  agents,
  judge,
  size = "sm",
  showJudge = true,
  className,
}: AgentAvatarStackProps) {
  const allItems: Array<AgentModel & { role: string }> = [
    ...agents.map((a) => ({ ...a, role: "agent" })),
    ...(showJudge ? [{ ...judge, role: "judge" }] : []),
  ];

  return (
    <div
      aria-label={`${agents.length} agents + judge`}
      className={cn("flex items-center", className)}
    >
      {allItems.map((item, i) => (
        <AgentDot
          key={`${item.modelId}-${i}`}
          {...item}
          index={i}
          size={size}
        />
      ))}
    </div>
  );
}
