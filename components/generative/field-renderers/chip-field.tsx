"use client";

import { cn } from "@/lib/utils";

/**
 * Chip field renderer — colored pill with text.
 */
export function ChipField({
  value,
  colors = {},
  className = "",
}: {
  value: string;
  colors?: Record<string, string>;
  className?: string;
}) {
  const colorMap: Record<string, string> = {
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    yellow: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    gray: "bg-white/5 text-white/50 border-white/10",
    ...colors,
  };

  const colorClass = colorMap[value.toLowerCase()] || colorMap.gray;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
        colorClass,
        className
      )}
    >
      {value}
    </span>
  );
}
