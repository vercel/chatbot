"use client";

import { cn } from "@/lib/utils";

/**
 * Badge field renderer — status badge with dot indicator.
 */
export function BadgeField({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const statusColors: Record<string, string> = {
    success: "bg-emerald-500",
    completed: "bg-emerald-500",
    active: "bg-emerald-500",
    connected: "bg-emerald-500",
    pending: "bg-amber-500",
    processing: "bg-blue-500",
    failed: "bg-red-500",
    error: "bg-red-500",
    disconnected: "bg-gray-500",
    unknown: "bg-gray-500",
  };

  const dotColor = statusColors[value.toLowerCase()] || statusColors.unknown;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-white/70", className)}>
      <span className={`size-1.5 rounded-full ${dotColor}`} />
      {value}
    </span>
  );
}
